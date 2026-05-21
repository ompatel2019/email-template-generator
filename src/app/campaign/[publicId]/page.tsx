import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { CampaignTabs } from "./campaign-tabs";

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

  const { data: rejectedSubmissions, error: rejectedError } = await supabase
    .from("campaign_submissions")
    .select("id, from_line, subject_line, preview_text, body, cta, notes, restrictions, rejection_reason")
    .eq("campaign_id", campaign.id)
    .eq("status", "rejected")
    .order("created_at", { ascending: false });

  if (rejectedError || !rejectedSubmissions) {
    throw new Error(rejectedError?.message || "Failed to load rejected submissions.");
  }

  return (
    <main className="min-h-screen bg-[#f5f1ea] px-4 py-6 text-[#171717] sm:px-6 lg:px-8">
      <section className="mx-auto grid w-full max-w-5xl gap-5">
        <header className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a34f2d]">
            Email templates
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {campaign.trial_name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#665e56]">
            Browse verified templates, check what&apos;s in review, or suggest new copy.
          </p>
        </header>

        <CampaignTabs
          publicId={publicId}
          templates={templates}
          submissions={submissions}
          rejectedSubmissions={rejectedSubmissions}
        />
      </section>
    </main>
  );
}
