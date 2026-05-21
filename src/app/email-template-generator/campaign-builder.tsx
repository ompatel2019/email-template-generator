"use client";

import { Check, Copy, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type CountOption = 10 | 15 | 20;
type AppScreen = "dashboard" | "new" | "builder";
type ReviewTab = "verified" | "unverified";
type UnverifiedTab = "ai" | "submissions";
type TemplateSource = "ai" | "submission";

type EmailTemplate = {
  id?: string;
  fromLine: string;
  subjectLine: string;
  previewText: string;
  body: string;
  cta: string;
  sourceType?: TemplateSource;
  verified?: boolean;
};

type CampaignSubmission = {
  body: string;
  createdAt: string;
  cta: string;
  fromLine: string;
  id: string;
  notes: string;
  previewText: string;
  restrictions: string;
  subjectLine: string;
};

type SavedCampaign = {
  id: string;
  publicId?: string;
  publicPath?: string;
  trialName?: string;
};

type CampaignSummary = {
  createdAt: string;
  id: string;
  publicId: string;
  publicPath: string;
  templateCount: number;
  trialName: string;
  verifiedCount: number;
};

type GenerateResponse =
  | {
      campaign?: SavedCampaign;
      templates: EmailTemplate[];
    }
  | { error: string };

type NotificationRecipient = {
  id: string;
  email: string;
  name: string;
};

export type InitialCampaign = {
  bodyCopy: string;
  fromLines: string;
  id: string;
  notificationRecipients?: NotificationRecipient[];
  publicId: string;
  publicPath: string;
  restrictions: string;
  subjectLines: string;
  submissions: CampaignSubmission[];
  templates: EmailTemplate[];
  trialName: string;
};

/** Same-origin API and links (client-side fetch does not auto-prefix basePath). */
function withBasePath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

const countOptions: CountOption[] = [10, 15, 20];

export default function CampaignBuilder({
  initialCampaign,
}: {
  initialCampaign?: InitialCampaign;
}) {
  const router = useRouter();
  const [screen, setScreen] = useState<AppScreen>(initialCampaign ? "builder" : "dashboard");
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState("");
  const [trialName, setTrialName] = useState(initialCampaign?.trialName ?? "");
  const [bodyCopy, setBodyCopy] = useState(initialCampaign?.bodyCopy ?? "");
  const [fromLines, setFromLines] = useState(initialCampaign?.fromLines ?? "");
  const [subjectLines, setSubjectLines] = useState(initialCampaign?.subjectLines ?? "");
  const [restrictions, setRestrictions] = useState(initialCampaign?.restrictions ?? "");
  const [count, setCount] = useState<CountOption>(10);
  const [savedCampaign, setSavedCampaign] = useState<SavedCampaign | null>(
    initialCampaign
      ? {
          id: initialCampaign.id,
          publicId: initialCampaign.publicId,
          publicPath: initialCampaign.publicPath,
          trialName: initialCampaign.trialName,
        }
      : null,
  );
  const [submissions, setSubmissions] = useState<CampaignSubmission[]>(
    initialCampaign?.submissions ?? [],
  );
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialCampaign?.templates ?? []);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState("");
  const [rejectingSubmission, setRejectingSubmission] = useState<CampaignSubmission | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reviewTab, setReviewTab] = useState<ReviewTab>("unverified");
  const [unverifiedTab, setUnverifiedTab] = useState<UnverifiedTab>("ai");
  const [verifyingTemplateId, setVerifyingTemplateId] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [deletingCampaignId, setDeletingCampaignId] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [recipients, setRecipients] = useState<NotificationRecipient[]>(
    initialCampaign?.notificationRecipients ?? [],
  );
  const [allRecipients, setAllRecipients] = useState<NotificationRecipient[]>([]);
  const [recipientsLoaded, setRecipientsLoaded] = useState(false);
  const [addingRecipient, setAddingRecipient] = useState(false);
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [newRecipientName, setNewRecipientName] = useState("");
  const briefFormRef = useRef<HTMLFormElement | null>(null);
  const [reviewPanelHeight, setReviewPanelHeight] = useState<number | null>(null);

  const canGenerate = useMemo(
    () =>
      bodyCopy.trim().length > 0 &&
      fromLines.trim().length > 0 &&
      subjectLines.trim().length > 0 &&
      restrictions.trim().length > 0 &&
      !isLoading,
    [bodyCopy, fromLines, subjectLines, restrictions, isLoading],
  );

  const packHasResults = !isLoading && (templates.length > 0 || submissions.length > 0);
  const verifiedTemplates = templates.filter((template) => template.verified);
  const unverifiedTemplates = templates.filter((template) => !template.verified);
  const verifiedCount = verifiedTemplates.length;
  const unverifiedCount = unverifiedTemplates.length + submissions.length;
  const reviewPath = savedCampaign?.publicPath || "";
  const reviewUrl = toAbsoluteUrl(reviewPath);

  useEffect(() => {
    const form = briefFormRef.current;

    if (!form) {
      setReviewPanelHeight(null);
      return;
    }

    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const updateReviewPanelHeight = () => {
      setReviewPanelHeight(desktopQuery.matches ? form.getBoundingClientRect().height : null);
    };

    updateReviewPanelHeight();

    const observer = new ResizeObserver(updateReviewPanelHeight);
    observer.observe(form);
    window.addEventListener("resize", updateReviewPanelHeight);
    desktopQuery.addEventListener("change", updateReviewPanelHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateReviewPanelHeight);
      desktopQuery.removeEventListener("change", updateReviewPanelHeight);
    };
  }, [screen]);

  useEffect(() => {
    let active = true;

    async function loadCampaigns() {
      setCampaignsLoading(true);
      setCampaignsError("");

      try {
        const response = await fetch(withBasePath("/email-template-generator/api/campaigns"), { cache: "no-store" });
        const payload = (await response.json()) as
          | { campaigns: CampaignSummary[] }
          | { error: string };

        if (!response.ok || "error" in payload) {
          throw new Error("error" in payload ? payload.error : "Failed to load campaigns.");
        }

        if (active) {
          setCampaigns(payload.campaigns);
        }
      } catch (caughtError) {
        if (active) {
          setCampaignsError(
            caughtError instanceof Error ? caughtError.message : "Failed to load campaigns.",
          );
        }
      } finally {
        if (active) {
          setCampaignsLoading(false);
        }
      }
    }

    loadCampaigns();

    return () => {
      active = false;
    };
  }, []);

  function startNewCampaign() {
    setError("");
    setTrialName("");
    setSavedCampaign(null);
    setSubmissions([]);
    setTemplates([]);
    setCopiedKey("");
    setScreen("new");
  }

  async function handleCampaignStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trialName.trim()) {
      setError("Add a trial name before creating the campaign.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(withBasePath("/email-template-generator/api/campaigns"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trialName }),
      });
      const payload = (await response.json()) as
        | { campaign: CampaignSummary }
        | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Failed to create campaign.");
      }

      const campaign = payload.campaign;
      setSavedCampaign({
        id: campaign.id,
        publicId: campaign.publicId,
        publicPath: campaign.publicPath,
        trialName: campaign.trialName,
      });
      setSubmissions([]);
      setTemplates([]);
      setCampaigns((currentCampaigns) => [
        campaign,
        ...currentCampaigns.filter((currentCampaign) => currentCampaign.id !== campaign.id),
      ]);
      router.push(`/email-template-generator/${campaign.publicId}`);
      setScreen("builder");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to create campaign.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canGenerate) {
      setError("Add body copy, from lines, subject lines, and restrictions before generating.");
      return;
    }

    setIsLoading(true);
    setError("");
    setCopiedKey("");

    try {
      const response = await fetch(withBasePath("/email-template-generator/api/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch",
          bodyCopy,
          campaignId: savedCampaign?.id,
          count,
          fromLines,
          restrictions,
          subjectLines,
          trialName,
        }),
      });

      const payload = (await response.json()) as GenerateResponse;

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Generation failed.");
      }

      setTemplates(payload.templates);

      if (payload.campaign) {
        const campaign = payload.campaign;
        setSavedCampaign(campaign);
        if (campaign.publicId) {
          router.push(`/email-template-generator/${campaign.publicId}`);
        }
        setCampaigns((currentCampaigns) => [
          {
            createdAt: new Date().toISOString(),
            id: campaign.id,
            publicId: campaign.publicId || "",
            publicPath: campaign.publicPath || "",
            templateCount: payload.templates.length,
            trialName: campaign.trialName || trialName,
            verifiedCount: 0,
          },
          ...currentCampaigns.filter((currentCampaign) => currentCampaign.id !== campaign.id),
        ]);
      }
    } catch (caughtError) {
      setTemplates([]);
      setError(caughtError instanceof Error ? caughtError.message : "Generation failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyText(text: string, key: string) {
    try {
      await writeClipboard(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(""), 1600);
    } catch {
      window.prompt("Copy this URL:", text);
    }
  }

  async function deleteCampaign(campaign: CampaignSummary) {
    setDeletingCampaignId(campaign.id);
    setCampaignsError("");

    try {
      const response = await fetch(
        withBasePath(`/email-template-generator/api/campaigns/${campaign.id}`),
        { method: "DELETE" },
      );
      const payload = (await response.json()) as { ok?: true } | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Failed to delete campaign.");
      }

      setCampaigns((currentCampaigns) =>
        currentCampaigns.filter((currentCampaign) => currentCampaign.id !== campaign.id),
      );
      setToastMessage("Campaign deleted.");
      window.setTimeout(() => setToastMessage(""), 3000);
    } catch (caughtError) {
      setCampaignsError(
        caughtError instanceof Error ? caughtError.message : "Failed to delete campaign.",
      );
    } finally {
      setDeletingCampaignId("");
    }
  }

  async function setTemplateVerified(template: EmailTemplate, verified: boolean) {
    if (!template.id) {
      setError("Save the campaign before verifying templates.");
      return;
    }

    const previousVerified = Boolean(template.verified);
    setVerifyingTemplateId(template.id);
    setError("");

    setTemplates((currentTemplates) =>
      currentTemplates.map((currentTemplate) =>
        currentTemplate.id === template.id ? { ...currentTemplate, verified } : currentTemplate,
      ),
    );

    try {
      const response = await fetch(
        withBasePath(`/email-template-generator/api/templates/${template.id}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verified }),
        },
      );
      const payload = (await response.json()) as
        | { template: { id: string; verified: boolean } }
        | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Failed to update verification.");
      }
    } catch (caughtError) {
      setTemplates((currentTemplates) =>
        currentTemplates.map((currentTemplate) =>
          currentTemplate.id === template.id
            ? { ...currentTemplate, verified: previousVerified }
            : currentTemplate,
        ),
      );
      setError(
        caughtError instanceof Error ? caughtError.message : "Failed to update verification.",
      );
    } finally {
      setVerifyingTemplateId("");
    }
  }

  async function reviewSubmission(
    submission: CampaignSubmission,
    action: "accept" | "reject",
    reason?: string,
  ) {
    setReviewingSubmissionId(submission.id);
    setError("");

    try {
      const body: Record<string, string> = { action };
      if (action === "reject" && reason) {
        body.rejectionReason = reason;
      }

      const response = await fetch(
        withBasePath(`/email-template-generator/api/submissions/${submission.id}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const payload = (await response.json()) as
        | { submission: { id: string; status: string }; template?: EmailTemplate }
        | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Failed to review submission.");
      }

      setSubmissions((currentSubmissions) =>
        currentSubmissions.filter((currentSubmission) => currentSubmission.id !== submission.id),
      );

      if (payload.template) {
        setTemplates((currentTemplates) => [...currentTemplates, payload.template as EmailTemplate]);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to review submission.");
    } finally {
      setReviewingSubmissionId("");
      setRejectingSubmission(null);
      setRejectionReason("");
    }
  }

  async function loadAllRecipients() {
    if (recipientsLoaded) return;
    try {
      const response = await fetch(withBasePath("/email-template-generator/api/recipients"));
      const data = (await response.json()) as { recipients: NotificationRecipient[] };
      if (data.recipients) {
        setAllRecipients(data.recipients);
        setRecipientsLoaded(true);
      }
    } catch {
      /* silent */
    }
  }

  async function assignRecipient(recipientId: string) {
    if (!savedCampaign) return;
    try {
      const response = await fetch(
        withBasePath(`/email-template-generator/api/campaigns/${savedCampaign.id}/recipients`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientId }),
        },
      );
      if (response.ok) {
        const added = allRecipients.find((r) => r.id === recipientId);
        if (added) {
          setRecipients((current) => [...current, added]);
        }
      }
    } catch {
      /* silent */
    }
  }

  async function removeRecipient(recipientId: string) {
    if (!savedCampaign) return;
    try {
      const response = await fetch(
        withBasePath(
          `/email-template-generator/api/campaigns/${savedCampaign.id}/recipients/${recipientId}`,
        ),
        { method: "DELETE" },
      );
      if (response.ok) {
        setRecipients((current) => current.filter((r) => r.id !== recipientId));
      }
    } catch {
      /* silent */
    }
  }

  async function createAndAssignRecipient() {
    if (!savedCampaign || !newRecipientEmail.trim()) return;
    setAddingRecipient(true);
    try {
      const createResponse = await fetch(withBasePath("/email-template-generator/api/recipients"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newRecipientEmail.trim(), name: newRecipientName.trim() }),
      });
      const createData = (await createResponse.json()) as {
        recipient?: NotificationRecipient;
        error?: string;
      };
      if (!createData.recipient) return;

      const newRecipient = createData.recipient;
      setAllRecipients((current) => [...current, newRecipient]);

      await fetch(
        withBasePath(`/email-template-generator/api/campaigns/${savedCampaign.id}/recipients`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientId: newRecipient.id }),
        },
      );
      setRecipients((current) => [...current, newRecipient]);
      setNewRecipientEmail("");
      setNewRecipientName("");
    } catch {
      /* silent */
    } finally {
      setAddingRecipient(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f1ea] text-[#171717]">
      <style>{`
        @keyframes skeleton-shimmer {
          100% {
            transform: translateX(100%);
          }
        }

        .skeleton-shimmer {
          position: relative;
          overflow: hidden;
        }

        .skeleton-shimmer::after {
          animation: skeleton-shimmer 1.35s ease-in-out infinite;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.72),
            transparent
          );
          content: "";
          inset: 0;
          position: absolute;
          transform: translateX(-100%);
        }

        @keyframes toast-slide {
          0% {
            opacity: 0;
            transform: translateX(-14px);
          }
          12%,
          88% {
            opacity: 1;
            transform: translateX(0);
          }
          100% {
            opacity: 0;
            transform: translateX(-14px);
          }
        }

        .toast-slide {
          animation: toast-slide 3s ease-in-out both;
        }
      `}</style>

      {screen === "dashboard" ? (
        <CampaignDashboard
          campaigns={campaigns}
          copiedKey={copiedKey}
          error={campaignsError}
          loading={campaignsLoading}
          onDelete={deleteCampaign}
          onCopy={(url, key) => copyText(toAbsoluteUrl(url), key)}
          onNewCampaign={startNewCampaign}
          deletingCampaignId={deletingCampaignId}
          toastMessage={toastMessage}
        />
      ) : null}

      {screen === "new" ? (
        <section className="mx-auto grid min-h-screen w-full max-w-5xl place-items-center px-4 py-8 sm:px-6">
          <div className="w-full rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
              New campaign
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#171717]">
              Create a trial campaign
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#665e56]">
              Start with the trial details. The creative ingredients and generated templates will
              live inside this campaign once the backend is connected.
            </p>

            {error ? (
              <p className="mt-5 rounded-lg border border-[#efb7a8] bg-[#fffaf3] px-4 py-3 text-sm font-medium text-[#9c3527]">
                {error}
              </p>
            ) : null}

            <form className="mt-7 grid gap-4" onSubmit={handleCampaignStart}>
              <TextInput
                helperText="Required. This becomes the campaign name and future share page label."
                label="Trial Name"
                onChange={setTrialName}
                placeholder="Depression investigational medication study"
                value={trialName}
              />
              <div className="mt-3 flex flex-col gap-3 border-t border-black/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-[#746b62]">
                  Next: add source email, subject line pool, from lines, and restrictions.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    className="h-12 rounded-md border border-[#e3d9cf] bg-white px-6 text-sm font-bold text-[#4c4239] transition hover:bg-[#fffaf3]"
                    onClick={() => setScreen("dashboard")}
                    type="button"
                  >
                    Back
                  </button>
                  <button
                    className="h-12 rounded-md bg-[#171717] px-6 text-sm font-bold text-white transition hover:bg-[#332d28]"
                    type="submit"
                  >
                    Create Campaign
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>
      ) : null}

      {screen === "builder" ? (
      <section className="mx-auto flex min-h-screen w-full max-w-[1520px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <header className="grid gap-4 rounded-lg border border-black/10 bg-white px-5 py-5 shadow-sm lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <button
              className="mb-3 flex items-center gap-1.5 text-xs font-medium text-[#7a6a5e] hover:text-[#171717] transition"
              onClick={() => router.push("/email-template-generator")}
              type="button"
            >
              <span>←</span>
              <span>All campaigns</span>
            </button>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
              Email template generator
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#171717] sm:text-4xl">
              {trialName}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#665e56]">
              Paste the approved ingredients, choose a pack size, and generate review-ready email
              variations with compliant from lines, previews, body copy, and CTAs.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[#514940]">
              <span className="rounded-md bg-[#eef7df] px-3 py-1 text-[#49651e]">
                Campaign draft
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:min-w-72">
            <button
              className="h-14 rounded-md bg-[#171717] px-7 text-sm font-bold text-white shadow-sm transition hover:bg-[#332d28] disabled:cursor-not-allowed disabled:bg-[#aaa39a]"
              disabled={!canGenerate}
              form="campaign-brief"
              type="submit"
            >
              {isLoading ? "Building..." : `Generate ${count}`}
            </button>
            <div className="rounded-md border border-[#e4d8cc] bg-[#fffaf3] p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#7a7168]">Versions</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {countOptions.map((option) => (
                  <button
                    className={`h-10 min-w-14 rounded-md text-sm font-bold transition ${
                      count === option
                        ? "bg-[#171717] text-white"
                        : "bg-white text-[#514940] ring-1 ring-[#e4d6c8] hover:bg-[#f4eadf]"
                    }`}
                    key={option}
                    onClick={() => setCount(option)}
                    type="button"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {error ? (
          <p className="rounded-lg border border-[#efb7a8] bg-white px-4 py-3 text-sm font-medium text-[#9c3527]">
            {error}
          </p>
        ) : null}

        <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(360px,430px)_minmax(0,1fr)] lg:items-start">
          <form
            className="self-start rounded-lg border border-black/10 bg-white shadow-sm"
            id="campaign-brief"
            onSubmit={handleSubmit}
            ref={briefFormRef}
          >
            <div className="border-b border-black/10 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-[#171717]">Creative Ingredients</h2>
                  <p className="mt-1 text-sm leading-6 text-[#746b62]">
                    Edit the source material once, then build the whole pack.
                  </p>
                </div>
                <span className="rounded-md bg-[#eef7df] px-3 py-1 text-xs font-bold text-[#49651e]">
                  Required
                </span>
              </div>
            </div>

            <div className="grid gap-3 p-4">
              <InputArea
                helperText="Approved email body and offer details."
                label="Source Email"
                minRows={8}
                onChange={setBodyCopy}
                value={bodyCopy}
              />
              <InputArea
                helperText="Seed subject lines the model can vary."
                label="Subject Line Pool"
                minRows={4}
                onChange={setSubjectLines}
                value={subjectLines}
              />
              <InputArea
                helperText="Allowed sender names, one per line."
                label="From Lines"
                minRows={3}
                onChange={setFromLines}
                value={fromLines}
              />
              <InputArea
                helperText="Hard compliance rules for every generated email."
                label="Restrictions"
                minRows={5}
                onChange={setRestrictions}
                value={restrictions}
                tone="locked"
              />
            </div>
          </form>

          <div
            className="grid min-h-0 gap-4 lg:grid-rows-[auto_minmax(0,1fr)]"
            style={reviewPanelHeight ? { height: reviewPanelHeight } : undefined}
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <SharePanel
                  copied={copiedKey === "review-path"}
                  onCopy={() => copyText(reviewUrl, "review-path")}
                  reviewPath={reviewPath}
                  reviewUrl={reviewUrl}
                  saved={Boolean(savedCampaign?.publicPath)}
                  trialName={trialName}
                />
              </div>
              <div className="lg:col-span-1">
                <NotificationRecipientsPanel
                  addingRecipient={addingRecipient}
                  allRecipients={allRecipients}
                  assignRecipient={assignRecipient}
                  createAndAssignRecipient={createAndAssignRecipient}
                  loadAllRecipients={loadAllRecipients}
                  newRecipientEmail={newRecipientEmail}
                  newRecipientName={newRecipientName}
                  onNewEmailChange={setNewRecipientEmail}
                  onNewNameChange={setNewRecipientName}
                  recipients={recipients}
                  removeRecipient={removeRecipient}
                />
              </div>
            </div>

            <section
              className={`flex min-h-0 w-full flex-col rounded-lg border border-black/10 bg-[#fcfbf8] shadow-sm ${
                packHasResults ? "overflow-hidden" : ""
              }`}
            >
              <div className="flex shrink-0 flex-col gap-3 border-b border-black/10 bg-white px-5 py-4">
                <div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#171717]">Review Queue</h2>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <TabButton
                    active={reviewTab === "unverified"}
                    label={`Unverified (${unverifiedCount})`}
                    onClick={() => setReviewTab("unverified")}
                  />
                  <TabButton
                    active={reviewTab === "verified"}
                    label={`Verified (${verifiedCount})`}
                    onClick={() => setReviewTab("verified")}
                  />
                </div>
              </div>

              {reviewTab === "verified" ? (
                isLoading ? (
                  <LoadingState />
                ) : verifiedTemplates.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain p-4 pb-7 sm:p-5 sm:pb-8">
                    {verifiedTemplates.map((template, index) => (
                      <TemplateCard
                        disabled={verifyingTemplateId === template.id}
                        key={`email-${index}`}
                        onSetVerified={(verified) => setTemplateVerified(template, verified)}
                        template={template}
                        templateNumber={index + 1}
                      />
                    ))}
                  </div>
                )
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain p-4 pb-7 sm:p-5 sm:pb-8">
                  <div className="grid grid-cols-2 gap-2 rounded-md border border-[#e3d9cf] bg-[#faf7f2] p-1">
                    <button
                      className={`h-9 rounded px-3 text-sm font-bold transition ${
                        unverifiedTab === "ai"
                          ? "bg-white text-[#171717] shadow-sm"
                          : "text-[#7a7168] hover:text-[#171717]"
                      }`}
                      onClick={() => setUnverifiedTab("ai")}
                      type="button"
                    >
                      AI-Generated ({unverifiedTemplates.length})
                    </button>
                    <button
                      className={`h-9 rounded px-3 text-sm font-bold transition ${
                        unverifiedTab === "submissions"
                          ? "bg-white text-[#171717] shadow-sm"
                          : "text-[#7a7168] hover:text-[#171717]"
                      }`}
                      onClick={() => setUnverifiedTab("submissions")}
                      type="button"
                    >
                      Submissions ({submissions.length})
                    </button>
                  </div>
                  {unverifiedTab === "ai" ? (
                    unverifiedTemplates.length === 0 ? (
                      <SubmissionEmptyState />
                    ) : (
                      unverifiedTemplates.map((template, index) => (
                        <TemplateCard
                          disabled={verifyingTemplateId === template.id}
                          key={`unverified-email-${index}`}
                          onSetVerified={(verified) => setTemplateVerified(template, verified)}
                          template={template}
                          templateNumber={index + 1}
                        />
                      ))
                    )
                  ) : submissions.length === 0 ? (
                    <SubmissionEmptyState />
                  ) : (
                    submissions.map((submission) => (
                      <SubmissionCard
                        disabled={reviewingSubmissionId === submission.id}
                        key={submission.id}
                        onAccept={() => reviewSubmission(submission, "accept")}
                        onReject={() => {
                          setRejectingSubmission(submission);
                          setRejectionReason("");
                        }}
                        submission={submission}
                      />
                    ))
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
      ) : null}

      {rejectingSubmission ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4">
          <section className="w-full max-w-md rounded-lg border border-black/10 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-[#171717]">Reject submission?</h2>
            <p className="mt-2 text-sm leading-6 text-[#746b62]">
              Optionally provide a reason for the rejection. This will be sent to notification recipients.
            </p>
            <textarea
              className="mt-3 w-full rounded-md border border-[#e3d9cf] bg-[#fffdf9] p-3 text-sm text-[#2f2a25] outline-none transition placeholder:text-[#a69b90] focus:border-[#171717] focus:ring-4 focus:ring-[#eadfd3]"
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection (optional)"
              rows={3}
              value={rejectionReason}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="h-10 rounded-md border border-[#e3d9cf] bg-[#fffaf3] px-4 text-sm font-bold text-[#4c4239] transition hover:bg-white"
                onClick={() => {
                  setRejectingSubmission(null);
                  setRejectionReason("");
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="h-10 rounded-md bg-[#9c3527] px-4 text-sm font-bold text-white transition hover:bg-[#7f291f] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={reviewingSubmissionId === rejectingSubmission.id}
                onClick={() => reviewSubmission(rejectingSubmission, "reject", rejectionReason)}
                type="button"
              >
                {reviewingSubmissionId === rejectingSubmission.id ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function InputArea({
  helperText,
  label,
  minRows,
  onChange,
  tone = "default",
  value,
}: {
  helperText: string;
  label: string;
  minRows: number;
  onChange: (value: string) => void;
  tone?: "default" | "locked";
  value: string;
}) {
  return (
    <label
      className={`grid gap-3 rounded-md border p-3 ${
        tone === "locked" ? "border-[#d7e4b8] bg-[#fbfdf5]" : "border-[#ece3da] bg-[#fffdf9]"
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold text-[#2e3645]">{label}</span>
          <span className="mt-0.5 block text-xs leading-5 text-[#7a7168]">{helperText}</span>
        </span>
        <span className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-[#7a7168]">
          {value.trim().length} chars
        </span>
      </span>
      <textarea
        className="w-full resize-y rounded-md border border-[#e3d9cf] bg-white px-3 py-2.5 text-sm leading-6 text-[#2f2a25] outline-none transition placeholder:text-[#a69b90] focus:border-[#171717] focus:ring-4 focus:ring-[#eadfd3]"
        onChange={(event) => onChange(event.target.value)}
        rows={minRows}
        value={value}
      />
    </label>
  );
}

function CampaignDashboard({
  campaigns,
  copiedKey,
  deletingCampaignId,
  error,
  loading,
  onCopy,
  onDelete,
  onNewCampaign,
  toastMessage,
}: {
  campaigns: CampaignSummary[];
  copiedKey: string;
  deletingCampaignId: string;
  error: string;
  loading: boolean;
  onCopy: (url: string, key: string) => void;
  onDelete: (campaign: CampaignSummary) => Promise<void>;
  onNewCampaign: () => void;
  toastMessage: string;
}) {
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignSummary | null>(null);
  async function confirmDeleteCampaign() {
    if (!campaignToDelete) {
      return;
    }

    await onDelete(campaignToDelete);
    setCampaignToDelete(null);
  }

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      {toastMessage ? (
        <div className="toast-slide fixed left-4 top-4 z-50 rounded-md bg-[#171717] px-4 py-2 text-sm font-bold text-white shadow-lg">
          {toastMessage}
        </div>
      ) : null}

      <header className="grid gap-4 rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
            Campaign library
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#171717]">
            Trial campaigns
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#665e56]">
            Create a campaign, generate templates, and share a clean copy-only link.
          </p>
        </div>
        <button
          className="h-12 rounded-md bg-[#171717] px-6 text-sm font-bold text-white transition hover:bg-[#332d28]"
          onClick={onNewCampaign}
          type="button"
        >
          New Campaign
        </button>
      </header>

      {error ? (
        <p className="rounded-lg border border-[#efb7a8] bg-white px-4 py-3 text-sm font-medium text-[#9c3527]">
          {error}
        </p>
      ) : null}

      <section className="rounded-lg border border-black/10 bg-white shadow-sm">
        <div className="border-b border-black/10 px-5 py-4">
          <h2 className="text-lg font-semibold text-[#171717]">
            Saved campaigns ({campaigns.length})
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#746b62]">
            Open the public link to see only the copyable templates.
          </p>
        </div>

        {loading ? (
          <div className="grid gap-3 p-5">
            {[0, 1, 2].map((item) => (
              <div className="skeleton-shimmer h-20 rounded-md bg-[#f0e6dc]" key={item} />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="p-5">
            <div className="rounded-lg border border-dashed border-[#dccfc1] bg-[#fffaf3] p-6">
              <p className="text-lg font-semibold text-[#171717]">No campaigns yet</p>
              <p className="mt-2 text-sm leading-6 text-[#746b62]">
                Create your first campaign to generate and save templates.
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-black/10">
            {campaigns.map((campaign) => (
              <article className="grid gap-3 px-5 py-4" key={campaign.id}>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-[#171717]">{campaign.trialName}</h3>
                  <p className="mt-1 text-sm text-[#746b62]">
                    {campaign.templateCount} template{campaign.templateCount === 1 ? "" : "s"} saved
                    {" · "}
                    {formatDate(campaign.createdAt)}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                  <code className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-[#f7f4ef] px-3 py-2 text-sm text-[#4c4239]">
                    {campaign.publicPath}
                  </code>
                  <div className="flex gap-2 md:justify-end">
                    <a
                      className="grid h-10 w-10 place-items-center rounded-md border border-[#e3d9cf] bg-[#fffaf3] text-[#4c4239] transition hover:bg-white"
                      href={withBasePath(`/email-template-generator/${campaign.publicId}`)}
                      title="Edit campaign"
                    >
                      <Pencil aria-hidden="true" size={18} strokeWidth={2.3} />
                    </a>
                    <a
                      className="grid h-10 w-10 place-items-center rounded-md bg-[#171717] text-white transition hover:bg-[#332d28]"
                      href={withBasePath(campaign.publicPath)}
                      rel="noreferrer"
                      target="_blank"
                      title="Open public campaign"
                    >
                      <ExternalLink aria-hidden="true" size={18} strokeWidth={2.3} />
                    </a>
                    <button
                      className="grid h-10 w-10 place-items-center rounded-md border border-[#e3d9cf] bg-[#fffaf3] text-[#4c4239] transition hover:bg-white"
                      onClick={() => onCopy(campaign.publicPath, `campaign-${campaign.id}`)}
                      title={copiedKey === `campaign-${campaign.id}` ? "Copied" : "Copy URL"}
                      type="button"
                    >
                      {copiedKey === `campaign-${campaign.id}` ? (
                        <Check aria-hidden="true" size={18} strokeWidth={2.3} />
                      ) : (
                        <Copy aria-hidden="true" size={18} strokeWidth={2.3} />
                      )}
                    </button>
                    <button
                      className="grid h-10 w-10 place-items-center rounded-md border border-[#efb7a8] bg-white text-[#9c3527] transition hover:bg-[#fff2e8] disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={deletingCampaignId === campaign.id}
                      onClick={() => setCampaignToDelete(campaign)}
                      title={deletingCampaignId === campaign.id ? "Deleting" : "Delete campaign"}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={18} strokeWidth={2.3} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {campaignToDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4">
          <section className="w-full max-w-md rounded-lg border border-black/10 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-[#171717]">Delete campaign?</h2>
            <p className="mt-2 text-sm leading-6 text-[#746b62]">
              This will delete {campaignToDelete.trialName}. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="h-10 rounded-md border border-[#e3d9cf] bg-[#fffaf3] px-4 text-sm font-bold text-[#4c4239] transition hover:bg-white"
                onClick={() => setCampaignToDelete(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="h-10 rounded-md bg-[#9c3527] px-4 text-sm font-bold text-white transition hover:bg-[#7f291f] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={deletingCampaignId === campaignToDelete.id}
                onClick={confirmDeleteCampaign}
                type="button"
              >
                {deletingCampaignId === campaignToDelete.id ? "Deleting" : "Delete"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function TextInput({
  helperText,
  label,
  onChange,
  placeholder,
  value,
}: {
  helperText: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-[#2e3645]">{label}</span>
      <input
        className="h-12 rounded-md border border-[#e3d9cf] bg-[#fffdf9] px-3 text-sm text-[#2f2a25] outline-none transition placeholder:text-[#a69b90] focus:border-[#171717] focus:ring-4 focus:ring-[#eadfd3]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
      <span className="text-xs leading-5 text-[#7a7168]">{helperText}</span>
    </label>
  );
}

function SharePanel({
  copied,
  onCopy,
  reviewPath,
  reviewUrl,
  saved,
  trialName,
}: {
  copied: boolean;
  onCopy: () => void;
  reviewPath: string;
  reviewUrl: string;
  saved: boolean;
  trialName: string;
}) {
  return (
    <section className="h-full rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="grid gap-3">
        <div>
          <p className="text-sm font-semibold text-[#171717]">Review page</p>
          <p className="mt-1 text-sm leading-6 text-[#746b62]">
            {saved
              ? `${trialName} is saved. Share this read-only page with anyone who needs the templates.`
              : "Generate the campaign pack to save it and create the public template page."}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <input
            className="block w-full rounded-md border border-[#e3d9cf] bg-[#f7f4ef] px-3 py-2 text-sm text-[#4c4239] outline-none"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={saved ? reviewUrl : reviewPath}
          />
          <div className="flex gap-2">
            <button
              className="grid h-10 w-10 cursor-pointer place-items-center rounded-md border border-[#e3d9cf] bg-[#fffaf3] text-[#4c4239] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!saved}
              onClick={onCopy}
              title={copied ? "Copied" : "Copy URL"}
              type="button"
            >
              {copied ? (
                <Check aria-hidden="true" size={18} strokeWidth={2.3} />
              ) : (
                <Copy aria-hidden="true" size={18} strokeWidth={2.3} />
              )}
            </button>
            <a
              className={`grid h-10 w-10 place-items-center rounded-md transition ${
                saved
                  ? "bg-[#171717] text-white hover:bg-[#332d28]"
                  : "pointer-events-none bg-[#e3d9cf] text-[#a69b90] opacity-60"
              }`}
              href={saved ? withBasePath(reviewPath) : undefined}
              rel="noreferrer"
              target="_blank"
              title="Go to review page"
            >
              <ExternalLink aria-hidden="true" size={18} strokeWidth={2.3} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function NotificationRecipientsPanel({
  addingRecipient,
  allRecipients,
  assignRecipient,
  createAndAssignRecipient,
  loadAllRecipients,
  newRecipientEmail,
  newRecipientName,
  onNewEmailChange,
  onNewNameChange,
  recipients,
  removeRecipient,
}: {
  addingRecipient: boolean;
  allRecipients: NotificationRecipient[];
  assignRecipient: (id: string) => void;
  createAndAssignRecipient: () => void;
  loadAllRecipients: () => void;
  newRecipientEmail: string;
  newRecipientName: string;
  onNewEmailChange: (value: string) => void;
  onNewNameChange: (value: string) => void;
  recipients: NotificationRecipient[];
  removeRecipient: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const assignedIds = new Set(recipients.map((r) => r.id));
  const unassigned = allRecipients.filter((r) => !assignedIds.has(r.id));

  return (
    <>
      <section className="flex h-full flex-col rounded-lg border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#171717]">Notification Recipients</p>
          <button
            className="text-xs font-bold text-[#7a7168] transition hover:text-[#171717]"
            onClick={() => {
              setExpanded(!expanded);
              if (!expanded) loadAllRecipients();
            }}
            type="button"
          >
            {expanded ? "Close" : "Manage"}
          </button>
        </div>

        <p className="mt-1 text-xs leading-5 text-[#7a7168]">
          These people are emailed when submissions are accepted or rejected.
        </p>

        <div className="mt-auto pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {recipients.length > 0 ? (
              recipients.map((r) => (
                <span
                  className="inline-flex items-center gap-1 rounded-md bg-[#f5f1ea] px-2.5 py-1 text-xs text-[#4c4239]"
                  key={r.id}
                >
                  {r.name || r.email}
                  {expanded ? (
                    <button
                      className="ml-0.5 cursor-pointer text-[#9c3527] transition hover:text-[#7f291f] hover:drop-shadow-[0_0_4px_rgba(156,53,39,0.5)]"
                      onClick={() => removeRecipient(r.id)}
                      title="Remove"
                      type="button"
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  ) : null}
                </span>
              ))
            ) : (
              <span className="text-xs text-[#7a7168]">No recipients assigned.</span>
            )}
            {expanded ? (
              <>
                {unassigned.map((r) => (
                  <button
                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-[#e3d9cf] px-2.5 py-1 text-xs text-[#7a7168] transition hover:border-[#171717] hover:text-[#171717]"
                    key={r.id}
                    onClick={() => assignRecipient(r.id)}
                    type="button"
                  >
                    + {r.name || r.email}
                  </button>
                ))}
                <button
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-[#e3d9cf] px-2.5 py-1 text-xs text-[#7a7168] transition hover:border-[#171717] hover:text-[#171717]"
                  onClick={() => setShowCreateModal(true)}
                  type="button"
                >
                  + New
                </button>
              </>
            ) : null}
          </div>
        </div>
      </section>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 px-4">
          <section className="w-full max-w-sm rounded-lg border border-black/10 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-[#171717]">New recipient</h2>
            <p className="mt-1 text-sm leading-6 text-[#746b62]">
              Add someone who should receive accept/reject notifications.
            </p>
            <div className="mt-4 grid gap-3">
              <input
                className="h-10 rounded-md border border-[#e3d9cf] bg-[#fffdf9] px-3 text-sm text-[#2f2a25] outline-none placeholder:text-[#a69b90] focus:border-[#171717] focus:ring-4 focus:ring-[#eadfd3]"
                onChange={(e) => onNewEmailChange(e.target.value)}
                placeholder="Email address"
                type="email"
                value={newRecipientEmail}
              />
              <input
                className="h-10 rounded-md border border-[#e3d9cf] bg-[#fffdf9] px-3 text-sm text-[#2f2a25] outline-none placeholder:text-[#a69b90] focus:border-[#171717] focus:ring-4 focus:ring-[#eadfd3]"
                onChange={(e) => onNewNameChange(e.target.value)}
                placeholder="Display name (optional)"
                value={newRecipientName}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="h-10 rounded-md border border-[#e3d9cf] bg-[#fffaf3] px-4 text-sm font-bold text-[#4c4239] transition hover:bg-white"
                onClick={() => {
                  setShowCreateModal(false);
                  onNewEmailChange("");
                  onNewNameChange("");
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="h-10 rounded-md bg-[#171717] px-4 text-sm font-bold text-white transition hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!newRecipientEmail.trim() || addingRecipient}
                onClick={() => {
                  createAndAssignRecipient();
                  setShowCreateModal(false);
                }}
                type="button"
              >
                {addingRecipient ? "Adding…" : "Add recipient"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`h-11 rounded-md px-4 text-sm font-bold transition ${
        active
          ? "bg-[#171717] text-white"
          : "border border-[#e3d9cf] bg-[#fffaf3] text-[#4c4239] hover:bg-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function SubmissionCard({
  disabled,
  onAccept,
  onReject,
  submission,
}: {
  disabled: boolean;
  onAccept: () => void;
  onReject: () => void;
  submission: CampaignSubmission;
}) {
  const metaFields = [
    { label: "From", value: submission.fromLine, tone: "default" as const },
    { label: "Subject Line", value: submission.subjectLine, tone: "default" as const },
    { label: "Preview", value: submission.previewText, tone: "default" as const },
    { label: "CTA", value: submission.cta, tone: "accent" as const },
    { label: "Restrictions", value: submission.restrictions, tone: "default" as const },
  ].filter(({ value }) => Boolean(value));

  return (
    <article className="rounded-lg border border-[#e4dbd1] bg-white p-4 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
            Submitted input
          </p>
          <span className="rounded-md bg-[#eef7df] px-2.5 py-1 text-xs font-bold text-[#49651e]">
            Submission
          </span>
          <span className="text-xs text-[#7a7168]">{formatDate(submission.createdAt)}</span>
        </div>
        <div className="flex gap-2 lg:justify-end">
          <VerifyButton
            active={false}
            disabled={disabled}
            intent="approve"
            onClick={onAccept}
            title="Verify and publish this submitted input"
          />
          <VerifyButton
            active={false}
            disabled={disabled}
            intent="reject"
            onClick={onReject}
            title="Reject this submitted input"
          />
        </div>
      </div>

      {metaFields.length > 0 ? (
        <div className={`mt-4 grid gap-3 text-sm ${metaFields.length > 1 ? "md:grid-cols-2" : "grid-cols-1"}`}>
          {metaFields.map(({ label, value, tone }) => (
            <MetaBox key={label} label={label} tone={tone} value={value!} />
          ))}
        </div>
      ) : null}

      {submission.body ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#7a7168] mb-2">Body</p>
          <p className="whitespace-pre-wrap rounded-md bg-[#faf7f2] p-4 text-sm leading-7 text-[#302a25]">
            {submission.body}
          </p>
        </div>
      ) : null}

      {submission.notes ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#7a7168] mb-2">Notes</p>
          <p className="whitespace-pre-wrap rounded-md border border-[#e3d9cf] bg-white p-4 text-sm leading-7 text-[#302a25]">
            {submission.notes}
          </p>
        </div>
      ) : null}
    </article>
  );
}

function TemplateCard({
  disabled,
  onSetVerified,
  template,
  templateNumber,
}: {
  disabled: boolean;
  onSetVerified: (verified: boolean) => void;
  template: EmailTemplate;
  templateNumber: number;
}) {
  const verified = Boolean(template.verified);
  const sourceLabel = template.sourceType === "submission" ? "Submission" : "AI-generated";

  return (
    <article
      className={`rounded-lg border bg-white shadow-sm transition hover:shadow-[0_14px_34px_rgba(33,28,22,0.08)] ${
        verified ? "border-[#b7cf86]" : "border-[#e4dbd1]"
      }`}
    >
      <div className="flex items-center justify-between border-b border-[#eee7df] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
            Email {templateNumber}
          </p>
          <span className="rounded-md bg-[#eef7df] px-2.5 py-1 text-xs font-bold text-[#49651e]">
            {sourceLabel}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <VerifyButton
            active={verified}
            disabled={disabled || verified}
            intent="approve"
            onClick={() => onSetVerified(true)}
            title="Show this email on the public campaign page"
          />
          <VerifyButton
            active={!verified}
            disabled={disabled || !verified}
            intent="reject"
            onClick={() => onSetVerified(false)}
            title="Hide this email from the public campaign page"
          />
        </div>
      </div>

      {[
        { label: "From", value: template.fromLine, tone: "default" as const },
        { label: "Subject Line", value: template.subjectLine, tone: "default" as const },
        { label: "Preview", value: template.previewText, tone: "default" as const },
        { label: "CTA", value: template.cta, tone: "accent" as const },
      ].filter(({ value }) => Boolean(value)).length > 0 ? (
        <div className={`grid w-full gap-3 p-5 text-sm ${[template.fromLine, template.subjectLine, template.previewText, template.cta].filter(Boolean).length > 1 ? "md:grid-cols-2" : ""} ${template.body ? "border-b border-[#eee7df]" : ""}`}>
          {[
            { label: "From", value: template.fromLine, tone: "default" as const },
            { label: "Subject Line", value: template.subjectLine, tone: "default" as const },
            { label: "Preview", value: template.previewText, tone: "default" as const },
            { label: "CTA", value: template.cta, tone: "accent" as const },
          ]
            .filter(({ value }) => Boolean(value))
            .map(({ label, value, tone }) => (
              <MetaBox key={label} label={label} tone={tone} value={value} />
            ))}
        </div>
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

function VerifyButton({
  active,
  disabled,
  intent,
  onClick,
  title,
}: {
  active: boolean;
  disabled: boolean;
  intent: "approve" | "reject";
  onClick: () => void;
  title: string;
}) {
  const Icon = intent === "approve" ? Check : X;
  const activeClass =
    intent === "approve"
      ? "border-[#b7cf86] bg-[#eef7df] text-[#49651e]"
      : "border-[#efb7a8] bg-[#fff2e8] text-[#9c3527]";

  return (
    <button
      aria-pressed={active}
      className={`grid h-10 w-10 place-items-center rounded-md border transition disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? activeClass
          : "border-[#e3d9cf] bg-[#fffaf3] text-[#4c4239] hover:bg-white"
      }`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      <Icon aria-hidden="true" size={19} strokeWidth={2.5} />
    </button>
  );
}

function MetaBox({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "default" | "accent";
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-[#e3d9cf] bg-white px-3 py-2.5 text-[#5e554d]">
      <p
        className={`text-xs font-bold uppercase tracking-wide ${
          tone === "accent" ? "text-[#a34f2d]" : "text-[#7a7168]"
        }`}
      >
        {label}
      </p>
      <p className="mt-1.5 font-medium leading-snug text-[#302a25]">{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid place-items-center p-6">
      <div className="w-full max-w-xl rounded-lg border border-[#e7ded4] bg-white p-5 shadow-sm">
        <div className="rounded-lg bg-[#f7f4ef] p-4">
          <div className="skeleton-shimmer mb-4 h-3 w-28 rounded-sm bg-[#d9cfc4]" />
          <div className="skeleton-shimmer mb-3 h-5 w-4/5 rounded-sm bg-[#c9b8a8]" />
          <div className="space-y-2">
            <div className="skeleton-shimmer h-3 rounded-sm bg-[#eadfd3]" />
            <div className="skeleton-shimmer h-3 w-11/12 rounded-sm bg-[#eadfd3]" />
            <div className="skeleton-shimmer h-3 w-2/3 rounded-sm bg-[#eadfd3]" />
          </div>
          <div className="skeleton-shimmer mt-5 h-10 w-40 rounded-md bg-[#171717]" />
        </div>
        <div className="mt-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-[#171717]">Building your campaign pack</p>
            <p className="mt-2 text-sm leading-6 text-[#746b62]">
              Generated emails will appear here when they are ready.
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#171717]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid place-items-center p-6">
      <div className="w-full max-w-xl rounded-lg border border-[#e7ded4] bg-white p-5 shadow-sm">
        <div className="rounded-lg bg-[#f7f4ef] p-4">
          <div className="mb-4 h-3 w-28 rounded-sm bg-[#d9cfc4]" />
          <div className="mb-3 h-5 w-4/5 rounded-sm bg-[#c9b8a8]" />
          <div className="space-y-2">
            <div className="h-3 rounded-sm bg-white" />
            <div className="h-3 w-11/12 rounded-sm bg-white" />
            <div className="h-3 w-2/3 rounded-sm bg-white" />
          </div>
          <div className="mt-5 h-10 w-40 rounded-md bg-[#171717]" />
        </div>
        <p className="mt-5 text-lg font-semibold text-[#171717]">
          Your campaign pack will appear here
        </p>
        <p className="mt-2 text-sm leading-6 text-[#746b62]">
          Generated emails will render as polished, copyable assets for review.
        </p>
      </div>
    </div>
  );
}

function SubmissionEmptyState() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-lg border border-dashed border-[#dccfc1] bg-white p-5 shadow-sm">
        <p className="text-lg font-semibold text-[#171717]">No inputs yet</p>
        <p className="mt-2 text-sm leading-6 text-[#746b62]">
          Public inputs submitted from the share page will appear here for review.
        </p>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function toAbsoluteUrl(path: string) {
  if (!path) {
    return "";
  }

  if (typeof window === "undefined") {
    return path;
  }

  return new URL(withBasePath(path), window.location.origin).toString();
}

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("Clipboard copy failed.");
  }
}
