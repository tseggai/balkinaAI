import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — Balkina AI',
  description: 'Balkina AI Terms of Service. Terms and conditions for using our platform.',
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Terms of Service</h1>
      <p className="mt-2 text-sm text-gray-400">Last updated: March 29, 2026</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-gray-600">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">1. Acceptance of Terms</h2>
          <p className="mt-2">
            By accessing or using the Balkina AI mobile application and web platform (the &quot;Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">2. Description of Service</h2>
          <p className="mt-2">
            Balkina AI is an AI-powered appointment booking platform that connects customers with service businesses. Customers discover and book appointments through a conversational AI chatbot. Businesses manage bookings, staff, services, and customers through a management dashboard.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">3. User Accounts</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>You must provide accurate and complete information when creating an account</li>
            <li>You are responsible for maintaining the security of your account credentials</li>
            <li>You must be at least 13 years old to use the Service</li>
            <li>One person may not maintain more than one customer account</li>
            <li>You are responsible for all activity that occurs under your account</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">4. Bookings and Appointments</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Balkina AI facilitates appointment bookings between customers and businesses</li>
            <li>We are not a party to the service agreement between customers and businesses</li>
            <li>Appointment availability, pricing, and service quality are determined by the business</li>
            <li>Cancellation and refund policies are set by individual businesses</li>
            <li>Deposits, when required, are processed through Stripe and subject to the business&apos;s deposit policy</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">5. Payments</h2>
          <p className="mt-2">
            Payments are processed securely through Stripe. By making a payment, you agree to Stripe&apos;s terms of service. Deposits are held and transferred to the business minus applicable platform fees. Refund eligibility is determined by the business&apos;s cancellation policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">6. Business Accounts (Tenants)</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Businesses subscribe to a plan (Starter, Pro, or Enterprise) with monthly billing</li>
            <li>A 14-day free trial is provided for new business accounts</li>
            <li>Subscription fees are billed monthly and are non-refundable</li>
            <li>We reserve the right to modify pricing with 30 days notice</li>
            <li>Businesses are responsible for the accuracy of their service listings, pricing, and availability</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">7. AI Chatbot Usage</h2>
          <p className="mt-2">
            The AI chatbot provides booking assistance based on available data. While we strive for accuracy, the AI may occasionally provide incorrect or incomplete information. Users should verify booking details before confirming. The AI chatbot is not a substitute for direct communication with service providers for complex inquiries.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">8. Prohibited Conduct</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Using the Service for any unlawful purpose</li>
            <li>Attempting to interfere with or disrupt the Service</li>
            <li>Creating fake accounts or submitting fraudulent bookings</li>
            <li>Scraping, data mining, or automated access to the Service</li>
            <li>Impersonating another person or entity</li>
            <li>Submitting false reviews or ratings</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">9. Intellectual Property</h2>
          <p className="mt-2">
            The Service, including its design, features, content, and technology, is owned by Balkina AI and protected by intellectual property laws. You may not copy, modify, distribute, or reverse-engineer any part of the Service without our written consent.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">10. Limitation of Liability</h2>
          <p className="mt-2">
            Balkina AI is provided &quot;as is&quot; without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">11. Termination</h2>
          <p className="mt-2">
            We may suspend or terminate your account at any time for violation of these terms. You may delete your account at any time through the app settings. Upon termination, your right to use the Service ceases immediately.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">12. Changes to Terms</h2>
          <p className="mt-2">
            We may modify these Terms at any time. Material changes will be communicated via the app or email. Continued use of the Service after changes constitutes acceptance of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">13. Contact</h2>
          <p className="mt-2">
            Questions about these Terms? Contact us at <a href="mailto:legal@balkina.ai" className="text-brand-600 hover:text-brand-700">legal@balkina.ai</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
