import { useState } from "react";
import { motion } from "framer-motion";
import { Send, CheckCircle2, Copy, Sparkles, MapPin } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/i18n/I18nProvider";
import { classify, generateTrackingCode, autoResponse } from "@/lib/ai";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const REGIONS = ["toshkent","samarqand","buxoro","andijon","namangan","fargona","qashqadaryo","surxondaryo","navoiy","jizzax","sirdaryo","xorazm","qoraqalpogiston"];

const schema = z.object({
  citizen_name: z.string().trim().min(2).max(120),
  citizen_phone: z.string().trim().min(7).max(30),
  region: z.string().min(1),
  location: z.string().trim().max(200).optional(),
  text: z.string().trim().min(10).max(2000),
  image_url: z.string().trim().url().max(500).optional().or(z.literal("")),
});

export default function Submit() {
  const { t } = useI18n();
  const [form, setForm] = useState({ citizen_name: "", citizen_phone: "", region: "", location: "", text: "", image_url: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ code: string; category: string; response: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      const ai = classify(form.text);
      const code = generateTrackingCode();
      const aiResp = autoResponse(ai.category);
      const { error } = await supabase.from("complaints").insert({
        citizen_name: form.citizen_name.trim(),
        citizen_phone: form.citizen_phone.trim(),
        region: form.region,
        location: form.location?.trim() || null,
        text: form.text.trim(),
        image_url: form.image_url?.trim() || null,
        category: ai.category,
        ai_confidence: ai.confidence,
        ai_response: aiResp,
        tracking_code: code,
      });
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        action: "complaint_created",
        details: `Code: ${code}, category: ${ai.category}`,
        actor: form.citizen_name,
      });
      setResult({ code, category: ai.category, response: aiResp });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (result) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <div className="glass rounded-3xl p-8 md:p-10 text-center shadow-elegant">
          <div className="h-16 w-16 mx-auto rounded-full bg-success/15 flex items-center justify-center mb-5">
            <CheckCircle2 className="h-9 w-9 text-success" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-2">{t("submit.success")}</h2>
          <p className="text-muted-foreground mb-6">{t("submit.your_code")}</p>
          <div className="inline-flex items-center gap-3 rounded-2xl bg-secondary px-5 py-3 mb-6">
            <code className="text-2xl font-bold tracking-wider text-primary">{result.code}</code>
            <Button size="sm" variant="ghost" onClick={copy}>
              <Copy className="h-4 w-4 mr-1" />
              {copied ? t("submit.copied") : t("submit.copy")}
            </Button>
          </div>
          <div className="rounded-xl bg-accent/10 border border-accent/20 p-4 text-left mb-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-accent uppercase tracking-wider mb-1">
              <Sparkles className="h-3.5 w-3.5" /> {t("submit.ai_detected")}: {t(`category.${result.category}`)}
            </div>
            <p className="text-sm">{result.response}</p>
          </div>
          <Button onClick={() => { setResult(null); setForm({ citizen_name: "", citizen_phone: "", region: "", location: "", text: "", image_url: "" }); }}>
            {t("submit.new_one")}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-1">{t("submit.title")}</h1>
        <p className="text-muted-foreground">{t("submit.subtitle")}</p>
      </div>
      <form onSubmit={onSubmit} className="glass rounded-2xl p-6 md:p-8 space-y-5 shadow-card-soft">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("submit.name")}</Label>
            <Input id="name" required maxLength={120} value={form.citizen_name} onChange={e => update("citizen_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">{t("submit.phone")}</Label>
            <Input id="phone" required maxLength={30} placeholder="+998 ..." value={form.citizen_phone} onChange={e => update("citizen_phone", e.target.value)} />
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t("submit.region")}</Label>
            <Select value={form.region} onValueChange={v => update("region", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REGIONS.map(r => <SelectItem key={r} value={r}>{t(`regions.${r}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="loc"><MapPin className="inline h-3.5 w-3.5 mr-1" />{t("submit.location")}</Label>
            <Input id="loc" maxLength={200} value={form.location} onChange={e => update("location", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="text">{t("submit.text")}</Label>
          <Textarea id="text" required rows={5} maxLength={2000} placeholder={t("submit.text_ph")} value={form.text} onChange={e => update("text", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="img">{t("submit.image")}</Label>
          <Input id="img" type="url" maxLength={500} placeholder="https://..." value={form.image_url} onChange={e => update("image_url", e.target.value)} />
        </div>
        <Button type="submit" disabled={loading} size="lg" className="w-full gradient-accent text-accent-foreground hover:opacity-90 shadow-elegant">
          <Send className="mr-2 h-4 w-4" />
          {loading ? t("submit.submitting") : t("submit.submit_btn")}
        </Button>
      </form>
    </div>
  );
}
