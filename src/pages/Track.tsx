import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, MapPin, Calendar, Sparkles, FileText, ExternalLink, Image as ImageIcon, Info, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";

const CODE_RE = /^HOK-\d{8}-\d{3,5}$/i;

export default function Track() {
  const { t, lang } = useI18n();
  const [params, setParams] = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  const lookup = useCallback(async (raw: string) => {
    const c = raw.trim().toUpperCase();
    if (!c) return;
    setLoading(true); setNotFound(false); setData(null);
    const { data, error } = await supabase.functions.invoke("track-complaint", {
      body: { tracking_code: c },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (!data?.complaint) { setNotFound(true); return; }
    setData(data.complaint);
  }, []);

  // Auto-load from URL ?code=HOK-...
  useEffect(() => {
    const q = params.get("code");
    if (q && CODE_RE.test(q)) lookup(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced auto-lookup when user types a full valid code
  useEffect(() => {
    const c = code.trim().toUpperCase();
    if (!CODE_RE.test(c)) return;
    const h = setTimeout(() => {
      if (data?.tracking_code !== c) lookup(c);
    }, 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setParams({ code: code.trim().toUpperCase() }, { replace: true });
    await lookup(code);
  }

  const dateFmt = (d: string) => new Date(d).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB");
  const cats: string[] = data?.categories?.length ? data.categories : data ? [data.category] : [];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-1">{t("track.title")}</h1>
        <p className="text-muted-foreground">{t("track.subtitle")}</p>
      </div>
      <form onSubmit={check} className="glass rounded-2xl p-5 flex gap-2 shadow-card-soft">
        <Input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="HOK-20260714-0001"
          className="text-base h-12 font-mono"
          autoFocus
        />
        <Button type="submit" disabled={loading} size="lg" className="gradient-accent text-accent-foreground">
          <Search className="mr-1 h-4 w-4" /> {loading ? "..." : t("track.check")}
        </Button>
      </form>
      <p className="text-[11px] text-muted-foreground mt-2 pl-1">
        Format: <span className="font-mono">HOK-YYYYMMDD-NNNN</span> — to'liq kod kiritilganda avtomatik yuklanadi
      </p>

      {notFound && <div className="mt-6 glass rounded-2xl p-8 text-center"><p className="text-muted-foreground">{t("track.not_found")}</p></div>}

      {data && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6 glass rounded-2xl p-6 md:p-8 shadow-elegant">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("track.details")}</div>
              <div className="font-bold text-lg font-mono">{data.tracking_code}</div>
            </div>
            <StatusBadge status={data.status} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <InfoBox icon={Calendar} label={t("track.submitted_on")} value={dateFmt(data.created_at)} />
            <div className="rounded-xl bg-secondary/60 p-3.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1"><Sparkles className="h-3 w-3" />{t("track.categories")}</div>
              <div className="flex flex-wrap gap-1">
                {cats.map(c => <span key={c} className="rounded-md bg-accent/15 text-accent text-xs font-semibold px-2 py-0.5">{t(`category.${c}`)}</span>)}
              </div>
            </div>
            {data.location && <InfoBox icon={MapPin} label={t("track.details")} value={data.location} />}
            {data.map_link && (
              <a href={data.map_link} target="_blank" rel="noreferrer" className="rounded-xl bg-accent/10 hover:bg-accent/20 transition-smooth p-3.5 flex items-center gap-2 text-sm font-medium text-accent">
                <ExternalLink className="h-4 w-4" /> {t("admin.view_map")}
              </a>
            )}
          </div>

          <div className="rounded-xl bg-secondary p-4 mb-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {t("submit.text")}</div>
            <p className="text-sm whitespace-pre-wrap">{data.text}</p>
          </div>

          {data.image_urls?.length > 0 && (
            <div className="rounded-xl bg-secondary p-4 mb-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" />{t("track.images")}</div>
              <div className="grid grid-cols-3 gap-2">
                {data.image_urls.map((u: string, i: number) => (
                  <a key={i} href={u} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border border-border block">
                    <img src={u} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* "Nega shunday yo'naltirildi?" — AI reasoning */}
          {(data.severity || data.routing_target || data.responsible_org || data.eta_days || data.ai_response) && (
            <ReasoningPanel data={data} />
          )}

          {/* Timeline */}
          <TimelinePanel
            createdAt={data.created_at}
            currentStatus={data.status}
            logs={data.timeline ?? []}
            t={t}
            dateFmt={dateFmt}
          />

          {data.admin_notes && (
            <div className="rounded-xl bg-success/10 border border-success/20 p-4 mt-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-success mb-1.5">{t("track.admin_notes")}</div>
              <p className="text-sm">{data.admin_notes}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function InfoBox({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-0.5"><Icon className="h-3 w-3" /> {label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function ReasoningPanel({ data }: { data: any }) {
  const severity = data.severity as string | undefined;
  const routing = data.routing_target as string | undefined;
  const sevLabel = severity === "yuqori" ? "Yuqori" : severity === "orta" ? "O'rta" : "Oddiy";
  const sevTone = severity === "yuqori"
    ? "bg-destructive/15 text-destructive border-destructive/30"
    : severity === "orta"
    ? "bg-warning/15 text-warning-foreground border-warning/40"
    : "bg-accent/15 text-accent border-accent/30";
  const routeLabel = routing === "hokimiyat" ? "Farg'ona tumani hokimligi" : "Mahalla fuqarolar yig'ini (MFY)";
  const etaLabel = data.eta_days == null ? null
    : data.eta_days <= 7 ? "3–7 kun"
    : data.eta_days <= 30 ? "7–30 kun" : "30+ kun";

  // Reasoning bullets
  const reasons: string[] = [];
  if (data.category_details?.length) {
    const hits = data.category_details.flatMap((d: any) => d.hits ?? []).slice(0, 6);
    if (hits.length > 0) reasons.push(`Matn tarkibida aniqlangan kalit so'zlar: “${hits.join(", ")}”.`);
    reasons.push(`Kategoriya(lar): ${data.category_details.map((d: any) => d.category).join(", ")}.`);
  }
  if (severity) reasons.push(`Muammoning og'irlik darajasi — ${sevLabel.toLowerCase()}.`);
  if (routing) {
    reasons.push(routing === "hokimiyat"
      ? "Muammo tashkiliy/kapital darajada — MFY vakolatidan tashqarida, shu sababli to'g'ridan-to'g'ri hokimiyatga yo'naltirildi."
      : "Muammo mahalliy darajada hal etiladi — MFY (mahalla) vakolatiga tegishli.");
  }
  if (data.responsible_org) reasons.push(`Mas'ul tashkilot: ${data.responsible_org}.`);
  if (etaLabel) reasons.push(`Muammoning turi va og'irligi asosida taxminiy hal etilish muddati — ${etaLabel}.`);

  return (
    <details open className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-3 group">
      <summary className="cursor-pointer list-none flex items-center gap-2 font-semibold text-sm">
        <Info className="h-4 w-4 text-primary" />
        Nega shunday yo'naltirildi?
        <span className="ml-auto text-[11px] text-muted-foreground group-open:hidden">ochish</span>
      </summary>

      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        {severity && (
          <div className={`rounded-md border px-2.5 py-1.5 ${sevTone}`}>
            <div className="opacity-70">Og'irlik</div>
            <div className="font-semibold">{sevLabel}</div>
          </div>
        )}
        {routing && (
          <div className="rounded-md border bg-background/60 px-2.5 py-1.5">
            <div className="text-muted-foreground">Yo'naltirildi</div>
            <div className="font-semibold">{routeLabel}</div>
          </div>
        )}
        {data.responsible_org && (
          <div className="rounded-md border bg-background/60 px-2.5 py-1.5 col-span-2">
            <div className="text-muted-foreground">Mas'ul tashkilot</div>
            <div className="font-semibold">{data.responsible_org}</div>
          </div>
        )}
        {etaLabel && (
          <div className="rounded-md border bg-background/60 px-2.5 py-1.5 col-span-2">
            <div className="text-muted-foreground">Taxminiy muddat</div>
            <div className="font-semibold">{etaLabel}</div>
          </div>
        )}
      </div>

      {reasons.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-xs text-foreground/85">
          {reasons.map((r, i) => (
            <li key={i} className="flex gap-2"><ArrowRight className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" /><span>{r}</span></li>
          ))}
        </ul>
      )}

      {data.ai_response && (
        <div className="mt-3 rounded-md bg-accent/10 border border-accent/20 p-2.5 text-xs">
          <div className="font-semibold text-accent mb-1 flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI xulosasi</div>
          <p>{data.ai_response}</p>
        </div>
      )}
    </details>
  );
}

function humanizeAction(action: string, details: string | null): string {
  const map: Record<string, string> = {
    complaint_created: "Murojaat qabul qilindi",
    status_changed: "Holat yangilandi",
    response_sent: "Rasmiy javob yuborildi",
    ai_classified: "AI tahlil yakunlandi",
    routed: "Tegishli bo'limga yo'naltirildi",
  };
  const base = map[action] ?? action.replace(/_/g, " ");
  return details ? `${base} — ${details}` : base;
}

function TimelinePanel({ createdAt, currentStatus, logs, t, dateFmt }: any) {
  // Build ordered event list; if no logs, synthesize from created_at + current status
  const events = logs?.length
    ? logs
    : [{ action: "complaint_created", details: null, created_at: createdAt }];

  return (
    <div className="rounded-xl bg-secondary/40 border border-border p-4 mt-3">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" /> Jarayon tarixi
      </div>
      <ol className="relative border-l-2 border-border/70 pl-4 space-y-3">
        {events.map((ev: any, i: number) => {
          const isLast = i === events.length - 1;
          return (
            <li key={i} className="relative">
              <span className={`absolute -left-[22px] top-1 h-3 w-3 rounded-full ring-2 ring-background ${isLast ? "bg-success" : "bg-primary"}`} />
              <div className="text-xs text-muted-foreground">{dateFmt(ev.created_at)}</div>
              <div className="text-sm font-medium">{humanizeAction(ev.action, ev.details)}</div>
            </li>
          );
        })}
        <li className="relative">
          <span className="absolute -left-[22px] top-1 h-3 w-3 rounded-full ring-2 ring-background bg-accent" />
          <div className="text-xs text-muted-foreground">Joriy holat</div>
          <div className="text-sm font-medium">
            <StatusBadge status={currentStatus} />
          </div>
        </li>
      </ol>
    </div>
  );
}
