import { createSupabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    publicId: string;
  }>;
};

type SubmissionRequest = {
  body?: unknown;
  cta?: unknown;
  fromLine?: unknown;
  notes?: unknown;
  previewText?: unknown;
  restrictions?: unknown;
  subjectLine?: unknown;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { publicId } = await params;

  let payload: SubmissionRequest;

  try {
    payload = (await request.json()) as SubmissionRequest;
  } catch {
    return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const submission = {
    body: readText(payload.body),
    cta: readText(payload.cta),
    from_line: readText(payload.fromLine),
    notes: readText(payload.notes),
    preview_text: readText(payload.previewText),
    restrictions: readText(payload.restrictions),
    subject_line: readText(payload.subjectLine),
  };

  if (!Object.values(submission).some(Boolean)) {
    return Response.json({ error: "Add at least one input before submitting." }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("public_id", publicId)
    .single();

  if (campaignError || !campaign) {
    return Response.json({ error: "Campaign not found." }, { status: 404 });
  }

  const { error } = await supabase.from("campaign_submissions").insert({
    campaign_id: campaign.id,
    ...submission,
    status: "pending",
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
