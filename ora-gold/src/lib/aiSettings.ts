export interface AiSettings {
  apiBase: string;
  apiKey: string;
  model: string;
}

const STORAGE_KEY = 'ora-gold-ai-settings-v1';

const DEFAULTS: AiSettings = {
  apiBase: import.meta.env.VITE_AI_API_BASE ?? 'https://api.openai.com/v1',
  apiKey: import.meta.env.VITE_AI_API_KEY ?? '',
  model: import.meta.env.VITE_AI_MODEL ?? 'gpt-4o-mini',
};

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return {
      apiBase: parsed.apiBase ?? DEFAULTS.apiBase,
      apiKey: parsed.apiKey ?? DEFAULTS.apiKey,
      model: parsed.model ?? DEFAULTS.model,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAiSettings(settings: AiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function hasAiApiConfigured(settings: AiSettings): boolean {
  return Boolean(settings.apiKey?.trim() || import.meta.env.VITE_AI_API_KEY);
}
