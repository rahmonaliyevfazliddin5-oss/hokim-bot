import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Clock, CheckCircle2, XCircle, Inbox, Eye, MapPin, ExternalLink, Sparkles, Download, FileDown, ThumbsUp, ThumbsDown, AlertTriangle } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { adminCall } from "@/lib/adminApi";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const STATUSES = ["qabul_qilindi", "ai_tahlil", "mahallaga_yuborildi", "hokimiyatga_yuborildi", "korib_chiqilmoqda", "jarayonda", "hal_qilindi", "rad_etildi"];
const CATS = ["gaz", "elektr", "suv", "chiqindi", "yo_l", "boshqa"];
const SEVERITIES = ["oddiy", "orta", "yuqori"];
const ROUTINGS = ["mahalla", "hokimiyat"];

export default function AdminDashboard() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [fCat, setFCat] = useState("all");
  const [fSev, setFSev] = useState("all");
  const [fRoute, setFRoute] = useState("all");
  const [fMahalla, setFMahalla] = useState("all");
  const [fOrg, setFOrg] = useState("all");
  const [open, setOpen] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [fbStats, setFbStats] = useState<{ correct: number; incorrect: number; total: number; accuracy: number | null } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { complaints } = await adminCall<{ complaints: any[] }>("list_complaints");
      setItems(complaints || []);
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoading(false);
  }
  async function loadFeedback() {
    try {
      const s = await adminCall<any>("routing_feedback_stats");
      setFbStats(s);
    } catch { /* ignore */ }
  }
  useEffect(() => { load(); loadFeedback(); }, []);

  const counts = {
    total: items.length,
    yangi: items.filter(i => i.status === "yangi").length,
    jarayonda: items.filter(i => i.status === "jarayonda").length,
    bajarildi: items.filter(i => i.status === "bajarildi").length,
    rad_etildi: items.filter(i => i.status === "rad_etildi").length,
  };

  const itemCats = (i: any): string[] => (i.categories?.length ? i.categories : [i.category]);

  const mahallaOptions = Array.from(new Set(items.map(i => i.mahalla).filter(Boolean))).sort();
  const orgOptions = Array.from(new Set(items.map(i => i.responsible_org).filter(Boolean))).sort();

  const filtered = items.filter(i => {
    if (fStatus !== "all" && i.status !== fStatus) return false;
    if (fCat !== "all" && !itemCats(i).includes(fCat)) return false;
    if (fSev !== "all" && i.severity !== fSev) return false;
    if (fRoute !== "all" && i.routing_target !== fRoute) return false;
    if (fMahalla !== "all" && i.mahalla !== fMahalla) return false;
    if (fOrg !== "all" && i.responsible_org !== fOrg) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${i.tracking_code} ${i.citizen_name} ${i.citizen_phone || ""} ${i.text} ${i.district || ""} ${i.mahalla || ""} ${i.responsible_org || ""} ${i.location || ""}`.toLowerCase();
      // Support space-separated multi-term AND search
      const terms = q.split(/\s+/).filter(Boolean);
      if (!terms.every(term => hay.includes(term))) return false;
    }
    return true;
  });

  const activeFilters = [fStatus, fCat, fSev, fRoute, fMahalla, fOrg].filter(v => v !== "all").length + (search ? 1 : 0);
  function resetFilters() {
    setSearch(""); setFStatus("all"); setFCat("all"); setFSev("all"); setFRoute("all"); setFMahalla("all"); setFOrg("all");
  }

  function filterSummary(): string {
    const bits: string[] = [];
    if (search) bits.push(`q="${search}"`);
    if (fStatus !== "all") bits.push(`holat=${fStatus}`);
    if (fCat !== "all") bits.push(`kategoriya=${fCat}`);
    if (fSev !== "all") bits.push(`og'irlik=${fSev}`);
    if (fRoute !== "all") bits.push(`yo'nalish=${fRoute}`);
    if (fMahalla !== "all") bits.push(`MFY=${fMahalla}`);
    if (fOrg !== "all") bits.push(`org=${fOrg}`);
    return bits.length ? bits.join(" · ") : "Filtr yo'q";
  }

  function buildFilename(ext: string) {
    const d = new Date().toISOString().slice(0, 10);
    const parts = ["hokim-murojaatlar", d];
    if (fStatus !== "all") parts.push(fStatus);
    if (fMahalla !== "all") parts.push(fMahalla.replace(/\s+/g, "_"));
    return parts.join("_") + "." + ext;
  }

  function exportCSV() {
    if (filtered.length === 0) { toast.error("Eksport uchun ma'lumot yo'q"); return; }
    const header = ["tracking_code", "created_at", "status", "severity", "routing_target", "responsible_org", "categories", "mahalla", "district", "citizen_name", "citizen_phone", "location", "eta_days", "text", "admin_notes"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
    const meta = `# Hokim AI murojaatlar eksport\n# Vaqt: ${new Date().toISOString()}\n# ${filterSummary()}\n# Yozuvlar: ${filtered.length}\n`;
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push([
        r.tracking_code, r.created_at, r.status, r.severity, r.routing_target, r.responsible_org,
        (r.categories?.length ? r.categories : [r.category]).join("; "),
        r.mahalla, r.district, r.citizen_name, r.citizen_phone, r.location, r.eta_days, r.text, r.admin_notes,
      ].map(esc).join(","));
    }
    const blob = new Blob(["\uFEFF" + meta + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = buildFilename("csv");
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} yozuv CSV ga eksport qilindi`);
  }

  function exportPDF() {
    if (filtered.length === 0) { toast.error("Eksport uchun ma'lumot yo'q"); return; }
    const win = window.open("", "_blank");
    if (!win) { toast.error("Popup bloklangan"); return; }
    const esc = (v: any) => String(v ?? "").replace(/[&<>]/g, c => c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;");
    const filename = buildFilename("pdf");
    const rowsHtml = filtered.map(r => `<tr>
      <td>${esc(r.tracking_code)}</td>
      <td>${esc(dateFmt(r.created_at))}</td>
      <td>${esc(r.status)}</td>
      <td>${esc(r.severity ?? "—")}</td>
      <td>${esc(r.routing_target ?? "—")}</td>
      <td>${esc(r.mahalla ?? "—")}</td>
      <td>${esc(r.responsible_org ?? "—")}</td>
      <td>${esc(r.citizen_name)}<br/><small>${esc(r.citizen_phone ?? "")}</small></td>
      <td>${esc((r.text ?? "").slice(0, 200))}</td>
    </tr>`).join("");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${esc(filename)}</title>
<style>body{font-family:-apple-system,sans-serif;padding:24px;color:#111}h1{font-size:18px;margin:0 0 4px}
.meta{color:#666;font-size:12px;margin-bottom:6px}
.filters{color:#333;font-size:12px;margin-bottom:16px;padding:6px 10px;background:#f5f7fa;border-left:3px solid #3b82f6}
table{width:100%;border-collapse:collapse;font-size:11px}
th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f5f5f5;text-transform:uppercase;font-size:10px}
tr:nth-child(even) td{background:#fafafa}
@media print{.noprint{display:none}}</style></head><body>
<h1>Hokim AI — Murojaatlar ro'yxati</h1>
<div class="meta">Eksport: ${new Date().toLocaleString()} · Yozuvlar: ${filtered.length}</div>
<div class="filters"><b>Filtr:</b> ${esc(filterSummary())}</div>
<button class="noprint" onclick="window.print()">PDF sifatida saqlash / Chop etish</button>
<table><thead><tr><th>Kod</th><th>Vaqt</th><th>Holat</th><th>Og'irlik</th><th>Yo'nalish</th><th>MFY</th><th>Mas'ul</th><th>Fuqaro</th><th>Matn</th></tr></thead>
<tbody>${rowsHtml}</tbody></table>
<script>setTimeout(function(){document.title=${JSON.stringify(filename)};window.print();},300);</script>
</body></html>`);
    win.document.close();
  }

  function openItem(it: any) {
    setOpen(it); setNewStatus(it.status); setNotes(it.admin_notes || "");
  }

  async function save() {
    if (!open) return;
    try {
      await adminCall("update_complaint", { id: open.id, status: newStatus, admin_notes: notes || null });
    } catch (e: any) {
      toast.error(e.message);
      return;
    }
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
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-2xl p-5">
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div className="text-2xl font-extrabold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {fbStats && fbStats.total > 0 && (
        <div className="glass rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-4">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">AI yo'naltirish bahosi</div>
          <div className="flex items-center gap-1.5 text-sm">
            <ThumbsUp className="h-4 w-4 text-success" />
            <span className="font-bold">{fbStats.correct}</span>
            <span className="text-muted-foreground text-xs">to'g'ri</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <ThumbsDown className="h-4 w-4 text-destructive" />
            <span className="font-bold">{fbStats.incorrect}</span>
            <span className="text-muted-foreground text-xs">noto'g'ri</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground text-xs">Aniqlik: </span>
            <span className="font-bold text-primary">{fbStats.accuracy != null ? Math.round(fbStats.accuracy * 100) + "%" : "—"}</span>
          </div>
          <div className="text-xs text-muted-foreground ml-auto">Jami: {fbStats.total}</div>
        </div>
      )}


      <div className="glass rounded-2xl p-4 md:p-5 mb-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder={`${t("admin.search")} (kod, ism, tel, matn, manzil...)`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[240px]"
          />
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            <span className="font-semibold text-foreground">{filtered.length}</span> / {items.length}
          </div>
          {activeFilters > 0 && (
            <Button size="sm" variant="outline" onClick={resetFilters} className="text-xs">
              Filtrlarni tozalash ({activeFilters})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={exportCSV} className="text-xs">
            <Download className="mr-1 h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportPDF} className="text-xs">
            <FileDown className="mr-1 h-3.5 w-3.5" /> PDF
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <FilterSelect label="Holat" value={fStatus} setValue={setFStatus} options={STATUSES.map(s => ({ v: s, l: t(`status.${s}`) }))} />
          <FilterSelect label="Kategoriya" value={fCat} setValue={setFCat} options={CATS.map(c => ({ v: c, l: t(`category.${c}`) }))} />
          <FilterSelect label="Og'irlik" value={fSev} setValue={setFSev} options={SEVERITIES.map(s => ({ v: s, l: s === "orta" ? "O'rta" : s.charAt(0).toUpperCase() + s.slice(1) }))} />
          <FilterSelect label="Yo'nalish" value={fRoute} setValue={setFRoute} options={ROUTINGS.map(r => ({ v: r, l: r === "hokimiyat" ? "Hokimiyat" : "MFY" }))} />
          <FilterSelect label="MFY" value={fMahalla} setValue={setFMahalla} options={mahallaOptions.map(m => ({ v: m, l: m }))} />
          <FilterSelect label="Mas'ul tashkilot" value={fOrg} setValue={setFOrg} options={orgOptions.map(o => ({ v: o, l: o }))} />
        </div>
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
                  <td className="px-4 py-3">
                    <div className="font-medium">{it.citizen_name}</div>
                    <div className="text-xs text-muted-foreground">{it.citizen_phone}</div>
                    {it.district && <div className="text-[10px] text-muted-foreground">{it.district}{it.mahalla ? `, ${it.mahalla}` : ""}</div>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell max-w-xs truncate text-muted-foreground">{it.text}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {itemCats(it).map(c => (
                        <span key={c} className="rounded-md bg-accent/15 text-accent px-2 py-0.5 text-[10px] font-semibold">{t(`category.${c}`)}</span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {it.severity && (
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          it.severity === "yuqori" ? "bg-destructive/15 text-destructive"
                          : it.severity === "orta" ? "bg-warning/15 text-warning-foreground"
                          : "bg-muted text-muted-foreground"
                        }`}>{it.severity === "orta" ? "o'rta" : it.severity}</span>
                      )}
                      {it.routing_target && (
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-primary/10 text-primary">
                          {it.routing_target === "hokimiyat" ? "→ HOK" : "→ MFY"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={it.status} /></td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">{dateFmt(it.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openItem(it)}><Eye className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!open} onOpenChange={v => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{open?.tracking_code}</DialogTitle></DialogHeader>
          {open && (
            <div className="space-y-4">
              <div className="text-sm">
                <div className="text-xs text-muted-foreground mb-1">
                  {open.citizen_name} — {open.citizen_phone}
                  {open.district && <span> · {open.district}{open.mahalla ? `, ${open.mahalla}` : ""}</span>}
                </div>
                {open.location && <div className="text-xs flex items-center gap-1 mb-2"><MapPin className="h-3 w-3" />{open.location}</div>}
                {open.map_link && (
                  <a href={open.map_link} target="_blank" rel="noreferrer" className="text-xs text-accent inline-flex items-center gap-1 mb-2"><ExternalLink className="h-3 w-3" />{t("admin.view_map")}</a>
                )}
                <p className="rounded-lg bg-secondary p-3 whitespace-pre-wrap">{open.text}</p>
              </div>

              {open.category_details?.length > 0 && (
                <div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-accent mb-2 flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />{t("submit.ai_detected")}</div>
                  <div className="space-y-1.5">
                    {open.category_details.map((d: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-accent text-accent-foreground px-2 py-0.5 font-semibold">{t(`category.${d.category}`)}</span>
                          {d.hits?.length > 0 && <span className="text-muted-foreground">→ {d.hits.join(", ")}</span>}
                        </div>
                        <span className="font-mono">{Math.round(d.confidence * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

function FilterSelect({ label, value, setValue, options }: { label: string; value: string; setValue: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">{label}</div>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Barchasi</SelectItem>
          {options.map(o => <SelectItem key={o.v} value={o.v} className="text-xs">{o.l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
