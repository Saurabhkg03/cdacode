import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard | GATECode',
  description: 'Check your global Elo rating and rank among other C-CAT aspirants.',
};

export default function LeaderboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
