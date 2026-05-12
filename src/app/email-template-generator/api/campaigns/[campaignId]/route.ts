import { createSupabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    campaignId: string;
  }>;
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { campaignId } = await params;
  const supabase = createSupabaseAdmin();

  const { error } = await supabase.from("campaigns").delete().eq("id", campaignId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
