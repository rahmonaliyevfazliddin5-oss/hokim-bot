import { useEffect, useMemo, useState } from "react";
import {
  Shield, Ban, Search, RefreshCw, Activity, MonitorSmartphone, AlertTriangle, ChevronDown,
  ArrowUpDown, Bell, BellRing, Download, FileText, CheckCheck,
} from "lucide-react";
import { adminCall } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ---------- types ----------
interface SessionRow {
  id: string;
  mahalla: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}
interface AuditRow {
  id: string;
  action: string;
  actor: string | null;
  details: string | null;
  created_at: string;
}
interface StatRow {
  mahalla: string;
  total: number;
  success: number;
  failed: number;
  failed_window: number;
  last_attempt: string | null;
  last_success: string | null;
  blocked_ips: string[];
}
interface AlertRow {
  id: string;
  kind: string;
  mahalla: string | null;
  ip: string | null;
  count: number;
  window_minutes: number;
  details: string | null;
  seen_at: string | null;
  created_at: string;
}

const AUDIT_ACTIONS = [
  { key: "mahalla_login_success", label: "Login (muvaffaqiyatli)" },
  { key: "mahalla_login_failed", label: "Login (xato)" },
  { key: "mahalla_login_blocked", label: "Login (bloklangan)" },
  { key: "mahalla_password_reset", label: "Parol tiklash" },
  { key: "mahalla_session_revoked", label: "Sessiya bekor qilingan" },
  { key: "mahalla_session_bulk_revoked", label: "Sessiya ommaviy bekor" },
  { key: "status_changed", label: "Status o'zgardi" },
  { key: "response_sent", label: "Javob yuborildi" },
];

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-GB") : "—");
const shortUA = (ua: string | null) => {
  if (!ua) return "—";
  const m = ua.match(/(Chrome|Safari|Firefox|Edge|OPR|Opera)\/[\d.]+/);
  const os = ua.match(/\((.*?)\)/)?.[1]?.split(";")[0] ?? "";
  return `${m?.[0] ?? "browser"} · ${os}`;
};
const deviceKind = (ua: string | null): "mobile" | "tablet" | "desktop" | "unknown" => {
  if (!ua) return "unknown";
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobi|android|iphone/.test(s)) return "mobile";
  return "desktop";
};

