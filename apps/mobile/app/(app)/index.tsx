import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
  SafeAreaView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';

const API_BASE = 'https://balkina-ai.vercel.app';

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'businesses' | 'booking_confirmation';
  isStreaming?: boolean;
}

type BookingCardType = 'summary' | 'confirmation' | 'package_offer' | 'loyalty_offer' | 'coupon_input' | 'extras_chips';

interface DetectedCard {
  type: BookingCardType;
  content: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Parse [[button:...]] and [[link:Label|URL]] from message content ─────────

interface ParsedLink {
  label: string;
  url: string;
}

function parseMessageContent(content: string): { text: string; buttons: string[]; links: ParsedLink[] } {
  const buttonRegex = /\[\[button:([^\]]+)\]\]/g;
  const linkRegex = /\[\[link:([^|]+)\|([^\]]+)\]\]/g;
  const buttons: string[] = [];
  const links: ParsedLink[] = [];

  let text = content.replace(linkRegex, (_match, label: string, url: string) => {
    links.push({ label: label.trim(), url: url.trim() });
    return '';
  });

  text = text.replace(buttonRegex, (_match, label: string) => {
    buttons.push(label.trim());
    return '';
  })
    .replace(/^[ \t]+$/gm, '')  // Remove lines that are only whitespace
    .replace(/\n{2,}/g, '\n')   // Collapse multiple newlines to single
    .replace(/^\n+|\n+$/g, '')  // Trim leading/trailing newlines
    .trim();

  return { text, buttons, links };
}

// ── Parse inline markdown (**bold** and *italic*) into Text elements ────────

function renderFormattedText(
  text: string,
  baseStyle: object,
): React.ReactNode[] {
  // Split on **bold** and *italic* patterns
  const parts: React.ReactNode[] = [];
  // Regex: match **bold** first, then *italic*
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      parts.push(
        <Text key={key++} style={baseStyle}>
          {text.slice(lastIndex, match.index)}
        </Text>,
      );
    }

    if (match[2]) {
      // **bold**
      parts.push(
        <Text key={key++} style={[baseStyle, { fontWeight: '700' }]}>
          {match[2]}
        </Text>,
      );
    } else if (match[3]) {
      // *italic*
      parts.push(
        <Text key={key++} style={[baseStyle, { fontStyle: 'italic' }]}>
          {match[3]}
        </Text>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining plain text
  if (lastIndex < text.length) {
    parts.push(
      <Text key={key++} style={baseStyle}>
        {text.slice(lastIndex)}
      </Text>,
    );
  }

  return parts.length > 0 ? parts : [<Text key={0} style={baseStyle}>{text}</Text>];
}

// ── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = (anim: Animated.Value) => ({
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -4],
        }),
      },
    ],
  });

  return (
    <View style={typingStyles.container}>
      <Animated.View style={[typingStyles.dot, dotStyle(dot1)]} />
      <Animated.View style={[typingStyles.dot, dotStyle(dot2)]} />
      <Animated.View style={[typingStyles.dot, dotStyle(dot3)]} />
    </View>
  );
}

const typingStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#9ca3af',
  },
});

// ── Booking Card Detection ──────────────────────────────────────────────────

function detectBookingCard(content: string): DetectedCard | null {
  // Summary card: contains TOTAL with price and service/staff/date lines
  if (
    (content.includes('**TOTAL:') || content.includes('**TOTAL ')) &&
    content.includes('**Service:**')
  ) {
    return { type: 'summary', content };
  }
  // Confirmation: starts with a check mark and has "Booked" or "confirmed"
  if (
    (content.includes('\u2713') || content.includes('\u2705') || content.includes('Booked!') || content.includes('confirmed')) &&
    content.includes("You'll earn") &&
    content.includes('points')
  ) {
    return { type: 'confirmation', content };
  }
  // Package offer
  if (
    content.includes('package') &&
    (content.includes('sessions remaining') || content.includes('part of a package'))
  ) {
    return { type: 'package_offer', content };
  }
  // Loyalty offer
  if (content.includes('points') && content.includes('$') && content.includes('Apply')) {
    return { type: 'loyalty_offer', content };
  }
  return null;
}

