import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { sendSubmissionReviewNotification } from "@/lib/mailer";

type RouteContext = {
  params: Promise<{
    submissionId: string;
  }>;
};

type ReviewSubmissionRequest = {
  action?: unknown;
  rejectionReason?: unknown;
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

type RecipientRow = {
  notification_recipients: { email: string; name: string };
};

async function notifyRecipients(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  campaignId: string,
  status: "accepted" | "rejected",
  submission: { from_line?: string | null; subject_line?: string | null; body?: string | null },
  rejectionReason?: string,
) {
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("trial_name")
    .eq("id", campaignId)
    .single();

  const { data: recipients } = await supabase
    .from("campaign_notification_recipients")
    .select("notification_recipients(email, name)")
    .eq("campaign_id", campaignId);

  if (!recipients || recipients.length === 0 || !campaign) return;

  const recipientList = (recipients as unknown as RecipientRow[])
    .map((r) => r.notification_recipients)
    .filter(Boolean);

  if (recipientList.length === 0) return;

  await sendSubmissionReviewNotification({
    recipients: recipientList,
    campaignName: campaign.trial_name,
    status,
    rejectionReason,
    submission: {
      fromLine: submission.from_line ?? undefined,
      subjectLine: submission.subject_line ?? undefined,
      body: submission.body ?? undefined,
    },
  });
}

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

  const rejectionReason =
    typeof payload.rejectionReason === "string" ? payload.rejectionReason.trim() : undefined;

  const supabase = createSupabaseAdmin();

  if (payload.action === "reject") {
    const { data: submission } = await supabase
      .from("campaign_submissions")
      .select("campaign_id, from_line, subject_line, body")
      .eq("id", submissionId)
      .single();

    const { error } = await supabase
      .from("campaign_submissions")
      .update({
        status: "rejected",
        ...(rejectionReason ? { rejection_reason: rejectionReason } : {}),
      })
      .eq("id", submissionId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (submission) {
      notifyRecipients(supabase, submission.campaign_id, "rejected", submission, rejectionReason).catch(
        () => {},
      );
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

  const s = submission as SubmissionRow;

  const { count, error: countError } = await supabase
    .from("email_templates")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", s.campaign_id);

  if (countError) {
    return Response.json({ error: countError.message }, { status: 500 });
  }

  const { data: template, error: templateError } = await supabase
    .from("email_templates")
    .insert({
      campaign_id: s.campaign_id,
      position: (count || 0) + 1,
      from_line: s.from_line?.trim() ?? "",
      subject_line: s.subject_line?.trim() ?? "",
      preview_text: s.preview_text?.trim() ?? "",
      body: s.body?.trim() ?? s.notes?.trim() ?? "",
      cta: s.cta?.trim() ?? "",
      source_type: "submission",
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

  notifyRecipients(supabase, s.campaign_id, "accepted", s).catch(() => {});

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
