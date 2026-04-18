import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Delete Your Account — Balkina AI',
  description: 'Request deletion of your Balkina AI account and all associated data.',
};

export default function DeleteAccountPage() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-16 md:py-24">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Delete Your Account</h1>
      <p className="mt-4 text-gray-600 leading-relaxed">
        You can delete your Balkina AI account and all associated data at any time directly from the app.
      </p>

      <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
        <h2 className="text-lg font-semibold text-gray-900">How to delete your account</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-gray-600">
          <li>Open the <strong>Balkina AI</strong> app on your device</li>
          <li>Tap the <strong>Profile</strong> tab at the bottom</li>
          <li>Scroll down and tap <strong>Delete Account</strong></li>
          <li>Confirm the deletion when prompted</li>
        </ol>
      </div>

      <div className="mt-8 space-y-4 text-sm text-gray-600 leading-relaxed">
        <h2 className="text-lg font-semibold text-gray-900">What gets deleted</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Your account credentials and profile information (name, email, phone, avatar)</li>
          <li>Your booking history and appointment records</li>
          <li>Your chat conversations</li>
          <li>Your saved preferences and behavior data</li>
          <li>Push notification tokens</li>
        </ul>
        <p>
          Account deletion is <strong>permanent and cannot be undone</strong>. All data is removed from our systems immediately upon confirmation.
        </p>
      </div>

      <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Need help?</h2>
        <p className="mt-2 text-gray-600">
          If you are unable to access the app or need assistance deleting your account, contact us at{' '}
          <a href="mailto:support@balkina.ai" className="font-medium text-blue-600 hover:underline">
            support@balkina.ai
          </a>{' '}
          with the email address associated with your account and we will process the deletion for you.
        </p>
      </div>
    </article>
  );
}
