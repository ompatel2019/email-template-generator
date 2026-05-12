import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { CopyTemplateButton } from "../copy-template-button";
import { SubmissionForm } from "./submission-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

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
};

type SubmissionRow = {
  body: string | null;
  cta: string | null;
  from_line: string | null;
  id: string;
  notes: string | null;
  preview_text: string | null;
  restrictions: string | null;
  subject_line: string | null;
};

export default async function CampaignTemplatesPage({ params }: PageProps) {
  const { publicId } = await params;
  const supabase = createSupabaseAdmin();

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, trial_name")
    .eq("public_id", publicId)
    .single();

  if (campaignError || !campaign) {
    notFound();
  }

  const { data: templates, error: templatesError } = await supabase
    .from("email_templates")
    .select("id, from_line, subject_line, preview_text, body, cta, source_type")
    .eq("campaign_id", campaign.id)
    .eq("verified", true)
    .order("created_at", { ascending: true });

  if (templatesError || !templates) {
    throw new Error(templatesError?.message || "Failed to load templates.");
  }

  const { data: submissions, error: submissionsError } = await supabase
    .from("campaign_submissions")
    .select("id, from_line, subject_line, preview_text, body, cta, notes, restrictions")
    .eq("campaign_id", campaign.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (submissionsError || !submissions) {
    throw new Error(submissionsError?.message || "Failed to load submissions.");
  }

  return (
    <main className="min-h-screen bg-[#f5f1ea] px-4 py-6 text-[#171717] sm:px-6 lg:px-8">
      <section className="mx-auto grid w-full max-w-5xl gap-5">
        <header className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
            Copyable email templates
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {campaign.trial_name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#665e56]">
            Review and copy the generated templates below.
          </p>
        </header>

        <SubmissionForm publicId={publicId} />

        {templates.length === 0 && submissions.length === 0 ? (
          <section className="rounded-lg border border-dashed border-[#dccfc1] bg-white p-6">
            <p className="text-lg font-semibold text-[#171717]">No templates yet</p>
            <p className="mt-2 text-sm leading-6 text-[#746b62]">
              Verified templates and pending submissions will appear here.
            </p>
          </section>
        ) : (
          <div className="grid gap-4">
            {templates.map((template: TemplateRow, index) => (
              <TemplateCard key={template.id} template={template} templateNumber={index + 1} />
            ))}
            {(submissions as SubmissionRow[]).map((submission, index) => (
              <SubmissionCard
                key={submission.id}
                submission={submission}
                submissionNumber={templates.length + index + 1}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function TemplateCard({
  template,
  templateNumber,
}: {
  template: TemplateRow;
  templateNumber: number;
}) {
  const fullTemplate = `From: ${template.from_line}
Subject: ${template.subject_line}
Preview: ${template.preview_text}
CTA: ${template.cta}

${template.body}`;

  return (
    <article className="rounded-lg border border-[#e4dbd1] bg-white shadow-sm">
      <div className="grid gap-4 border-b border-[#eee7df] p-5 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
            Email {templateNumber}
          </p>
          <span className="mt-2 inline-flex rounded-md bg-[#eef7df] px-2.5 py-1 text-xs font-bold text-[#49651e]">
            {template.source_type === "submission" ? "Submission" : "AI-generated"}
          </span>
          <h2 className="mt-2 text-2xl font-semibold leading-8">{template.subject_line}</h2>
        </div>
        <CopyTemplateButton text={fullTemplate} />
      </div>

      <dl className="grid gap-3 border-b border-[#eee7df] p-5 text-sm md:grid-cols-3">
        <MetaBox label="From" value={template.from_line} />
        <MetaBox label="Preview" value={template.preview_text} />
        <MetaBox label="CTA" value={template.cta} />
      </dl>

      <div className="p-5">
        <p className="whitespace-pre-wrap rounded-md bg-[#faf7f2] p-4 text-sm leading-7 text-[#302a25]">
          {template.body}
        </p>
      </div>
    </article>
  );
}

function SubmissionCard({
  submission,
  submissionNumber,
}: {
  submission: SubmissionRow;
  submissionNumber: number;
}) {
  const body = submission.body || submission.notes || submission.restrictions || "";

  return (
    <article className="rounded-lg border border-[#e4dbd1] bg-white shadow-sm">
      <div className="grid gap-4 border-b border-[#eee7df] p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
            Submission {submissionNumber}
          </p>
          <span className="mt-2 inline-flex rounded-md bg-[#eef7df] px-2.5 py-1 text-xs font-bold text-[#49651e]">
            Submission
          </span>
          <h2 className="mt-2 text-2xl font-semibold leading-8">
            {submission.subject_line || "No subject line provided"}
          </h2>
        </div>
      </div>

      <dl className="grid gap-3 border-b border-[#eee7df] p-5 text-sm md:grid-cols-3">
        <MetaBox label="From" value={submission.from_line || "Not provided"} />
        <MetaBox label="Preview" value={submission.preview_text || "Not provided"} />
        <MetaBox label="CTA" value={submission.cta || "Not provided"} />
      </dl>

      {body ? (
        <div className="p-5">
          <p className="whitespace-pre-wrap rounded-md bg-[#faf7f2] p-4 text-sm leading-7 text-[#302a25]">
            {body}
          </p>
        </div>
      ) : null}
    </article>
  );
}

function MetaBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e3d9cf] bg-white px-3 py-2.5">
      <dt className="text-xs font-bold uppercase tracking-wide text-[#7a7168]">{label}</dt>
      <dd className="mt-1.5 font-medium leading-snug text-[#302a25]">{value}</dd>
    </div>
  );
}
