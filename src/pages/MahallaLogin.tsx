import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MahallaCombobox } from "@/components/MahallaCombobox";
import { useMahalla } from "@/contexts/MahallaContext";
import { toast } from "sonner";

export default function MahallaLogin() {
  const { mahalla, login } = useMahalla();
  const nav = useNavigate();
  const [m, setM] = useState("");
  const [p, setP] = useState("");
  const [busy, setBusy] = useState(false);

  if (mahalla) return <Navigate to="/mahalla/dashboard" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!m) return toast.error("MFY tanlang");
    setBusy(true);
    const ok = await login(m, p);
    setBusy(false);
    if (ok) {
      toast.success("Kirish muvaffaqiyatli");
      nav("/mahalla/dashboard");
    } else {
      toast.error("Noto'g'ri MFY yoki parol");
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto mt-10">
      <div className="glass rounded-2xl p-8 shadow-elegant">
        <div className="h-14 w-14 mx-auto rounded-2xl gradient-accent flex items-center justify-center mb-4 shadow-elegant">
          <Building2 className="h-7 w-7 text-accent-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-1">Mahalla paneli</h1>
        <p className="text-xs text-center text-muted-foreground mb-6">Farg'ona tumani MFY raislari uchun kirish</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>MFY</Label>
            <MahallaCombobox value={m} onChange={setM} />
          </div>
          <div className="space-y-1.5">
            <Label>Parol</Label>
            <Input type="password" value={p} onChange={e => setP(e.target.value)} placeholder="mahallanomi123" />
            <p className="text-[11px] text-muted-foreground"></p>
          </div>
          <Button type="submit" disabled={busy} className="w-full gradient-accent text-accent-foreground" size="lg">
            <LogIn className="mr-2 h-4 w-4" /> Kirish
          </Button>
        </form>
      </div>
    </motion.div>
  );
}
