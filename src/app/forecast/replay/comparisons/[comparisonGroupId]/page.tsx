import { ComparisonPageClient } from "@/components/ComparisonPageClient";

type ComparisonPageProps = {
  params: Promise<{ comparisonGroupId: string }>;
};

export default async function ComparisonPage({ params }: ComparisonPageProps) {
  const { comparisonGroupId } = await params;
  return <ComparisonPageClient comparisonGroupId={comparisonGroupId} />;
}
