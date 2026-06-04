import Anthropic from "@anthropic-ai/sdk";
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
  sourceType?: "ai" | "submission";
  verified?: boolean;
};

const allowedCounts = new Set([10, 15, 20]);
const allowedActions = new Set(["batch", "regenerate", "shorten"]);
const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const toolName = "return_email_variation_templates";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "Missing ANTHROPIC_API_KEY in the server environment." },
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

  console.log(
    `[generate] request action=${action} count=${count ?? "n/a"} campaignId=${campaignId || "new"}`,
  );

  const startedAt = Date.now();

  try {
    const anthropic = new Anthropic({ apiKey });
    const claudeResponse = await anthropic.messages.create({
      model,
      max_tokens: 12000,
      system: buildSystemPrompt({ action, count }),
      messages: [
        {
          role: "user",
          content: buildUserPrompt({
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
      tools: [
        {
          name: toolName,
          description: "Return the generated clinical trial recruitment email templates.",
          input_schema: buildSchema(count),
        },
      ],
      tool_choice: {
        type: "tool",
        name: toolName,
      },
    });

    console.log(`[generate] claude responded in ${Date.now() - startedAt}ms`);

    const parsed = extractToolInput(claudeResponse);

    if (!Array.isArray(parsed.templates) || parsed.templates.length !== count) {
      return Response.json({ error: "Claude returned an unexpected template count." }, { status: 502 });
    }

    if (action === "batch") {
      if (!trialName) {
        return Response.json({ error: "Trial name is required to save a campaign." }, { status: 400 });
      }

      const savedCampaign = await saveCampaign({
        bodyCopy,
        campaignId,
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
    console.error(`[generate] failed after ${Date.now() - startedAt}ms: ${message}`);
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
- If compensation is mentioned in the source copy, make it clear and prominent without overstating it. Preserve the exact compensation amount, cap, conditions, and uncertainty.
- Highlight practical positives of participating, such as helping research, receiving study-related care or assessments, convenience, compensation, or learning more, only when supported by the source copy.
- Do not use pressure tactics, false urgency, or unsupported scarcity claims. Only mention limited availability, deadlines, or time sensitivity if they are explicitly included in the source copy.
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
  campaignId,
  fromLines,
  restrictions,
  subjectLines,
  templates,
  trialName,
}: {
  bodyCopy: string;
  campaignId: string;
  fromLines: string;
  restrictions: string;
  subjectLines: string;
  templates: EmailTemplate[];
  trialName: string;
}) {
  const supabase = createSupabaseAdmin();
  const nextCampaignId = campaignId || crypto.randomUUID();
  const publicId = toShortPublicId(nextCampaignId);

  const campaignMutation = campaignId
    ? supabase
        .from("campaigns")
        .update({
          trial_name: trialName,
          source_email: bodyCopy,
          subject_lines: subjectLines,
          from_lines: fromLines,
          restrictions,
        })
        .eq("id", campaignId)
    : supabase.from("campaigns").insert({
        id: nextCampaignId,
        public_id: publicId,
        trial_name: trialName,
        source_email: bodyCopy,
        subject_lines: subjectLines,
        from_lines: fromLines,
        restrictions,
      });

  const { data: campaign, error: campaignError } = await campaignMutation
    .select("id, public_id, trial_name")
    .single();

  if (campaignError || !campaign) {
    throw new Error(campaignError?.message || "Failed to save campaign.");
  }

  console.log(
    `[generate] campaign ${campaignId ? "updated" : "created"} id=${campaign.id} public_id=${campaign.public_id}`,
  );

  // Regenerating an existing campaign: clear the previous AI batch so we can
  // re-insert without colliding on the unique (campaign_id, position) index.
  // Accepted submissions also live here (source_type = "submission"); keep them.
  let positionOffset = 0;

  if (campaignId) {
    const { error: deleteError, count: deletedCount } = await supabase
      .from("email_templates")
      .delete({ count: "exact" })
      .eq("campaign_id", campaign.id)
      .eq("source_type", "ai");

    if (deleteError) {
      console.error(`[generate] failed to clear previous AI batch: ${deleteError.message}`);
      throw new Error(deleteError.message || "Failed to clear previous templates.");
    }

    const { data: remaining, error: remainingError } = await supabase
      .from("email_templates")
      .select("position")
      .eq("campaign_id", campaign.id)
      .order("position", { ascending: false })
      .limit(1);

    if (remainingError) {
      throw new Error(remainingError.message || "Failed to read existing template positions.");
    }

    positionOffset = remaining?.[0]?.position ?? 0;
    console.log(
      `[generate] regenerate: cleared ${deletedCount ?? 0} AI template(s); kept rows up to position ${positionOffset}; new batch starts at ${positionOffset + 1}`,
    );
  }

  const { data: savedTemplates, error: templatesError } = await supabase
    .from("email_templates")
    .insert(
      templates.map((template, index) => ({
        campaign_id: campaign.id,
        position: positionOffset + index + 1,
        from_line: template.fromLine,
        subject_line: template.subjectLine,
        preview_text: template.previewText,
        source_type: "ai",
        body: template.body,
        cta: template.cta,
        verified: false,
      })),
    )
    .select("id, from_line, subject_line, preview_text, body, cta, verified, source_type");

  if (templatesError || !savedTemplates) {
    console.error(`[generate] failed to insert ${templates.length} template(s): ${templatesError?.message}`);
    throw new Error(templatesError?.message || "Failed to save generated templates.");
  }

  console.log(
    `[generate] inserted ${savedTemplates.length} template(s) at positions ${positionOffset + 1}-${positionOffset + savedTemplates.length} for campaign ${campaign.id}`,
  );

  return {
    campaign: {
      id: campaign.id,
      publicId: campaign.public_id,
      publicPath: `/campaign/${campaign.public_id}`,
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
  source_type?: string | null;
  subject_line: string;
  verified?: boolean | null;
}) {
  return {
    id: row.id,
    body: row.body,
    cta: row.cta,
    fromLine: row.from_line,
    previewText: row.preview_text,
    sourceType: row.source_type === "submission" ? "submission" : "ai",
    subjectLine: row.subject_line,
    verified: Boolean(row.verified),
  };
}

function toShortPublicId(id: string) {
  return id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase();
}

function buildSchema(count: number): Anthropic.Messages.Tool.InputSchema {
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

function extractToolInput(responseBody: Anthropic.Messages.Message): { templates?: EmailTemplate[] } {
  for (const content of responseBody.content) {
    if (content.type === "tool_use" && content.name === toolName && isTemplateResponse(content.input)) {
      return content.input;
    }
  }

  throw new Error("Claude response did not include generated templates.");
}

function isTemplateResponse(value: unknown): value is { templates?: EmailTemplate[] } {
  if (
    typeof value === "object" &&
    value !== null &&
    "templates" in value &&
    Array.isArray(value.templates)
  ) {
    return value.templates.every(isEmailTemplate);
  }

  return false;
}
