import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-white" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07-2.83 2.83M9.76 14.24l-2.83 2.83m11.14 0-2.83-2.83M9.76 9.76 6.93 6.93" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-wide text-gray-900">BALKINA</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">AI-powered appointment booking for modern businesses.</p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900">Product</h3>
            <ul className="mt-4 space-y-3">
              <li><Link href="/#features" className="text-sm text-gray-500 hover:text-brand-600">Features</Link></li>
              <li><Link href="/pricing" className="text-sm text-gray-500 hover:text-brand-600">Pricing</Link></li>
              <li><Link href="/#how-it-works" className="text-sm text-gray-500 hover:text-brand-600">How It Works</Link></li>
            </ul>
          </div>

          {/* Business */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900">For Businesses</h3>
            <ul className="mt-4 space-y-3">
              <li><a href="https://app.balkina.ai/auth/register" className="text-sm text-gray-500 hover:text-brand-600">Sign Up</a></li>
              <li><a href="https://app.balkina.ai/auth/login" className="text-sm text-gray-500 hover:text-brand-600">Tenant Dashboard</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900">Legal</h3>
            <ul className="mt-4 space-y-3">
              <li><Link href="/privacy" className="text-sm text-gray-500 hover:text-brand-600">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-sm text-gray-500 hover:text-brand-600">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-8 text-center">
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} Balkina AI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
