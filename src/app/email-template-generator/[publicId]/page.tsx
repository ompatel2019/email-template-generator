import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import CampaignBuilder, { type InitialCampaign } from "../campaign-builder";

type PageProps = {
  params: Promise<{
    publicId: string;
  }>;
};

type TemplateRow = {
  body: string;
  cta: string;
  from_line: string;
  id: string;
  preview_text: string;
  source_type: string | null;
  subject_line: string;
  verified: boolean | null;
};

type SubmissionRow = {
  body: string | null;
  created_at: string;
  cta: string | null;
  from_line: string | null;
  id: string;
  notes: string | null;
  preview_text: string | null;
  restrictions: string | null;
  subject_line: string | null;
};

export default async function EditCampaignPage({ params }: PageProps) {
  const { publicId } = await params;
  const supabase = createSupabaseAdmin();

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, public_id, trial_name, source_email, subject_lines, from_lines, restrictions")
    .eq("public_id", publicId)
    .single();

  if (campaignError || !campaign) {
    notFound();
  }

  const { data: templates, error: templatesError } = await supabase
    .from("email_templates")
    .select("id, from_line, subject_line, preview_text, body, cta, verified, source_type")
    .eq("campaign_id", campaign.id)
    .order("created_at", { ascending: true });

  if (templatesError || !templates) {
    throw new Error(templatesError?.message || "Failed to load templates.");
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("campaign_submissions")
    .select("id, from_line, subject_line, preview_text, body, cta, notes, restrictions, created_at")
    .eq("campaign_id", campaign.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (submissionsError || !submissions) {
    throw new Error(submissionsError?.message || "Failed to load submissions.");
  }

  const { data: recipientRows } = await supabase
    .from("campaign_notification_recipients")
    .select("notification_recipients(id, email, name)")
    .eq("campaign_id", campaign.id);

  type RecipientJoinRow = { notification_recipients: { id: string; email: string; name: string } };
  const notificationRecipients = ((recipientRows ?? []) as unknown as RecipientJoinRow[])
    .map((row) => row.notification_recipients)
    .filter(Boolean);

  const initialCampaign: InitialCampaign = {
    bodyCopy: campaign.source_email,
    fromLines: campaign.from_lines,
    id: campaign.id,
    notificationRecipients,
    publicId: campaign.public_id,
    publicPath: `/campaign/${campaign.public_id}`,
    restrictions: campaign.restrictions,
    subjectLines: campaign.subject_lines,
    submissions: (submissions as SubmissionRow[]).map((submission) => ({
      body: submission.body || "",
      createdAt: submission.created_at,
      cta: submission.cta || "",
      fromLine: submission.from_line || "",
      id: submission.id,
      notes: submission.notes || "",
      previewText: submission.preview_text || "",
      restrictions: submission.restrictions || "",
      subjectLine: submission.subject_line || "",
    })),
    templates: (templates as TemplateRow[]).map((template) => ({
      body: template.body,
      cta: template.cta,
      fromLine: template.from_line,
      id: template.id,
      previewText: template.preview_text,
      sourceType: template.source_type === "submission" ? "submission" : "ai",
      subjectLine: template.subject_line,
      verified: Boolean(template.verified),
    })),
    trialName: campaign.trial_name,
  };

  return <CampaignBuilder key={campaign.public_id} initialCampaign={initialCampaign} />;
}
