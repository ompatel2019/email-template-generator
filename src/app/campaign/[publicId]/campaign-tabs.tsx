"use client";

import { useState } from "react";
import { CopyTemplateButton } from "../copy-template-button";
import { SubmissionForm } from "./submission-form";

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

type RejectedSubmissionRow = SubmissionRow & {
  rejection_reason: string | null;
};

type Tab = "templates" | "submissions" | "suggest";

export function CampaignTabs({
  publicId,
  templates,
  submissions,
  rejectedSubmissions,
}: {
  publicId: string;
  templates: TemplateRow[];
  submissions: SubmissionRow[];
  rejectedSubmissions: RejectedSubmissionRow[];
}) {
  const [tab, setTab] = useState<Tab>("templates");
  const [templateSubTab, setTemplateSubTab] = useState<"ai" | "submitted">("ai");
  const [submissionSubTab, setSubmissionSubTab] = useState<"in-review" | "rejected">("in-review");

  const aiTemplates = templates.filter((t) => t.source_type !== "submission");
  const submittedTemplates = templates.filter((t) => t.source_type === "submission");
  const activeTemplates = templateSubTab === "ai" ? aiTemplates : submittedTemplates;

  return (
    <div className="grid gap-5">
      <nav className="flex gap-1 rounded-lg border border-black/10 bg-white p-1.5 shadow-sm">
        <TabButton active={tab === "templates"} onClick={() => setTab("templates")}>
          Templates
          <span className={`ml-2 rounded-md px-2 py-0.5 text-xs font-bold ${tab === "templates" ? "bg-white/20" : "bg-[#f0e8df] text-[#7a6a5e]"}`}>
            {templates.length}
          </span>
        </TabButton>
        <TabButton active={tab === "submissions"} onClick={() => setTab("submissions")}>
          Submissions
          <span className={`ml-2 rounded-md px-2 py-0.5 text-xs font-bold ${tab === "submissions" ? "bg-white/20" : "bg-[#f0e8df] text-[#7a6a5e]"}`}>
            {submissions.length + rejectedSubmissions.length}
          </span>
        </TabButton>
        <TabButton active={tab === "suggest"} onClick={() => setTab("suggest")}>
          Suggest Copy
        </TabButton>
      </nav>

      {tab === "templates" ? (
        <div className="grid gap-4">
          <div className="flex gap-1 rounded-lg border border-black/10 bg-white p-1.5 shadow-sm">
            <SubTabButton active={templateSubTab === "ai"} onClick={() => setTemplateSubTab("ai")}>
              AI-Generated
              <span className={`ml-2 rounded-md px-2 py-0.5 text-xs font-bold ${templateSubTab === "ai" ? "bg-black/10" : "bg-[#f0e8df] text-[#7a6a5e]"}`}>
                {aiTemplates.length}
              </span>
            </SubTabButton>
            <SubTabButton active={templateSubTab === "submitted"} onClick={() => setTemplateSubTab("submitted")}>
              Verified Submissions
              <span className={`ml-2 rounded-md px-2 py-0.5 text-xs font-bold ${templateSubTab === "submitted" ? "bg-black/10" : "bg-[#f0e8df] text-[#7a6a5e]"}`}>
                {submittedTemplates.length}
              </span>
            </SubTabButton>
          </div>

          {activeTemplates.length === 0 ? (
            <EmptyState
              title={templateSubTab === "ai" ? "No AI-generated templates yet" : "No verified submissions yet"}
              description={templateSubTab === "ai" ? "Generated templates will appear here once approved." : "Approved submissions will appear here."}
            />
          ) : (
            <div className="grid gap-4">
              {activeTemplates.map((template, index) => (
                <TemplateCard key={template.id} template={template} templateNumber={index + 1} />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "submissions" ? (
        <div className="grid gap-4">
          <div className="flex gap-1 rounded-lg border border-black/10 bg-white p-1.5 shadow-sm">
            <SubTabButton active={submissionSubTab === "in-review"} onClick={() => setSubmissionSubTab("in-review")}>
              In Review
              <span className={`ml-2 rounded-md px-2 py-0.5 text-xs font-bold ${submissionSubTab === "in-review" ? "bg-black/10" : "bg-[#f0e8df] text-[#7a6a5e]"}`}>
                {submissions.length}
              </span>
            </SubTabButton>
            <SubTabButton active={submissionSubTab === "rejected"} onClick={() => setSubmissionSubTab("rejected")}>
              Rejected
              <span className={`ml-2 rounded-md px-2 py-0.5 text-xs font-bold ${submissionSubTab === "rejected" ? "bg-black/10" : "bg-[#f0e8df] text-[#7a6a5e]"}`}>
                {rejectedSubmissions.length}
              </span>
            </SubTabButton>
          </div>

          {submissionSubTab === "in-review" ? (
            submissions.length === 0 ? (
              <EmptyState
                title="Nothing in review yet"
                description="Submitted copy will appear here while it's waiting for approval."
              />
            ) : (
              <div className="grid gap-4">
                {submissions.map((submission, index) => (
                  <SubmissionCard
                    key={submission.id}
                    submission={submission}
                    submissionNumber={index + 1}
                  />
                ))}
              </div>
            )
          ) : rejectedSubmissions.length === 0 ? (
            <EmptyState
              title="No rejected submissions"
              description="Submissions that have been rejected will appear here."
            />
          ) : (
            <div className="grid gap-4">
              {rejectedSubmissions.map((submission, index) => (
                <RejectedCard
                  key={submission.id}
                  submission={submission}
                  submissionNumber={index + 1}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {tab === "suggest" ? <SubmissionForm publicId={publicId} /> : null}
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex flex-1 items-center justify-center rounded-md px-4 py-2.5 text-sm font-bold transition ${
        active
          ? "bg-[#171717] text-white shadow-sm"
          : "text-[#746b62] hover:bg-[#f7f2ec] hover:text-[#171717]"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function TemplateCard({
  template,
  templateNumber,
}: {
  template: TemplateRow;
  templateNumber: number;
}) {
  const metaFields = [
    { label: "From", value: template.from_line },
    { label: "Subject Line", value: template.subject_line },
    { label: "Preview", value: template.preview_text },
    { label: "CTA", value: template.cta },
  ].filter(({ value }) => Boolean(value));

  const copyParts = [
    template.from_line && `From: ${template.from_line}`,
    template.subject_line && `Subject: ${template.subject_line}`,
    template.preview_text && `Preview: ${template.preview_text}`,
    template.cta && `CTA: ${template.cta}`,
    template.body && `\n${template.body}`,
  ]
    .filter(Boolean)
    .join("\n");


  return (
    <article className="rounded-lg border border-[#e4dbd1] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#eee7df] p-5">
        <div className="flex items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
            Email {templateNumber}
          </p>
          <span className="inline-flex rounded-md bg-[#eef7df] px-2.5 py-1 text-xs font-bold text-[#49651e]">
            {template.source_type === "submission" ? "Submission" : "AI-generated"}
          </span>
        </div>
        <CopyTemplateButton text={copyParts} />
      </div>

      {metaFields.length > 0 ? (
        <dl className={`grid gap-3 p-5 text-sm ${metaFields.length > 1 ? "md:grid-cols-2" : "grid-cols-1"} ${template.body ? "border-b border-[#eee7df]" : ""}`}>
          {metaFields.map(({ label, value }) => (
            <MetaBox key={label} label={label} value={value} />
          ))}
        </dl>
      ) : null}

      {template.body ? (
        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#7a7168] mb-2">Body</p>
          <p className="whitespace-pre-wrap rounded-md bg-[#faf7f2] p-4 text-sm leading-7 text-[#302a25]">
            {template.body}
          </p>
        </div>
      ) : null}
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
  const metaFields = [
    { label: "From", value: submission.from_line },
    { label: "Subject Line", value: submission.subject_line },
    { label: "Preview", value: submission.preview_text },
    { label: "CTA", value: submission.cta },
    { label: "Restrictions", value: submission.restrictions },
  ].filter(({ value }) => Boolean(value));

  const body = submission.body || submission.notes || "";

  return (
    <article className="rounded-lg border border-[#e4dbd1] bg-white shadow-sm">
      <div className={`p-5 ${metaFields.length > 0 || body ? "border-b border-[#eee7df]" : ""}`}>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
          Submission {submissionNumber}
        </p>
      </div>

      {metaFields.length > 0 ? (
        <dl className={`grid gap-3 p-5 text-sm ${metaFields.length > 1 ? "md:grid-cols-2" : ""} ${body ? "border-b border-[#eee7df]" : ""}`}>
          {metaFields.map(({ label, value }) => (
            <MetaBox key={label} label={label} value={value!} />
          ))}
        </dl>
      ) : null}

      {body ? (
        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#7a7168] mb-2">Email Body</p>
          <p className="whitespace-pre-wrap rounded-md bg-[#faf7f2] p-4 text-sm leading-7 text-[#302a25]">
            {body}
          </p>
        </div>
      ) : null}
    </article>
  );
}

function RejectedCard({
  submission,
  submissionNumber,
}: {
  submission: RejectedSubmissionRow;
  submissionNumber: number;
}) {
  const metaFields = [
    { label: "From", value: submission.from_line },
    { label: "Subject Line", value: submission.subject_line },
    { label: "Preview", value: submission.preview_text },
    { label: "CTA", value: submission.cta },
  ].filter(({ value }) => Boolean(value));

  const body = submission.body || submission.notes || "";

  return (
    <article className="rounded-lg border border-[#e4dbd1] bg-white shadow-sm">
      <div className={`flex items-center justify-between p-5 ${metaFields.length > 0 || body || submission.rejection_reason ? "border-b border-[#eee7df]" : ""}`}>
        <div className="flex items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
            Submission {submissionNumber}
          </p>
          <span className="inline-flex rounded-md bg-[#fdecea] px-2.5 py-1 text-xs font-bold text-[#9c3527]">
            Rejected
          </span>
        </div>
      </div>

      {submission.rejection_reason ? (
        <div className="border-b border-[#eee7df] px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-[#7a7168]">Reason</p>
          <p className="mt-1 text-sm leading-6 text-[#302a25]">{submission.rejection_reason}</p>
        </div>
      ) : null}

      {metaFields.length > 0 ? (
        <dl className={`grid gap-3 p-5 text-sm ${metaFields.length > 1 ? "md:grid-cols-2" : ""} ${body ? "border-b border-[#eee7df]" : ""}`}>
          {metaFields.map(({ label, value }) => (
            <MetaBox key={label} label={label} value={value!} />
          ))}
        </dl>
      ) : null}

      {body ? (
        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-[#7a7168] mb-2">Email Body</p>
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

function SubTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex flex-1 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition ${
        active ? "bg-[#f0e8df] text-[#171717]" : "text-[#746b62] hover:bg-[#f7f2ec] hover:text-[#171717]"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#dccfc1] bg-white p-8 text-center">
      <p className="text-lg font-semibold text-[#171717]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#746b62]">{description}</p>
    </div>
  );
}
