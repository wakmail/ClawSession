import { randomUUID } from "crypto";

const BASE_URL = "https://claude.ai/api";

const HEADERS_BASE: Record<string, string> = {
  "content-type": "application/json",
  "anthropic-client-platform": "web_claude_ai",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
};

const PERSONALIZED_STYLES = [
  {
    type: "default",
    key: "Default",
    name: "Normal",
    nameKey: "normal_style_name",
    prompt: "Normal\n",
    summary: "Default responses from Claude",
    summaryKey: "normal_style_summary",
    isDefault: true,
  },
];

export const MODELS: [string, string][] = [
  ["haiku", "claude-haiku-4-5-20251001"],
  ["sonnet", "claude-sonnet-4-6"],
  ["opus", "claude-opus-4-8"],
  ["sonnet-4-5", "claude-sonnet-4-5-20241022"],
  ["sonnet-4", "claude-sonnet-4-20250514"],
  ["opus-4", "claude-opus-4-20250514"],
  ["haiku-3.5", "claude-3-5-haiku-20241022"],
  ["sonnet-3.5", "claude-3-5-sonnet-20241022"],
];

export function resolveModel(input: string): string {
  if (/^\d+$/.test(input)) {
    const idx = parseInt(input) - 1;
    if (idx >= 0 && idx < MODELS.length) return MODELS[idx][1];
  }
  const match = MODELS.find(([name]) => name === input);
  if (match) return match[1];
  return input;
}

function makeTitle(
  message: string,
  mode: string,
  customTitle?: string
): string {
  if (mode === "custom" && customTitle) return customTitle;
  if (mode === "message")
    return message.length > 60 ? message.slice(0, 60) + "..." : message;
  if (mode === "timestamp")
    return `Automated Session Started: ${new Date().toISOString().replace("T", " ").slice(0, 19)}`;
  return "";
}

async function parseSSE(response: Response): Promise<string> {
  const text = await response.text();
  let fullText = "";
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const data = JSON.parse(line.slice(6));
      if (data.type === "completion") fullText += data.completion ?? "";
    } catch {}
  }
  return fullText;
}

export async function sendMessage(
  cookie: string,
  message: string,
  model: string,
  orgId: string,
  titleMode = "message",
  customTitle?: string
): Promise<string> {
  const headers = {
    ...HEADERS_BASE,
    cookie: `sessionKey=${cookie}`,
  };

  const convUuid = randomUUID();
  const createResp = await fetch(
    `${BASE_URL}/organizations/${orgId}/chat_conversations`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        uuid: convUuid,
        name: makeTitle(message, titleMode, customTitle),
        model,
        include_conversation_preferences: true,
        is_temporary: false,
      }),
    }
  );

  if (!createResp.ok) {
    throw new Error(`Create conversation failed: ${createResp.status}`);
  }

  const convData = await createResp.json();
  const parentUuid = convData.chat_messages?.[0]?.uuid ?? "";

  const completionResp = await fetch(
    `${BASE_URL}/organizations/${orgId}/chat_conversations/${convUuid}/completion`,
    {
      method: "POST",
      headers: { ...headers, accept: "text/event-stream" },
      body: JSON.stringify({
        prompt: message,
        parent_message_uuid: parentUuid,
        timezone: "America/New_York",
        model,
        locale: "en-US",
        personalized_styles: PERSONALIZED_STYLES,
        tools: [],
        attachments: [],
        files: [],
        sync_sources: [],
      }),
    }
  );

  if (!completionResp.ok) {
    if (completionResp.status === 429) {
      throw new Error("rate-limited");
    }
    throw new Error(`Completion failed: ${completionResp.status}`);
  }

  return parseSSE(completionResp);
}
