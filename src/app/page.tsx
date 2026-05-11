"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type CountOption = 10 | 15 | 20;
type TemplateAction = "regenerate" | "shorten";
type AppScreen = "dashboard" | "new" | "builder";

type EmailTemplate = {
  id?: string;
  fromLine: string;
  subjectLine: string;
  previewText: string;
  body: string;
  cta: string;
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
};

type GenerateResponse =
  | {
      campaign?: SavedCampaign;
      templates: EmailTemplate[];
    }
  | { error: string };

const countOptions: CountOption[] = [10, 15, 20];

const sampleBody = `Hi [First Name],

Be among the first to get access to an investigational medication for Depression.

If your current depression medication is not working consider joining this paid clinical trial.

If you are 18-65 and currently experiencing symptoms of depression you may be eligible - spots are filling fast; check your eligibility now.

[Check Your Eligibility]

If this isn't for you we also have local trials for:

Anxiety
Chronic Cough
Eczema
Asthma
More...

Some of these trials pay up to $2,000

[Check Your Eligibility]`;

const sampleFromLines = `Paid Research Studies
Clinical Trial Alert`;

const sampleSubjectLines = `New Paid Trials (Up to $2,000): Depression, Anxiety, Asthma, Eczema + More
Depression, Asthma or Eczema? Earn Up To $2,000 In Paid Studies
Limited Spots: Depression, Asthma or Eczema? Earn Up To $2,000`;

const sampleRestrictions = `Compensation language must not exceed "up to $2,000".
Do not imply guaranteed eligibility, treatment success, cure, approval, or guaranteed payment.
Keep the age range as 18-65.
Keep the medication described as investigational.
Use eligibility uncertainty language such as "may be eligible".`;

