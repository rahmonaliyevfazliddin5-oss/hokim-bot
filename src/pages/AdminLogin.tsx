import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/I18nProvider";
import { useAdmin } from "@/contexts/AdminContext";
import { toast } from "sonner";

export default function AdminLogin() {
  const { t } = useI18n();
  const { isAdmin, login } = useAdmin();
  const nav = useNavigate();
  const [u, setU] = useState("");
  const [p, setP] = useState("");

  if (isAdmin) return <Navigate to="/admin/dashboard" replace />;

  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await login(u, p);
    setBusy(false);
    if (ok) {
      toast.success("OK");
      nav("/admin/dashboard");
    } else {
      toast.error(t("admin.wrong"));
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md mx-auto mt-10">
      <div className="glass rounded-2xl p-8 shadow-elegant">
        <div className="h-14 w-14 mx-auto rounded-2xl gradient-accent flex items-center justify-center mb-4 shadow-elegant">
          <Shield className="h-7 w-7 text-accent-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-1">{t("admin.login_title")}</h1>
        <p className="text-xs text-center text-muted-foreground mb-6">&nbsp;</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("admin.username")}</Label>
            <Input value={u} onChange={e => setU(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>{t("admin.password")}</Label>
            <Input type="password" value={p} onChange={e => setP(e.target.value)} />
          </div>
          <Button type="submit" className="w-full gradient-accent text-accent-foreground" size="lg">
            <LogIn className="mr-2 h-4 w-4" /> {t("admin.login_btn")}
          </Button>
        </form>
      </div>
    </motion.div>
  );
}
