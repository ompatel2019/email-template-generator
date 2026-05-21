import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("notification_recipients")
    .select("id, email, name, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    recipients: (data ?? []).map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      createdAt: r.created_at,
    })),
  });
}

type CreateRecipientRequest = {
  email?: unknown;
  name?: unknown;
};

export async function POST(request: Request) {
  let payload: CreateRecipientRequest;

  try {
    payload = (await request.json()) as CreateRecipientRequest;
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const name = typeof payload.name === "string" ? payload.name.trim() : "";

  if (!email) {
    return Response.json({ error: "Email is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("notification_recipients")
    .insert({ email, name })
    .select("id, email, name, created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    recipient: { id: data.id, email: data.email, name: data.name, createdAt: data.created_at },
  });
}
