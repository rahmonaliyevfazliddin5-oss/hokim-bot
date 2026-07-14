import { useEffect, useState, useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { adminCall } from "@/lib/adminApi";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { FARGONA_TUMAN_MAHALLAS } from "@/lib/fargona";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reportError, newCorrelationId } from "@/lib/errors";

const COLORS = ["hsl(210 75% 52%)", "hsl(38 92% 50%)", "hsl(152 60% 38%)", "hsl(0 75% 52%)", "hsl(215 50% 35%)", "hsl(222 60% 18%)"];

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

const STATUS_KEYS = ["yangi","jarayonda","bajarildi","rad_etildi"] as const;
const CATEGORY_KEYS = ["gaz","elektr","suv","chiqindi","yo_l","boshqa"] as const;
const TIER_KEYS: Tier[] = ["high", "mid", "none"];

export default function AdminStats() {
  const { t } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [statusF, setStatusF] = useState<string>("all");
  const [categoryF, setCategoryF] = useState<string>("all");
  const [mahallaF, setMahallaF] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  // Legend interactive filter (keyboard-driven)
  const [tierF, setTierF] = useState<Tier | null>(null);

  useEffect(() => {
    const cid = newCorrelationId();
    console.groupCollapsed(`%c[admin_stats_load] fetching`, "color:#2563eb");
    console.log("correlationId:", cid);
    console.groupEnd();
    adminCall<{ complaints: any[] }>("list_complaints")
      .then(({ complaints }) => setItems(complaints || []))
      .catch((err) => {
        const info = reportError("admin_stats_load", err);
        setLoadError(info.correlationId);
      });
  }, []);

  const allCats = (i: any): string[] => (i.categories?.length ? i.categories : [i.category]);

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      if (statusF !== "all" && i.status !== statusF) return false;
      if (categoryF !== "all" && !allCats(i).includes(categoryF)) return false;
      if (mahallaF !== "all" && (i.mahalla || "").trim() !== mahallaF) return false;
      if (dateFrom && i.created_at?.slice(0, 10) < dateFrom) return false;
      if (dateTo && i.created_at?.slice(0, 10) > dateTo) return false;
      return true;
    });
  }, [items, statusF, categoryF, mahallaF, dateFrom, dateTo]);

  const byCat = CATEGORY_KEYS.map(c => ({
    key: c,
    name: t(`category.${c}`),
    value: filteredItems.filter(i => allCats(i).includes(c)).length,
  })).filter(x => x.value > 0);

  const byStatus = STATUS_KEYS.map(s => ({
    key: s, name: t(`status.${s}`), value: filteredItems.filter(i => i.status === s).length,
  }));

  const byMahalla = useMemo(() => {
    const rows = FARGONA_TUMAN_MAHALLAS.map(name => ({
      name,
      value: filteredItems.filter(i => (i.mahalla || "").trim() === name).length,
    }));
    const maxVal = Math.max(0, ...rows.map(r => r.value));
    return rows
      .map(r => {
        const tier = tierFor(r.value, maxVal);
        return { ...r, tier, fill: TIER[tier].color, pattern: `url(#${TIER[tier].pattern})` };
      })
      .filter(r => (tierF ? r.tier === tierF : true))
      .sort((a, b) => b.value - a.value);
  }, [filteredItems, tierF]);

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      key,
      name: d.toLocaleDateString(undefined, { weekday: "short" }),
      value: filteredItems.filter(it => it.created_at?.slice(0, 10) === key).length,
    };
  });

  function clearFilters() {
    setStatusF("all"); setCategoryF("all"); setMahallaF("all");
    setDateFrom(""); setDateTo(""); setTierF(null);
  }

  const hasFilters = statusF !== "all" || categoryF !== "all" || mahallaF !== "all" || dateFrom || dateTo || tierF;

  function exportCsv() {
    const cid = newCorrelationId();
    console.groupCollapsed(`%c[admin_stats_export] cid=${cid}`, "color:#059669");
    console.log("filters:", { statusF, categoryF, mahallaF, dateFrom, dateTo, tierF });
    console.log("row count:", filteredItems.length);
    console.groupEnd();

    const now = new Date();
    const stamp = now.toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const rangeTag = dateFrom || dateTo ? `_${dateFrom || "start"}_to_${dateTo || "end"}` : "";
    const rows: (string | number)[][] = [];
    rows.push([`Hokim AI — ${t("admin.stats_title")}`]);
    rows.push([`Generated: ${now.toISOString()}`]);
    rows.push([`Correlation ID: ${cid}`]);
    rows.push([]);
    rows.push([`# Filters`]);
    rows.push(["Status", statusF === "all" ? "(all)" : t(`status.${statusF}`)]);
    rows.push(["Category", categoryF === "all" ? "(all)" : t(`category.${categoryF}`)]);
    rows.push(["MFY", mahallaF === "all" ? "(all)" : mahallaF]);
    rows.push(["Date from", dateFrom || "(none)"]);
    rows.push(["Date to", dateTo || "(none)"]);
    rows.push(["Legend tier", tierF || "(all)"]);
    rows.push(["Matching rows", filteredItems.length]);
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
    downloadCsv(`hokim-stats-${stamp}${rangeTag}.csv`, toCsv(rows));
  }

  const legendItems: { tier: Tier; title: string; desc: string }[] = [
    { tier: "high", title: t("admin.legend_high"), desc: t("admin.legend_high_desc") || "eng ko'p" },
    { tier: "mid",  title: t("admin.legend_mid"),  desc: t("admin.legend_mid_desc")  || "o'rtacha" },
    { tier: "none", title: t("admin.legend_none"), desc: t("admin.legend_none_desc") || "yo'q" },
  ];

  // Roving keyboard nav across legend chips
  function onLegendKey(e: React.KeyboardEvent<HTMLButtonElement>, idx: number) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = e.key === "ArrowRight" ? (idx + 1) % legendItems.length : (idx - 1 + legendItems.length) % legendItems.length;
      const el = document.getElementById(`legend-tier-${legendItems[next].tier}`);
      el?.focus();
    } else if (e.key === "Escape" && tierF) {
      e.preventDefault(); setTierF(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-3xl font-extrabold">{t("admin.stats_title")}</h1>
        <Button onClick={exportCsv} variant="outline" size="sm" className="gap-2" aria-label={t("admin.export_csv") || "Export CSV"}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {t("admin.export_csv") || "Export CSV"}
        </Button>
      </div>

      {loadError && (
        <div role="alert" className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <span className="font-semibold">Load failed.</span>{" "}
          <span className="text-muted-foreground">Correlation ID: <code>{loadError}</code></span>
        </div>
      )}

      {/* Filters */}
      <div className="glass rounded-2xl p-4 mb-5" role="group" aria-label="Filters">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("admin.by_status")}</Label>
            <Select value={statusF} onValueChange={setStatusF}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {STATUS_KEYS.map(s => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("admin.by_category")}</Label>
            <Select value={categoryF} onValueChange={setCategoryF}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {CATEGORY_KEYS.map(c => <SelectItem key={c} value={c}>{t(`category.${c}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">MFY</Label>
            <Select value={mahallaF} onValueChange={setMahallaF}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">All</SelectItem>
                {FARGONA_TUMAN_MAHALLAS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="date-from" className="text-xs">From</Label>
            <Input id="date-from" type="date" className="h-9" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="date-to" className="text-xs">To</Label>
            <Input id="date-to" type="date" className="h-9" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="text-xs text-muted-foreground" aria-live="polite">
            {filteredItems.length} / {items.length} matching
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
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
            role="toolbar"
            aria-label={t("admin.legend_title") || "Legend — filter by tier"}
            className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl bg-muted/40 border border-border/60 text-xs"
          >
            <span id="legend-desc" className="font-semibold text-foreground mr-1">
              {t("admin.legend_title") || "Rang belgilari:"}
            </span>
            <span className="sr-only">
              Use Left/Right arrows to move between tiers. Press Enter to filter the MFY chart by that tier. Escape clears.
            </span>
            {legendItems.map((it, idx) => {
              const active = tierF === it.tier;
              const label = `${it.title} — ${it.desc}${active ? " (active filter)" : ""}`;
              return (
                <button
                  key={it.tier}
                  id={`legend-tier-${it.tier}`}
                  type="button"
                  role="switch"
                  aria-checked={active}
                  aria-label={label}
                  aria-describedby="legend-desc"
                  tabIndex={0}
                  onKeyDown={(e) => onLegendKey(e, idx)}
                  onClick={() => setTierF(active ? null : it.tier)}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1
                    ${active ? "bg-accent/15 border-accent" : "bg-background border-border hover:bg-muted"}`}
                >
                  <LegendSwatch tier={it.tier} label={label} />
                  <span className="font-medium">{it.title}</span>
                  <span className="text-muted-foreground">— {it.desc}</span>
                </button>
              );
            })}
            {tierF && (
              <button
                type="button"
                onClick={() => setTierF(null)}
                className="ml-auto inline-flex items-center gap-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
                aria-label="Clear tier filter"
              >
                <X className="h-3 w-3" /> clear
              </button>
            )}
          </div>

          <div
            className="max-h-[520px] overflow-y-auto pr-1"
            role="img"
            aria-label={`${t("admin.by_mahalla")} — ${byMahalla.length} MFY${tierF ? ` (${tierF} only)` : ""}`}
          >
            <ResponsiveContainer width="100%" height={Math.max(260, byMahalla.length * 22)}>
              <BarChart data={byMahalla} layout="vertical" margin={{ left: 8, right: 16 }}>
                <defs>
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
