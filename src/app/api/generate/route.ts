import { createSupabaseAdmin } from "@/lib/supabase-admin";

type GenerateRequest = {
  action?: unknown;
  bodyCopy?: unknown;
  campaignId?: unknown;
  existingTemplate?: unknown;
  fromLines?: unknown;
  templateId?: unknown;
  trialName?: unknown;
  subjectLines?: unknown;
  restrictions?: unknown;
  count?: unknown;
};

type EmailTemplate = {
  id?: string;
  fromLine: string;
  subjectLine: string;
  previewText: string;
  body: string;
  cta: string;
};

const allowedCounts = new Set([10, 15, 20]);
const allowedActions = new Set(["batch", "regenerate", "shorten"]);
const model = process.env.OPENAI_MODEL || "gpt-5.2";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "Missing OPENAI_API_KEY in the server environment." },
      { status: 500 },
    );
  }

  let payload: GenerateRequest;

  try {
    payload = (await request.json()) as GenerateRequest;
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const bodyCopy = readText(payload.bodyCopy);
  const action = readOption(payload.action, allowedActions) || "batch";
  const campaignId = readText(payload.campaignId);
  const fromLines = readText(payload.fromLines);
  const templateId = readText(payload.templateId);
  const trialName = readText(payload.trialName);
  const subjectLines = readText(payload.subjectLines);
  const restrictions = readText(payload.restrictions);
  const count =
    action === "batch" && typeof payload.count === "number" && allowedCounts.has(payload.count)
      ? payload.count
      : action !== "batch"
        ? 1
        : null;
  const existingTemplate = isEmailTemplate(payload.existingTemplate) ? payload.existingTemplate : null;

  if (!bodyCopy || !fromLines || !subjectLines || !restrictions || !count) {
    return Response.json(
      { error: "Body copy, from lines, subject lines, restrictions, and count are required." },
      { status: 400 },
    );
  }

  if (action !== "batch" && !existingTemplate) {
    return Response.json({ error: "An existing template is required for this action." }, { status: 400 });
  }

  try {
    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: buildSystemPrompt({ action, count }),
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildUserPrompt({
                  action,
                  bodyCopy,
                  count,
                  existingTemplate,
                  fromLines,
                  restrictions,
                  subjectLines,
                }),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "email_variation_templates",
            strict: true,
            schema: buildSchema(count),
          },
        },
      }),
    });

    const responseBody = await openAIResponse.json();

    if (!openAIResponse.ok) {
      const message =
        typeof responseBody?.error?.message === "string"
          ? responseBody.error.message
          : "OpenAI request failed.";

      return Response.json({ error: message }, { status: openAIResponse.status });
    }

    const rawText = extractOutputText(responseBody);
    const parsed = JSON.parse(rawText) as { templates?: EmailTemplate[] };

    if (!Array.isArray(parsed.templates) || parsed.templates.length !== count) {
      return Response.json({ error: "OpenAI returned an unexpected template count." }, { status: 502 });
    }

    if (action === "batch") {
      if (!trialName) {
        return Response.json({ error: "Trial name is required to save a campaign." }, { status: 400 });
      }

      const savedCampaign = await saveCampaign({
        bodyCopy,
        fromLines,
        restrictions,
        subjectLines,
        templates: parsed.templates,
        trialName,
      });

      return Response.json(savedCampaign);
    }

    if (campaignId && templateId) {
      const [template] = parsed.templates;
      const savedTemplate = await updateTemplate(templateId, template);

      return Response.json({
        campaign: {
          id: campaignId,
        },
        templates: [savedTemplate],
      });
    }

    return Response.json({ templates: parsed.templates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected generation error.";
    return Response.json({ error: message }, { status: 500 });
  }
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOption(value: unknown, allowed: Set<string>) {
  return typeof value === "string" && allowed.has(value) ? value : "";
}

function isEmailTemplate(value: unknown): value is EmailTemplate {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const maybeTemplate = value as Partial<Record<keyof EmailTemplate, unknown>>;

  return (
    typeof maybeTemplate.fromLine === "string" &&
    typeof maybeTemplate.subjectLine === "string" &&
    typeof maybeTemplate.previewText === "string" &&
    typeof maybeTemplate.body === "string" &&
    typeof maybeTemplate.cta === "string"
  );
}

function buildSystemPrompt({
  action,
  count,
}: {
  action: string;
  count: number;
}) {
  return `You generate compliant email copy variations for clinical trial recruitment campaigns.

Return exactly ${count} complete email templates.

Requested action: ${actionInstruction(action)}

Rules:
- Treat the user's Restrictions as hard rules. Never reinterpret them loosely.
- Preserve fixed facts from the source copy, including compensation caps, eligibility ranges, trial condition, and investigational wording.
- Do not promise qualification, enrollment, treatment benefit, cure, payment, or medication approval.
- Use clear consumer email language. Keep each body concise and ready to paste into an email platform.
- Vary subject lines, from lines, preview text, body framing, and CTA wording while staying faithful to the provided copy.
- Do not use em dashes in any generated field. Use commas, periods, colons, semicolons, or parentheses instead.
- Do not include markdown, numbering, commentary, or compliance explanations inside the generated fields.`;
}

function buildUserPrompt({
  action,
  bodyCopy,
  count,
  existingTemplate,
  fromLines,
  restrictions,
  subjectLines,
}: {
  action: string;
  bodyCopy: string;
  count: number;
  existingTemplate: EmailTemplate | null;
  fromLines: string;
  restrictions: string;
  subjectLines: string;
}) {
  const existingTemplateText = existingTemplate
    ? `
Existing Template To Revise:
From: ${existingTemplate.fromLine}
Subject: ${existingTemplate.subjectLine}
Preview: ${existingTemplate.previewText}
CTA: ${existingTemplate.cta}
Body:
${existingTemplate.body}
`
    : "";

  return `Generate ${count} complete email templates from these inputs.

Action: ${action}
${existingTemplateText}

Body Copy:
${bodyCopy}

From Lines:
${fromLines}

Subject Lines:
${subjectLines}

Restrictions:
${restrictions}`;
}

function actionInstruction(action: string) {
  switch (action) {
    case "regenerate":
      return "Create one fresh alternative to the existing template. Keep the same locked facts but change the phrasing meaningfully.";
    case "shorten":
      return "Create one shorter version of the existing template. Preserve all required facts and restrictions.";
    default:
      return "Create a full batch of distinct templates.";
  }
}

async function saveCampaign({
  bodyCopy,
  fromLines,
  restrictions,
  subjectLines,
  templates,
  trialName,
}: {
  bodyCopy: string;
  fromLines: string;
  restrictions: string;
  subjectLines: string;
  templates: EmailTemplate[];
  trialName: string;
}) {
  const supabase = createSupabaseAdmin();
  const publicId = `${slugify(trialName)}-${crypto.randomUUID().slice(0, 8)}`;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      public_id: publicId,
      trial_name: trialName,
      source_email: bodyCopy,
      subject_lines: subjectLines,
      from_lines: fromLines,
      restrictions,
    })
    .select("id, public_id, trial_name")
    .single();

  if (campaignError || !campaign) {
    throw new Error(campaignError?.message || "Failed to save campaign.");
  }

  const { data: savedTemplates, error: templatesError } = await supabase
    .from("email_templates")
    .insert(
      templates.map((template, index) => ({
        campaign_id: campaign.id,
        position: index + 1,
        from_line: template.fromLine,
        subject_line: template.subjectLine,
        preview_text: template.previewText,
        body: template.body,
        cta: template.cta,
      })),
    )
    .select("id, from_line, subject_line, preview_text, body, cta");

  if (templatesError || !savedTemplates) {
    throw new Error(templatesError?.message || "Failed to save generated templates.");
  }

  return {
    campaign: {
      id: campaign.id,
      publicId: campaign.public_id,
      publicPath: `/campaigns/${campaign.public_id}`,
      trialName: campaign.trial_name,
    },
    templates: savedTemplates.map(mapTemplateRow),
  };
}

