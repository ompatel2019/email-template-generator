import { createSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type CampaignRow = {
  created_at: string;
  email_templates?: Array<{ id: string; verified?: boolean | null }>;
  id: string;
  public_id: string;
  trial_name: string;
};

type CreateCampaignRequest = {
  trialName?: unknown;
};

export async function GET() {
  try {
    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
      .from("campaigns")
      .select("id, public_id, trial_name, created_at, email_templates(id, verified)")
      .order("created_at", { ascending: false });

    if (error || !data) {
      throw new Error(error?.message || "Failed to load campaigns.");
    }

    return Response.json(
      {
        campaigns: (data as CampaignRow[]).map((campaign) => ({
          createdAt: campaign.created_at,
          id: campaign.id,
          publicId: campaign.public_id,
          publicPath: `/campaign/${campaign.public_id}`,
          templateCount: campaign.email_templates?.length || 0,
          verifiedCount:
            campaign.email_templates?.filter((template) => Boolean(template.verified)).length || 0,
          trialName: campaign.trial_name,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load campaigns.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let payload: CreateCampaignRequest;

  try {
    payload = (await request.json()) as CreateCampaignRequest;
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const trialName = typeof payload.trialName === "string" ? payload.trialName.trim() : "";

  if (!trialName) {
    return Response.json({ error: "Trial name is required." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdmin();
    const campaignId = crypto.randomUUID();
    const publicId = toShortPublicId(campaignId);

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert({
        id: campaignId,
        public_id: publicId,
        trial_name: trialName,
        source_email: "",
        subject_lines: "",
        from_lines: "",
        restrictions: "",
      })
      .select("id, public_id, trial_name, created_at")
      .single();

    if (error || !campaign) {
      throw new Error(error?.message || "Failed to create campaign.");
    }

    return Response.json({
      campaign: {
        createdAt: campaign.created_at,
        id: campaign.id,
        publicId: campaign.public_id,
        publicPath: `/campaign/${campaign.public_id}`,
        templateCount: 0,
        trialName: campaign.trial_name,
        verifiedCount: 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create campaign.";
    return Response.json({ error: message }, { status: 500 });
  }
}

function toShortPublicId(id: string) {
  return id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase();
}
