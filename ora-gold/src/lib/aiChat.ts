import { AI_SYSTEM_PROMPT, localAssistantReply } from './aiKnowledge';
import type { AiSettings } from './aiSettings';
import { hasAiApiConfigured } from './aiSettings';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

function parseOpenAiErrorBody(errText: string): { message?: string; code?: string } {
  try {
    const j = JSON.parse(errText) as { error?: { message?: string; code?: string; type?: string } };
    return { message: j.error?.message, code: j.error?.code ?? j.error?.type };
  } catch {
    return {};
  }
}

function formatApiFailure(status: number, errText: string, localFallback: string): string {
  const { message, code } = parseOpenAiErrorBody(errText);
  const msgLower = (message ?? errText).toLowerCase();

  if (
    status === 429 ||
    code === 'insufficient_quota' ||
    msgLower.includes('no credits') ||
    msgLower.includes('quota')
  ) {
    return (
      '⚠️ رصيد OpenAI منتهي أو الحدّ اليومي وصل (خطأ 429).\n\n' +
      'المفتاح والرابط غالباً صحيحان، لكن الحساب يحتاج:\n' +
      '• إضافة رصيد / بطاقة في platform.openai.com → Billing\n' +
      '• أو انتظار تجديد الحد المجاني\n' +
      '• أو استخدام مزوّد آخر (OpenRouter / Groq) وتحديث VITE_AI_API_BASE والموديل\n\n' +
      '— إجابة مساعدة محلية —\n\n' +
      localFallback
    );
  }

  if (status === 401 || status === 403) {
    return (
      '⚠️ مفتاح API غير صالح أو مُلغى (401/403).\n\n' +
      'أنشئ مفتاحاً جديداً من platform.openai.com/api-keys وحدّث VITE_AI_API_KEY على Vercel ثم Redeploy.\n\n' +
      '— إجابة مساعدة محلية —\n\n' +
      localFallback
    );
  }

  return (
    `تعذّر الاتصال بالذكاء الاصطناعي (${status}).\n\n` +
    (message ? `${message}\n\n` : '') +
    '— إجابة مساعدة محلية —\n\n' +
    localFallback
  );
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
      return formatApiFailure(res.status, errText, localAssistantReply(trimmed));
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
