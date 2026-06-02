'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface PropertyData {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  welcome_message: string;
  primary_color: string;
  background_color: string | null;
}

interface TenantSummary {
  id: string;
  name: string;
  logo_url: string | null;
  subcategory?: string;
  avg_rating: number | null;
  review_count: number | null;
}

/* ─── Card data shapes (match the chat route's [[CARD:...]] contract) ──────── */

interface ServiceItem { id: string; name: string; price: number; duration_minutes: number; deposit_enabled?: boolean; deposit_amount?: number; image_url?: string }
interface BusinessWithServices { id: string; name: string; image_url?: string; distance_mi?: number; drive_minutes?: number; category?: string; services?: ServiceItem[] }
interface Slot { time: string; iso?: string; staff_name?: string }
interface StaffWithSlots { id: string; name: string; image_url?: string; available_slots_count?: number; slots?: Slot[] }
interface PackageItem { id: string; name: string; image_url?: string; price: number; sessions_count?: number; customer_owned?: boolean; sessions_remaining?: number }
interface ExtraItem { id: string; name: string; price: number; duration_minutes?: number }
interface SummaryCard {
  service?: string; package?: string; extras?: { name: string; price: number }[];
  business?: string; staff?: string; date?: string; time?: string; address?: string;
  subtotal?: number; extras_total?: number; package_discount?: number; coupon_discount?: number;
  loyalty_discount?: number; total?: number; deposit_required?: number; points_to_earn?: number;
}
interface ConfirmedCard {
  service?: string; package?: string; extras?: { name: string; price: number }[];
  business?: string; staff?: string; date?: string; time?: string; address?: string;
  total?: number; points_earned?: number; latitude?: number; longitude?: number;
  deposit_amount?: number; deposit_paid?: boolean; payment_url?: string; payment_required?: boolean;
}
type AnyCard =
  | ({ type: 'business_with_services'; items?: BusinessWithServices[] })
  | ({ type: 'staff_with_slots'; items?: StaffWithSlots[]; anyone_slots?: Slot[] })
  | ({ type: 'booking_options'; packages?: PackageItem[]; extras?: ExtraItem[] })
  | ({ type: 'summary_card' } & SummaryCard)
  | ({ type: 'confirmed_card' } & ConfirmedCard)
  | ({ type: string; [k: string]: unknown });

