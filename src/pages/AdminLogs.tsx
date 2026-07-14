import { useEffect, useState, useMemo } from "react";
import { ScrollText, Search, Download, FileDown } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { adminCall } from "@/lib/adminApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const ACTION_OPTIONS: { v: string; l: string }[] = [
  { v: "all", l: "Barchasi" },
  { v: "ai_classified", l: "AI tahlil" },
  { v: "routed", l: "Yo'naltirildi" },
  { v: "status_changed", l: "Holat o'zgardi" },
  { v: "response_sent", l: "Rasmiy javob" },
  { v: "routing_feedback", l: "Fuqaro bahosi" },
  { v: "escalated", l: "Eskalatsiya" },
  { v: "admin_viewed", l: "Admin ko'rdi" },
  { v: "admin_login_success", l: "Admin kirdi" },
];

const ACTION_LABELS: Record<string, string> = Object.fromEntries(ACTION_OPTIONS.map(o => [o.v, o.l]));

export default function AdminLogs() {
  const { t, lang } = useI18n();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("");
  const [act, setAct] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 500 };
      if (q) params.q = q;
      if (actor) params.actor = actor;
      if (act !== "all") params.actions = [act];
      if (from) params.from = new Date(from).toISOString();
      if (to) params.to = new Date(to + "T23:59:59").toISOString();
      const r = await adminCall<{ logs: any[] }>("routing_audit", params);
      setLogs(r.logs || []);
    } catch { /* ignore */ }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const dateFmt = (d: string) => new Date(d).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB");

  const summary = useMemo(() => {
    const s: Record<string, number> = {};
    for (const l of logs) s[l.action] = (s[l.action] ?? 0) + 1;
    return s;
  }, [logs]);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-2">{t("admin.logs_title")}</h1>
      <p className="text-sm text-muted-foreground mb-6">AI yo'naltirish qarorlari, statuslar, javoblar va ko'rish audit logi</p>

      <div className="glass rounded-2xl p-4 mb-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
          <Input placeholder="Qidiruv (matn, kod, tafsilot)" value={q} onChange={e => setQ(e.target.value)} />
          <Input placeholder="Aktor (admin, mahalla:...)" value={actor} onChange={e => setActor(e.target.value)} />
          <Select value={act} onValueChange={setAct}>
            <SelectTrigger><SelectValue placeholder="Amal turi" /></SelectTrigger>
            <SelectContent>
              {ACTION_OPTIONS.map(o => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" onClick={load} className="gradient-accent text-accent-foreground">
            <Search className="mr-1 h-4 w-4" /> Qidirish
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setQ(""); setActor(""); setAct("all"); setFrom(""); setTo(""); }}>
            Tozalash
          </Button>
          <div className="text-xs text-muted-foreground ml-auto">
            Jami: <span className="font-semibold text-foreground">{logs.length}</span>
          </div>
        </div>
        {Object.keys(summary).length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-[10px]">
            {Object.entries(summary).map(([a, n]) => (
              <span key={a} className="rounded-full bg-secondary px-2 py-0.5">
                {ACTION_LABELS[a] ?? a}: <b>{n}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="glass rounded-2xl divide-y divide-border/60">
        {loading && <div className="p-6 text-muted-foreground">...</div>}
        {!loading && logs.length === 0 && <div className="p-6 text-muted-foreground">{t("admin.no_data")}</div>}
        {logs.map(l => {
          const open = expanded[l.id];
          return (
            <button
              key={l.id}
              onClick={() => setExpanded(s => ({ ...s, [l.id]: !s[l.id] }))}
              className="w-full flex items-start gap-3 p-4 text-left hover:bg-secondary/40 transition-smooth"
            >
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <ScrollText className="h-4 w-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{ACTION_LABELS[l.action] ?? l.action}</span>
                  <span className="rounded-full bg-secondary text-[10px] px-2 py-0.5 font-mono">{l.action}</span>
                </div>
                {l.details && (
                  <div className={`text-xs text-muted-foreground mt-0.5 ${open ? "whitespace-pre-wrap" : "truncate"}`}>
                    {l.details}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-1">
                  {l.actor || "system"} • {dateFmt(l.created_at)}
                  {l.complaint_id && <> • <span className="font-mono">#{String(l.complaint_id).slice(0, 8)}</span></>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
