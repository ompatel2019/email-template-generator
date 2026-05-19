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

type Tab = "templates" | "submissions" | "suggest";

export function CampaignTabs({
  publicId,
  templates,
  submissions,
}: {
  publicId: string;
  templates: TemplateRow[];
  submissions: SubmissionRow[];
}) {
  const [tab, setTab] = useState<Tab>("templates");

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
          In Review
          <span className={`ml-2 rounded-md px-2 py-0.5 text-xs font-bold ${tab === "submissions" ? "bg-white/20" : "bg-[#f0e8df] text-[#7a6a5e]"}`}>
            {submissions.length}
          </span>
        </TabButton>
        <TabButton active={tab === "suggest"} onClick={() => setTab("suggest")}>
          Suggest Copy
        </TabButton>
      </nav>

      {tab === "templates" ? (
        templates.length === 0 ? (
          <EmptyState
            title="No verified templates yet"
            description="Templates will appear here once they've been reviewed and approved."
          />
        ) : (
          <div className="grid gap-4">
            {templates.map((template, index) => (
              <TemplateCard key={template.id} template={template} templateNumber={index + 1} />
            ))}
          </div>
        )
      ) : null}

      {tab === "submissions" ? (
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

  const title =
    template.subject_line ||
    template.from_line ||
    (template.body ? template.body.slice(0, 60) + (template.body.length > 60 ? "…" : "") : null) ||
    "Verified template";

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
          <h2 className="mt-2 text-2xl font-semibold leading-8">{title}</h2>
        </div>
        <CopyTemplateButton text={copyParts} />
      </div>

      {metaFields.length > 0 ? (
        <dl className={`grid gap-3 p-5 text-sm ${metaFields.length > 1 ? "md:grid-cols-3" : ""} ${template.body ? "border-b border-[#eee7df]" : ""}`}>
          {metaFields.map(({ label, value }) => (
            <MetaBox key={label} label={label} value={value} />
          ))}
        </dl>
      ) : null}

      {template.body ? (
        <div className="p-5">
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

function MetaBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e3d9cf] bg-white px-3 py-2.5">
      <dt className="text-xs font-bold uppercase tracking-wide text-[#7a7168]">{label}</dt>
      <dd className="mt-1.5 font-medium leading-snug text-[#302a25]">{value}</dd>
    </div>
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
