import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book an Appointment — Balkina AI',
  description: 'Chat with our AI assistant to book your appointment',
};

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
