import { useEffect, useState, useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { adminCall } from "@/lib/adminApi";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { FARGONA_TUMAN_MAHALLAS } from "@/lib/fargona";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const COLORS = ["hsl(210 75% 52%)", "hsl(38 92% 50%)", "hsl(152 60% 38%)", "hsl(0 75% 52%)", "hsl(215 50% 35%)", "hsl(222 60% 18%)"];

// Colorblind-friendly tier tokens: pair color with a distinct SVG pattern.
const TIER = {
  high: { color: "hsl(0 75% 52%)", pattern: "pat-high" },
  mid:  { color: "hsl(38 92% 50%)", pattern: "pat-mid" },
  none: { color: "hsl(152 60% 42%)", pattern: "pat-none" },
} as const;
type Tier = keyof typeof TIER;

function tierFor(v: number, maxVal: number): Tier {
  if (v === 0) return "none";
  if (maxVal > 0 && v >= maxVal * 0.66) return "high";
  return "mid";
}

/** Tiny inline SVG swatch that shows both color and pattern — colorblind-safe legend key. */
function LegendSwatch({ tier, label }: { tier: Tier; label: string }) {
  const t = TIER[tier];
  return (
    <svg width="20" height="20" role="img" aria-label={label} className="shrink-0">
      <rect x="0" y="0" width="20" height="20" rx="4" fill={t.color} />
      {tier === "high" && (
        <g stroke="hsl(0 0% 100% / 0.9)" strokeWidth="1.5">
          <line x1="-2" y1="6" x2="22" y2="6" />
          <line x1="-2" y1="12" x2="22" y2="12" />
          <line x1="-2" y1="18" x2="22" y2="18" />
        </g>
      )}
      {tier === "mid" && (
        <g fill="hsl(0 0% 100% / 0.85)">
          <circle cx="5" cy="5" r="1.6" />
          <circle cx="14" cy="8" r="1.6" />
          <circle cx="7" cy="14" r="1.6" />
          <circle cx="15" cy="15" r="1.6" />
        </g>
      )}
      {tier === "none" && (
        <g stroke="hsl(0 0% 100% / 0.9)" strokeWidth="1.5" fill="none">
          <path d="M-2 22 L22 -2" />
          <path d="M-2 10 L10 -2" />
          <path d="M10 22 L22 10" />
        </g>
      )}
    </svg>
  );
}

function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map(r => r.map(esc).join(",")).join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function AdminStats() {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    adminCall<{ complaints: any[] }>("list_complaints").then(({ complaints }) => setItems(complaints || [])).catch(() => {});
  }, []);

  const allCats = (i: any): string[] => (i.categories?.length ? i.categories : [i.category]);

  const byCat = ["gaz","elektr","suv","chiqindi","yo_l","boshqa"].map(c => ({
    key: c,
    name: t(`category.${c}`),
    value: items.filter(i => allCats(i).includes(c)).length,
  })).filter(x => x.value > 0);

  const byStatus = ["yangi","jarayonda","bajarildi","rad_etildi"].map(s => ({
    key: s, name: t(`status.${s}`), value: items.filter(i => i.status === s).length,
  }));

  const byMahalla = useMemo(() => {
    const rows = FARGONA_TUMAN_MAHALLAS.map(name => ({
      name,
      value: items.filter(i => (i.mahalla || "").trim() === name).length,
    }));
    const maxVal = Math.max(0, ...rows.map(r => r.value));
    return rows
      .map(r => {
        const tier = tierFor(r.value, maxVal);
        return { ...r, tier, fill: TIER[tier].color, pattern: `url(#${TIER[tier].pattern})` };
      })
      .sort((a, b) => b.value - a.value);
  }, [items]);

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      key,
      name: d.toLocaleDateString(undefined, { weekday: "short" }),
      value: items.filter(it => it.created_at.slice(0, 10) === key).length,
    };
  });

  function exportCsv() {
    const now = new Date();
    const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const rows: (string | number)[][] = [];
    rows.push([`Hokim AI — ${t("admin.stats_title")}`]);
    rows.push([`Generated: ${now.toISOString()}`]);
    rows.push([`Total complaints: ${items.length}`]);
    rows.push([]);
    rows.push([`# ${t("admin.by_status")}`]);
    rows.push(["Key", "Label", "Count"]);
    byStatus.forEach(r => rows.push([r.key, r.name, r.value]));
    rows.push([]);
    rows.push([`# ${t("admin.by_category")}`]);
    rows.push(["Key", "Label", "Count"]);
    byCat.forEach(r => rows.push([r.key, r.name, r.value]));
    rows.push([]);
    rows.push([`# ${t("admin.weekly")}`]);
    rows.push(["Date", "Weekday", "Count"]);
    days.forEach(r => rows.push([r.key, r.name, r.value]));
    rows.push([]);
    rows.push([`# ${t("admin.by_mahalla")}`]);
    rows.push(["MFY", "Count", "Tier"]);
    byMahalla.forEach(r => rows.push([r.name, r.value, r.tier]));
    downloadCsv(`hokim-stats-${stamp}.csv`, toCsv(rows));
  }

  const legendHighLabel = `${t("admin.legend_high")} — ${t("admin.legend_high_desc") || "eng ko'p"}`;
  const legendMidLabel  = `${t("admin.legend_mid")} — ${t("admin.legend_mid_desc") || "o'rtacha"}`;
  const legendNoneLabel = `${t("admin.legend_none")} — ${t("admin.legend_none_desc") || "yo'q"}`;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-3xl font-extrabold">{t("admin.stats_title")}</h1>
        <Button onClick={exportCsv} variant="outline" size="sm" className="gap-2" aria-label={t("admin.export_csv") || "Export CSV"}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {t("admin.export_csv") || "Export CSV"}
        </Button>
      </div>

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
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="font-bold">{t("admin.by_mahalla")}</h3>
          </div>

          <div
            role="group"
            aria-label={t("admin.legend_title") || "Legend"}
            className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl bg-muted/40 border border-border/60 text-xs"
          >
            <span className="font-semibold text-foreground mr-1">{t("admin.legend_title") || "Rang belgilari:"}</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-background border border-border" aria-label={legendHighLabel}>
              <LegendSwatch tier="high" label={legendHighLabel} />
              <span className="font-medium">{t("admin.legend_high")}</span>
              <span className="text-muted-foreground">— {t("admin.legend_high_desc") || "eng ko'p"}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-background border border-border" aria-label={legendMidLabel}>
              <LegendSwatch tier="mid" label={legendMidLabel} />
              <span className="font-medium">{t("admin.legend_mid")}</span>
              <span className="text-muted-foreground">— {t("admin.legend_mid_desc") || "o'rtacha"}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-background border border-border" aria-label={legendNoneLabel}>
              <LegendSwatch tier="none" label={legendNoneLabel} />
              <span className="font-medium">{t("admin.legend_none")}</span>
              <span className="text-muted-foreground">— {t("admin.legend_none_desc") || "yo'q"}</span>
            </span>
          </div>

          <div
            className="max-h-[520px] overflow-y-auto pr-1"
            role="img"
            aria-label={`${t("admin.by_mahalla")} — ${byMahalla.length} MFY`}
          >
            <ResponsiveContainer width="100%" height={Math.max(260, byMahalla.length * 22)}>
              <BarChart data={byMahalla} layout="vertical" margin={{ left: 8, right: 16 }}>
                <defs>
                  {/* Colorblind-safe patterns layered over each tier's color. */}
                  <pattern id="pat-high" width="6" height="6" patternUnits="userSpaceOnUse">
                    <rect width="6" height="6" fill={TIER.high.color} />
                    <path d="M 0 3 L 6 3" stroke="hsl(0 0% 100% / 0.85)" strokeWidth="1.5" />
                  </pattern>
                  <pattern id="pat-mid" width="6" height="6" patternUnits="userSpaceOnUse">
                    <rect width="6" height="6" fill={TIER.mid.color} />
                    <circle cx="3" cy="3" r="1.1" fill="hsl(0 0% 100% / 0.9)" />
                  </pattern>
                  <pattern id="pat-none" width="6" height="6" patternUnits="userSpaceOnUse">
                    <rect width="6" height="6" fill={TIER.none.color} />
                    <path d="M 0 6 L 6 0" stroke="hsl(0 0% 100% / 0.9)" strokeWidth="1.2" />
                  </pattern>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" fontSize={10} width={130} interval={0} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                  formatter={(value: any, _name, ctx: any) => {
                    const tier = ctx?.payload?.tier as Tier | undefined;
                    const label = tier === "high" ? t("admin.legend_high")
                      : tier === "mid" ? t("admin.legend_mid")
                      : t("admin.legend_none");
                    return [`${value} · ${label}`, t("admin.by_mahalla")];
                  }}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {byMahalla.map((row, i) => <Cell key={i} fill={row.pattern} stroke={row.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