export default function Home() {
  const [screen, setScreen] = useState<AppScreen>("dashboard");
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState("");
  const [trialName, setTrialName] = useState("");
  const [bodyCopy, setBodyCopy] = useState(sampleBody);
  const [fromLines, setFromLines] = useState(sampleFromLines);
  const [subjectLines, setSubjectLines] = useState(sampleSubjectLines);
  const [restrictions, setRestrictions] = useState(sampleRestrictions);
  const [count, setCount] = useState<CountOption>(10);
  const [savedCampaign, setSavedCampaign] = useState<SavedCampaign | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTemplateAction, setActiveTemplateAction] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  const canGenerate = useMemo(
    () =>
      bodyCopy.trim().length > 0 &&
      fromLines.trim().length > 0 &&
      subjectLines.trim().length > 0 &&
      restrictions.trim().length > 0 &&
      !isLoading,
    [bodyCopy, fromLines, subjectLines, restrictions, isLoading],
  );

  const packHasResults = !isLoading && templates.length > 0;
  const campaignSlug = slugify(trialName || "new-campaign");
  const reviewPath = savedCampaign?.publicPath || `/campaigns/${campaignSlug}`;
  const reviewUrl = toAbsoluteUrl(reviewPath);

  useEffect(() => {
    let active = true;

    async function loadCampaigns() {
      setCampaignsLoading(true);
      setCampaignsError("");

      try {
        const response = await fetch("/api/campaigns");
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
    setTemplates([]);
    setCopiedKey("");
    setScreen("new");
  }

  function handleCampaignStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!trialName.trim()) {
      setError("Add a trial name before creating the campaign.");
      return;
    }

    setError("");
    setSavedCampaign(null);
    setTemplates([]);
    setScreen("builder");
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
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch",
          bodyCopy,
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
        setCampaigns((currentCampaigns) => [
          {
            createdAt: new Date().toISOString(),
            id: campaign.id,
            publicId: campaign.publicId || "",
            publicPath: campaign.publicPath || "",
            templateCount: payload.templates.length,
            trialName: campaign.trialName || trialName,
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

  async function reviseTemplate(index: number, action: TemplateAction) {
    const template = templates[index];

    if (!template) {
      return;
    }

    const actionKey = `${action}-${index}`;
    setActiveTemplateAction(actionKey);
    setError("");
    setCopiedKey("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          bodyCopy,
          campaignId: savedCampaign?.id,
          existingTemplate: template,
          fromLines,
          restrictions,
          subjectLines,
          templateId: template.id,
        }),
      });

      const payload = (await response.json()) as GenerateResponse;

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Revision failed.");
      }

      const [nextTemplate] = payload.templates;

      if (!nextTemplate) {
        throw new Error("Revision did not return a template.");
      }

      setTemplates((currentTemplates) =>
        currentTemplates.map((currentTemplate, currentIndex) =>
          currentIndex === index ? nextTemplate : currentTemplate,
        ),
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Revision failed.");
    } finally {
      setActiveTemplateAction("");
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
      `}</style>

      {screen === "dashboard" ? (
        <CampaignDashboard
          campaigns={campaigns}
          copiedKey={copiedKey}
          error={campaignsError}
          loading={campaignsLoading}
          onCopy={(url, key) => copyText(toAbsoluteUrl(url), key)}
          onNewCampaign={startNewCampaign}
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
              Email template generator
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#171717] sm:text-4xl">
              {trialName}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#665e56]">
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
            className="rounded-lg border border-black/10 bg-white shadow-sm"
            id="campaign-brief"
            onSubmit={handleSubmit}
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

            <div className="border-t border-black/10 bg-[#fffaf3] px-4 py-3 text-sm text-[#665e56]">
              {templates.length > 0
                ? `${templates.length} emails ready to copy.`
                : "Generated emails will appear in the results panel."}
            </div>
          </form>

          <div className="grid min-h-0 gap-4">
            <SharePanel
              copied={copiedKey === "review-path"}
              onCopy={() => copyText(reviewUrl, "review-path")}
              reviewPath={reviewPath}
              reviewUrl={reviewUrl}
              saved={Boolean(savedCampaign?.publicPath)}
              templateCount={templates.length}
              trialName={trialName}
            />

            <section
              className={`flex w-full flex-col rounded-lg border border-black/10 bg-[#fcfbf8] shadow-sm ${
                packHasResults
                  ? "min-h-0 max-h-[calc(100dvh-8rem)] overflow-hidden lg:max-h-[calc(100dvh-13.5rem)]"
                  : ""
              }`}
            >
            <div className="flex shrink-0 flex-col gap-3 border-b border-black/10 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#171717]">Generated Pack</h2>
                <p className="mt-1 text-sm leading-6 text-[#746b62]">
                  Full-width cards for scanning, reviewing, and copying.
                </p>
              </div>
              <div className="shrink-0 whitespace-nowrap rounded-md bg-[#171717] px-4 py-2 text-sm font-bold text-white">
                {isLoading
                  ? `Generating ${count}`
                  : `${templates.length} template${templates.length === 1 ? "" : "s"}`}
              </div>
            </div>

            {isLoading ? (
              <LoadingState />
            ) : templates.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain p-4 pb-7 sm:p-5 sm:pb-8">
                {templates.map((template, index) => (
                  <TemplateCard
                    actionInProgress={activeTemplateAction}
                    copied={copiedKey === `template-${index}`}
                    key={`email-${index}`}
                    onCopy={() => copyText(formatTemplate(template), `template-${index}`)}
                    onRegenerate={() => reviseTemplate(index, "regenerate")}
                    onShorten={() => reviseTemplate(index, "shorten")}
                    template={template}
                    templateIndex={index}
                    templateNumber={index + 1}
                  />
                ))}
              </div>
            )}
            </section>
          </div>
        </div>
      </section>
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
  error,
  loading,
  onCopy,
  onNewCampaign,
}: {
  campaigns: CampaignSummary[];
  copiedKey: string;
  error: string;
  loading: boolean;
  onCopy: (url: string, key: string) => void;
  onNewCampaign: () => void;
}) {
  return (
    <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
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
          <h2 className="text-lg font-semibold text-[#171717]">Saved campaigns</h2>
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
                      className="flex h-10 items-center rounded-md bg-[#171717] px-4 text-sm font-bold text-white transition hover:bg-[#332d28]"
                      href={campaign.publicPath}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open
                    </a>
                    <button
                      className="h-10 whitespace-nowrap rounded-md border border-[#e3d9cf] bg-[#fffaf3] px-4 text-sm font-bold text-[#4c4239] transition hover:bg-white"
                      onClick={() => onCopy(campaign.publicPath, `campaign-${campaign.id}`)}
                      type="button"
                    >
                      {copiedKey === `campaign-${campaign.id}` ? "Copied" : "Copy URL"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
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
  templateCount,
  trialName,
}: {
  copied: boolean;
  onCopy: () => void;
  reviewPath: string;
  reviewUrl: string;
  saved: boolean;
  templateCount: number;
  trialName: string;
}) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-semibold text-[#171717]">Review page</p>
          <p className="mt-1 text-sm leading-6 text-[#746b62]">
            {saved
              ? `${trialName} is saved. Share this read-only page with anyone who needs the templates.`
              : "Generate the campaign pack to save it and create the public template page."}
          </p>
          <input
            className="mt-3 block w-full rounded-md border border-[#e3d9cf] bg-[#f7f4ef] px-3 py-2 text-sm text-[#4c4239] outline-none"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={saved ? reviewUrl : reviewPath}
          />
        </div>
        <div className="grid gap-2">
          <span className="rounded-md bg-[#eef7df] px-3 py-2 text-center text-xs font-bold text-[#49651e]">
            {saved ? `${templateCount} saved` : `${templateCount} local`}
          </span>
          <button
            className="h-10 rounded-md border border-[#e3d9cf] bg-[#fffaf3] px-4 text-sm font-bold text-[#4c4239] transition hover:bg-white"
            disabled={!saved}
            onClick={onCopy}
            type="button"
          >
            {copied ? "Copied" : "Copy URL"}
          </button>
        </div>
      </div>
    </section>
  );
}

function TemplateCard({
  actionInProgress,
  copied,
  onCopy,
  onRegenerate,
  onShorten,
  template,
  templateIndex,
  templateNumber,
}: {
  actionInProgress: string;
  copied: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  onShorten: () => void;
  template: EmailTemplate;
  templateIndex: number;
  templateNumber: number;
}) {
  const isBusy = actionInProgress.length > 0;
  const regenerating = actionInProgress === `regenerate-${templateIndex}`;
  const shortening = actionInProgress === `shorten-${templateIndex}`;

  return (
    <article className="rounded-lg border border-[#e4dbd1] bg-white shadow-sm transition hover:shadow-[0_14px_34px_rgba(33,28,22,0.08)]">
      <div className="grid gap-4 border-b border-[#eee7df] p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
              Email {templateNumber}
            </p>
            <h3 className="mt-2 text-2xl font-semibold leading-8 text-[#171717]">
              {template.subjectLine}
            </h3>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <ActionButton disabled={isBusy} label={regenerating ? "Regenerating" : "Regenerate"} onClick={onRegenerate} />
            <ActionButton disabled={isBusy} label={shortening ? "Shortening" : "Shorten"} onClick={onShorten} />
            <CopyButton copied={copied} onClick={onCopy} />
          </div>
        </div>

        <div className="grid w-full gap-3 text-sm md:grid-cols-3">
          <MetaBox label="From" value={template.fromLine} />
          <MetaBox label="Preview" value={template.previewText} />
          <MetaBox label="CTA" tone="accent" value={template.cta} />
        </div>
      </div>

      <div className="p-5">
        <p className="whitespace-pre-wrap rounded-md bg-[#faf7f2] p-4 text-sm leading-7 text-[#302a25]">
          {template.body}
        </p>
      </div>
    </article>
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

function CopyButton({
  copied,
  onClick,
}: {
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="h-10 rounded-md bg-[#171717] px-5 text-sm font-bold text-white transition hover:bg-[#332d28]"
      onClick={onClick}
      type="button"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ActionButton({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="h-10 rounded-md border border-[#e3d9cf] bg-[#fffaf3] px-4 text-sm font-bold text-[#4c4239] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
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

function formatTemplate(template: EmailTemplate) {
  return `From: ${template.fromLine}
Subject: ${template.subjectLine}
Preview: ${template.previewText}
CTA: ${template.cta}

${template.body}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function toAbsoluteUrl(path: string) {
  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
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
