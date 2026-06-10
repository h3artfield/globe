import { ForecastTournamentDetailPageClient } from "@/components/ForecastTournamentDetailPageClient";

type TournamentDetailPageProps = {
  params: Promise<{ tournamentId: string }>;
};

export default async function TournamentDetailPage({ params }: TournamentDetailPageProps) {
  const { tournamentId } = await params;
  return <ForecastTournamentDetailPageClient tournamentId={tournamentId} />;
}
