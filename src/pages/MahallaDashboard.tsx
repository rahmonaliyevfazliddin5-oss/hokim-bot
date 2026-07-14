import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Clock, CheckCircle2, XCircle, Inbox, Eye, MapPin, ExternalLink, LogOut, Building2, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { useMahalla } from "@/contexts/MahallaContext";
import { mahallaCall } from "@/lib/mahallaApi";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { computeEscalation, escalationLabel } from "@/lib/ai";
import { useI18n } from "@/i18n/I18nProvider";

const STATUSES = ["yangi", "jarayonda", "bajarildi", "rad_etildi"];
const CATS = ["gaz", "elektr", "suv", "chiqindi", "yo_l", "boshqa"];
const COLORS = ["#3b82f6", "#f59e0b", "#22c55e", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function MahallaDashboard() {
  const { t } = useI18n();
  const { mahalla, logout } = useMahalla();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fCat, setFCat] = useState("all");
  const [open, setOpen] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    try {
      const { complaints } = await mahallaCall<{ complaints: any[] }>("mahalla_list_complaints");
      setItems(complaints || []);
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const counts = {
    total: items.length,
    yangi: items.filter(i => i.status === "yangi").length,
    jarayonda: items.filter(i => i.status === "jarayonda").length,
    bajarildi: items.filter(i => i.status === "bajarildi").length,
    rad_etildi: items.filter(i => i.status === "rad_etildi").length,
  };

  const itemCats = (i: any): string[] => (i.categories?.length ? i.categories : [i.category]);

  const filtered = items.filter(i => {
    if (fStatus !== "all" && i.status !== fStatus) return false;
    if (fCat !== "all" && !itemCats(i).includes(fCat)) return false;
    if (search && !(`${i.tracking_code} ${i.citizen_name} ${i.text}`).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ---- Stats ----
  const now = Date.now();
  const DAY = 86400_000;
  const daily = items.filter(i => now - new Date(i.created_at).getTime() < DAY).length;
  const weekly = items.filter(i => now - new Date(i.created_at).getTime() < 7 * DAY).length;
  const monthly = items.filter(i => now - new Date(i.created_at).getTime() < 30 * DAY).length;

  const byCategory = useMemo(() => {
    const m: Record<string, number> = {};
    items.forEach(i => itemCats(i).forEach(c => { m[c] = (m[c] || 0) + 1; }));
    return Object.entries(m).map(([name, value]) => ({ name: t(`category.${name}`), value }));
  }, [items, t]);

  const byStatus = useMemo(() =>
    STATUSES.map(s => ({ name: t(`status.${s}`), value: items.filter(i => i.status === s).length })),
    [items, t]
  );

  const dailyTrend = useMemo(() => {
    const arr: { day: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * DAY);
      const key = d.toISOString().slice(0, 10);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      const c = items.filter(x => x.created_at.slice(0, 10) === key).length;
      arr.push({ day: label, count: c });
    }
    return arr;
  }, [items, now]);

  function openItem(it: any) {
    setOpen(it); setNewStatus(it.status); setNotes(it.admin_notes || "");
  }

  async function save() {
    if (!open) return;
    try {
      await mahallaCall("mahalla_update_complaint", { id: open.id, status: newStatus, admin_notes: notes || null });
      toast.success("Saqlandi");
      setOpen(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const stats = [
    { label: "Jami", value: counts.total, icon: Inbox, color: "text-primary bg-primary/10" },
    { label: "Yangi", value: counts.yangi, icon: FileText, color: "text-accent bg-accent/10" },
    { label: "Jarayonda", value: counts.jarayonda, icon: Clock, color: "text-warning-foreground bg-warning/15" },
    { label: "Bajarildi", value: counts.bajarildi, icon: CheckCircle2, color: "text-success bg-success/10" },
    { label: "Rad etildi", value: counts.rad_etildi, icon: XCircle, color: "text-destructive bg-destructive/10" },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl gradient-accent flex items-center justify-center shadow-elegant">
            <Building2 className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">{mahalla} MFY</h1>
            <div className="text-xs text-muted-foreground">Mahalla boshqaruv paneli · Farg'ona tumani</div>
          </div>
        </div>
        <Button variant="outline" onClick={logout}><LogOut className="mr-2 h-4 w-4" /> Chiqish</Button>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="list">Murojaatlar</TabsTrigger>
          <TabsTrigger value="stats">Statistika</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {stats.map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-2xl p-5">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="text-2xl font-extrabold">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </motion.div>
            ))}
          </div>

          <div className="glass rounded-2xl p-4 md:p-5 mb-4 flex flex-wrap gap-3">
            <Input placeholder="Qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[200px]" />
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barchasi</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fCat} onValueChange={setFCat}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Barchasi</SelectItem>
                {CATS.map(c => <SelectItem key={c} value={c}>{t(`category.${c}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Kod</th>
                    <th className="text-left px-4 py-3">Fuqaro</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Matn</th>
                    <th className="text-left px-4 py-3">Kategoriya</th>
                    <th className="text-left px-4 py-3">Yo'nalish</th>
                    <th className="text-left px-4 py-3">Holat</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Ma'lumot yo'q</td></tr>
                  ) : filtered.map(it => {
                    const detailCats = it.category_details?.length ? it.category_details : itemCats(it).map((c: string) => ({ category: c, confidence: 0.6, hits: [] }));
                    const esc = computeEscalation(it.text, detailCats);
                    return (
                      <tr key={it.id} className="border-t border-border/60 hover:bg-secondary/40 transition-smooth">
                        <td className="px-4 py-3 font-mono text-xs font-semibold">{it.tracking_code}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{it.citizen_name}</div>
                          <div className="text-xs text-muted-foreground">{it.citizen_phone}</div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell max-w-xs truncate text-muted-foreground">{it.text}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {itemCats(it).map((c: string) => (
                              <span key={c} className="rounded-md bg-accent/15 text-accent px-2 py-0.5 text-[10px] font-semibold">{t(`category.${c}`)}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                            esc === "mahalla" ? "bg-success/15 text-success" :
                            esc === "mahalla_org" ? "bg-primary/15 text-primary" :
                            "bg-destructive/15 text-destructive"
                          }`}>{escalationLabel(esc)}</span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={it.status} /></td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => openItem(it)}><Eye className="h-4 w-4" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { label: "Bugun", value: daily },
              { label: "So'nggi 7 kun", value: weekly },
              { label: "So'nggi 30 kun", value: monthly },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-2xl p-6">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  <TrendingUp className="h-4 w-4" /> {s.label}
                </div>
                <div className="text-4xl font-extrabold">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">murojaat</div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-bold mb-3">Kategoriya bo'yicha</div>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" outerRadius={90} label>
                    {byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="glass rounded-2xl p-5">
              <div className="text-sm font-bold mb-3">Holat bo'yicha</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byStatus}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <div className="text-sm font-bold mb-3">So'nggi 30 kunlik dinamika</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!open} onOpenChange={v => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{open?.tracking_code}</DialogTitle></DialogHeader>
          {open && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="text-xs text-muted-foreground mb-1">
                  {open.citizen_name} — {open.citizen_phone}
                </div>
                {open.location && <div className="text-xs flex items-center gap-1 mb-2"><MapPin className="h-3 w-3" />{open.location}</div>}
                {open.map_link && (
                  <a href={open.map_link} target="_blank" rel="noreferrer" className="text-xs text-accent inline-flex items-center gap-1 mb-2"><ExternalLink className="h-3 w-3" />Xaritada ko'rish</a>
                )}
                <p className="rounded-lg bg-secondary p-3 whitespace-pre-wrap">{open.text}</p>
              </div>

              {open.image_urls?.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {open.image_urls.map((u: string, i: number) => (
                    <a key={i} href={u} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border border-border">
                      <img src={u} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider">Holatni yangilash</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider">Javob / Izoh</label>
                <Textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Fuqaroga javobingizni yozing..." />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setOpen(null)}>Bekor qilish</Button>
                <Button onClick={save} className="gradient-accent text-accent-foreground">Saqlash</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