// ── Summary Card Component ─────────────────────────────────────────────────

function SummaryCard({ text, onButtonPress }: { text: string; onButtonPress: (label: string) => void }) {
  // Parse structured summary lines
  const lines = text.split('\n').filter((l) => l.trim());
  const detailLines: string[] = [];
  const priceLines: string[] = [];
  let totalLine = '';
  let inPriceSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes('──') || trimmed.includes('───')) {
      inPriceSection = true;
      continue;
    }
    if (trimmed.startsWith('**TOTAL')) {
      totalLine = trimmed.replace(/\*\*/g, '');
      continue;
    }
    if (inPriceSection && (trimmed.includes('$') || trimmed.includes('-$') || trimmed.includes('+$'))) {
      priceLines.push(trimmed.replace(/\*\*/g, ''));
    } else if (!inPriceSection && trimmed.length > 0) {
      detailLines.push(trimmed.replace(/\*\*/g, ''));
    }
  }

  return (
    <View style={cardStyles.summaryCard}>
      {detailLines.map((line, i) => (
        <Text key={`d-${i}`} style={cardStyles.summaryDetail}>{line}</Text>
      ))}
      <View style={cardStyles.divider} />
      {priceLines.map((line, i) => (
        <Text key={`p-${i}`} style={cardStyles.priceLine}>{line}</Text>
      ))}
      {totalLine ? (
        <>
          <View style={cardStyles.divider} />
          <Text style={cardStyles.totalLine}>{totalLine}</Text>
        </>
      ) : null}
      <TouchableOpacity
        style={cardStyles.confirmBtn}
        onPress={() => onButtonPress('Confirm Booking')}
        activeOpacity={0.7}
      >
        <Text style={cardStyles.confirmBtnText}>Confirm Booking</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={cardStyles.changeBtn}
        onPress={() => onButtonPress('Change something')}
        activeOpacity={0.7}
      >
        <Text style={cardStyles.changeBtnText}>Change something</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Confirmation Card Component ────────────────────────────────────────────

function ConfirmationCard({ text, onButtonPress }: { text: string; onButtonPress: (label: string) => void }) {
  const lines = text.split('\n').filter((l) => l.trim());
  // Extract points earned badge
  const pointsMatch = text.match(/earn (\d+)\s*(loyalty\s*)?points/i);
  const pointsEarned = pointsMatch?.[1];

  return (
    <View style={cardStyles.confirmationCard}>
      <View style={cardStyles.checkCircle}>
        <Ionicons name="checkmark" size={24} color="#fff" />
      </View>
      {lines.map((line, i) => {
        const cleaned = line.replace(/\*\*/g, '').replace(/\[\[button:[^\]]+\]\]/g, '').trim();
        if (!cleaned || cleaned.includes('earn') && cleaned.includes('points')) return null;
        return (
          <Text key={i} style={i === 0 ? cardStyles.confirmTitle : cardStyles.confirmDetail}>
            {cleaned}
          </Text>
        );
      })}
      {pointsEarned ? (
        <View style={cardStyles.pointsBadge}>
          <Text style={cardStyles.pointsBadgeText}>+{pointsEarned} pts</Text>
        </View>
      ) : null}
      <View style={cardStyles.confirmActions}>
        <TouchableOpacity
          style={cardStyles.confirmActionBtn}
          onPress={() => onButtonPress('View My Bookings')}
          activeOpacity={0.7}
        >
          <Text style={cardStyles.confirmActionText}>View My Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[cardStyles.confirmActionBtn, cardStyles.confirmActionBtnSecondary]}
          onPress={() => onButtonPress('Book Another Service')}
          activeOpacity={0.7}
        >
          <Text style={[cardStyles.confirmActionText, cardStyles.confirmActionTextSecondary]}>Book Another</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Package Offer Card Component ───────────────────────────────────────────

function PackageOfferCard({ text, onButtonPress }: { text: string; onButtonPress: (label: string) => void }) {
  const cleaned = text.replace(/\[\[button:[^\]]+\]\]/g, '').replace(/\*\*/g, '').trim();
  return (
    <View style={cardStyles.packageCard}>
      <View style={cardStyles.packageHeader}>
        <Ionicons name="gift-outline" size={20} color="#6366f1" />
        <Text style={cardStyles.packageTitle}>Package Available</Text>
      </View>
      <Text style={cardStyles.packageText}>{cleaned}</Text>
    </View>
  );
}