async function updateTemplate(templateId: string, template: EmailTemplate) {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("email_templates")
    .update({
      from_line: template.fromLine,
      subject_line: template.subjectLine,
      preview_text: template.previewText,
      body: template.body,
      cta: template.cta,
    })
    .eq("id", templateId)
    .select("id, from_line, subject_line, preview_text, body, cta")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update template.");
  }

  return mapTemplateRow(data);
}

function mapTemplateRow(row: {
  body: string;
  cta: string;
  from_line: string;
  id: string;
  preview_text: string;
  subject_line: string;
}) {
  return {
    id: row.id,
    body: row.body,
    cta: row.cta,
    fromLine: row.from_line,
    previewText: row.preview_text,
    subjectLine: row.subject_line,
  };
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "campaign";
}

function buildSchema(count: number) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["templates"],
    properties: {
      templates: {
        type: "array",
        minItems: count,
        maxItems: count,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["fromLine", "subjectLine", "previewText", "body", "cta"],
          properties: {
            fromLine: { type: "string", minLength: 1 },
            subjectLine: { type: "string", minLength: 1 },
            previewText: { type: "string", minLength: 1 },
            body: { type: "string", minLength: 1 },
            cta: { type: "string", minLength: 1 },
          },
        },
      },
    },
  };
}

function extractOutputText(responseBody: unknown) {
  if (
    typeof responseBody === "object" &&
    responseBody !== null &&
    "output_text" in responseBody &&
    typeof responseBody.output_text === "string"
  ) {
    return responseBody.output_text;
  }

  if (
    typeof responseBody === "object" &&
    responseBody !== null &&
    "output" in responseBody &&
    Array.isArray(responseBody.output)
  ) {
    const text = responseBody.output
      .flatMap((item) =>
        typeof item === "object" && item !== null && "content" in item && Array.isArray(item.content)
          ? item.content
          : [],
      )
      .map((content) =>
        typeof content === "object" && content !== null && "text" in content && typeof content.text === "string"
          ? content.text
          : "",
      )
      .join("");

    if (text) {
      return text;
    }
  }

  throw new Error("OpenAI response did not include output text.");
}
