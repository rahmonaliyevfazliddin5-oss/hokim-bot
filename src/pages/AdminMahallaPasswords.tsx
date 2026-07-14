import { useEffect, useState } from "react";
import { KeyRound, RefreshCw, Shield, Search, Copy, Check, AlertTriangle } from "lucide-react";
import { adminCall } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Row {
  mahalla: string;
  updated_at: string;
  updated_by: string | null;
}

export default function AdminMahallaPasswords() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Row | null>(null);
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [defaultShown, setDefaultShown] = useState<{ mahalla: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { mahallas } = await adminCall<{ mahallas: Row[] }>("admin_list_mahallas");
      setRows(mahallas || []);
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const filtered = rows.filter(r => r.mahalla.toLowerCase().includes(search.toLowerCase()));

  async function resetToDefault(m: string) {
    setBusy(true);
    try {
      const res = await adminCall<{ default_password?: string }>("admin_reset_mahalla_password", { mahalla: m });
      if (res.default_password) {
        setDefaultShown({ mahalla: m, password: res.default_password });
      }
      toast.success("Parol standart holatga qaytarildi");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
    setBusy(false);
  }

  async function saveCustom() {
    if (!open) return;
    if (newPw.length < 6) return toast.error("Kamida 6 belgi");
    setBusy(true);
    try {
      await adminCall("admin_reset_mahalla_password", { mahalla: open.mahalla, new_password: newPw });
      toast.success("Parol yangilandi");
      setOpen(null);
      setNewPw("");
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
    setBusy(false);
  }

  const dateFmt = (d: string) => new Date(d).toLocaleString("en-GB");

  async function bulkResetAll() {
    if (!confirm("BARCHA MFY parollarini standart (mahallanomi123) holatga qaytarish? Barcha faol sessiyalar ham bekor qilinadi.")) return;
    setBusy(true);
    try {
      const res = await adminCall<{ reset: number; failed: string[] }>("admin_reset_all_mahalla_passwords");
      toast.success(`${res.reset} ta MFY paroli tiklandi${res.failed?.length ? `, ${res.failed.length} ta xato` : ""}`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-xl gradient-accent flex items-center justify-center">
          <KeyRound className="h-6 w-6 text-accent-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold">Mahalla parollari</h1>
          <p className="text-sm text-muted-foreground">Bcrypt bilan hashlangan. Boshlang'ich: mahallanomi123</p>
        </div>
        <Button variant="destructive" disabled={busy} onClick={bulkResetAll}>
          <AlertTriangle className="h-4 w-4 mr-1" /> Barchasini standart
        </Button>
      </div>

      <div className="glass rounded-2xl p-4 mb-4 flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="MFY qidirish..." value={search} onChange={e => setSearch(e.target.value)} className="border-0 bg-transparent focus-visible:ring-0" />
        <span className="text-xs text-muted-foreground">{filtered.length}/{rows.length}</span>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">MFY</th>
              <th className="text-left px-4 py-3">Oxirgi o'zgarish</th>
              <th className="text-left px-4 py-3">Kim</th>
              <th className="text-right px-4 py-3">Amal</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">Yuklanmoqda...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">Ma'lumot yo'q</td></tr>}
            {filtered.map((r) => (
              <tr key={r.mahalla} className="border-t border-border/40">
                <td className="px-4 py-3 font-medium">{r.mahalla}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{dateFmt(r.updated_at)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Shield className="h-3 w-3" />{r.updated_by ?? "—"}</span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => resetToDefault(r.mahalla)} className="mr-2">
                    <RefreshCw className="h-3.5 w-3.5 mr-1" /> Standart
                  </Button>
                  <Button size="sm" disabled={busy} onClick={() => { setOpen(r); setNewPw(""); }}>
                    <KeyRound className="h-3.5 w-3.5 mr-1" /> O'zgartirish
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Custom-password dialog */}
      <Dialog open={!!open} onOpenChange={(v) => { if (!v) setOpen(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yangi parol: {open?.mahalla}</DialogTitle>
            <DialogDescription>Kamida 6 belgi. Faol sessiyalar bekor qilinadi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Parol</Label>
            <Input type="text" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Yangi kuchli parol" autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>Bekor qilish</Button>
            <Button disabled={busy || newPw.length < 6} onClick={saveCustom}>Saqlash</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Default password shown-once dialog */}
      <Dialog open={!!defaultShown} onOpenChange={(v) => { if (!v) { setDefaultShown(null); setCopied(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Standart parol tayyor</DialogTitle>
            <DialogDescription>{defaultShown?.mahalla} MFY uchun. Bu parol keyin faqat hashlangan holda saqlanadi.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg bg-muted p-3 font-mono text-sm">
            <span className="flex-1 break-all">{defaultShown?.password}</span>
            <Button size="sm" variant="ghost" onClick={() => {
              if (defaultShown) {
                navigator.clipboard.writeText(defaultShown.password);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }
            }}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => { setDefaultShown(null); setCopied(false); }}>Yopish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
