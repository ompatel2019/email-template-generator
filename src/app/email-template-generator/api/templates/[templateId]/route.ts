import { createSupabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

type UpdateTemplateRequest = {
  verified?: unknown;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { templateId } = await params;

  let payload: UpdateTemplateRequest;

  try {
    payload = (await request.json()) as UpdateTemplateRequest;
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  if (typeof payload.verified !== "boolean") {
    return Response.json({ error: "verified must be a boolean." }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("email_templates")
    .update({ verified: payload.verified })
    .eq("id", templateId)
    .select("id, verified")
    .single();

  if (error || !data) {
    return Response.json(
      { error: error?.message || "Failed to update template verification." },
      { status: 500 },
    );
  }

  return Response.json({
    template: {
      id: data.id,
      verified: Boolean(data.verified),
    },
  });
}
