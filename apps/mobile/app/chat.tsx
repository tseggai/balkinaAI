import { useState, useRef, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const API_BASE = 'https://balkina-ai.vercel.app';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

function generateSessionId(): string {
  return `mobile_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// ── Typing indicator ────────────────────────────────────────────────────────

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
        ])
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

// ── Message bubble ──────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
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

  return (
    <Animated.View
      style={[
        bubbleStyles.wrapper,
        isUser ? bubbleStyles.wrapperUser : bubbleStyles.wrapperAssistant,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
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
            {message.content}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const bubbleStyles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 12,
    marginVertical: 3,
  },
  wrapperUser: {
    alignItems: 'flex-end',
  },
  wrapperAssistant: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  textUser: {
    color: '#fff',
  },
  textAssistant: {
    color: '#111827',
  },
});

// ── Main chat screen ────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { tenantId, tenantName } = useLocalSearchParams<{
    tenantId: string;
    tenantName: string;
  }>();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hi! Welcome to ${tenantName ?? 'our business'}. I'm your booking assistant. How can I help you today?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(generateSessionId);

  const flatListRef = useRef<FlatList>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !tenantId) return;

    Keyboard.dismiss();

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    const assistantId = `assistant_${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          tenantId,
          sessionId,
        }),
      });

      if (!res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Sorry, something went wrong. Please try again.', isStreaming: false }
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

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
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: fullText, isStreaming: true }
                    : m
                )
              );
            } else if (event.type === 'tool_call') {
              if (!fullText) {
                const toolLabel = event.name?.replace(/_/g, ' ') ?? 'info';
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: `Looking up ${toolLabel}...` }
                      : m
                  )
                );
              }
            } else if (event.type === 'done' || event.type === 'error') {
              if (event.type === 'error' && event.content) {
                fullText = `Sorry, something went wrong: ${event.content}`;
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: fullText || 'I couldn\'t process that. Please try again.', isStreaming: false }
                    : m
                )
              );
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      // Finalize
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, isStreaming: false } : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Connection error. Please check your network and try again.', isStreaming: false }
            : m
        )
      );
    }

    setIsLoading(false);
  }, [input, isLoading, tenantId, sessionId]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={scrollToBottom}
      />

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={2000}
          editable={!isLoading}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!input.trim() || isLoading) && styles.sendBtnDisabled,
          ]}
          onPress={sendMessage}
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? (
            <View style={styles.sendSpinner}>
              <Ionicons name="hourglass-outline" size={18} color="#fff" />
            </View>
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
    fontSize: 15,
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
  sendSpinner: {
    opacity: 0.8,
  },
});
