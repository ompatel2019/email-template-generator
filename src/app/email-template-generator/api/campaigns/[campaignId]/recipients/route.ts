import { createSupabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{ campaignId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { campaignId } = await params;
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("campaign_notification_recipients")
    .select("recipient_id, notification_recipients(id, email, name)")
    .eq("campaign_id", campaignId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  type JoinRow = { notification_recipients: { id: string; email: string; name: string } };

  const recipients = ((data ?? []) as unknown as JoinRow[])
    .map((row) => row.notification_recipients)
    .filter(Boolean);

  return Response.json({ recipients });
}

type AssignRequest = {
  recipientId?: unknown;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { campaignId } = await params;

  let payload: AssignRequest;

  try {
    payload = (await request.json()) as AssignRequest;
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const recipientId = typeof payload.recipientId === "string" ? payload.recipientId.trim() : "";

  if (!recipientId) {
    return Response.json({ error: "recipientId is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("campaign_notification_recipients")
    .insert({ campaign_id: campaignId, recipient_id: recipientId });

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "Recipient already assigned." }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
