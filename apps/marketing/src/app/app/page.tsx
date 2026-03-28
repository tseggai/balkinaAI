import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Balkina App — Book Anything with AI',
  description: 'Download the Balkina app. Chat with AI to discover businesses, check availability, and book appointments in seconds.',
};

const STEPS = [
  {
    num: '1',
    title: 'Open the chat',
    desc: 'No browsing, no searching through lists. Just say what you need.',
    example: '"I need a haircut near downtown"',
  },
  {
    num: '2',
    title: 'See your options',
    desc: 'The AI shows matching businesses with ratings, distance, prices, and real-time availability.',
    example: 'Business cards with services, staff, and time slots',
  },
  {
    num: '3',
    title: 'Book and go',
    desc: 'Pick a time, confirm, pay the deposit if needed. You get a confirmation instantly.',
    example: '"Book a facial at Glow for tomorrow at 2pm"',
  },
];

const PERKS = [
  { icon: '💬', title: 'One Chat, Every Booking', desc: 'Barbers, yoga, dental, massage, personal training — all from one app.' },
  { icon: '📍', title: 'Nearby Discovery', desc: 'Find businesses near you with distance, drive time, and ratings.' },
  { icon: '⚡', title: 'Real-Time Availability', desc: 'No "we\'ll call you back". See actual open slots and book instantly.' },
  { icon: '💳', title: 'Pay in App', desc: 'Apple Pay, Google Pay, or card. Deposits handled securely.' },
  { icon: '🔔', title: 'Smart Reminders', desc: 'Push notifications so you never miss an appointment.' },
  { icon: '🔄', title: 'Easy Rebooking', desc: 'AI remembers your preferences and suggests when it\'s time to rebook.' },
];

export default function AppPage() {
  return (
    <>
      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/60 to-white">
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-20 md:pt-28">
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-16">
            {/* Left — text */}
            <div className="flex-1 text-center lg:text-left">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
                Free on iOS & Android
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
                Book anything<br />
                <span className="bg-gradient-to-r from-brand-600 to-indigo-500 bg-clip-text text-transparent">by chatting</span>
              </h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-gray-600 lg:mx-0 mx-auto">
                Tell the AI what you need. It finds the best businesses near you, shows live availability, and books your appointment — in seconds, not minutes.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start sm:justify-center">
                <a href="#" className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-7 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-gray-800 transition-colors">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
                  App Store
                </a>
                <a href="#" className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-7 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-gray-800 transition-colors">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.292l2.545 1.473c.68.394.68 1.03 0 1.424l-2.545 1.473-2.534-2.534 2.534-2.536zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" /></svg>
                  Google Play
                </a>
              </div>
            </div>

            {/* Right — phone mockup */}
            <div className="shrink-0">
              <div className="rounded-[2.5rem] border-[6px] border-gray-800 bg-gray-800 p-1 shadow-2xl">
                <div className="w-[280px] rounded-[2rem] bg-white overflow-hidden">
                  <div className="mx-auto mt-2 h-5 w-24 rounded-full bg-gray-800" />
                  <div className="flex items-center justify-center gap-2 border-b border-gray-100 py-2.5">
                    <div className="h-5 w-5 rounded-full bg-brand-600" />
                    <span className="text-xs font-bold tracking-wide text-gray-900">BALKINA</span>
                  </div>
                  <div className="space-y-2.5 p-4" style={{ minHeight: 380 }}>
                    <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-brand-600 px-3.5 py-2 text-[12px] text-white">
                      Find a massage nearby
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-gray-100 px-3.5 py-2 text-[12px] text-gray-700">
                      Here are 3 top-rated options near you:
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 rounded-xl border border-gray-200 p-2.5">
                        <div className="h-12 rounded-lg bg-gradient-to-br from-teal-100 to-cyan-50" />
                        <p className="mt-1.5 text-[11px] font-semibold text-gray-800">Zen Spa</p>
                        <p className="text-[10px] text-gray-400">0.2 mi &middot; 4.9</p>
                      </div>
                      <div className="flex-1 rounded-xl border border-gray-200 p-2.5">
                        <div className="h-12 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-50" />
                        <p className="mt-1.5 text-[11px] font-semibold text-gray-800">Bliss Body</p>
                        <p className="text-[10px] text-gray-400">0.4 mi &middot; 4.8</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="rounded-lg border border-brand-300 bg-brand-50 px-2.5 py-1.5">
                        <p className="text-[10px] font-medium text-brand-800">Deep Tissue</p>
                        <p className="text-[9px] text-brand-600">$110 &middot; 60 min</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 px-2.5 py-1.5">
                        <p className="text-[10px] font-medium text-gray-700">Swedish</p>
                        <p className="text-[9px] text-gray-400">$90 &middot; 60 min</p>
                      </div>
                    </div>
                    <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-md bg-brand-600 px-3.5 py-2 text-[12px] text-white">
                      Deep tissue at Zen for 3pm
                    </div>
                    <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                      <div className="flex items-center gap-1.5">
                        <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        <span className="text-[11px] font-semibold text-green-800">Confirmed!</span>
                      </div>
                      <p className="mt-1 text-[10px] text-green-700">Deep Tissue at Zen Spa &middot; Today 3 PM</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 px-4 py-3">
                    <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2">
                      <span className="flex-1 text-[12px] text-gray-400">Ask me anything...</span>
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600">
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────────────────────────────── */}
      <section className="py-24 md:py-32">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">Booking in 3 messages</h2>
            <p className="mt-4 text-lg text-gray-500">No apps to learn, no menus to navigate. Just chat.</p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.num} className="rounded-2xl bg-gray-50 p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">{s.num}</div>
                <h3 className="mt-5 text-base font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{s.desc}</p>
                <p className="mt-3 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs italic text-brand-700">{s.example}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Perks ────────────────────────────────────────────────────────── */}
      <section className="bg-gray-50 py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">Why customers love Balkina</h2>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {PERKS.map((p, i) => (
              <div key={i} className="rounded-2xl border border-gray-100 bg-white p-6">
                <span className="text-2xl">{p.icon}</span>
                <h3 className="mt-3 text-base font-semibold text-gray-900">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Download CTA ─────────────────────────────────────────────────── */}
      <section className="bg-brand-600 py-20 md:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Stop calling. Start chatting.</h2>
          <p className="mt-4 text-lg text-brand-100">Download Balkina and book your next appointment in under a minute.</p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a href="#" className="inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-gray-900 shadow-lg hover:bg-gray-50 transition-colors">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
              Download for iPhone
            </a>
            <a href="#" className="inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-gray-900 shadow-lg hover:bg-gray-50 transition-colors">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.292l2.545 1.473c.68.394.68 1.03 0 1.424l-2.545 1.473-2.534-2.534 2.534-2.536zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" /></svg>
              Download for Android
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
