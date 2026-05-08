import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles, MessageSquare, Phone, Users, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n, Lang } from "@/i18n/I18nProvider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PERSONAS, PersonaKey, Persona, detectPersona, detectPersonaFromAssistant,
  detectSafetyTopic, SAFETY_REDIRECTS,
} from "@/lib/persona";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "assistant"; content: string; persona?: PersonaKey; safety?: boolean; }

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const FN_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/ai-chat`;

const langKeyOf = (lang: Lang) =>
  (lang === "ru" ? "ru" : lang === "uz_cyrl" ? "uz_cyrl" : "uz") as "uz" | "uz_cyrl" | "ru";

function HotlineButton({ phone, label }: { phone: string; label?: string }) {
  return (
    <a
      href={`tel:${phone}`}
      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:scale-105 active:scale-95 transition-transform"
    >
      <Phone className="h-3.5 w-3.5" /> {label ? `${label}: ` : ""}{phone}
    </a>
  );
}

function PersonaHeader({ personaKey, lang }: { personaKey: PersonaKey; lang: Lang }) {
  const p = PERSONAS[personaKey];
  const Icon = p.icon;
  const lk = langKeyOf(lang);
  return (
    <div className={cn("flex items-center gap-2.5 mb-2 -mx-1 px-2 py-1.5 rounded-xl ring-1", p.bg, p.ring)}>
      <div className={cn("h-9 w-9 rounded-full flex items-center justify-center bg-background/60 ring-2", p.ring)}>
        <Icon className={cn("h-4.5 w-4.5", p.text)} />
      </div>
      <div className="flex flex-col leading-tight flex-1 min-w-0">
        <span className={cn("text-xs font-bold truncate", p.text)}>{p.label[lk]}</span>
        <span className="text-[10px] text-muted-foreground">Hokim AI · {personaKey}</span>
      </div>
      {p.hotline && <HotlineButton phone={p.hotline} />}
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
                  <div className={cn("h-8 w-8 rounded-full bg-background/60 flex items-center justify-center ring-1", p.ring)}>
                    <Icon className={cn("h-4 w-4", p.text)} />
                  </div>
                  <span className={cn("text-xs font-bold", p.text)}>{p.label[lk]}</span>
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

export default function Chat() {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activePersona, setActivePersona] = useState<PersonaKey | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  function pickAvatar(p: Persona) {
    setActivePersona(p.key);
    const lk = langKeyOf(lang);
    const greetings: Record<typeof lk, string> = {
      uz: `Assalomu alaykum! Men **${p.label.uz}**man. Muammoyingizni batafsil yozing — yordam beraman.`,
      uz_cyrl: `Ассалому алайкум! Мен **${p.label.uz_cyrl}**ман. Муаммоингизни батафсил ёзинг — ёрдам бераман.`,
      ru: `Здравствуйте! Я — **${p.label.ru}**. Опишите вашу проблему подробнее.`,
    };
    setMessages(m => [...m, { role: "assistant", content: greetings[lk], persona: p.key }]);
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
              const persona: PersonaKey = detected !== "default" ? detected : userPersona;
              setMessages(m => {
                const c = [...m];
                c[c.length - 1] = { role: "assistant", content: assistant, persona };
                return c;
              });
            }
          } catch { /* ignore */ }
        }
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
        <Button onClick={() => setPickerOpen(true)} size="sm" variant="outline" className="shrink-0 gap-2">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Virtual avatar</span>
        </Button>
      </div>

      {activeP && (
        <div className={cn("mb-3 flex items-center gap-2 rounded-xl px-3 py-2 ring-1", activeP.bg, activeP.ring)}>
          <activeP.icon className={cn("h-4 w-4", activeP.text)} />
          <span className={cn("text-xs font-bold", activeP.text)}>{activeP.label[lk]}</span>
          {activeP.hotline && <HotlineButton phone={activeP.hotline} />}
          <button onClick={() => setActivePersona(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">✕</button>
        </div>
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
                    <PersonaHeader personaKey={m.persona} lang={lang} />
                  )}
                  {m.role === "assistant" ? (
                    <>
                      <div className="prose prose-sm max-w-none prose-headings:my-1 prose-p:my-1 prose-ul:my-1">
                        <ReactMarkdown>{m.content || "..."}</ReactMarkdown>
                      </div>
                      {m.safety && persona?.hotline && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <HotlineButton phone={persona.hotline} label={lang === "ru" ? "Позвонить" : "Qo'ng'iroq"} />
                          <a href="tel:103" className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground hover:scale-105 transition-transform">
                            <Phone className="h-3.5 w-3.5" /> 103
                          </a>
                        </div>
                      )}
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
    </div>
  );
}
