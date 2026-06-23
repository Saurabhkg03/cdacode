import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile | CDACode',
  description: 'View your CDACode profile, statistics, and history.',
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
