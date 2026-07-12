import { useEffect, useState } from "react";
import { User, Phone, FileText } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { adminCall } from "@/lib/adminApi";

export default function AdminUsers() {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    adminCall<{ complaints: any[] }>("list_complaints").then(({ complaints }) => {
      const map = new Map<string, any>();
      (complaints || []).forEach(d => {
        const key = `${d.citizen_name}|${d.citizen_phone}`;
        const ex = map.get(key);
        if (ex) { ex.count++; if (d.created_at > ex.last) ex.last = d.created_at; }
        else map.set(key, { name: d.citizen_name, phone: d.citizen_phone, count: 1, last: d.created_at });
      });
      setItems(Array.from(map.values()).sort((a, b) => b.count - a.count));
    }).catch(() => {});
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-6">{t("admin.users_title")}</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.length === 0 && <div className="text-muted-foreground">{t("admin.no_data")}</div>}
        {items.map((u, i) => (
          <div key={i} className="glass rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full gradient-accent flex items-center justify-center text-accent-foreground font-bold">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-bold truncate">{u.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{u.phone}</div>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> {u.count}</span>
              <span className="text-xs text-muted-foreground">{new Date(u.last).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