// ============================================================
export default function AdminMahallaSecurity() {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [unseen, setUnseen] = useState(0);
  const [showAlerts, setShowAlerts] = useState(false);

  async function loadAlerts() {
    try {
      const res = await adminCall<{ alerts: AlertRow[]; unseen: number }>("admin_alerts_list", { limit: 50 });
      setAlerts(res.alerts || []);
      setUnseen(res.unseen || 0);
    } catch (e: any) { /* silent */ }
  }
  async function markAllSeen() {
    try {
      await adminCall("admin_alerts_mark_seen", { all: true });
      await loadAlerts();
      toast.success("Bildirishnomalar ko'rilgan deb belgilandi");
    } catch (e: any) { toast.error(e.message); }
  }
  useEffect(() => {
    loadAlerts();
    const t = setInterval(loadAlerts, 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-xl gradient-accent flex items-center justify-center">
          <Shield className="h-6 w-6 text-accent-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold">Mahalla xavfsizlik</h1>
          <p className="text-sm text-muted-foreground">Sessiyalar, audit log va login statistikasi</p>
        </div>
        <Button
          variant={unseen > 0 ? "default" : "outline"}
          size="sm"
          onClick={() => setShowAlerts((v) => !v)}
          className="relative"
        >
          {unseen > 0 ? <BellRing className="h-4 w-4 mr-1" /> : <Bell className="h-4 w-4 mr-1" />}
          Bildirishnomalar
          {unseen > 0 && (
            <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold">
              {unseen}
            </span>
          )}
        </Button>
      </div>

      {showAlerts && (
        <div className="glass rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Xavfsizlik bildirishnomalari
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={loadAlerts}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Yangilash
              </Button>
              {unseen > 0 && (
                <Button size="sm" onClick={markAllSeen}>
                  <CheckCheck className="h-3.5 w-3.5 mr-1" /> Barchasini o'qildi
                </Button>
              )}
            </div>
          </div>
          {alerts.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">Bildirishnoma yo'q</div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-border/40">
              {alerts.map((a) => {
                const tone = a.kind === "approaching_block"
                  ? "bg-warning/15 text-warning border-warning/30"
                  : "bg-destructive/15 text-destructive border-destructive/30";
                const label = a.kind === "approaching_block" ? "Chegara yaqin"
                  : a.kind === "blocked" ? "Bloklandi"
                  : a.kind === "rate_limited_429" ? "429 Rate limit" : a.kind;
                return (
                  <div key={a.id} className={`py-2 flex items-start gap-3 ${a.seen_at ? "opacity-60" : ""}`}>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${tone} shrink-0`}>{label}</span>
                    <div className="flex-1 text-sm">
                      <div className="font-medium">{a.details ?? `${a.mahalla ?? "?"} / ${a.ip ?? "?"}`}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmt(a.created_at)} · {a.count} xato / {a.window_minutes} daq.
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="sessions"><MonitorSmartphone className="h-4 w-4 mr-1" /> Sessiyalar</TabsTrigger>
          <TabsTrigger value="audit"><Activity className="h-4 w-4 mr-1" /> Audit</TabsTrigger>
          <TabsTrigger value="stats"><AlertTriangle className="h-4 w-4 mr-1" /> Statistika</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions"><SessionsTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
        <TabsContent value="stats"><StatsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
type SessionStatus = "all" | "active" | "revoked" | "expired";
type DeviceFilter = "all" | "desktop" | "mobile" | "tablet" | "unknown";
type SortKey = "mahalla" | "ip" | "device" | "created_at" | "expires_at" | "status";

function SessionsTab() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mahalla, setMahalla] = useState("");
  const [uaFilter, setUaFilter] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const [status, setStatus] = useState<SessionStatus>("active");
  const [device, setDevice] = useState<DeviceFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [busy, setBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { sessions } = await adminCall<{ sessions: SessionRow[] }>("admin_list_mahalla_sessions", {
        mahalla: mahalla || undefined,
        active_only: status === "active",
      });
      setRows(sessions || []);
      setSelected(new Set());
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status === "active"]);

  const now = Date.now();
  const statusOf = (s: SessionRow): "active" | "revoked" | "expired" => {
    if (s.revoked_at) return "revoked";
    if (new Date(s.expires_at).getTime() < now) return "expired";
    return "active";
  };

  const filtered = useMemo(() => {
    let list = rows.slice();
    if (status !== "all") list = list.filter((s) => statusOf(s) === status);
    if (device !== "all") list = list.filter((s) => deviceKind(s.user_agent) === device);
    if (uaFilter) {
      const q = uaFilter.toLowerCase();
      list = list.filter((s) => (s.user_agent ?? "").toLowerCase().includes(q));
    }
    if (ipFilter) {
      list = list.filter((s) => (s.ip ?? "").includes(ipFilter));
    }
    if (fromDate) list = list.filter((s) => s.created_at >= fromDate);
    if (toDate) list = list.filter((s) => s.created_at <= toDate + "T23:59:59");

    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      const av = sortKey === "device" ? deviceKind(a.user_agent)
        : sortKey === "status" ? statusOf(a)
        : (a as any)[sortKey] ?? "";
      const bv = sortKey === "device" ? deviceKind(b.user_agent)
        : sortKey === "status" ? statusOf(b)
        : (b as any)[sortKey] ?? "";
      return String(av).localeCompare(String(bv)) * dir;
    });
    return list;
  }, [rows, status, device, uaFilter, ipFilter, fromDate, toDate, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  }
  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  const activeVisibleIds = filtered.filter((s) => statusOf(s) === "active").map((s) => s.id);
  const allSelected = activeVisibleIds.length > 0 && activeVisibleIds.every((id) => selected.has(id));
  function toggleSelectAll() {
    setSelected((s) => {
      if (allSelected) {
        const n = new Set(s);
        activeVisibleIds.forEach((id) => n.delete(id));
        return n;
      }
      return new Set([...s, ...activeVisibleIds]);
    });
  }

  async function revoke(id: string) {
    setBusy(id);
    try {
      await adminCall("admin_revoke_mahalla_session", { session_id: id });
      toast.success("Sessiya bekor qilindi");
      setRows((r) => r.map((s) => (s.id === id ? { ...s, revoked_at: new Date().toISOString() } : s)));
    } catch (e: any) { toast.error(e.message); }
    setBusy(null);
  }

  async function bulkRevokeSelected() {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} ta sessiyani bekor qilishni tasdiqlaysizmi?`)) return;
    setBulkBusy(true);
    try {
      const res = await adminCall<{ revoked: number }>("admin_bulk_revoke_sessions", {
        session_ids: Array.from(selected),
      });
      toast.success(`${res.revoked} ta sessiya bekor qilindi`);
      setSelected(new Set());
      await load();
    } catch (e: any) { toast.error(e.message); }
    setBulkBusy(false);
  }

  async function bulkRevokeByFilter() {
    if (!mahalla && !ipFilter && !fromDate && !toDate) {
      toast.error("Kamida bitta filtr belgilang (MFY, IP yoki sana)");
      return;
    }
    const parts = [
      mahalla && `MFY=${mahalla}`,
      ipFilter && `IP=${ipFilter}`,
      fromDate && `dan=${fromDate}`,
      toDate && `gacha=${toDate}`,
    ].filter(Boolean).join(", ");
    if (!confirm(`Filtr bo'yicha (${parts}) barcha faol sessiyalarni bekor qilasizmi?`)) return;
    setBulkBusy(true);
    try {
      const res = await adminCall<{ revoked: number }>("admin_bulk_revoke_sessions", {
        mahalla: mahalla || undefined,
        ip: ipFilter || undefined,
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined,
      });
      toast.success(`${res.revoked} ta sessiya bekor qilindi`);
      await load();
    } catch (e: any) { toast.error(e.message); }
    setBulkBusy(false);
  }

  const stCls = (st: string) =>
    st === "active" ? "bg-success/15 text-success"
    : st === "revoked" ? "bg-destructive/15 text-destructive"
    : "bg-muted text-muted-foreground";
  const stLabel = (st: string) =>
    st === "active" ? "Faol" : st === "revoked" ? "Bekor qilingan" : "Muddati o'tgan";

  const SortH = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="text-left px-4 py-3 cursor-pointer select-none" onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortKey === k ? "opacity-100" : "opacity-30"}`} />
      </span>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input placeholder="MFY..." value={mahalla}
                 onChange={(e) => setMahalla(e.target.value)}
                 onKeyDown={(e) => e.key === "Enter" && load()}
                 className="max-w-[180px]" />
          <Input placeholder="IP..." value={ipFilter}
                 onChange={(e) => setIpFilter(e.target.value)}
                 className="max-w-[140px]" />
          <Input placeholder="Qurilma / user-agent..." value={uaFilter}
                 onChange={(e) => setUaFilter(e.target.value)}
                 className="max-w-[220px]" />
          <select value={device} onChange={(e) => setDevice(e.target.value as DeviceFilter)}
                  className="text-sm rounded-md border border-border bg-transparent px-2 py-2">
            <option value="all">Barcha qurilma</option>
            <option value="desktop">Desktop</option>
            <option value="mobile">Mobil</option>
            <option value="tablet">Planshet</option>
            <option value="unknown">Noma'lum</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as SessionStatus)}
                  className="text-sm rounded-md border border-border bg-transparent px-2 py-2">
            <option value="active">Faqat faol</option>
            <option value="revoked">Bekor qilingan</option>
            <option value="expired">Muddati o'tgan</option>
            <option value="all">Barchasi</option>
          </select>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Yangilash
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Vaqt oralig'i:</span>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="max-w-[160px]" />
          <span className="text-xs">—</span>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="max-w-[160px]" />
          <div className="flex-1" />
          <Button size="sm" variant="destructive" disabled={selected.size === 0 || bulkBusy} onClick={bulkRevokeSelected}>
            <Ban className="h-3.5 w-3.5 mr-1" /> Tanlanganni bekor ({selected.size})
          </Button>
          <Button size="sm" variant="destructive" disabled={bulkBusy} onClick={bulkRevokeByFilter}>
            <Ban className="h-3.5 w-3.5 mr-1" /> Filtr bo'yicha bekor
          </Button>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-3 py-3 w-8">
                <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                       disabled={activeVisibleIds.length === 0} />
              </th>
              <SortH k="mahalla">MFY</SortH>
              <SortH k="ip">IP</SortH>
              <SortH k="device">Qurilma</SortH>
              <SortH k="created_at">Boshlangan</SortH>
              <SortH k="expires_at">Tugaydi</SortH>
              <SortH k="status">Holat</SortH>
              <th className="text-right px-4 py-3">Amal</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Yuklanmoqda...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Sessiya topilmadi</td></tr>}
            {filtered.map((s) => {
              const st = statusOf(s);
              const isActive = st === "active";
              return (
                <tr key={s.id} className="border-t border-border/40">
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.has(s.id)} disabled={!isActive}
                           onChange={() => toggleSelect(s.id)} />
                  </td>
                  <td className="px-4 py-3 font-medium">{s.mahalla}</td>
                  <td className="px-4 py-3 text-xs font-mono">{s.ip ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    <div>{shortUA(s.user_agent)}</div>
                    <div className="text-muted-foreground capitalize">{deviceKind(s.user_agent)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(s.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(s.expires_at)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={stCls(st)}>{stLabel(st)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="destructive" disabled={!isActive || busy === s.id} onClick={() => revoke(s.id)}>
                      <Ban className="h-3.5 w-3.5 mr-1" /> Bekor
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
function AuditTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [mahalla, setMahalla] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(AUDIT_ACTIONS.map((a) => a.key)));

  async function load() {
    setLoading(true);
    try {
      const { logs } = await adminCall<{ logs: AuditRow[] }>("admin_mahalla_audit", {
        q: q || undefined,
        mahalla: mahalla || undefined,
        actions: Array.from(selected),
      });
      setRows(logs || []);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function toggle(k: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }

  function exportCSV() {
    if (rows.length === 0) { toast.error("Eksport uchun ma'lumot yo'q"); return; }
    const header = ["created_at", "action", "actor", "details"];
    const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push([r.created_at, r.action, r.actor ?? "", r.details ?? ""].map((v) => escape(String(v))).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} yozuv CSV ga eksport qilindi`);
  }

  function exportPDF() {
    if (rows.length === 0) { toast.error("Eksport uchun ma'lumot yo'q"); return; }
    const win = window.open("", "_blank");
    if (!win) { toast.error("Popup bloklangan"); return; }
    const escape = (v: string) => (v ?? "").replace(/[&<>]/g, (c) =>
      c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;");
    const html = `
<!doctype html><html><head><meta charset="utf-8"/>
<title>Audit log — ${new Date().toLocaleDateString()}</title>
<style>
  body { font-family: -apple-system, sans-serif; padding: 24px; color:#111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color:#666; font-size:12px; margin-bottom:16px; }
  table { width:100%; border-collapse: collapse; font-size:11px; }
  th, td { border:1px solid #ddd; padding:6px 8px; text-align:left; vertical-align:top; }
  th { background:#f5f5f5; text-transform:uppercase; font-size:10px; }
  tr:nth-child(even) td { background:#fafafa; }
  @media print { .noprint { display:none; } }
</style></head><body>
<h1>Mahalla audit log</h1>
<div class="meta">Eksport: ${new Date().toLocaleString()} · Yozuvlar: ${rows.length}</div>
<button class="noprint" onclick="window.print()">PDF sifatida saqlash / Chop etish</button>
<table>
  <thead><tr><th>Vaqt</th><th>Amal</th><th>Actor</th><th>Tafsilot</th></tr></thead>
  <tbody>
    ${rows.map((r) => `<tr>
      <td>${fmt(r.created_at)}</td>
      <td>${escape(r.action)}</td>
      <td>${escape(r.actor ?? "—")}</td>
      <td>${escape(r.details ?? "—")}</td>
    </tr>`).join("")}
  </tbody>
</table>
<script>setTimeout(function(){ window.print(); }, 300);</script>
</body></html>`;
    win.document.write(html);
    win.document.close();
  }

  const actionColor = (a: string) =>
    a === "mahalla_login_success" ? "bg-success/15 text-success"
    : a === "mahalla_login_failed" ? "bg-warning/15 text-warning"
    : a === "mahalla_login_blocked" ? "bg-destructive/15 text-destructive"
    : a === "mahalla_password_reset" ? "bg-primary/15 text-primary"
    : a === "mahalla_session_revoked" ? "bg-destructive/15 text-destructive"
    : a === "mahalla_session_bulk_revoked" ? "bg-destructive/15 text-destructive"
    : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input placeholder="Qidiruv (details, actor, action)..."
                 value={q} onChange={(e) => setQ(e.target.value)}
                 onKeyDown={(e) => e.key === "Enter" && load()}
                 className="flex-1 min-w-[220px] border-0 bg-transparent focus-visible:ring-0" />
          <Input placeholder="MFY..." value={mahalla} onChange={(e) => setMahalla(e.target.value)}
                 onKeyDown={(e) => e.key === "Enter" && load()}
                 className="max-w-[220px]" />
          <Button size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Qidirish</Button>
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportPDF}>
            <FileText className="h-3.5 w-3.5 mr-1" /> PDF
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {AUDIT_ACTIONS.map((a) => (
            <button key={a.key} onClick={() => toggle(a.key)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition ${
                      selected.has(a.key)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent text-muted-foreground border-border hover:border-primary/40"
                    }`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 w-40">Vaqt</th>
              <th className="text-left px-4 py-3 w-48">Amal</th>
              <th className="text-left px-4 py-3">Actor</th>
              <th className="text-left px-4 py-3">Tafsilot</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">Yuklanmoqda...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">Yozuv topilmadi</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border/40">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(r.created_at)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${actionColor(r.action)}`}>
                    {r.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-mono">{r.actor ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{r.details ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
function StatsTab() {
  const [rows, setRows] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{ window_minutes: number; threshold: number }>({ window_minutes: 15, threshold: 5 });
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<keyof StatRow>("failed_window");

  async function load() {
    setLoading(true);
    try {
      const res = await adminCall<{ stats: StatRow[]; window_minutes: number; threshold: number }>("admin_mahalla_login_stats");
      setRows(res.stats || []);
      setMeta({ window_minutes: res.window_minutes, threshold: res.threshold });
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const list = rows.filter((r) => r.mahalla.toLowerCase().includes(q.toLowerCase()));
    return list.sort((a, b) => {
      const av = a[sortKey] as any; const bv = b[sortKey] as any;
      if (typeof av === "number") return (bv as number) - (av as number);
      return String(bv ?? "").localeCompare(String(av ?? ""));
    });
  }, [rows, q, sortKey]);

  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      failed: acc.failed + r.failed,
      failed_window: acc.failed_window + r.failed_window,
      blocked: acc.blocked + (r.blocked_ips.length > 0 ? 1 : 0),
    }),
    { total: 0, failed: 0, failed_window: 0, blocked: 0 },
  ), [rows]);

  const SortHead = ({ k, children }: { k: keyof StatRow; children: React.ReactNode }) => (
    <th className="text-left px-4 py-3 cursor-pointer select-none" onClick={() => setSortKey(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k && <ChevronDown className="h-3 w-3" />}
      </span>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Jami urinish (24s)" value={totals.total} />
        <StatCard label="Muvaffaqiyatsiz (24s)" value={totals.failed} tone="warning" />
        <StatCard label={`Oxirgi ${meta.window_minutes} daq. xato`} value={totals.failed_window} tone="destructive" />
        <StatCard label="Hozir bloklangan MFY" value={totals.blocked} tone="destructive" />
      </div>

      <div className="glass rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input placeholder="MFY qidirish..." value={q} onChange={(e) => setQ(e.target.value)}
               className="flex-1 min-w-[200px] border-0 bg-transparent focus-visible:ring-0" />
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Yangilash</Button>
        <span className="text-xs text-muted-foreground">Blok chegarasi: {meta.threshold} xato / {meta.window_minutes} daq.</span>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider">
            <tr>
              <SortHead k="mahalla">MFY</SortHead>
              <SortHead k="total">Jami</SortHead>
              <SortHead k="success">Muvaffaqiyatli</SortHead>
              <SortHead k="failed">Xato</SortHead>
              <SortHead k="failed_window">Oxirgi {meta.window_minutes} daq.</SortHead>
              <SortHead k="last_success">Oxirgi login</SortHead>
              <th className="text-left px-4 py-3">Blok</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Yuklanmoqda...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Ma'lumot yo'q</td></tr>}
            {filtered.map((r) => (
              <tr key={r.mahalla} className="border-t border-border/40">
                <td className="px-4 py-3 font-medium">{r.mahalla}</td>
                <td className="px-4 py-3">{r.total}</td>
                <td className="px-4 py-3 text-success">{r.success}</td>
                <td className="px-4 py-3 text-warning">{r.failed}</td>
                <td className={`px-4 py-3 ${r.failed_window >= meta.threshold ? "text-destructive font-bold" : ""}`}>
                  {r.failed_window}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(r.last_success)}</td>
                <td className="px-4 py-3">
                  {r.blocked_ips.length > 0
                    ? <Badge variant="outline" className="bg-destructive/15 text-destructive">
                        {r.blocked_ips.length} IP bloklangan
                      </Badge>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "warning" | "destructive" }) {
  const toneCls = tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-3xl font-extrabold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}
