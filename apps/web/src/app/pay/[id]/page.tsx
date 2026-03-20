'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentData {
  clientSecret: string;
  amount: number;
  currency: string;
  serviceName?: string;
  businessName?: string;
}

function CheckoutForm({ onSuccess }: { onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href + '?status=success',
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message ?? 'Payment failed');
      setIsProcessing(false);
    } else {
      onSuccess();
    }
  }, [stripe, elements, onSuccess]);

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <p style={{ color: '#ef4444', marginTop: 12, fontSize: 14 }}>{error}</p>}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        style={{
          marginTop: 24,
          width: '100%',
          padding: '14px 0',
          backgroundColor: isProcessing ? '#94a3b8' : '#6366f1',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: 16,
          fontWeight: 600,
          cursor: isProcessing ? 'not-allowed' : 'pointer',
        }}
      >
        {isProcessing ? 'Processing...' : 'Pay Deposit'}
      </button>
    </form>
  );
}

export default function PayPage({ params }: { params: { id: string } }) {
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  // Check for redirect return
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('status') === 'success' || urlParams.get('redirect_status') === 'succeeded') {
      setPaid(true);
      setLoading(false);
      return;
    }
  }, []);

  useEffect(() => {
    if (paid) return;

    async function fetchPayment() {
      try {
        const res = await fetch('/api/payments/create-deposit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId: params.id }),
        });
        const data = await res.json() as { clientSecret?: string; amount?: number; currency?: string; error?: string };
        if (!res.ok) {
          setError(data.error ?? 'Failed to load payment');
          return;
        }
        setPaymentData({
          clientSecret: data.clientSecret!,
          amount: data.amount!,
          currency: data.currency!,
        });
      } catch {
        setError('Failed to connect to payment service');
      } finally {
        setLoading(false);
      }
    }
    fetchPayment();
  }, [params.id, paid]);

  if (paid) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>&#10003;</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>Deposit Paid!</h1>
          <p style={{ color: '#64748b', textAlign: 'center' }}>
            Your deposit has been successfully processed. You can close this page and return to the app.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <p style={{ textAlign: 'center', color: '#64748b' }}>Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Payment Error</h1>
          <p style={{ color: '#ef4444' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!paymentData) return null;

  const amountDisplay = (paymentData.amount / 100).toFixed(2);

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Pay Deposit</h1>
        <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>
          Deposit amount: <strong>${amountDisplay}</strong>
        </p>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret: paymentData.clientSecret,
            appearance: { theme: 'stripe' },
          }}
        >
          <CheckoutForm onSuccess={() => setPaid(true)} />
        </Elements>
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
