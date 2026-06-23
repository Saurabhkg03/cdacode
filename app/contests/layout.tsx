import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contests | CDACode',
  description: 'Participate in live weekly and biweekly C-CAT contests to compete globally.',
};

export default function ContestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
