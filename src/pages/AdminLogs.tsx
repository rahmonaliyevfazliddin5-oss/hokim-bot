import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { adminCall } from "@/lib/adminApi";

export default function AdminLogs() {
  const { t, lang } = useI18n();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(200).then(({ data }) => setLogs(data || []));
  }, []);

  const dateFmt = (d: string) => new Date(d).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB");

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-6">{t("admin.logs_title")}</h1>
      <div className="glass rounded-2xl divide-y divide-border/60">
        {logs.length === 0 && <div className="p-6 text-muted-foreground">{t("admin.no_data")}</div>}
        {logs.map(l => (
          <div key={l.id} className="flex items-start gap-3 p-4">
            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
              <ScrollText className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{l.action}</div>
              {l.details && <div className="text-xs text-muted-foreground mt-0.5">{l.details}</div>}
              <div className="text-[11px] text-muted-foreground mt-1">{l.actor || "system"} • {dateFmt(l.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
