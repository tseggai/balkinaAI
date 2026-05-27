'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';

const SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', CHF: 'CHF', JPY: '¥', RSD: 'RSD',
};

interface CurrencyContextValue {
  code: string;
  symbol: string;
  format: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  code: 'USD',
  symbol: '$',
  format: (n) => `$${n % 1 === 0 ? n : n.toFixed(2)}`,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState('USD');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('tenants').select('id').eq('user_id', user.id).single().then(({ data: tenant }) => {
        if (!tenant) return;
        const t = tenant as { id: string };
        supabase.from('tenant_locations').select('currency').eq('tenant_id', t.id).limit(1).single().then(({ data: loc }) => {
          if (loc && (loc as { currency?: string }).currency) {
            setCode((loc as { currency: string }).currency);
          }
        });
      });
    });
  }, []);

  const symbol = SYMBOLS[code] ?? '$';
  const format = (n: number) => `${symbol}${n % 1 === 0 ? n : n.toFixed(2)}`;

  return (
    <CurrencyContext.Provider value={{ code, symbol, format }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
