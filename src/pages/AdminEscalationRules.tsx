import { useEffect, useState } from "react";
import { Timer, Save } from "lucide-react";
import { adminCall } from "@/lib/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Rules = {
  enabled: boolean;
  severity_bump_days: number;
  reroute_to_hokimiyat_days: number;
  target_status: string;
  max_severity: string;
};

const STATUSES = [
  { v: "korib_chiqilmoqda", l: "Ko'rib chiqilmoqda" },
  { v: "jarayonda", l: "Jarayonda" },
  { v: "yuborildi_hokimiyat", l: "Hokimiyatga yuborildi" },
];
const SEVS = [
  { v: "oddiy", l: "Oddiy" },
  { v: "orta", l: "O'rta" },
  { v: "yuqori", l: "Yuqori" },
];

export default function AdminEscalationRules() {
  const [rules, setRules] = useState<Rules | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const r = await adminCall<{ rules: Rules }>("escalation_rules_get");
      setRules(r.rules);
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!rules) return;
    setSaving(true);
    try {
      await adminCall("escalation_rules_set", rules);
      toast.success("Qoidalar saqlandi");
    } catch (e: any) {
      toast.error(e.message);
    }
    setSaving(false);
  }

  if (!rules) return <div className="p-6 text-muted-foreground">Yuklanmoqda...</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Timer className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-extrabold">Eskalatsiya qoidalari</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Muddati o'tgan murojaatlar uchun avtomatik eskalatsiya sozlamalari.
        "Muddati o'tganlarni eskalatsiya" tugmasi bosilganda ushbu qoidalar qo'llaniladi.
      </p>

      <div className="glass rounded-2xl p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Yoqilgan</Label>
            <p className="text-xs text-muted-foreground">O'chirilgan bo'lsa, eskalatsiya ishlamaydi</p>
          </div>
          <Switch checked={rules.enabled} onCheckedChange={v => setRules({ ...rules, enabled: v })} />
        </div>

        <div>
          <Label>Og'irlikni oshirish — kun kechikish</Label>
          <Input
            type="number" min={0} max={365}
            value={rules.severity_bump_days}
            onChange={e => setRules({ ...rules, severity_bump_days: Number(e.target.value) || 0 })}
          />
          <p className="text-xs text-muted-foreground mt-1">
            ETA'dan shuncha kun o'tganda og'irlik bosqichi ko'tariladi (0 = o'tishi bilan darhol)
          </p>
        </div>

        <div>
          <Label>Maksimal og'irlik darajasi</Label>
          <Select value={rules.max_severity} onValueChange={v => setRules({ ...rules, max_severity: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEVS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Hokimiyatga yo'naltirish — kun kechikish</Label>
          <Input
            type="number" min={0} max={365}
            value={rules.reroute_to_hokimiyat_days}
            onChange={e => setRules({ ...rules, reroute_to_hokimiyat_days: Number(e.target.value) || 0 })}
          />
          <p className="text-xs text-muted-foreground mt-1">
            ETA'dan shuncha kun o'tgan mahalla murojaatlari hokimiyatga yo'naltiriladi
          </p>
        </div>

        <div>
          <Label>Yangi status</Label>
          <Select value={rules.target_status} onValueChange={v => setRules({ ...rules, target_status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">Eskalatsiya qilingan murojaat qaysi statusga o'tsin</p>
        </div>

        <Button onClick={save} disabled={saving} className="w-full gradient-accent text-accent-foreground">
          <Save className="mr-1.5 h-4 w-4" /> {saving ? "Saqlanmoqda..." : "Saqlash"}
        </Button>
      </div>
    </div>
  );
}
