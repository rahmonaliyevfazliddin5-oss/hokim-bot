import { useEffect, useMemo, useState } from "react";
import {
  Shield, Ban, Search, RefreshCw, Activity, MonitorSmartphone, AlertTriangle, ChevronDown,
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

const AUDIT_ACTIONS = [
  { key: "mahalla_login_success", label: "Login (muvaffaqiyatli)" },
  { key: "mahalla_login_failed", label: "Login (xato)" },
  { key: "mahalla_login_blocked", label: "Login (bloklangan)" },
  { key: "mahalla_password_reset", label: "Parol tiklash" },
  { key: "mahalla_session_revoked", label: "Sessiya bekor qilingan" },
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

// ============================================================
export default function AdminMahallaSecurity() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-xl gradient-accent flex items-center justify-center">
          <Shield className="h-6 w-6 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold">Mahalla xavfsizlik</h1>
          <p className="text-sm text-muted-foreground">Sessiyalar, audit log va login statistikasi</p>
        </div>
      </div>

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
function SessionsTab() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mahalla, setMahalla] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { sessions } = await adminCall<{ sessions: SessionRow[] }>("admin_list_mahalla_sessions", {
        mahalla: mahalla || undefined,
        active_only: activeOnly,
      });
      setRows(sessions || []);
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeOnly]);

  async function revoke(id: string) {
    setBusy(id);
    try {
      await adminCall("admin_revoke_mahalla_session", { session_id: id });
      toast.success("Sessiya bekor qilindi");
      setRows((r) => r.map((s) => (s.id === id ? { ...s, revoked_at: new Date().toISOString() } : s)));
    } catch (e: any) { toast.error(e.message); }
    setBusy(null);
  }

  const now = Date.now();
  const status = (s: SessionRow) => {
    if (s.revoked_at) return { label: "Bekor qilingan", cls: "bg-muted text-muted-foreground" };
    if (new Date(s.expires_at).getTime() < now) return { label: "Muddati o'tgan", cls: "bg-muted text-muted-foreground" };
    return { label: "Faol", cls: "bg-success/15 text-success" };
  };

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <Input placeholder="MFY nomi bo'yicha filtr..." value={mahalla}
               onChange={(e) => setMahalla(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && load()}
               className="flex-1 min-w-[200px] border-0 bg-transparent focus-visible:ring-0" />
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
          Faqat faol
        </label>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1" /> Yangilash</Button>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">MFY</th>
              <th className="text-left px-4 py-3">IP · Qurilma</th>
              <th className="text-left px-4 py-3">Boshlangan</th>
              <th className="text-left px-4 py-3">Tugaydi</th>
              <th className="text-left px-4 py-3">Holat</th>
              <th className="text-right px-4 py-3">Amal</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Yuklanmoqda...</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Sessiya topilmadi</td></tr>}
            {rows.map((s) => {
              const st = status(s);
              const isActive = !s.revoked_at && new Date(s.expires_at).getTime() >= now;
              return (
                <tr key={s.id} className="border-t border-border/40">
                  <td className="px-4 py-3 font-medium">{s.mahalla}</td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-mono">{s.ip ?? "—"}</div>
                    <div className="text-muted-foreground">{shortUA(s.user_agent)}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(s.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(s.expires_at)}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className={st.cls}>{st.label}</Badge></td>
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

  const actionColor = (a: string) =>
    a === "mahalla_login_success" ? "bg-success/15 text-success"
    : a === "mahalla_login_failed" ? "bg-warning/15 text-warning"
    : a === "mahalla_login_blocked" ? "bg-destructive/15 text-destructive"
    : a === "mahalla_password_reset" ? "bg-primary/15 text-primary"
    : a === "mahalla_session_revoked" ? "bg-destructive/15 text-destructive"
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
