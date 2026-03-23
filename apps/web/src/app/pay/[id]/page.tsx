'use client';

import { useState, useEffect } from 'react';

/**
 * /pay/[id] — Mobile WebView payment page.
 *
 * Instead of rendering Stripe Elements (which use iframes that don't work in
 * React Native WebViews), this page creates a Stripe Checkout Session and
 * redirects to Stripe's hosted payment page. After payment, Stripe redirects
 * back here with ?status=success, which the WebView detects and closes.
 */
export default function PayPage({ params }: { params: { id: string } }) {
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Check for success redirect return from Stripe Checkout
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (
      urlParams.get('status') === 'success' ||
      urlParams.get('redirect_status') === 'succeeded'
    ) {
      setPaid(true);
    }
  }, []);

  // Create checkout session and redirect to Stripe
  useEffect(() => {
    if (paid || redirecting) return;

    async function startCheckout() {
      setRedirecting(true);
      try {
        const baseUrl = window.location.origin;
        const successUrl = `${baseUrl}/pay/${params.id}?status=success`;
        const cancelUrl = `${baseUrl}/pay/${params.id}?status=cancelled`;

        const res = await fetch('/api/payments/checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appointmentId: params.id,
            successUrl,
            cancelUrl,
          }),
        });

        const data = (await res.json()) as { url?: string; error?: string };

        if (!res.ok) {
          setError(data.error ?? 'Failed to create payment session');
          setRedirecting(false);
          return;
        }

        if (data.url) {
          window.location.href = data.url;
        } else {
          setError('No checkout URL returned');
          setRedirecting(false);
        }
      } catch {
        setError('Failed to connect to payment service');
        setRedirecting(false);
      }
    }

    startCheckout();
  }, [params.id, paid, redirecting]);

  if (paid) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>
            &#10003;
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Deposit Paid!
          </h1>
          <p style={{ color: '#64748b', textAlign: 'center' }}>
            Your deposit has been successfully processed. You can close this
            page and return to the app.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Payment Error
          </h1>
          <p style={{ color: '#ef4444' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={spinnerStyle} />
          <p style={{ color: '#64748b', fontSize: 14 }}>
            Redirecting to secure payment...
          </p>
        </div>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f8fafc',
  padding: 16,
};

const cardStyle: React.CSSProperties = {
  maxWidth: 440,
  width: '100%',
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 32,
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};

const spinnerStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  border: '3px solid #e5e7eb',
  borderTopColor: '#6B7FC4',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};
