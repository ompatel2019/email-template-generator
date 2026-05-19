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

type SectionState = {
  open: boolean;
  value: string;
  submitting: boolean;
  submitted: boolean;
  error: string;
};

type FullEmailState = {
  open: boolean;
  fromLine: string;
  subjectLine: string;
  previewText: string;
  body: string;
  cta: string;
  submitting: boolean;
  submitted: boolean;
  error: string;
};

function useSectionState(): [SectionState, (patch: Partial<SectionState>) => void] {
  const [state, setState] = useState<SectionState>({
    open: false,
    value: "",
    submitting: false,
    submitted: false,
    error: "",
  });

  function patch(update: Partial<SectionState>) {
    setState((current) => ({ ...current, ...update }));
  }

  return [state, patch];
}

export function SubmissionForm({ publicId }: SubmissionFormProps) {
  const [fromLines, setFromLines] = useSectionState();
  const [subjectLines, setSubjectLines] = useSectionState();
  const [emailBody, setEmailBody] = useSectionState();
  const [fullEmail, setFullEmail] = useState<FullEmailState>({
    open: false,
    fromLine: "",
    subjectLine: "",
    previewText: "",
    body: "",
    cta: "",
    submitting: false,
    submitted: false,
    error: "",
  });

  function patchFullEmail(update: Partial<FullEmailState>) {
    setFullEmail((current) => ({ ...current, ...update }));
  }

  async function handleFromLinesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFromLines({ error: "", submitted: false, submitting: true });

    const lines = fromLines.value
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    try {
      const response = await fetch(withBasePath(`/campaign/${publicId}/submissions`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "fromLines", lines }),
      });
      const payload = (await response.json()) as { ok?: true; count?: number } | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Submission failed.");
      }

      setFromLines({ value: "", submitted: true, open: false });
    } catch (err) {
      setFromLines({ error: err instanceof Error ? err.message : "Submission failed." });
    } finally {
      setFromLines({ submitting: false });
    }
  }

  async function handleSubjectLinesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubjectLines({ error: "", submitted: false, submitting: true });

    const lines = subjectLines.value
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    try {
      const response = await fetch(withBasePath(`/campaign/${publicId}/submissions`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "subjectLines", lines }),
      });
      const payload = (await response.json()) as { ok?: true; count?: number } | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Submission failed.");
      }

      setSubjectLines({ value: "", submitted: true, open: false });
    } catch (err) {
      setSubjectLines({ error: err instanceof Error ? err.message : "Submission failed." });
    } finally {
      setSubjectLines({ submitting: false });
    }
  }

  async function handleEmailBodySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailBody({ error: "", submitted: false, submitting: true });

    try {
      const response = await fetch(withBasePath(`/campaign/${publicId}/submissions`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "body", body: emailBody.value }),
      });
      const payload = (await response.json()) as { ok?: true } | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Submission failed.");
      }

      setEmailBody({ value: "", submitted: true, open: false });
    } catch (err) {
      setEmailBody({ error: err instanceof Error ? err.message : "Submission failed." });
    } finally {
      setEmailBody({ submitting: false });
    }
  }

  async function handleFullEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    patchFullEmail({ error: "", submitted: false, submitting: true });

    try {
      const response = await fetch(withBasePath(`/campaign/${publicId}/submissions`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "full",
          fromLine: fullEmail.fromLine,
          subjectLine: fullEmail.subjectLine,
          previewText: fullEmail.previewText,
          body: fullEmail.body,
          cta: fullEmail.cta,
        }),
      });
      const payload = (await response.json()) as { ok?: true } | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Submission failed.");
      }

      patchFullEmail({
        fromLine: "",
        subjectLine: "",
        previewText: "",
        body: "",
        cta: "",
        submitted: true,
        open: false,
      });
    } catch (err) {
      patchFullEmail({ error: err instanceof Error ? err.message : "Submission failed." });
    } finally {
      patchFullEmail({ submitting: false });
    }
  }

  const fullEmailHasValue = [
    fullEmail.fromLine,
    fullEmail.subjectLine,
    fullEmail.previewText,
    fullEmail.body,
    fullEmail.cta,
  ].some((v) => v.trim().length > 0);

  return (
    <section className="grid gap-4">
      <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
          Suggest copy
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-[#171717]">Add new inputs</h2>
        <p className="mt-1 text-sm leading-6 text-[#665e56]">
          Submit from lines, subject lines, email body, or a full email for review.
        </p>
      </div>

      <BulkSection
        description="Paste sender names, one per line."
        error={fromLines.error}
        label="From Lines"
        onClose={() => setFromLines({ open: false })}
        onOpen={() => setFromLines({ open: true, submitted: false, error: "" })}
        onSubmit={handleFromLinesSubmit}
        onChange={(value) => setFromLines({ value })}
        open={fromLines.open}
        placeholder=""
        submitted={fromLines.submitted}
        submitting={fromLines.submitting}
        successMessage="From lines submitted for review."
        value={fromLines.value}
      />

      <BulkSection
        description="Paste subject lines, one per line."
        error={subjectLines.error}
        label="Subject Lines"
        onClose={() => setSubjectLines({ open: false })}
        onOpen={() => setSubjectLines({ open: true, submitted: false, error: "" })}
        onSubmit={handleSubjectLinesSubmit}
        onChange={(value) => setSubjectLines({ value })}
        open={subjectLines.open}
        placeholder=""
        submitted={subjectLines.submitted}
        submitting={subjectLines.submitting}
        successMessage="Subject lines submitted for review."
        value={subjectLines.value}
      />

      <BulkSection
        description="Paste the email body or copy notes."
        error={emailBody.error}
        label="Email Body"
        onClose={() => setEmailBody({ open: false })}
        onOpen={() => setEmailBody({ open: true, submitted: false, error: "" })}
        onSubmit={handleEmailBodySubmit}
        onChange={(value) => setEmailBody({ value })}
        open={emailBody.open}
        placeholder=""
        submitted={emailBody.submitted}
        submitting={emailBody.submitting}
        successMessage="Email body submitted for review."
        value={emailBody.value}
      />

      {/* Full Email Section */}
      <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#171717]">Full Email</h3>
            <p className="mt-0.5 text-sm text-[#665e56]">Fill in only the fields you want to submit.</p>
          </div>
          <button
            className="h-11 rounded-md bg-[#171717] px-5 text-sm font-bold text-white transition hover:bg-[#332d28]"
            onClick={() =>
              patchFullEmail(
                fullEmail.open
                  ? { open: false }
                  : { open: true, submitted: false, error: "" },
              )
            }
            type="button"
          >
            {fullEmail.open ? "Close" : "Add Full Email +"}
          </button>
        </div>

        {fullEmail.submitted ? (
          <p className="mt-4 rounded-md border border-[#d7e4b8] bg-[#fbfdf5] px-4 py-3 text-sm font-medium text-[#49651e]">
            Full email submitted for review.
          </p>
        ) : null}

        {fullEmail.error ? (
          <p className="mt-4 rounded-md border border-[#efb7a8] bg-[#fffaf3] px-4 py-3 text-sm font-medium text-[#9c3527]">
            {fullEmail.error}
          </p>
        ) : null}

        {fullEmail.open ? (
          <form className="mt-5 grid gap-4" onSubmit={handleFullEmailSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label="From line"
                onChange={(v) => patchFullEmail({ fromLine: v })}
                value={fullEmail.fromLine}
              />
              <TextInput
                label="Subject line"
                onChange={(v) => patchFullEmail({ subjectLine: v })}
                value={fullEmail.subjectLine}
              />
              <TextInput
                label="Preview text"
                onChange={(v) => patchFullEmail({ previewText: v })}
                value={fullEmail.previewText}
              />
              <TextInput
                label="CTA"
                onChange={(v) => patchFullEmail({ cta: v })}
                value={fullEmail.cta}
              />
            </div>
            <TextArea
              label="Email body"
              minRows={6}
              onChange={(v) => patchFullEmail({ body: v })}
              value={fullEmail.body}
            />
            <div className="flex justify-end">
              <button
                className="h-11 rounded-md bg-[#171717] px-5 text-sm font-bold text-white transition hover:bg-[#332d28] disabled:cursor-not-allowed disabled:bg-[#aaa39a]"
                disabled={fullEmail.submitting || !fullEmailHasValue}
                type="submit"
              >
                {fullEmail.submitting ? "Submitting..." : "Submit for Review"}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </section>
  );
}

function BulkSection({
  description,
  error,
  label,
  onChange,
  onClose,
  onOpen,
  onSubmit,
  open,
  placeholder,
  submitted,
  submitting,
  successMessage,
  value,
}: {
  description: string;
  error: string;
  label: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onOpen: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  open: boolean;
  placeholder: string;
  submitted: boolean;
  submitting: boolean;
  successMessage: string;
  value: string;
}) {
  const lineCount = value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean).length;

  return (
    <section className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#171717]">{label}</h3>
          <p className="mt-0.5 text-sm text-[#665e56]">{description}</p>
        </div>
        <button
          className="h-11 rounded-md bg-[#171717] px-5 text-sm font-bold text-white transition hover:bg-[#332d28]"
          onClick={open ? onClose : onOpen}
          type="button"
        >
          {open ? "Close" : `Add ${label} +`}
        </button>
      </div>

      {submitted ? (
        <p className="mt-4 rounded-md border border-[#d7e4b8] bg-[#fbfdf5] px-4 py-3 text-sm font-medium text-[#49651e]">
          {successMessage}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-md border border-[#efb7a8] bg-[#fffaf3] px-4 py-3 text-sm font-medium text-[#9c3527]">
          {error}
        </p>
      ) : null}

      {open ? (
        <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2">
            <span className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[#2e3645]">{label}</span>
              {lineCount > 0 ? (
                <span className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-[#7a7168] ring-1 ring-[#e3d9cf]">
                  {lineCount} {lineCount === 1 ? "line" : "lines"}
                </span>
              ) : null}
            </span>
            <textarea
              className="w-full resize-y rounded-md border border-[#e3d9cf] bg-[#fffdf9] px-3 py-2.5 text-sm leading-6 text-[#2f2a25] outline-none transition placeholder:text-[#a69b90] focus:border-[#171717] focus:ring-4 focus:ring-[#eadfd3]"
              onChange={(event) => onChange(event.target.value)}
              placeholder={placeholder}
              rows={6}
              value={value}
            />
          </label>
          <div className="flex justify-end">
            <button
              className="h-11 rounded-md bg-[#171717] px-5 text-sm font-bold text-white transition hover:bg-[#332d28] disabled:cursor-not-allowed disabled:bg-[#aaa39a]"
              disabled={submitting || lineCount === 0}
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
