import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, MessageSquare, Phone, Users, X, Copy, MessageCircle, Volume2, VolumeX, Mic, Check, Settings } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n, Lang } from "@/i18n/I18nProvider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PERSONAS, PersonaKey, Persona, detectPersona, detectPersonaFromAssistant,
  detectSafetyTopic, SAFETY_REDIRECTS, voiceIdFor,
} from "@/lib/persona";
import { cn } from "@/lib/utils";

interface Msg { id?: string; role: "user" | "assistant"; content: string; persona?: PersonaKey; safety?: boolean; }

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const FN_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/ai-chat`;
const TTS_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/tts`;
const STORAGE_KEY = "hokim_chat_history_v2";
const ACTIVE_PERSONA_KEY = "hokim_chat_active_persona_v1";
const AUTOSPEAK_KEY = "hokim_chat_autospeak_v1";
const HOTLINE_FB_KEY = "hokim_chat_hotline_fb_v1";
const LAST_PLAYED_KEY = "hokim_chat_last_played_v1";

const langKeyOf = (lang: Lang) =>
  (lang === "ru" ? "ru" : lang === "uz_cyrl" ? "uz_cyrl" : "uz") as "uz" | "uz_cyrl" | "ru";

const ttsLangOf = (lang: Lang) =>
  lang === "ru" ? "ru-RU" : "uz-UZ";

function plainText(md: string) {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[*_#>~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Persisted hotline-action feedback (copy/sms timestamps per phone) */
type HotlineFb = Record<string, { copied?: number; sms?: number }>;
function loadHotlineFb(): HotlineFb {
  try { return JSON.parse(localStorage.getItem(HOTLINE_FB_KEY) || "{}"); } catch { return {}; }
}
function saveHotlineFb(fb: HotlineFb) {
  try { localStorage.setItem(HOTLINE_FB_KEY, JSON.stringify(fb)); } catch {}
}

/** Browser-TTS fallback with multi-step voice resolution */
function speakWithBrowser(text: string, lang: Lang, gender: "male" | "female", onStart: () => void, onEnd: () => void) {
  if (!("speechSynthesis" in window)) { onEnd(); return; }
  const ttsLang = ttsLangOf(lang);
  const lang2 = ttsLang.slice(0, 2).toLowerCase();
  const utter = new SpeechSynthesisUtterance(plainText(text));
  utter.rate = 0.97; utter.pitch = gender === "female" ? 1.15 : 0.95;
  const voices = window.speechSynthesis.getVoices();
  // Fallback chain: exact lang → lang prefix → language family (ru fallbacks to uk/be; uz fallbacks to tr/ru) → default
  const fallbackLangs = lang === "ru"
    ? [ttsLang, "ru", "uk", "be"]
    : [ttsLang, "uz", "tr", "ru", "kk"];
  let chosen = voices.find(v => v.lang.toLowerCase() === ttsLang.toLowerCase());
  if (!chosen) chosen = voices.find(v => v.lang.toLowerCase().startsWith(lang2));
  if (!chosen) {
    for (const fl of fallbackLangs) {
      chosen = voices.find(v => v.lang.toLowerCase().startsWith(fl.toLowerCase()));
      if (chosen) break;
    }
  }
  if (chosen) { utter.voice = chosen; utter.lang = chosen.lang; } else { utter.lang = ttsLang; }
  utter.onstart = onStart;
  utter.onend = onEnd;
  utter.onerror = onEnd;
  try { window.speechSynthesis.cancel(); } catch {}
  window.speechSynthesis.speak(utter);
}

/** Hotline action menu: call / copy / SMS — with persistent feedback */
function HotlineActions({ phone, lang, label, compact = false }: { phone: string; lang: Lang; label?: string; compact?: boolean }) {
  const lk = langKeyOf(lang);
  const [fb, setFb] = useState<{ copied?: number; sms?: number }>(() => loadHotlineFb()[phone] || {});
  const t = {
    call:  { uz: "Qo'ng'iroq", uz_cyrl: "Қўнғироқ", ru: "Звонок" }[lk],
    copy:  { uz: "Nusxa", uz_cyrl: "Нусха", ru: "Копия" }[lk],
    sms:   { uz: "SMS", uz_cyrl: "СМС", ru: "СМС" }[lk],
    copied:{ uz: "Nusxalandi", uz_cyrl: "Нусхаланди", ru: "Скопировано" }[lk],
    sent:  { uz: "Yuborildi", uz_cyrl: "Юборилди", ru: "Отправлено" }[lk],
  };
  const persist = (patch: Partial<{ copied: number; sms: number }>) => {
    const all = loadHotlineFb();
    const next = { ...(all[phone] || {}), ...patch };
    all[phone] = next;
    saveHotlineFb(all);
    setFb(next);
  };
  const onCopy = async () => {
    try { await navigator.clipboard.writeText(phone); toast.success(`${t.copied}: ${phone}`); persist({ copied: Date.now() }); }
    catch { toast.error("clipboard"); }
  };
  const onSms = () => { persist({ sms: Date.now() }); };
  // "fresh" feedback within last 10s pulses; older still shows badge
  const recent = (ts?: number) => ts && Date.now() - ts < 10_000;
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5">
      <a href={`tel:${phone}`}
         className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:scale-105 active:scale-95 transition-transform min-h-[36px]">
        <Phone className="h-3.5 w-3.5" /> {label ? `${label}: ` : ""}{phone}
      </a>
      {!compact && (
        <>
          <button onClick={onCopy}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-[11px] font-semibold active:scale-95 transition-transform min-h-[36px]",
              fb.copied ? "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/40" : "bg-secondary hover:bg-secondary/70",
              recent(fb.copied) && "animate-pulse",
            )}
            aria-label={t.copy}>
            {fb.copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {fb.copied ? t.copied : t.copy}
          </button>
          <a href={`sms:${phone}`} onClick={onSms}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-[11px] font-semibold active:scale-95 transition-transform min-h-[36px]",
              fb.sms ? "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/40" : "bg-secondary hover:bg-secondary/70",
              recent(fb.sms) && "animate-pulse",
            )}>
            {fb.sms ? <Check className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />} {fb.sms ? t.sent : t.sms}
          </a>
        </>
      )}
    </div>
  );
}