// ── Loyalty Offer Card Component ───────────────────────────────────────────

function LoyaltyOfferCard({ text, onButtonPress }: { text: string; onButtonPress: (label: string) => void }) {
  const cleaned = text.replace(/\[\[button:[^\]]+\]\]/g, '').replace(/\*\*/g, '').trim();
  return (
    <View style={cardStyles.loyaltyCard}>
      <View style={cardStyles.loyaltyHeader}>
        <Text style={cardStyles.loyaltyIcon}>{"⭐"}</Text>
        <Text style={cardStyles.loyaltyTitle}>Loyalty Points</Text>
      </View>
      <Text style={cardStyles.loyaltyText}>{cleaned}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  summaryDetail: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 10,
  },
  priceLine: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  totalLine: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  confirmBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  changeBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  changeBtnText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
  },
  confirmationCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
  },
  checkCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#065f46',
    textAlign: 'center',
    marginBottom: 4,
  },
  confirmDetail: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 2,
  },
  pointsBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  pointsBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  confirmActionBtn: {
    flex: 1,
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  confirmActionBtnSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  confirmActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmActionTextSecondary: {
    color: '#6366f1',
  },
  packageCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  packageTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4338ca',
  },
  packageText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  loyaltyCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  loyaltyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  loyaltyIcon: {
    fontSize: 18,
  },
  loyaltyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400e',
  },
  loyaltyText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
});

// ── Action Button ───────────────────────────────────────────────────────────

