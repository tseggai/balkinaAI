import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Balkina AI',
  description: 'Balkina AI Privacy Policy. How we collect, use, and protect your data.',
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-400">Last updated: March 29, 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-gray-600">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">1. Introduction</h2>
          <p className="mt-2">
            Balkina AI (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates the Balkina AI mobile application and web platform (collectively, the &quot;Service&quot;). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">2. Information We Collect</h2>
          <h3 className="mt-3 font-semibold text-gray-800">Personal Information</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Name, email address, and phone number when you create an account</li>
            <li>Profile information you choose to provide</li>
            <li>Payment information processed securely through Stripe</li>
            <li>Appointment booking details and history</li>
          </ul>
          <h3 className="mt-3 font-semibold text-gray-800">Automatically Collected Information</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Device information (type, operating system, unique identifiers)</li>
            <li>Usage data (features accessed, interactions, timestamps)</li>
            <li>Location data (with your consent, for finding nearby businesses)</li>
            <li>Push notification tokens (for sending booking updates)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">3. How We Use Your Information</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>To provide, maintain, and improve our Service</li>
            <li>To process appointments and payments</li>
            <li>To send booking confirmations, reminders, and updates</li>
            <li>To personalize your experience with AI-powered recommendations</li>
            <li>To communicate with you about the Service</li>
            <li>To detect, prevent, and address fraud or technical issues</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">4. AI Chat Data</h2>
          <p className="mt-2">
            Our AI chatbot processes your messages to understand booking requests and provide relevant results. Chat conversations are used to improve the booking experience. We do not sell chat data to third parties. Chat history may be retained to provide continuity in your booking experience.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">5. Data Sharing</h2>
          <p className="mt-2">We share your information only in the following circumstances:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Service Providers:</strong> With businesses you book appointments with (name, contact, booking details)</li>
            <li><strong>Payment Processors:</strong> Stripe processes payments securely on our behalf</li>
            <li><strong>Communication Services:</strong> Twilio (SMS), Resend (email), Expo (push notifications)</li>
            <li><strong>Legal Requirements:</strong> When required by law or to protect rights and safety</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">6. Data Security</h2>
          <p className="mt-2">
            We implement industry-standard security measures including encryption in transit (TLS), secure database hosting with Supabase, and Row Level Security (RLS) policies to ensure data isolation between users and businesses.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">7. Your Rights</h2>
          <p className="mt-2">You have the right to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Opt out of marketing communications</li>
            <li>Disable location sharing at any time</li>
            <li>Request a copy of your data in a portable format</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">8. Children&apos;s Privacy</h2>
          <p className="mt-2">
            Our Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If we learn we have collected such information, we will delete it promptly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">9. Changes to This Policy</h2>
          <p className="mt-2">
            We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">10. Contact Us</h2>
          <p className="mt-2">
            If you have questions about this Privacy Policy, please contact us at <a href="mailto:privacy@balkina.ai" className="text-brand-600 hover:text-brand-700">privacy@balkina.ai</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
