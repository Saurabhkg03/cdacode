import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Practice | CDACode',
  description: 'Practice thousands of C-CAT questions by subject and topic. Track your accuracy and mastery.',
};

export default function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
