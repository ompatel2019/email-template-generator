import { createSupabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{ campaignId: string; recipientId: string }>;
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { campaignId, recipientId } = await params;
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("campaign_notification_recipients")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("recipient_id", recipientId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
