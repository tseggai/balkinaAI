import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SupabaseProvider } from '@/components/supabase-provider';

export const metadata: Metadata = {
  title: 'Balkina AI — Admin Panel',
  description: 'Platform administration for Balkina AI',
  icons: {
    icon: '/assets/Balkina_icon_color.png',
    apple: '/assets/Balkina_icon_color.png',
  },
};

/**
 * An explicit theme colour stops iOS Safari from sampling the page to tint its
 * address bar and toolbar. Without it, Safari keeps the dimmed colour it sampled
 * while the mobile drawer's overlay was open and only clears it on a full reload.
 * `viewportFit: 'cover'` is what makes the env(safe-area-inset-*) paddings apply.
 */
export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  return (
    <html lang="en">
      <body>
        <SupabaseProvider
          supabaseUrl={supabaseUrl}
          supabaseAnonKey={supabaseAnonKey}
        >
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}
