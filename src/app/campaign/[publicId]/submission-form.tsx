"use client";

import { FormEvent, useState } from "react";

type SubmissionFormProps = {
  publicId: string;
};

function withBasePath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function SubmissionForm({ publicId }: SubmissionFormProps) {
  const [fromLine, setFromLine] = useState("");
  const [subjectLine, setSubjectLine] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState("");
  const [notes, setNotes] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitted(false);
    setSubmitting(true);

    try {
      const response = await fetch(withBasePath(`/campaign/${publicId}/submissions`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          cta,
          fromLine,
          notes,
          previewText,
          restrictions,
          subjectLine,
        }),
      });
      const payload = (await response.json()) as { ok?: true } | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Submission failed.");
      }

      setFromLine("");
      setSubjectLine("");
      setPreviewText("");
      setBody("");
      setCta("");
      setNotes("");
      setRestrictions("");
      setSubmitted(true);
      setOpen(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
            Suggest copy
          </p>
          <h2 className="text-2xl font-semibold text-[#171717]">Add new inputs</h2>
        </div>
        <button
          className="h-11 rounded-md bg-[#171717] px-5 text-sm font-bold text-white transition hover:bg-[#332d28]"
          onClick={() => setOpen((currentOpen) => !currentOpen)}
          type="button"
        >
          {open ? "Close" : "Suggest Copy +"}
        </button>
      </div>

      {submitted ? (
        <p className="mt-4 rounded-md border border-[#d7e4b8] bg-[#fbfdf5] px-4 py-3 text-sm font-medium text-[#49651e]">
          Submitted for review.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-md border border-[#efb7a8] bg-[#fffaf3] px-4 py-3 text-sm font-medium text-[#9c3527]">
          {error}
        </p>
      ) : null}

      {open ? (
        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput label="From line" onChange={setFromLine} value={fromLine} />
            <TextInput label="Subject line" onChange={setSubjectLine} value={subjectLine} />
            <TextInput label="Preview text" onChange={setPreviewText} value={previewText} />
            <TextInput label="CTA" onChange={setCta} value={cta} />
          </div>
          <TextArea label="Email body or copy notes" minRows={7} onChange={setBody} value={body} />
          <TextArea label="Extra notes" minRows={4} onChange={setNotes} value={notes} />
          <TextArea label="Restrictions or compliance comments" minRows={4} onChange={setRestrictions} value={restrictions} />
          <div className="flex justify-end">
            <button
              className="h-11 rounded-md bg-[#171717] px-5 text-sm font-bold text-white transition hover:bg-[#332d28] disabled:cursor-not-allowed disabled:bg-[#aaa39a]"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Submitting..." : "Submit for Review"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function TextInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-[#2e3645]">{label}</span>
      <input
        className="h-11 rounded-md border border-[#e3d9cf] bg-[#fffdf9] px-3 text-sm text-[#2f2a25] outline-none transition focus:border-[#171717] focus:ring-4 focus:ring-[#eadfd3]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function TextArea({
  label,
  minRows,
  onChange,
  value,
}: {
  label: string;
  minRows: number;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-[#2e3645]">{label}</span>
      <textarea
        className="w-full resize-y rounded-md border border-[#e3d9cf] bg-[#fffdf9] px-3 py-2.5 text-sm leading-6 text-[#2f2a25] outline-none transition focus:border-[#171717] focus:ring-4 focus:ring-[#eadfd3]"
        onChange={(event) => onChange(event.target.value)}
        rows={minRows}
        value={value}
      />
    </label>
  );
}