function PersonaHeader({ personaKey, lang, onAvatarClick }: { personaKey: PersonaKey; lang: Lang; onAvatarClick?: () => void }) {
  const p = PERSONAS[personaKey];
  const Icon = p.icon;
  const lk = langKeyOf(lang);
  return (
    <div className={cn("flex items-center gap-2.5 mb-2 -mx-1 px-2 py-1.5 rounded-xl ring-1", p.bg, p.ring)}>
      <button
        onClick={onAvatarClick}
        className={cn("h-10 w-10 rounded-full overflow-hidden bg-background/60 ring-2 shrink-0 hover:scale-110 active:scale-95 transition-transform", p.ring)}
        aria-label="Open avatar"
      >
        {p.image ? (
          <img src={p.image} alt={p.label[lk]} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center"><Icon className={cn("h-5 w-5", p.text)} /></div>
        )}
      </button>
      <div className="flex flex-col leading-tight flex-1 min-w-0">
        <span className={cn("text-xs font-bold truncate", p.text)}>{p.label[lk]}</span>
        <span className="text-[10px] text-muted-foreground">Hokim AI · {personaKey}</span>
      </div>
      {p.hotline && (
        <a href={`tel:${p.hotline}`} className="inline-flex items-center gap-1 rounded-full bg-primary/90 px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground hover:scale-105 transition-transform">
          <Phone className="h-3 w-3" /> {p.hotline}
        </a>
      )}
    </div>
  );
}

