import type { Metadata } from 'next';
import DeckAdmin from '@/components/deck-admin/DeckAdmin';

export const metadata: Metadata = {
  title: 'White-label deck — Slide Editor',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <DeckAdmin deck="whitelabel" />;
}
