'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
}

interface TenantInfo {
  name: string;
}

function generateSessionId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

export default function ChatWidgetPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => generateSessionId());
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  const [tenantLoading, setTenantLoading] = useState(true);
  const [error, setError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch tenant info
  useEffect(() => {
    async function fetchTenant() {
      try {
        const res = await fetch(`/api/widget/${tenantId}/info`);
        if (!res.ok) {
          setError('Business not found');
          setTenantLoading(false);
          return;
        }
        const json = (await res.json()) as { data: TenantInfo };
        setTenant(json.data);
        // Add concise welcome message with quick-action buttons
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: `Hi! Welcome to ${json.data.name}. What would you like to do?\n\n[[button:Book Appointment]] [[button:View Services]] [[button:My Appointments]]`,
          },
        ]);
      } catch {
        setError('Failed to load business info');
      }
      setTenantLoading(false);
    }
    fetchTenant();
  }, [tenantId]);

  // Send message (can be called from input or button click)
  const sendMessage = useCallback(async (messageText?: string) => {
    const trimmed = (messageText ?? input).trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!messageText) setInput('');
    setIsLoading(true);

    // Add placeholder for assistant reply
    const assistantId = `assistant_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', isStreaming: true },
    ]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          tenantId,
          sessionId,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({ error: 'Failed to send message' }))) as { error: string };
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Sorry, something went wrong: ${errJson.error}`, isStreaming: false }
              : m
          )
        );
        setIsLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setIsLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let fullText = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) { streamDone = true; break; }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr) as { type: string; content?: string; name?: string };

            if (event.type === 'text') {
              fullText += event.content ?? '';
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: fullText } : m
                )
              );
            } else if (event.type === 'tool_call') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: fullText || `Looking up ${event.name?.replace(/_/g, ' ')}...` }
                    : m
                )
              );
            } else if (event.type === 'done') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, isStreaming: false } : m
                )
              );
            } else if (event.type === 'error') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: `Sorry, something went wrong: ${event.content ?? 'Unknown error'}. Please try again.`, isStreaming: false }
                    : m
                )
              );
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Finalize streaming
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Sorry, I had trouble connecting. Please try again.', isStreaming: false }
            : m
        )
      );
    }

    setIsLoading(false);
  }, [input, isLoading, tenantId, sessionId, customerName, customerPhone]);

  // Handle button click — send the label as a user message
  const handleButtonClick = useCallback((label: string) => {
    if (isLoading) return;
    sendMessage(label);
  }, [isLoading, sendMessage]);

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  if (tenantLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white text-sm font-bold">
          {tenant?.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{tenant?.name}</p>
          <p className="text-xs text-gray-500">Booking Assistant</p>
        </div>
      </div>

      {/* Customer info banner */}
      {showInfoBanner && (
        <div className="border-b border-gray-200 bg-indigo-50 px-4 py-3">
          <p className="mb-2 text-xs font-medium text-indigo-800">
            Share your info for a better booking experience (optional):
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Your name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="flex-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="flex-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={() => setShowInfoBanner(false)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-800 shadow-sm border border-gray-100'
              }`}
            >
              <MessageContent
                content={msg.content}
                isStreaming={msg.isStreaming}
                onButtonClick={handleButtonClick}
                isUserMessage={msg.role === 'user'}
              />
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isLoading || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-gray-400">
          Powered by Balkina AI
        </p>
      </div>
    </div>
  );
}

// ── Button parsing helper ────────────────────────────────────────────────────

const BUTTON_REGEX = /\[\[button:(.*?)\]\]/g;
const LINK_REGEX = /\[\[link:([^|]+)\|([^\]]+)\]\]/g;

interface ParsedLink {
  label: string;
  url: string;
}

function parseContentWithButtons(content: string): { textParts: string[]; buttons: string[]; links: ParsedLink[] } {
  const links: ParsedLink[] = [];

  // Extract links first
  const contentWithoutLinks = content.replace(LINK_REGEX, (_match, label: string, url: string) => {
    links.push({ label: label.trim(), url: url.trim() });
    return '';
  });

  const buttons: string[] = [];
  const textParts = contentWithoutLinks.split(BUTTON_REGEX);

  // split alternates: text, captured group, text, captured group...
  // Even indices are text, odd indices are button labels
  const cleanTextParts: string[] = [];
  for (let i = 0; i < textParts.length; i++) {
    if (i % 2 === 0) {
      cleanTextParts.push(textParts[i] ?? '');
    } else {
      buttons.push(textParts[i] ?? '');
    }
  }

  return { textParts: cleanTextParts, buttons, links };
}

// ── MessageContent component with buttons and basic markdown ─────────────────

function MessageContent({
  content,
  isStreaming,
  onButtonClick,
  isUserMessage,
}: {
  content: string;
  isStreaming?: boolean;
  onButtonClick: (label: string) => void;
  isUserMessage: boolean;
}) {
  if (!content && isStreaming) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
        <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
        <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
      </div>
    );
  }

  // For user messages, just show plain text (no button parsing)
  if (isUserMessage) {
    const formatted = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br />');
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  }

  // Parse buttons and links from assistant messages
  const { textParts, buttons, links } = parseContentWithButtons(content);

  // Reconstruct the text without button markup
  const textOnly = textParts.join('').trim();
  const formatted = textOnly
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />');

  return (
    <div>
      {textOnly && (
        <span dangerouslySetInnerHTML={{ __html: formatted }} />
      )}
      {links.length > 0 && !isStreaming && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {links.map((link, i) => (
            <a
              key={`link-${i}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors no-underline"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {link.label}
            </a>
          ))}
        </div>
      )}
      {buttons.length > 0 && !isStreaming && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {buttons.map((label, i) => (
            <button
              key={`${label}-${i}`}
              onClick={() => onButtonClick(label)}
              className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors active:bg-indigo-200"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
