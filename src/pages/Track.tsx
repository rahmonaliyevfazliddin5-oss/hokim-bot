import { useState } from "react";
import { motion } from "framer-motion";
import { Search, MapPin, Calendar, Sparkles, FileText } from "lucide-react";
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
    const { data, error } = await supabase
      .from("complaints")
      .select("*")
      .eq("tracking_code", code.trim().toUpperCase())
      .maybeSingle();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (!data) { setNotFound(true); return; }
    setData(data);
  }

  const dateFmt = (d: string) => new Date(d).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB");

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

      {notFound && (
        <div className="mt-6 glass rounded-2xl p-8 text-center">
          <p className="text-muted-foreground">{t("track.not_found")}</p>
        </div>
      )}

      {data && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 glass rounded-2xl p-6 md:p-8 shadow-elegant"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("track.details")}</div>
              <div className="font-bold text-lg">{data.tracking_code}</div>
            </div>
            <StatusBadge status={data.status} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <Info icon={Calendar} label={t("track.submitted_on")} value={dateFmt(data.created_at)} />
            <Info icon={Sparkles} label={t("track.category")} value={t(`category.${data.category}`)} />
            {data.location && <Info icon={MapPin} label={t("submit.location")} value={data.location} />}
          </div>

          <div className="rounded-xl bg-secondary p-4 mb-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> {t("submit.text")}
            </div>
            <p className="text-sm whitespace-pre-wrap">{data.text}</p>
          </div>

          {data.ai_response && (
            <div className="rounded-xl bg-accent/10 border border-accent/20 p-4 mb-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-accent mb-1.5 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> {t("track.ai_response")}
              </div>
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
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-0.5">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
