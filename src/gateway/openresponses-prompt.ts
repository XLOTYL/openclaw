/**
 * Build agent ingress fields from an OpenResponses `input` payload.
 *
 * Security contract (gateway-enforced in `openresponses-http.ts`):
 * - `system` / `developer` roles are only folded into `extraSystemPrompt` when
 *   `allowSystemMessages === true` (trusted operator / owner sender).
 * - Otherwise callers must not receive a privileged system lane via untrusted
 *   HTTP; `buildAgentPrompt` throws `openai_compat_system_messages_not_allowed`.
 */
import {
  buildAgentMessageFromConversationEntries,
  type ConversationEntry,
} from "./agent-prompt.js";
import type { ContentPart, ItemParam } from "./open-responses.schema.js";

function extractTextContent(content: string | ContentPart[]): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .map((part) => {
      if (part.type === "input_text") {
        return part.text;
      }
      if (part.type === "output_text") {
        return part.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

export function buildAgentPrompt(
  input: string | ItemParam[],
  opts?: { allowSystemMessages?: boolean },
): {
  message: string;
  extraSystemPrompt?: string;
} {
  if (typeof input === "string") {
    return { message: input };
  }

  const systemParts: string[] = [];
  const conversationEntries: ConversationEntry[] = [];
  const allowSystemMessages = opts?.allowSystemMessages === true;

  for (const item of input) {
    if (item.type === "message") {
      const content = extractTextContent(item.content).trim();
      if (!content) {
        continue;
      }

      if (item.role === "system" || item.role === "developer") {
        if (!allowSystemMessages) {
          throw new Error("openai_compat_system_messages_not_allowed");
        }
        systemParts.push(content);
        continue;
      }

      const normalizedRole = item.role === "assistant" ? "assistant" : "user";
      const sender = normalizedRole === "assistant" ? "Assistant" : "User";

      conversationEntries.push({
        role: normalizedRole,
        entry: { sender, body: content },
      });
    } else if (item.type === "function_call_output") {
      conversationEntries.push({
        role: "tool",
        entry: { sender: `Tool:${item.call_id}`, body: item.output },
      });
    }
    // Skip reasoning and item_reference for prompt building (Phase 1)
  }

  const message = buildAgentMessageFromConversationEntries(conversationEntries);

  return {
    message,
    extraSystemPrompt: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
  };
}
