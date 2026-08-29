import { supabase } from './supabase';

export type MessageTemplateKey = 'reconciliation' | 'balance' | 'balance_share' | 'pending';

export interface MessageTemplates {
  reconciliation: string;
  balance: string;
  balance_share: string;
  pending: string;
}

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplates = {
  reconciliation: `📋 مطابقة حساب — {{account}}
الصندوق: {{fund}}
التاريخ: {{date}}

{{lines}}`,
  balance: `📊 رصيد {{fund}}
التاريخ: {{date}}

{{lines}}`,
  balance_share: `📤 رصيد حساب — {{account}}
الصندوق: {{fund}}
التاريخ: {{date}}

{{lines}}`,
  pending: `⏳ قيد انتظار — {{fund}}
التاريخ: {{date}}

{{lines}}`,
};

const STORAGE_KEY = 'message_templates';
const LOCAL_KEY = 'sandouk-message-templates';

function normalizeTemplates(raw: Partial<MessageTemplates> | null | undefined): MessageTemplates {
  return {
    reconciliation: raw?.reconciliation?.trim() || DEFAULT_MESSAGE_TEMPLATES.reconciliation,
    balance: raw?.balance?.trim() || DEFAULT_MESSAGE_TEMPLATES.balance,
    balance_share: raw?.balance_share?.trim() || DEFAULT_MESSAGE_TEMPLATES.balance_share,
    pending: raw?.pending?.trim() || DEFAULT_MESSAGE_TEMPLATES.pending,
  };
}

export function loadMessageTemplatesLocal(): MessageTemplates {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return { ...DEFAULT_MESSAGE_TEMPLATES };
    return normalizeTemplates(JSON.parse(raw) as Partial<MessageTemplates>);
  } catch {
    return { ...DEFAULT_MESSAGE_TEMPLATES };
  }
}

export function saveMessageTemplatesLocal(templates: MessageTemplates) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(normalizeTemplates(templates)));
}

export async function fetchMessageTemplates(): Promise<MessageTemplates> {
  const local = loadMessageTemplatesLocal();
  if (!supabase) return local;

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', STORAGE_KEY)
    .maybeSingle();

  if (error || !data?.value) return local;

  const merged = normalizeTemplates(data.value as Partial<MessageTemplates>);
  saveMessageTemplatesLocal(merged);
  return merged;
}

export async function saveMessageTemplates(templates: MessageTemplates): Promise<void> {
  const normalized = normalizeTemplates(templates);
  saveMessageTemplatesLocal(normalized);
  if (!supabase) return;

  const { error } = await supabase.from('app_settings').upsert({
    key: STORAGE_KEY,
    value: normalized,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    if (error.message.includes('app_settings') || error.code === 'PGRST205' || error.code === '42P01') {
      return;
    }
    throw error;
  }
}

export function applyMessageTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out.trim();
}
