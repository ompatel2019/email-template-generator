import { createSupabaseAdmin } from "@/lib/supabase-admin";

type CampaignRow = {
  created_at: string;
  email_templates?: Array<{ id: string }>;
  id: string;
  public_id: string;
  trial_name: string;
};

export async function GET() {
  try {
    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
      .from("campaigns")
      .select("id, public_id, trial_name, created_at, email_templates(id)")
      .order("created_at", { ascending: false });

    if (error || !data) {
      throw new Error(error?.message || "Failed to load campaigns.");
    }

    return Response.json({
      campaigns: (data as CampaignRow[]).map((campaign) => ({
        createdAt: campaign.created_at,
        id: campaign.id,
        publicId: campaign.public_id,
        publicPath: `/campaigns/${campaign.public_id}`,
        templateCount: campaign.email_templates?.length || 0,
        trialName: campaign.trial_name,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load campaigns.";
    return Response.json({ error: message }, { status: 500 });
  }
}
