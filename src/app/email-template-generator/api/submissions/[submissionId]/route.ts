import { createSupabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    submissionId: string;
  }>;
};

type ReviewSubmissionRequest = {
  action?: unknown;
};

type SubmissionRow = {
  body: string | null;
  campaign_id: string;
  cta: string | null;
  from_line: string | null;
  notes: string | null;
  preview_text: string | null;
  restrictions: string | null;
  subject_line: string | null;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { submissionId } = await params;

  let payload: ReviewSubmissionRequest;

  try {
    payload = (await request.json()) as ReviewSubmissionRequest;
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  if (payload.action !== "accept" && payload.action !== "reject") {
    return Response.json({ error: "action must be accept or reject." }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  if (payload.action === "reject") {
    const { error } = await supabase
      .from("campaign_submissions")
      .update({ status: "rejected" })
      .eq("id", submissionId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ submission: { id: submissionId, status: "rejected" } });
  }

  const { data: submission, error: submissionError } = await supabase
    .from("campaign_submissions")
    .select("campaign_id, from_line, subject_line, preview_text, body, cta, notes, restrictions")
    .eq("id", submissionId)
    .eq("status", "pending")
    .single();

  if (submissionError || !submission) {
    return Response.json(
      { error: submissionError?.message || "Submission not found." },
      { status: 404 },
    );
  }

  const typedSubmission = submission as SubmissionRow;
  const { count, error: countError } = await supabase
    .from("email_templates")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", typedSubmission.campaign_id);

  if (countError) {
    return Response.json({ error: countError.message }, { status: 500 });
  }

  const body = buildTemplateBody(typedSubmission);

  const { data: template, error: templateError } = await supabase
    .from("email_templates")
    .insert({
      body,
      campaign_id: typedSubmission.campaign_id,
      cta: firstText(typedSubmission.cta, "Check Your Eligibility"),
      from_line: firstText(typedSubmission.from_line, "Submitted suggestion"),
      position: (count || 0) + 1,
      preview_text: firstText(typedSubmission.preview_text, typedSubmission.notes, body.slice(0, 140)),
      source_type: "submission",
      subject_line: firstText(typedSubmission.subject_line, "Submitted email"),
      verified: true,
    })
    .select("id, from_line, subject_line, preview_text, body, cta, verified, source_type")
    .single();

  if (templateError || !template) {
    return Response.json(
      { error: templateError?.message || "Failed to create verified template." },
      { status: 500 },
    );
  }

  const { error: updateError } = await supabase
    .from("campaign_submissions")
    .update({ status: "accepted" })
    .eq("id", submissionId);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({
    submission: { id: submissionId, status: "accepted" },
    template: {
      body: template.body,
      cta: template.cta,
      fromLine: template.from_line,
      id: template.id,
      previewText: template.preview_text,
      sourceType: template.source_type === "submission" ? "submission" : "ai",
      subjectLine: template.subject_line,
      verified: Boolean(template.verified),
    },
  });
}

function firstText(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() || "";
}

function buildTemplateBody(submission: SubmissionRow) {
  const body = firstText(submission.body);

  if (body) {
    return body;
  }

  const details = [
    ["From", submission.from_line],
    ["Subject", submission.subject_line],
    ["Preview", submission.preview_text],
    ["CTA", submission.cta],
    ["Notes", submission.notes],
    ["Restrictions", submission.restrictions],
  ]
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .map(([label, value]) => `${label}: ${value?.trim()}`);

  return details.length > 0 ? details.join("\n") : "Submitted input";
}
