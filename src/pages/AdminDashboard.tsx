import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Clock, CheckCircle2, XCircle, Inbox, Eye } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const STATUSES = ["yangi", "jarayonda", "bajarildi", "rad_etildi"];
const CATS = ["gaz", "elektr", "suv", "chiqindi", "yo_l", "boshqa"];

export default function AdminDashboard() {
  const { t, lang } = useI18n();
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
    const { data } = await supabase.from("complaints").select("*").order("created_at", { ascending: false }).limit(500);
    setItems(data || []);
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

  const filtered = items.filter(i => {
    if (fStatus !== "all" && i.status !== fStatus) return false;
    if (fCat !== "all" && i.category !== fCat) return false;
    if (search && !(`${i.tracking_code} ${i.citizen_name} ${i.text}`).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function openItem(it: any) {
    setOpen(it);
    setNewStatus(it.status);
    setNotes(it.admin_notes || "");
  }

  async function save() {
    if (!open) return;
    const { error } = await supabase.from("complaints").update({
      status: newStatus, admin_notes: notes || null
    }).eq("id", open.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("activity_logs").insert({
      action: "status_changed",
      details: `${open.tracking_code}: ${open.status} → ${newStatus}`,
      actor: "admin",
      complaint_id: open.id,
    });
    toast.success("OK");
    setOpen(null);
    load();
  }

  const dateFmt = (d: string) => new Date(d).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB");

  const stats = [
    { label: t("admin.total"), value: counts.total, icon: Inbox, color: "text-primary bg-primary/10" },
    { label: t("admin.new"), value: counts.yangi, icon: FileText, color: "text-accent bg-accent/10" },
    { label: t("admin.in_progress"), value: counts.jarayonda, icon: Clock, color: "text-warning-foreground bg-warning/15" },
    { label: t("admin.resolved"), value: counts.bajarildi, icon: CheckCircle2, color: "text-success bg-success/10" },
    { label: t("admin.rejected"), value: counts.rad_etildi, icon: XCircle, color: "text-destructive bg-destructive/10" },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-extrabold mb-6">{t("admin.dashboard_title")}</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-2xl p-5">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div className="text-2xl font-extrabold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="glass rounded-2xl p-4 md:p-5 mb-4 flex flex-wrap gap-3">
        <Input placeholder={t("admin.search")} value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[200px]" />
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.all")}</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fCat} onValueChange={setFCat}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.all")}</SelectItem>
            {CATS.map(c => <SelectItem key={c} value={c}>{t(`category.${c}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">{t("admin.table_id")}</th>
                <th className="text-left px-4 py-3">{t("admin.table_user")}</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">{t("admin.table_text")}</th>
                <th className="text-left px-4 py-3">{t("admin.table_category")}</th>
                <th className="text-left px-4 py-3">{t("admin.table_status")}</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">{t("admin.table_date")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">{t("admin.no_data")}</td></tr>
              ) : filtered.map(it => (
                <tr key={it.id} className="border-t border-border/60 hover:bg-secondary/40 transition-smooth">
                  <td className="px-4 py-3 font-mono text-xs font-semibold">{it.tracking_code}</td>
                  <td className="px-4 py-3"><div className="font-medium">{it.citizen_name}</div><div className="text-xs text-muted-foreground">{it.citizen_phone}</div></td>
                  <td className="px-4 py-3 hidden md:table-cell max-w-xs truncate text-muted-foreground">{it.text}</td>
                  <td className="px-4 py-3"><span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">{t(`category.${it.category}`)}</span></td>
                  <td className="px-4 py-3"><StatusBadge status={it.status} /></td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">{dateFmt(it.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openItem(it)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={v => !v && setOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{open?.tracking_code}</DialogTitle>
          </DialogHeader>
          {open && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="text-xs text-muted-foreground mb-1">{open.citizen_name} — {open.citizen_phone}</div>
                <p className="rounded-lg bg-secondary p-3 whitespace-pre-wrap">{open.text}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider">{t("admin.update_status")}</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider">{t("track.admin_notes")}</label>
                <Textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setOpen(null)}>{t("admin.cancel")}</Button>
                <Button onClick={save} className="gradient-accent text-accent-foreground">{t("admin.save")}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
