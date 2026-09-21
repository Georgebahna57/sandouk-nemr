import { useCallback, useRef, useState } from 'react';
import { Bot, MessageCircle, Send, Settings, X } from 'lucide-react';
import { sendAssistantMessage, type ChatMessage } from '../lib/aiChat';
import { AI_QUICK_PROMPTS } from '../lib/aiKnowledge';
import { hasAiApiConfigured, loadAiSettings, saveAiSettings, type AiSettings } from '../lib/aiSettings';

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AiSettings>(() => loadAiSettings());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'مرحباً! أنا مساعد Ora Gold. اسأل عن الفواتير، Excel، الطباعة، أو أوامر الصرف. يمكنك إضافة مفتاح API من الإعدادات لإجابات أذكى.',
    },
  ]);
  const listRef = useRef<HTMLDivElement>(null);

  const apiOn = hasAiApiConfigured(settings);

  const persistSettings = (patch: Partial<AiSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAiSettings(next);
  };

  const submit = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || loading) return;
      setInput('');
      setMessages((m) => [...m, { role: 'user', content: q }]);
      setLoading(true);
      try {
        const history = messages.filter((m) => m.role !== 'system');
        const reply = await sendAssistantMessage(history, q, settings);
        setMessages((m) => [...m, { role: 'assistant', content: reply }]);
      } finally {
        setLoading(false);
        requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }));
      }
    },
    [loading, messages, settings],
  );

  return (
    <>
      <button
        type="button"
        className="fixed bottom-5 left-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber-600 text-white shadow-lg hover:bg-amber-500 transition no-print"
        onClick={() => setOpen(true)}
        title="مساعد ذكي"
      >
        <MessageCircle className="h-7 w-7" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 no-print">
          <div className="card w-full sm:max-w-md h-[85dvh] sm:h-[min(560px,85dvh)] flex flex-col border-amber-500/30 shadow-2xl rounded-t-2xl sm:rounded-xl">
            <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-amber-400" />
                <span className="font-semibold text-amber-400">مساعد Ora Gold</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${apiOn ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                  {apiOn ? 'AI' : 'محلي'}
                </span>
              </div>
              <div className="flex gap-1">
                <button type="button" className="p-2 text-slate-400 hover:text-white" onClick={() => setSettingsOpen((v) => !v)} title="إعدادات">
                  <Settings className="h-4 w-4" />
                </button>
                <button type="button" className="p-2 text-slate-400 hover:text-white" onClick={() => setOpen(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {settingsOpen && (
              <div className="border-b border-slate-700 p-3 space-y-2 text-xs bg-slate-800/50">
                <label className="block">
                  <span className="text-slate-400">رابط API (OpenAI-compatible)</span>
                  <input
                    className="input-field mt-1"
                    value={settings.apiBase}
                    onChange={(e) => persistSettings({ apiBase: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-slate-400">مفتاح API</span>
                  <input
                    type="password"
                    className="input-field mt-1"
                    value={settings.apiKey}
                    onChange={(e) => persistSettings({ apiKey: e.target.value })}
                    placeholder="sk-proj-… أو مفتاح المزود"
                  />
                </label>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  أو عيّن المتغيرات في <code className="text-amber-500/80">.env.local</code> من{' '}
                  <code className="text-amber-500/80">.env.example</code> ثم أعد تشغيل{' '}
                  <code className="text-amber-500/80">npm run dev</code>.
                </p>
                <label className="block">
                  <span className="text-slate-400">الموديل</span>
                  <input
                    className="input-field mt-1"
                    value={settings.model}
                    onChange={(e) => persistSettings({ model: e.target.value })}
                  />
                </label>
              </div>
            )}

            <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-3 py-2 whitespace-pre-wrap ${
                    m.role === 'user' ? 'bg-amber-600/20 ml-8' : 'bg-slate-800/80 mr-4 text-slate-200'
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {loading && <p className="text-slate-500 text-xs animate-pulse">جاري التفكير…</p>}
            </div>

            <div className="border-t border-slate-700 p-3 space-y-2">
              <div className="flex flex-wrap gap-1">
                {AI_QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="text-[10px] rounded-full border border-slate-600 px-2 py-0.5 text-slate-400 hover:border-amber-500/50 hover:text-amber-300"
                    onClick={() => submit(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(input);
                }}
              >
                <input
                  className="input-field flex-1"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="اسأل عن التطبيق…"
                  disabled={loading}
                />
                <button type="submit" className="btn-primary px-3" disabled={loading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
