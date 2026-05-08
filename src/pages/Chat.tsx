import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Sparkles, MessageSquare, Phone } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n, Lang } from "@/i18n/I18nProvider";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  PERSONAS, PersonaKey, detectPersona, detectPersonaFromAssistant,
  detectSafetyTopic, SAFETY_REDIRECTS,
} from "@/lib/persona";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "assistant"; content: string; persona?: PersonaKey; safety?: boolean; }

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const FN_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/ai-chat`;

function PersonaBadge({ personaKey, lang }: { personaKey: PersonaKey; lang: Lang }) {
  const p = PERSONAS[personaKey];
  const Icon = p.icon;
  const langKey = (lang === "ru" ? "ru" : lang === "uz_cyrl" ? "uz_cyrl" : "uz") as keyof typeof p.label;
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className={cn("h-9 w-9 rounded-full flex items-center justify-center ring-2", p.bg, p.ring)}>
        <Icon className={cn("h-4.5 w-4.5", p.text)} />
      </div>
      <div className="flex flex-col leading-tight">
        <span className={cn("text-xs font-bold", p.text)}>{p.label[langKey]}</span>
        {p.hotline && (
          <a href={`tel:${p.hotline}`} className="text-[10px] text-muted-foreground inline-flex items-center gap-1 hover:underline">
            <Phone className="h-3 w-3" /> {p.hotline}
          </a>
        )}
      </div>
    </div>
  );
}

export default function Chat() {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
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

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    // 1) Client-side safety check — instant redirect, no AI call
    const safety = detectSafetyTopic(trimmed);
    if (safety) {
      const lk = (lang === "ru" ? "ru" : lang === "uz_cyrl" ? "uz_cyrl" : "uz") as keyof typeof SAFETY_REDIRECTS["tibbiy"];
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

    const userPersona = detectPersona(trimmed);
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

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-12rem)]">
      <div className="mb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2"><MessageSquare className="h-6 w-6 text-accent" />{t("chat.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("chat.subtitle")}</p>
      </div>

      <div ref={scrollRef} className="flex-1 glass rounded-2xl p-4 md:p-6 overflow-y-auto space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-accent/10 border border-accent/20 p-4 text-sm flex gap-2">
              <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" /> {t("chat.intro")}
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {suggestions.map(s => (
                <button key={s} onClick={() => send(s)} className="text-left text-sm rounded-xl bg-secondary hover:bg-secondary/70 p-3 transition-smooth border border-border/60">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
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
                  <PersonaBadge personaKey={m.persona} lang={lang} />
                )}
                {m.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none prose-headings:my-1 prose-p:my-1 prose-ul:my-1">
                    <ReactMarkdown>{m.content || "..."}</ReactMarkdown>
                  </div>
                ) : <p className="whitespace-pre-wrap">{m.content}</p>}
              </div>
            </motion.div>
          ))
        )}
        {loading && <div className="text-xs text-muted-foreground animate-pulse">{t("chat.thinking")}</div>}
      </div>

      <form onSubmit={e => { e.preventDefault(); send(input); }} className="mt-3 flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} placeholder={t("chat.placeholder")} className="h-12" />
        <Button type="submit" disabled={loading || !input.trim()} size="lg" className="gradient-accent text-accent-foreground">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
