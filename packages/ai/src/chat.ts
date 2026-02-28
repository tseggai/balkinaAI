/**
 * Core Claude API integration.
 * All AI calls use claude-sonnet-4-6 with streaming.
 * NEVER call create_booking or process_payment tools without explicit
 * customer confirmation in the preceding message.
 */
import Anthropic from '@anthropic-ai/sdk';
import { AI_MODEL, MAX_RESPONSE_TOKENS } from '@balkina/shared';
import { serverEnv } from '@balkina/config';
import { tools } from './tools/index.js';
import { buildSystemPrompt, type SystemPromptContext } from './system-prompt.js';

export const anthropic = new Anthropic({
  apiKey: serverEnv.ANTHROPIC_API_KEY,
});

export type ChatMessage = Anthropic.MessageParam;

export interface StreamChatOptions {
  messages: ChatMessage[];
  context: SystemPromptContext;
  onChunk: (text: string) => void;
  onToolUse?: (toolName: string, toolInput: Record<string, unknown>) => void;
}

/**
 * Streams a response from Claude with tool use enabled.
 * Returns the full assistant message for appending to conversation history.
 *
 * Rules enforced here:
 * - Model is always claude-sonnet-4-6 (AI_MODEL constant).
 * - Tools are always streamed — never block for full completion.
 * - Caller must verify user confirmation before passing create_booking /
 *   process_payment tool results back into the conversation.
 */
export async function streamChat({
  messages,
  context,
  onChunk,
  onToolUse,
}: StreamChatOptions): Promise<Anthropic.Message> {
  const systemPrompt = buildSystemPrompt(context);

  const stream = anthropic.messages.stream({
    model: AI_MODEL,
    max_tokens: MAX_RESPONSE_TOKENS,
    system: systemPrompt,
    tools,
    messages,
  });

  stream.on('text', (text) => {
    onChunk(text);
  });

  stream.on('message', (message) => {
    for (const block of message.content) {
      if (block.type === 'tool_use' && onToolUse) {
        onToolUse(block.name, block.input as Record<string, unknown>);
      }
    }
  });

  return stream.finalMessage();
}
