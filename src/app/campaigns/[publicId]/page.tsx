import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    publicId: string;
  }>;
};

export default async function CampaignTemplatesPage({ params }: PageProps) {
  const { publicId } = await params;
  redirect(`/campaign/${publicId}`);
}