function ActionButton({ label, onPress }: { label: string; onPress: (label: string) => void }) {
  return (
    <TouchableOpacity
      style={actionBtnStyles.btn}
      onPress={() => onPress(label)}
      activeOpacity={0.7}
    >
      <Text style={actionBtnStyles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const actionBtnStyles = StyleSheet.create({
  btn: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#6366f1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
});

// ── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onButtonPress,
}: {
  message: ChatMessage;
  onButtonPress: (label: string) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const isUser = message.role === 'user';
  const { text, buttons, links } = isUser
    ? { text: message.content, buttons: [], links: [] }
    : parseMessageContent(message.content);

  // Detect rich booking cards in assistant messages
  const detectedCard = !isUser && !message.isStreaming ? detectBookingCard(text) : null;

  return (
    <Animated.View
      style={[
        bubbleStyles.wrapper,
        isUser ? bubbleStyles.wrapperUser : bubbleStyles.wrapperAssistant,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {/* Rich card rendering for booking flow */}
      {detectedCard?.type === 'summary' ? (
        <SummaryCard text={text} onButtonPress={onButtonPress} />
      ) : detectedCard?.type === 'confirmation' ? (
        <ConfirmationCard text={text} onButtonPress={onButtonPress} />
      ) : detectedCard?.type === 'package_offer' ? (
        <>
          <PackageOfferCard text={text} onButtonPress={onButtonPress} />
          {buttons.length > 0 && (
            <View style={bubbleStyles.buttonsRow}>
              {buttons.map((btn, i) => (
                <ActionButton key={`${btn}-${i}`} label={btn} onPress={onButtonPress} />
              ))}
            </View>
          )}
        </>
      ) : detectedCard?.type === 'loyalty_offer' ? (
        <>
          <LoyaltyOfferCard text={text} onButtonPress={onButtonPress} />
          {buttons.length > 0 && (
            <View style={bubbleStyles.buttonsRow}>
              {buttons.map((btn, i) => (
                <ActionButton key={`${btn}-${i}`} label={btn} onPress={onButtonPress} />
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          {/* Text bubble */}
          {(text || message.isStreaming) && (
            <View
              style={[
                bubbleStyles.bubble,
                isUser ? bubbleStyles.bubbleUser : bubbleStyles.bubbleAssistant,
              ]}
            >
              {message.isStreaming && !message.content ? (
                <TypingIndicator />
              ) : (
                <Text
                  style={[
                    bubbleStyles.text,
                    isUser ? bubbleStyles.textUser : bubbleStyles.textAssistant,
                  ]}
                >
                  {isUser
                    ? text
                    : renderFormattedText(
                        text,
                        StyleSheet.flatten([
                          bubbleStyles.text,
                          bubbleStyles.textAssistant,
                        ]),
                      )}
                </Text>
              )}
            </View>
          )}

          {/* Link buttons rendered below the bubble (open URL in browser) */}
          {links.length > 0 && !message.isStreaming && (
            <View style={bubbleStyles.buttonsRow}>
              {links.map((link, i) => (
                <TouchableOpacity
                  key={`link-${i}`}
                  style={bubbleStyles.linkButton}
                  onPress={() => Linking.openURL(link.url)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="navigate-outline" size={14} color="#4f46e5" style={{ marginRight: 4 }} />
                  <Text style={bubbleStyles.linkButtonText}>{link.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Action buttons rendered below the bubble */}
          {buttons.length > 0 && !message.isStreaming && (
            <View style={bubbleStyles.buttonsRow}>
              {buttons.map((btn, i) => (
                <ActionButton key={`${btn}-${i}`} label={btn} onPress={onButtonPress} />
              ))}
            </View>
          )}
        </>
      )}
    </Animated.View>
  );
}

const bubbleStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    marginVertical: 3,
    maxWidth: '88%',
  },
  wrapperUser: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  wrapperAssistant: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 16,
    lineHeight: 23,
  },
  textUser: {
    color: '#fff',
  },
  textAssistant: {
    color: '#111827',
  },
  buttonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  linkButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4f46e5',
  },
});

// ── Suggestion Chip ──────────────────────────────────────────────────────────

function SuggestionChip({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={chipStyles.chip} onPress={onPress} activeOpacity={0.7}>
      <Text style={chipStyles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6366f1',
  },
});

// ── Main Chat Screen ─────────────────────────────────────────────────────────

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => generateId());
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setInput('');
    setIsLoading(false);
    setSessionId(generateId());
  }, []);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Fetch the logged-in user's name and request location on mount
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const meta = user.user_metadata as { display_name?: string; phone?: string } | undefined;
        setCustomerName(meta?.display_name ?? user.email ?? null);
        setCustomerPhone(meta?.phone ?? user.phone ?? null);
        setCustomerEmail(user.email ?? null);
        setUserId(user.id);
      }
    };
    fetchUser();

    // Request location permission and get coords
    const fetchLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserCoords({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch {
        // Location not available — continue without it
      }
    };
    fetchLocation();
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (flatListRef.current && messages.length > 0) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }, 100);
  }, [messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const trimmed = (text ?? input).trim();
      if (!trimmed || isLoading) return;

      Keyboard.dismiss();

      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: trimmed,
        type: 'text',
      };

      const assistantId = `assistant_${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        type: 'text',
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setIsLoading(true);

      try {
        const body: Record<string, string | number> = {
          message: trimmed,
          sessionId,
        };
        if (customerName) {
          body.customerName = customerName;
        }
        if (customerPhone) {
          body.customerPhone = customerPhone;
        }
        if (customerEmail) {
          body.customerEmail = customerEmail;
        }
        if (userId) {
          body.userId = userId;
        }
        if (userCoords) {
          body.userLatitude = userCoords.latitude;
          body.userLongitude = userCoords.longitude;
        }

        const res = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          let errMsg = 'Sorry, something went wrong. Please try again.';
          try {
            const errBody = (await res.json()) as { error?: string };
            if (errBody.error) {
              errMsg = `Sorry, something went wrong: ${errBody.error}`;
            }
          } catch {
            // Could not parse error body — use default message
          }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: errMsg, isStreaming: false }
                : m,
            ),
          );
          setIsLoading(false);
          return;
        }

        // React Native's fetch does not support ReadableStream, so we
        // read the full response body as text and parse SSE events from it.
        const respText = await res.text();
        let fullText = '';

        const lines = respText.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr) as {
              type: string;
              content?: string;
              name?: string;
            };

            if (event.type === 'text') {
              fullText += event.content ?? '';
            } else if (event.type === 'error' && event.content) {
              fullText = `Sorry, something went wrong: ${event.content}`;
            }
          } catch {
            // skip malformed JSON chunks
          }
        }

        // Finalize the assistant message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    fullText ||
                    "I couldn't process that. Please try again.",
                  isStreaming: false,
                }
              : m,
          ),
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    'Connection error. Please check your network and try again.',
                  isStreaming: false,
                }
              : m,
          ),
        );
      }

      setIsLoading(false);
    },
    [input, isLoading, sessionId, customerName, customerPhone, customerEmail, userId, userCoords],
  );

  const handleButtonPress = useCallback(
    (label: string) => {
      sendMessage(label);
    },
    [sendMessage],
  );

  const hasMessages = messages.length > 0;

  // ── Empty / welcome state ──────────────────────────────────────────────────

  if (!hasMessages) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.welcomeContainer}>
            <Text style={styles.greeting}>Hi there 👋</Text>
            <Text style={styles.subtitle}>
              What would you like to book today?
            </Text>

            <View style={styles.chipsContainer}>
              <SuggestionChip
                label="Book a haircut"
                onPress={() => handleButtonPress('Book a haircut')}
              />
              <SuggestionChip
                label="Find a dentist"
                onPress={() => handleButtonPress('Find a dentist')}
              />
              <SuggestionChip
                label="My appointments"
                onPress={() => handleButtonPress('My appointments')}
              />
              <SuggestionChip
                label="Cancel a booking"
                onPress={() => handleButtonPress('Cancel a booking')}
              />
            </View>

            <TouchableOpacity
              style={styles.startOverLink}
              onPress={resetConversation}
              activeOpacity={0.6}
            >
              <Text style={styles.startOverText}>Start over</Text>
            </TouchableOpacity>
          </View>

          {/* Input bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Ask me anything..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={2000}
              editable={!isLoading}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage()}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!input.trim() || isLoading) && styles.sendBtnDisabled,
              ]}
              onPress={() => sendMessage()}
              disabled={!input.trim() || isLoading}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Chat state ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Chat header with reset button */}
        <View style={styles.chatHeader}>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={resetConversation}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color="#6366f1" />
            <Text style={styles.resetBtnText}>Start over</Text>
          </TouchableOpacity>
          <Text style={styles.chatHeaderTitle}>Balkina AI</Text>
          <View style={styles.resetBtnPlaceholder} />
        </View>

        <FlatList
          ref={flatListRef}
          data={[...messages].reverse()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} onButtonPress={handleButtonPress} />
          )}
          contentContainerStyle={styles.messagesList}
          inverted
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask me anything..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={2000}
            editable={!isLoading}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || isLoading) && styles.sendBtnDisabled,
            ]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <Ionicons name="hourglass-outline" size={18} color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  flex: {
    flex: 1,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  greeting: {
    fontSize: 34,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 32,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  messagesList: {
    paddingVertical: 12,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resetBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6366f1',
  },
  resetBtnPlaceholder: {
    width: 90,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  startOverLink: {
    marginTop: 16,
  },
  startOverText: {
    fontSize: 13,
    color: '#9ca3af',
    textDecorationLine: 'underline',
  },
});