function AvatarPicker({
  open, onClose, onPick, lang,
}: { open: boolean; onClose: () => void; onPick: (p: Persona) => void; lang: Lang }) {
  if (!open) return null;
  const lk = langKeyOf(lang);
  const list = Object.values(PERSONAS).filter(p => p.key !== "default");
  return (
    <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-lg glass rounded-2xl p-4 shadow-2xl border border-border/60">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold flex items-center gap-2"><Users className="h-4 w-4 text-accent" /> Virtual avatar bilan bog'lanish</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-secondary flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
          {list.map(p => {
            const Icon = p.icon;
            return (
              <button
                key={p.key}
                onClick={() => { onPick(p); onClose(); }}
                className={cn("text-left rounded-xl p-3 ring-1 hover:scale-[1.02] active:scale-95 transition-transform", p.bg, p.ring)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn("h-10 w-10 rounded-full overflow-hidden bg-background/60 ring-1 shrink-0", p.ring)}>
                    {p.image ? <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Icon className={cn("h-4 w-4 m-auto mt-3", p.text)} />}
                  </div>
                  <span className={cn("text-xs font-bold leading-tight", p.text)}>{p.label[lk]}</span>
                </div>
                {p.hotline && (
                  <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {p.hotline}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Big speaking avatar modal — ElevenLabs TTS (with browser fallback) + animated gestures */
function SpeakingAvatar({
  open, onClose, persona, text, lang, autoSpeak, messageId, onSpeakStateChange,
}: {
  open: boolean; onClose: () => void; persona: Persona | null; text: string; lang: Lang;
  autoSpeak: boolean; messageId?: string;
  onSpeakStateChange?: (state: { speaking: boolean; messageId?: string }) => void;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lk = langKeyOf(lang);

  const stop = useCallback(() => {
    try { window.speechSynthesis.cancel(); } catch {}
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setSpeaking(false);
    onSpeakStateChange?.({ speaking: false, messageId });
  }, [messageId, onSpeakStateChange]);

  const speak = useCallback(async () => {
    if (!text || !persona) return;
    stop();
    const cleaned = plainText(text);
    if (!cleaned) return;

    const startBrowserFallback = () => {
      speakWithBrowser(text, lang, persona.gender,
        () => { setSpeaking(true); onSpeakStateChange?.({ speaking: true, messageId }); },
        () => { setSpeaking(false); onSpeakStateChange?.({ speaking: false, messageId }); },
      );
    };

    setLoadingAudio(true);
    try {
      const voiceId = voiceIdFor(persona, langKeyOf(lang));
      const r = await fetch(TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ text: cleaned, voiceId, lang: langKeyOf(lang) }),
      });
      if (!r.ok) throw new Error(`tts ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => { setSpeaking(true); onSpeakStateChange?.({ speaking: true, messageId }); };
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); onSpeakStateChange?.({ speaking: false, messageId }); };
      audio.onerror = () => { setSpeaking(false); onSpeakStateChange?.({ speaking: false, messageId }); startBrowserFallback(); };
      await audio.play();
    } catch {
      // Fallback to browser TTS
      startBrowserFallback();
    } finally {
      setLoadingAudio(false);
    }
  }, [text, persona, lang, stop, messageId, onSpeakStateChange]);

  useEffect(() => {
    if (open && autoSpeak) {
      const t = setTimeout(() => speak(), 200);
      return () => { clearTimeout(t); stop(); };
    }
    if (!open) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoSpeak]);

  if (!open || !persona) return null;
  const Icon = persona.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center p-4"
        onClick={() => { stop(); onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 22 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-md glass rounded-3xl p-5 shadow-2xl border border-border/60 relative"
        >
          <button onClick={() => { stop(); onClose(); }}
            className="absolute right-3 top-3 h-9 w-9 rounded-full bg-secondary hover:bg-secondary/70 flex items-center justify-center z-10">
            <X className="h-4 w-4" />
          </button>

          <div className="flex flex-col items-center text-center pt-2">
            <div className="relative">
              {speaking && (
                <>
                  <motion.span
                    className={cn("absolute inset-0 rounded-full ring-4", persona.ring)}
                    animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  />
                  <motion.span
                    className={cn("absolute inset-0 rounded-full ring-4", persona.ring)}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: 0.3 }}
                  />
                </>
              )}
              <motion.div
                animate={speaking ? { y: [0, -3, 0, -2, 0], rotate: [0, -1.5, 0, 1.5, 0] } : { y: 0, rotate: 0 }}
                transition={speaking ? { duration: 0.55, repeat: Infinity } : { duration: 0.3 }}
                className={cn("h-44 w-44 rounded-full overflow-hidden ring-4 shadow-2xl bg-background relative", persona.ring)}
              >
                {persona.image ? (
                  <img src={persona.image} alt={persona.label[lk]} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center"><Icon className={cn("h-20 w-20", persona.text)} /></div>
                )}
                {speaking && (
                  <motion.span
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 h-2 w-10 rounded-full bg-foreground/30"
                    animate={{ scaleX: [0.4, 1, 0.6, 1.1, 0.5], scaleY: [0.6, 1, 0.7, 1.2, 0.6] }}
                    transition={{ duration: 0.45, repeat: Infinity }}
                  />
                )}
              </motion.div>
            </div>

            <h3 className={cn("mt-4 font-extrabold text-lg leading-tight", persona.text)}>{persona.label[lk]}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Hokim AI · {persona.key} · {persona.gender === "female" ? (lk === "ru" ? "женский" : "ayol") : (lk === "ru" ? "мужской" : "erkak")}
            </p>

            <div className="mt-4 max-h-40 w-full overflow-y-auto rounded-xl bg-secondary/60 p-3 text-left text-sm">
              <ReactMarkdown>{text || (lk === "ru" ? "Ассистент пока молчит." : "Yordamchi hozircha jim.")}</ReactMarkdown>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {speaking ? (
                <Button onClick={stop} size="sm" variant="destructive" className="gap-2 rounded-full">
                  <VolumeX className="h-4 w-4" /> {lk === "ru" ? "Стоп" : "To'xtatish"}
                </Button>
              ) : (
                <Button onClick={speak} size="sm" disabled={loadingAudio} className="gap-2 rounded-full gradient-accent text-accent-foreground">
                  <Volume2 className="h-4 w-4" />
                  {loadingAudio ? (lk === "ru" ? "Загрузка…" : "Yuklanmoqda…") : (lk === "ru" ? "Озвучить" : "Ovozda eshitish")}
                </Button>
              )}
              {persona.hotline && (
                <HotlineActions phone={persona.hotline} lang={lang} />
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
export default function Chat() {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw) as Msg[];
    } catch { /* ignore */ }
    return [];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activePersona, setActivePersona] = useState<PersonaKey | null>(() => {
    if (typeof window === "undefined") return null;
    try { return (localStorage.getItem(ACTIVE_PERSONA_KEY) as PersonaKey) || null; } catch { return null; }
  });
  // Avatar speaking modal state
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarPersona, setAvatarPersona] = useState<Persona | null>(null);
  const [avatarText, setAvatarText] = useState("");
  const [avatarAuto, setAvatarAuto] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist messages
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
  }, [messages]);
  useEffect(() => {
    try {
      if (activePersona) localStorage.setItem(ACTIVE_PERSONA_KEY, activePersona);
      else localStorage.removeItem(ACTIVE_PERSONA_KEY);
    } catch {}
  }, [activePersona]);

  // Preload TTS voices
  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => { try { window.speechSynthesis.cancel(); } catch {} };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function logSafety(topic: string, userText: string) {
    try {
      await supabase.from("activity_logs").insert({
        action: "ai_safety_redirect",
        details: `[${topic}] ${userText.slice(0, 240)}`,
        actor: "hokim_ai",
      });
    } catch { /* ignore */ }
  }

  function openAvatar(p: Persona, text = "", auto = false) {
    setAvatarPersona(p);
    setAvatarText(text);
    setAvatarAuto(auto);
    setAvatarOpen(true);
  }

  function pickAvatar(p: Persona) {
    setActivePersona(p.key);
    const lk = langKeyOf(lang);
    const greetings: Record<typeof lk, string> = {
      uz: `Assalomu alaykum! Men **${p.label.uz}**man. Muammoyingizni batafsil yozing — yordam beraman.`,
      uz_cyrl: `Ассалому алайкум! Мен **${p.label.uz_cyrl}**ман. Муаммоингизни батафсил ёзинг — ёрдам бераман.`,
      ru: `Здравствуйте! Я — **${p.label.ru}**. Опишите вашу проблему подробнее.`,
    };
    const greeting = greetings[lk];
    setMessages(m => [...m, { role: "assistant", content: greeting, persona: p.key }]);
    // Open speaking avatar with greeting auto-spoken
    openAvatar(p, greeting, true);
  }

  function clearChat() {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const safety = detectSafetyTopic(trimmed);
    if (safety) {
      const lk = langKeyOf(lang);
      const redirect = SAFETY_REDIRECTS[safety][lk];
      const next: Msg[] = [
        ...messages,
        { role: "user", content: trimmed },
        { role: "assistant", content: redirect, persona: safety, safety: true },
      ];
      setMessages(next);
      setInput("");
      void logSafety(safety, trimmed);
      return;
    }

    const userPersona = activePersona ?? detectPersona(trimmed);
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          lang,
          hint_persona: userPersona,
        }),
      });
      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast.error(lang === "ru" ? "Слишком много запросов" : "Juda ko'p so'rov, biroz kuting");
        else if (resp.status === 402) toast.error(lang === "ru" ? "AI кредиты закончились" : "AI kredit tugadi");
        else toast.error("Xatolik");
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let assistant = "";
      let finalPersona: PersonaKey = userPersona;
      setMessages([...next, { role: "assistant", content: "", persona: userPersona }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              assistant += delta;
              const detected = detectPersonaFromAssistant(assistant);
              finalPersona = detected !== "default" ? detected : userPersona;
              setMessages(m => {
                const c = [...m];
                c[c.length - 1] = { role: "assistant", content: assistant, persona: finalPersona };
                return c;
              });
            }
          } catch { /* ignore */ }
        }
      }

      // After streaming complete, if user has an active avatar persona, auto-open speaking modal
      if (activePersona && assistant) {
        openAvatar(PERSONAS[finalPersona], assistant, true);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [t("chat.suggest_1"), t("chat.suggest_2"), t("chat.suggest_3"), t("chat.suggest_4")];
  const activeP = activePersona ? PERSONAS[activePersona] : null;
  const lk = langKeyOf(lang);

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-12rem)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2"><MessageSquare className="h-6 w-6 text-accent" />{t("chat.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("chat.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button onClick={clearChat} size="sm" variant="ghost" className="text-xs text-muted-foreground hover:text-destructive">
              {lk === "ru" ? "Очистить" : "Tozalash"}
            </Button>
          )}
          <Button onClick={() => setPickerOpen(true)} size="sm" variant="outline" className="shrink-0 gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Virtual avatar</span>
          </Button>
        </div>
      </div>

      {activeP && (
        <button
          onClick={() => openAvatar(activeP, "", false)}
          className={cn("mb-3 flex items-center gap-2 rounded-xl px-3 py-2 ring-1 w-full text-left hover:scale-[1.01] active:scale-[0.99] transition-transform", activeP.bg, activeP.ring)}
        >
          <div className={cn("h-9 w-9 rounded-full overflow-hidden ring-2 shrink-0", activeP.ring)}>
            {activeP.image ? <img src={activeP.image} alt="" className="h-full w-full object-cover" /> : <activeP.icon className={cn("h-4 w-4 m-auto mt-2.5", activeP.text)} />}
          </div>
          <span className={cn("text-xs font-bold flex-1", activeP.text)}>{activeP.label[lk]}</span>
          {activeP.hotline && <span className="text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1"><Phone className="h-3 w-3" />{activeP.hotline}</span>}
          <Mic className={cn("h-4 w-4", activeP.text)} />
          <span onClick={(e) => { e.stopPropagation(); setActivePersona(null); }} className="text-xs text-muted-foreground hover:text-foreground px-1">✕</span>
        </button>
      )}

      <div ref={scrollRef} className="flex-1 glass rounded-2xl p-4 md:p-6 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-accent/10 border border-accent/20 p-4 text-sm flex gap-2">
              <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" /> {t("chat.intro")}
            </div>
            <button onClick={() => setPickerOpen(true)} className="w-full text-left rounded-xl border border-dashed border-accent/40 bg-accent/5 hover:bg-accent/10 p-4 transition-smooth flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center"><Users className="h-5 w-5 text-accent" /></div>
              <div className="flex-1">
                <div className="font-bold text-sm">Virtual avatar bilan bog'lanish</div>
                <div className="text-xs text-muted-foreground">Gaz, svet, suv, IIB va boshqa xizmat vakili bilan suhbat boshlang</div>
              </div>
            </button>
            <div className="grid sm:grid-cols-2 gap-2">
              {suggestions.map(s => (
                <button key={s} onClick={() => send(s)} className="text-left text-sm rounded-xl bg-secondary hover:bg-secondary/70 p-3 transition-smooth border border-border/60">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => {
            const persona = m.persona ? PERSONAS[m.persona] : null;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={cn(
                  "max-w-[88%] rounded-2xl px-4 py-3 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : m.safety
                      ? "bg-destructive/10 border border-destructive/30"
                      : "bg-secondary"
                )}>
                  {m.role === "assistant" && m.persona && (
                    <PersonaHeader
                      personaKey={m.persona}
                      lang={lang}
                      onAvatarClick={() => persona && openAvatar(persona, m.content, true)}
                    />
                  )}
                  {m.role === "assistant" ? (
                    <>
                      <div className="prose prose-sm max-w-none prose-headings:my-1 prose-p:my-1 prose-ul:my-1">
                        <ReactMarkdown>{m.content || "..."}</ReactMarkdown>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {persona?.hotline && (
                          <HotlineActions
                            phone={persona.hotline}
                            lang={lang}
                            label={m.safety ? (lk === "ru" ? "Позвонить" : "Qo'ng'iroq") : undefined}
                          />
                        )}
                        {m.safety && (
                          <a href="tel:103" className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground hover:scale-105 transition-transform min-h-[36px]">
                            <Phone className="h-3.5 w-3.5" /> 103
                          </a>
                        )}
                        {persona && m.content && (
                          <button
                            onClick={() => openAvatar(persona, m.content, true)}
                            className="inline-flex items-center gap-1 rounded-full bg-accent/15 text-accent ring-1 ring-accent/30 px-2.5 py-2 text-[11px] font-semibold hover:bg-accent/25 active:scale-95 transition-transform min-h-[36px]"
                          >
                            <Volume2 className="h-3 w-3" /> {lk === "ru" ? "Озвучить" : "Ovozda eshitish"}
                          </button>
                        )}
                      </div>
                    </>
                  ) : <p className="whitespace-pre-wrap">{m.content}</p>}
                </div>
              </motion.div>
            );
          })
        )}
        {loading && <div className="text-xs text-muted-foreground animate-pulse">{t("chat.thinking")}</div>}
      </div>

      <form onSubmit={e => { e.preventDefault(); send(input); }} className="mt-3 flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} placeholder={t("chat.placeholder")} className="h-12" />
        <Button type="submit" disabled={loading || !input.trim()} size="lg" className="gradient-accent text-accent-foreground">
          <Send className="h-4 w-4" />
        </Button>
      </form>

      <AvatarPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={pickAvatar} lang={lang} />
      <SpeakingAvatar
        open={avatarOpen}
        onClose={() => setAvatarOpen(false)}
        persona={avatarPersona}
        text={avatarText}
        lang={lang}
        autoSpeak={avatarAuto}
      />
    </div>
  );
}
