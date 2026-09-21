import { AI_SYSTEM_PROMPT, localAssistantReply } from './aiKnowledge';
import type { AiSettings } from './aiSettings';
import { hasAiApiConfigured } from './aiSettings';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function sendAssistantMessage(
  history: ChatMessage[],
  userText: string,
  settings: AiSettings,
): Promise<string> {
  const trimmed = userText.trim();
  if (!trimmed) return '';

  if (!hasAiApiConfigured(settings)) {
    return localAssistantReply(trimmed);
  }

  const apiKey = settings.apiKey.trim() || (import.meta.env.VITE_AI_API_KEY as string);
  const base = settings.apiBase.replace(/\/$/, '');
  const url = `${base}/chat/completions`;

  const messages: ChatMessage[] = [
    { role: 'system', content: AI_SYSTEM_PROMPT },
    ...history.filter((m) => m.role !== 'system'),
    { role: 'user', content: trimmed },
  ];

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: 0.4,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return `تعذّر الاتصال بالذكاء الاصطناعي (${res.status}). تحقق من المفتاح والرابط.\n\n${localAssistantReply(trimmed)}\n\nتفاصيل: ${errText.slice(0, 200)}`;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || localAssistantReply(trimmed);
  } catch (e) {
    return `خطأ شبكة: ${e instanceof Error ? e.message : 'غير معروف'}\n\n${localAssistantReply(trimmed)}`;
  }
}