function generateSessionId(): string {
  return `portal_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

function money(n: number | undefined): string {
  if (n === undefined || n === null) return '';
  return `$${Number(n).toFixed(Number.isInteger(n) ? 0 : 2)}`;
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function PropertyPortalPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [property, setProperty] = useState<PropertyData | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(generateSessionId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // Load property + its businesses
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/properties?slug=${encodeURIComponent(slug)}`);
        if (!res.ok) { setNotFound(true); setLoading(false); return; }
        const json = await res.json();
        const p = json.property as PropertyData;
        setProperty(p);
        setTenants((json.tenants ?? []) as TenantSummary[]);
        const top = (json.tenants ?? []).slice(0, 6) as TenantSummary[];
        const chips = top.map((t) => `[[button:${t.name}]]`).join(' ');
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: `${p.welcome_message || `Welcome to ${p.name}! What would you like to book today?`}${chips ? `\n\n${chips}` : ''}`,
        }]);
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    })();
  }, [slug]);

  const brand = property?.primary_color || '#6B7FC4';

  const sendMessage = useCallback(async (messageText?: string) => {
    const trimmed = (messageText ?? input).trim();
    if (!trimmed || isLoading || !property) return;

    const userMsg: ChatMessage = { id: `user_${Date.now()}`, role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    if (!messageText) setInput('');
    setIsLoading(true);

    const assistantId = `assistant_${Date.now()}`;
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', isStreaming: true }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, propertyId: property.id, sessionId }),
      });

      if (!res.ok || !res.body) {
        const errJson = await res.json().catch(() => ({ error: 'Failed to send message' }));
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: `Sorry, something went wrong: ${errJson.error}`, isStreaming: false } : m));
        setIsLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let done = false;

      while (!done) {
        const { done: rDone, value } = await reader.read();
        if (rDone) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr) as { type: string; content?: string; name?: string };
            if (event.type === 'text') {
              fullText += event.content ?? '';
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: fullText } : m));
            } else if (event.type === 'tool_call') {
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: fullText || `One moment…` } : m));
            } else if (event.type === 'done') {
              done = true;
            } else if (event.type === 'error') {
              setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: `Sorry, something went wrong. Please try again.`, isStreaming: false } : m));
            }
          } catch { /* skip malformed */ }
        }
      }
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, isStreaming: false } : m));
    } catch {
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: 'Sorry, I had trouble connecting. Please try again.', isStreaming: false } : m));
    }
    setIsLoading(false);
  }, [input, isLoading, property, sessionId]);

  const handleAction = useCallback((text: string) => { if (!isLoading) sendMessage(text); }, [isLoading, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-gray-50"><div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300" style={{ borderTopColor: '#6B7FC4' }} /></div>;
  }
  if (notFound || !property) {
    return <div className="flex h-screen items-center justify-center bg-gray-50 px-4"><p className="text-sm text-gray-500">This booking portal could not be found.</p></div>;
  }

  return (
    <div className="flex h-screen flex-col" style={{ backgroundColor: property.background_color || '#f9fafb' }}>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        {property.logo_url ? (
          <img src={property.logo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: brand }}>{property.name.charAt(0)}</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{property.name}</p>
          <p className="text-xs text-gray-500">Booking Assistant · {tenants.length} businesses</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[92%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'user' ? 'text-white' : 'bg-white text-gray-800 shadow-sm border border-gray-100'}`}
              style={msg.role === 'user' ? { backgroundColor: brand } : undefined}
            >
              <MessageContent content={msg.content} isStreaming={msg.isStreaming} isUser={msg.role === 'user'} brand={brand} onAction={handleAction} />
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }}
            onKeyDown={handleKeyDown}
            placeholder="Ask for anything — e.g. a haircut tomorrow afternoon"
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 disabled:opacity-50"
            style={{ maxHeight: '120px' }}
          />
          <button onClick={() => sendMessage()} disabled={isLoading || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-50 transition-colors"
            style={{ backgroundColor: brand }}>
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-gray-400">Powered by Balkina AI</p>
      </div>
    </div>
  );
}

/* ─── Message + card rendering ───────────────────────────────────────────── */

const CARD_REGEX = /\[\[CARD:([\s\S]*?)\]\]/g;
const BUTTON_REGEX = /\[\[button:(.*?)\]\]/g;
const LINK_REGEX = /\[\[link:([^|]+)\|([^\]]+)\]\]/g;

function MessageContent({ content, isStreaming, isUser, brand, onAction }: {
  content: string; isStreaming?: boolean; isUser: boolean; brand: string; onAction: (text: string) => void;
}) {
  if (!content && isStreaming) {
    return (
      <div className="flex items-center gap-1.5">
        {[0, 150, 300].map((d) => <div key={d} className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: `${d}ms` }} />)}
      </div>
    );
  }

  if (isUser) {
    const formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />');
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  }

  // Split into ordered segments of text and cards.
  const segments: ({ kind: 'text'; value: string } | { kind: 'card'; card: AnyCard })[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  CARD_REGEX.lastIndex = 0;
  while ((m = CARD_REGEX.exec(content)) !== null) {
    if (m.index > lastIndex) segments.push({ kind: 'text', value: content.slice(lastIndex, m.index) });
    try {
      segments.push({ kind: 'card', card: JSON.parse(m[1]!) as AnyCard });
    } catch {
      // If the card JSON is still streaming/incomplete, skip it silently.
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < content.length) segments.push({ kind: 'text', value: content.slice(lastIndex) });

  return (
    <div className="space-y-2">
      {segments.map((seg, i) => seg.kind === 'text'
        ? <TextSegment key={i} value={seg.value} brand={brand} isStreaming={isStreaming} onAction={onAction} />
        : <CardSegment key={i} card={seg.card} brand={brand} onAction={onAction} />)}
    </div>
  );
}

function TextSegment({ value, brand, isStreaming, onAction }: { value: string; brand: string; isStreaming?: boolean; onAction: (t: string) => void }) {
  const links: { label: string; url: string }[] = [];
  const withoutLinks = value.replace(LINK_REGEX, (_x, label: string, url: string) => { links.push({ label: label.trim(), url: url.trim() }); return ''; });
  const buttons: string[] = [];
  const textOnly = withoutLinks.replace(BUTTON_REGEX, (_x, label: string) => { buttons.push(label); return ''; }).trim();
  const formatted = textOnly.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />');

  return (
    <div>
      {textOnly && <span dangerouslySetInnerHTML={{ __html: formatted }} />}
      {!isStreaming && (links.length > 0 || buttons.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {links.map((l, i) => (
            <a key={`l${i}`} href={l.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold no-underline" style={{ color: brand, borderColor: brand }}>
              📍 {l.label}
            </a>
          ))}
          {buttons.map((b, i) => (
            <button key={`b${i}`} onClick={() => onAction(b)}
              className="rounded-full border px-3 py-1.5 text-xs font-medium hover:opacity-80" style={{ color: brand, borderColor: brand }}>
              {b}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CardSegment({ card, brand, onAction }: { card: AnyCard; brand: string; onAction: (t: string) => void }) {
  switch (card.type) {
    case 'business_with_services':
      return <BusinessCards items={(card as { items?: BusinessWithServices[] }).items ?? []} brand={brand} onAction={onAction} />;
    case 'staff_with_slots':
      return <StaffSlots items={(card as { items?: StaffWithSlots[] }).items ?? []} anyone={(card as { anyone_slots?: Slot[] }).anyone_slots ?? []} brand={brand} onAction={onAction} />;
    case 'booking_options':
      return <BookingOptions packages={(card as { packages?: PackageItem[] }).packages ?? []} extras={(card as { extras?: ExtraItem[] }).extras ?? []} brand={brand} onAction={onAction} />;
    case 'summary_card':
      return <Summary card={card as SummaryCard} brand={brand} onAction={onAction} />;
    case 'confirmed_card':
      return <Confirmed card={card as ConfirmedCard} brand={brand} />;
    default:
      return null;
  }
}

function Avatar({ url, name, brand, size = 40 }: { url?: string; name: string; brand: string; size?: number }) {
  return url
    ? <img src={url} alt="" className="flex-shrink-0 rounded-lg object-cover" style={{ width: size, height: size }} />
    : <div className="flex flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ width: size, height: size, backgroundColor: brand }}>{name.charAt(0)}</div>;
}

function BusinessCards({ items, brand, onAction }: { items: BusinessWithServices[]; brand: string; onAction: (t: string) => void }) {
  return (
    <div className="space-y-3">
      {items.map((b) => (
        <div key={b.id} className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-3">
            <Avatar url={b.image_url} name={b.name} brand={brand} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{b.name}</p>
              <p className="text-xs text-gray-500 truncate">{[b.category, b.distance_mi ? `${b.distance_mi} mi` : null].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          {b.services && b.services.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {b.services.map((s) => (
                <button key={s.id} onClick={() => onAction(`I'd like "${s.name}" at ${b.name}`)}
                  className="rounded-lg border px-2.5 py-1.5 text-xs hover:opacity-80" style={{ borderColor: brand, color: brand }}>
                  {s.name} · {money(s.price)} · {s.duration_minutes}m
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StaffSlots({ items, anyone, brand, onAction }: { items: StaffWithSlots[]; anyone: Slot[]; brand: string; onAction: (t: string) => void }) {
  const SlotChips = ({ slots, staffName }: { slots: Slot[]; staffName?: string }) => (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {slots.slice(0, 12).map((s, i) => (
        <button key={i} onClick={() => onAction(`Book ${s.time}${staffName ? ` with ${staffName}` : s.staff_name ? ` with ${s.staff_name}` : ''}`)}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90" style={{ backgroundColor: brand }}>
          {s.time}
        </button>
      ))}
    </div>
  );
  return (
    <div className="space-y-3">
      {items.map((st) => (
        <div key={st.id} className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-3">
            <Avatar url={st.image_url} name={st.name} brand={brand} size={32} />
            <p className="text-sm font-semibold text-gray-900">{st.name}</p>
          </div>
          <SlotChips slots={st.slots ?? []} staffName={st.name} />
        </div>
      ))}
      {anyone.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-sm font-semibold text-gray-900">Any available staff</p>
          <SlotChips slots={anyone} />
        </div>
      )}
    </div>
  );
}

function BookingOptions({ packages, extras, brand, onAction }: { packages: PackageItem[]; extras: ExtraItem[]; brand: string; onAction: (t: string) => void }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
      {packages.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400">Packages</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {packages.map((p) => (
              <button key={p.id} onClick={() => onAction(`Use package "${p.name}"`)}
                className="rounded-lg border px-2.5 py-1.5 text-xs hover:opacity-80" style={{ borderColor: brand, color: brand }}>
                {p.name}{p.sessions_count ? ` · ${p.sessions_count}x` : ''} · {money(p.price)}
              </button>
            ))}
          </div>
        </div>
      )}
      {extras.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400">Add-ons</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {extras.map((e) => (
              <button key={e.id} onClick={() => onAction(`Add "${e.name}"`)}
                className="rounded-lg border px-2.5 py-1.5 text-xs hover:opacity-80" style={{ borderColor: brand, color: brand }}>
                + {e.name} · {money(e.price)}
              </button>
            ))}
          </div>
        </div>
      )}
      <button onClick={() => onAction('Continue, no extras')}
        className="rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: brand }}>
        Continue
      </button>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value?: string | number; strong?: boolean }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className={`flex justify-between text-xs ${strong ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function Summary({ card, brand, onAction }: { card: SummaryCard; brand: string; onAction: (t: string) => void }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-1.5">
      <p className="mb-1 text-sm font-semibold text-gray-900">Booking summary</p>
      <Row label="Business" value={card.business} />
      <Row label="Service" value={card.package ? `${card.service ?? ''} (${card.package})` : card.service} />
      {card.extras?.map((e, i) => <Row key={i} label={`+ ${e.name}`} value={money(e.price)} />)}
      <Row label="Staff" value={card.staff} />
      <Row label="When" value={[card.date, card.time].filter(Boolean).join(' · ')} />
      <Row label="Where" value={card.address} />
      <div className="my-1.5 border-t border-gray-100" />
      <Row label="Subtotal" value={money(card.subtotal)} />
      {card.package_discount ? <Row label="Package discount" value={`-${money(card.package_discount)}`} /> : null}
      {card.coupon_discount ? <Row label="Coupon" value={`-${money(card.coupon_discount)}`} /> : null}
      {card.loyalty_discount ? <Row label="Loyalty" value={`-${money(card.loyalty_discount)}`} /> : null}
      <Row label="Total" value={money(card.total)} strong />
      {card.deposit_required ? <p className="text-[11px] text-gray-500">Deposit due to confirm: {money(card.deposit_required)}</p> : null}
      <button onClick={() => onAction('Confirm booking')}
        className="mt-2 w-full rounded-lg py-2 text-sm font-semibold text-white" style={{ backgroundColor: brand }}>
        Confirm booking
      </button>
    </div>
  );
}

function Confirmed({ card, brand }: { card: ConfirmedCard; brand: string }) {
  const maps = card.latitude && card.longitude ? `https://www.google.com/maps/search/?api=1&query=${card.latitude},${card.longitude}` : null;
  return (
    <div className="rounded-xl border-2 bg-white p-4 space-y-1.5" style={{ borderColor: brand }}>
      <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold" style={{ color: brand }}>✓ Booking confirmed</p>
      <Row label="Business" value={card.business} />
      <Row label="Service" value={card.package ? `${card.service ?? ''} (${card.package})` : card.service} />
      <Row label="Staff" value={card.staff} />
      <Row label="When" value={[card.date, card.time].filter(Boolean).join(' · ')} />
      <Row label="Where" value={card.address} />
      <Row label="Total" value={money(card.total)} strong />
      {card.points_earned ? <p className="text-[11px] text-gray-500">You earned {card.points_earned} loyalty points.</p> : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {card.payment_required && card.payment_url && (
          <a href={card.payment_url} target="_blank" rel="noopener noreferrer"
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: brand }}>
            Pay deposit {card.deposit_amount ? money(card.deposit_amount) : ''}
          </a>
        )}
        {maps && (
          <a href={maps} target="_blank" rel="noopener noreferrer"
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ color: brand, borderColor: brand }}>
            📍 Directions
          </a>
        )}
      </div>
    </div>
  );
}
