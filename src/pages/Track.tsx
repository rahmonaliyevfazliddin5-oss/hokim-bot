import { useState } from "react";
import { motion } from "framer-motion";
import { Search, MapPin, Calendar, Sparkles, FileText, ExternalLink, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";

export default function Track() {
  const { t, lang } = useI18n();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true); setNotFound(false); setData(null);
    const { data, error } = await supabase.functions.invoke("track-complaint", {
      body: { tracking_code: code.trim().toUpperCase() },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (!data?.complaint) { setNotFound(true); return; }
    setData(data.complaint);
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
        <Input value={code} onChange={e => setCode(e.target.value)} placeholder={t("track.code_ph")} className="text-base h-12" />
        <Button type="submit" disabled={loading} size="lg" className="gradient-accent text-accent-foreground">
          <Search className="mr-1 h-4 w-4" /> {t("track.check")}
        </Button>
      </form>

      {notFound && <div className="mt-6 glass rounded-2xl p-8 text-center"><p className="text-muted-foreground">{t("track.not_found")}</p></div>}

      {data && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6 glass rounded-2xl p-6 md:p-8 shadow-elegant">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("track.details")}</div>
              <div className="font-bold text-lg">{data.tracking_code}</div>
            </div>
            <StatusBadge status={data.status} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <Info icon={Calendar} label={t("track.submitted_on")} value={dateFmt(data.created_at)} />
            <div className="rounded-xl bg-secondary/60 p-3.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1"><Sparkles className="h-3 w-3" />{t("track.categories")}</div>
              <div className="flex flex-wrap gap-1">
                {cats.map(c => <span key={c} className="rounded-md bg-accent/15 text-accent text-xs font-semibold px-2 py-0.5">{t(`category.${c}`)}</span>)}
              </div>
            </div>
            {data.location && <Info icon={MapPin} label={t("track.details")} value={data.location} />}
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

          {(data.severity || data.routing_target || data.responsible_org || data.eta_days) && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 mb-3 grid grid-cols-2 gap-3 text-xs">
              {data.severity && (
                <div><div className="text-muted-foreground uppercase tracking-wider">Og'irlik</div><div className="font-semibold capitalize">{data.severity === "orta" ? "o'rta" : data.severity}</div></div>
              )}
              {data.routing_target && (
                <div><div className="text-muted-foreground uppercase tracking-wider">Yo'naltirildi</div><div className="font-semibold">{data.routing_target === "hokimiyat" ? "Hokimiyat" : "MFY"}</div></div>
              )}
              {data.responsible_org && (
                <div className="col-span-2"><div className="text-muted-foreground uppercase tracking-wider">Mas'ul tashkilot</div><div className="font-semibold">{data.responsible_org}</div></div>
              )}
              {data.eta_days != null && (
                <div className="col-span-2"><div className="text-muted-foreground uppercase tracking-wider">Taxminiy muddat</div><div className="font-semibold">{data.eta_days <= 7 ? "3–7 kun" : data.eta_days <= 30 ? "7–30 kun" : "30+ kun"}</div></div>
              )}
            </div>
          )}

          {data.ai_response && (
            <div className="rounded-xl bg-accent/10 border border-accent/20 p-4 mb-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-accent mb-1.5 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> {t("track.ai_response")}</div>
              <p className="text-sm">{data.ai_response}</p>
            </div>
          )}

          {data.admin_notes && (
            <div className="rounded-xl bg-success/10 border border-success/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-success mb-1.5">{t("track.admin_notes")}</div>
              <p className="text-sm">{data.admin_notes}</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: any) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-0.5"><Icon className="h-3 w-3" /> {label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
