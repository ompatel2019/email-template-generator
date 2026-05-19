import { sendNotificationEmail } from "@/lib/mailer";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    publicId: string;
  }>;
};

type SubmissionRequest =
  | { type: "fromLines"; lines: unknown }
  | { type: "subjectLines"; lines: unknown }
  | { type: "body"; body: unknown }
  | { type: "full"; fromLine?: unknown; subjectLine?: unknown; previewText?: unknown; body?: unknown; cta?: unknown };

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://goodlabgroup.com/ai/apps";

export async function POST(request: Request, { params }: RouteContext) {
  const { publicId } = await params;

  let payload: SubmissionRequest;

  try {
    payload = (await request.json()) as SubmissionRequest;
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, trial_name")
    .eq("public_id", publicId)
    .single();

  if (campaignError || !campaign) {
    return Response.json({ error: "Campaign not found." }, { status: 404 });
  }

  const campaignName = campaign.trial_name ?? "Unknown Campaign";
  const adminUrl = `${BASE_URL}/email-template-generator/${publicId}`;

  if (payload.type === "fromLines" || payload.type === "subjectLines") {
    const raw = Array.isArray(payload.lines) ? payload.lines : [];
    const lines = raw
      .map((line) => (typeof line === "string" ? line.trim() : ""))
      .filter(Boolean);

    if (lines.length === 0) {
      return Response.json({ error: "Add at least one line before submitting." }, { status: 400 });
    }

    const field = payload.type === "fromLines" ? "from_line" : "subject_line";
    const rows = lines.map((line) => ({
      campaign_id: campaign.id,
      [field]: line,
      status: "pending",
    }));

    const { error } = await supabase.from("campaign_submissions").insert(rows);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    const submissionType = payload.type === "fromLines" ? "from lines" : "subject lines";
    sendNotificationEmail({ campaignName, campaignAdminUrl: adminUrl, submissionType }).catch(
      console.error,
    );

    return Response.json({ ok: true, count: rows.length });
  }

  if (payload.type === "body") {
    const body = typeof payload.body === "string" ? payload.body.trim() : "";

    if (!body) {
      return Response.json({ error: "Add email body copy before submitting." }, { status: 400 });
    }

    const { error } = await supabase.from("campaign_submissions").insert({
      campaign_id: campaign.id,
      body,
      status: "pending",
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    sendNotificationEmail({ campaignName, campaignAdminUrl: adminUrl, submissionType: "email body" }).catch(
      console.error,
    );

    return Response.json({ ok: true, count: 1 });
  }

  if (payload.type === "full") {
    const fromLine = readText(payload.fromLine);
    const subjectLine = readText(payload.subjectLine);
    const previewText = readText(payload.previewText);
    const body = readText(payload.body);
    const cta = readText(payload.cta);

    if (!fromLine && !subjectLine && !previewText && !body && !cta) {
      return Response.json({ error: "Fill in at least one field before submitting." }, { status: 400 });
    }

    const { error } = await supabase.from("campaign_submissions").insert({
      campaign_id: campaign.id,
      from_line: fromLine,
      subject_line: subjectLine,
      preview_text: previewText,
      body,
      cta,
      status: "pending",
    });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    sendNotificationEmail({ campaignName, campaignAdminUrl: adminUrl, submissionType: "full email" }).catch(
      console.error,
    );

    return Response.json({ ok: true, count: 1 });
  }

  return Response.json({ error: "Invalid submission type." }, { status: 400 });
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
