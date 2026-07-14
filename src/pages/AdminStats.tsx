import { useEffect, useState, useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { adminCall } from "@/lib/adminApi";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { FARGONA_TUMAN_MAHALLAS } from "@/lib/fargona";

const COLORS = ["hsl(210 75% 52%)", "hsl(38 92% 50%)", "hsl(152 60% 38%)", "hsl(0 75% 52%)", "hsl(215 50% 35%)", "hsl(222 60% 18%)"];

export default function AdminStats() {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    adminCall<{ complaints: any[] }>("list_complaints").then(({ complaints }) => setItems(complaints || [])).catch(() => {});
  }, []);

  const allCats = (i: any): string[] => (i.categories?.length ? i.categories : [i.category]);

  const byCat = ["gaz","elektr","suv","chiqindi","yo_l","boshqa"].map(c => ({
    name: t(`category.${c}`),
    value: items.filter(i => allCats(i).includes(c)).length,
  })).filter(x => x.value > 0);

  const byStatus = ["yangi","jarayonda","bajarildi","rad_etildi"].map(s => ({
    name: t(`status.${s}`), value: items.filter(i => i.status === s).length,
  }));

  const districts = Array.from(new Set(items.map(i => i.district).filter(Boolean))) as string[];
  const byDistrict = districts.map(d => ({ name: d, value: items.filter(i => i.district === d).length }))
    .sort((a, b) => b.value - a.value).slice(0, 10);

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      name: d.toLocaleDateString(undefined, { weekday: "short" }),
      value: items.filter(it => it.created_at.slice(0, 10) === key).length,
    };
  });

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-6">{t("admin.stats_title")}</h1>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="glass rounded-2xl p-6">
          <h3 className="font-bold mb-4">{t("admin.by_status")}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byStatus}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="value" fill="hsl(var(--accent))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-bold mb-4">{t("admin.by_category")}</h3>
          {byCat.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">{t("admin.no_data")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byCat} dataKey="value" nameKey="name" outerRadius={90} label>
                  {byCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="glass rounded-2xl p-6">
          <h3 className="font-bold mb-4">{t("admin.weekly")}</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={days}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--accent))" strokeWidth={3} dot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-2xl p-6">
          <h3 className="font-bold mb-4">{t("admin.by_district")}</h3>
          {byDistrict.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">{t("admin.no_data")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byDistrict} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={12} allowDecimals={false} />
                <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
