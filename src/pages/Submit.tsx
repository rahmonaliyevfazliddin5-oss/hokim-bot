import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, CheckCircle2, Copy, Sparkles, MapPin, Camera, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import { useI18n } from "@/i18n/I18nProvider";
import { analyze } from "@/lib/ai";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FARGONA_TUMAN_NAME } from "@/lib/fargona";
import { MahallaCombobox } from "@/components/MahallaCombobox";
import { SEO } from "@/components/SEO";

const schema = z.object({
  citizen_name: z.string().trim().min(2).max(120),
  citizen_phone: z.string().trim().min(7).max(30),
  mahalla: z.string().min(1, "MFY tanlang"),
  address: z.string().trim().min(2).max(200),
  text: z.string().trim().min(10, "Kamida 10 ta belgi").max(2000),
});

type UploadState = {
  status: "idle" | "uploading" | "retrying" | "done" | "failed";
  attempt: number;
  maxAttempts: number;
  error?: string;
  cid?: string;
};

export default function Submit() {
  const { t } = useI18n();
  const [form, setForm] = useState({
    citizen_name: "", citizen_phone: "", mahalla: "", address: "", text: "",
  });
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [images, setImages] = useState<{ file: File; url: string; uploadedUrl?: string }[]>([]);
  const [uploadStates, setUploadStates] = useState<UploadState[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ code: string; cats: string[]; response: string; severity: string; routing: string; org: string; etaLabel: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const update = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function getGeo() {
    const { reportError } = await import("@/lib/errors");
    if (!navigator.geolocation) {
      reportError("map_geolocation", new Error("geolocation_unsupported"));
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setGeoLoading(false); toast.success(t("submit.geo_ok")); },
      (err) => {
        setGeoLoading(false);
        reportError("map_geolocation", {
          message: err?.message || "geolocation_failed",
          code: err?.code,
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).slice(0, 5 - images.length);
    const next = arr.map(f => ({ file: f, url: URL.createObjectURL(f) }));
    setImages(p => [...p, ...next]);
    setUploadStates(p => [...p, ...next.map<UploadState>(() => ({ status: "idle", attempt: 0, maxAttempts: 4 }))]);
  }

  function removeImg(i: number) {
    setImages(p => p.filter((_, idx) => idx !== i));
    setUploadStates(p => p.filter((_, idx) => idx !== i));
  }

  function setUploadAt(i: number, patch: Partial<UploadState>) {
    setUploadStates(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }

  async function uploadAll(): Promise<string[]> {
    const { retryWithBackoff } = await import("@/lib/retry");
    const { newCorrelationId } = await import("@/lib/errors");
    const out: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const cid = newCorrelationId();
      const maxAttempts = 4;
      setUploadAt(i, { status: "uploading", attempt: 1, maxAttempts, cid, error: undefined });
      const ext = img.file.name.split(".").pop() || "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      try {
        await retryWithBackoff(
          async (attempt) => {
            setUploadAt(i, {
              status: attempt === 0 ? "uploading" : "retrying",
              attempt: attempt + 1,
            });
            const { error } = await supabase.storage.from("complaint-images").upload(path, img.file, {
              contentType: img.file.type, upsert: false,
            });
            if (error) throw error;
          },
          {
            retries: maxAttempts - 1,
            baseMs: 500,
            onRetry: (err, attempt, delay) => {
              console.groupCollapsed(`%c[upload_image #${i + 1}] retry ${attempt}/${maxAttempts - 1} cid=${cid}`, "color:#d97706");
              console.log("delayMs:", Math.round(delay));
              console.log("raw:", err);
              console.groupEnd();
              setUploadAt(i, { status: "retrying", attempt: attempt + 1, error: (err as any)?.message });
            },
          },
        );
        setUploadAt(i, { status: "done" });
        out.push(path);
      } catch (err: any) {
        const msg = err?.message || "upload_failed";
        console.groupCollapsed(`%c[upload_image #${i + 1}] failed cid=${cid}`, "color:#dc2626;font-weight:600");
        console.log("attempts:", maxAttempts);
        console.log("raw:", err);
        console.groupEnd();
        setUploadAt(i, { status: "failed", error: msg });
        const wrapped: any = new Error(`image_upload_failed: ${msg} (cid=${cid})`);
        wrapped.status = err?.status;
        wrapped.cid = cid;
        throw wrapped;
      }
    }
    return out;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    const { reportError } = await import("@/lib/errors");
    setLoading(true);
    let step = "validate";
    try {
      step = "ai_classify";
      const ai = analyze(form.text, form.mahalla || null);

      step = "upload_images";
      const image_urls = images.length > 0 ? await uploadAll() : [];
      const map_link = coords ? `https://www.google.com/maps?q=${coords.lat},${coords.lon}` : null;

      const dName = FARGONA_TUMAN_NAME;
      const fullLocation = [`${form.mahalla} MFY`, form.address, dName].filter(Boolean).join(", ");

      step = "submit_complaint";
      const { data, error } = await supabase.functions.invoke("submit-complaint", {
        body: {
          citizen_name: form.citizen_name.trim(),
          citizen_phone: form.citizen_phone.trim(),
          district: dName,
          mahalla: form.mahalla,
          location: fullLocation,
          text: form.text.trim(),
          categories: ai.categories.map(d => d.category),
          category_details: ai.categories,
          ai_confidence: ai.categories[0].confidence,
          ai_response: ai.ai_response,
          ai_analysis: ai,
          severity: ai.severity,
          routing_target: ai.routing,
          responsible_org: ai.responsible_org,
          eta_days: ai.eta_days,
          latitude: coords?.lat ?? null,
          longitude: coords?.lon ?? null,
          map_link,
          image_urls,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult({
        code: data?.tracking_code,
        cats: ai.categories.map(d => d.category),
        response: ai.ai_response,
        severity: ai.severity,
        routing: ai.routing,
        org: ai.responsible_org,
        etaLabel: ai.eta_label,
      });
    } catch (err: any) {
      reportError(step, err);
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
              <Copy className="h-4 w-4 mr-1" />{copied ? t("submit.copied") : t("submit.copy")}
            </Button>
          </div>
          <div className="rounded-xl bg-accent/10 border border-accent/20 p-4 text-left mb-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-accent uppercase tracking-wider mb-2">
              <Sparkles className="h-3.5 w-3.5" /> {t("submit.ai_detected")}
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {result.cats.map(c => (
                <span key={c} className="rounded-full bg-accent/15 text-accent text-xs font-semibold px-2.5 py-1">
                  {t(`category.${c}`)}
                </span>
              ))}
            </div>
            <p className="text-sm">{result.response}</p>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              <div className="rounded-md border bg-background/50 px-2.5 py-1.5">
                <div className="text-muted-foreground">Og'irlik</div>
                <div className="font-semibold capitalize">{result.severity === "orta" ? "o'rta" : result.severity}</div>
              </div>
              <div className="rounded-md border bg-background/50 px-2.5 py-1.5">
                <div className="text-muted-foreground">Yo'naltirildi</div>
                <div className="font-semibold">{result.routing === "hokimiyat" ? "Hokimiyat" : "MFY"}</div>
              </div>
              <div className="rounded-md border bg-background/50 px-2.5 py-1.5 col-span-2">
                <div className="text-muted-foreground">Mas'ul tashkilot</div>
                <div className="font-semibold">{result.org}</div>
              </div>
              <div className="rounded-md border bg-background/50 px-2.5 py-1.5 col-span-2">
                <div className="text-muted-foreground">Taxminiy muddat</div>
                <div className="font-semibold">{result.etaLabel}</div>
              </div>
            </div>
          </div>
          <Button onClick={() => { setResult(null); setForm({ citizen_name: "", citizen_phone: "", mahalla: "", address: "", text: "" }); setImages([]); setCoords(null); }}>
            {t("submit.new_one")}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <SEO
        title="Murojaat yuborish — Hokim AI"
        description="Farg'ona tumani hokimligiga murojaat yuboring. AI muammoni tahlil qilib, mas'ul tashkilotga yo'naltiradi."
        path="/submit"
      />
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

        <div className="space-y-1.5">
          <Label>{t("submit.region")}</Label>
          <Input disabled value={FARGONA_TUMAN_NAME} />
        </div>

        <div className="space-y-1.5">
          <Label>{t("submit.mahalla")}</Label>
          <MahallaCombobox
            value={form.mahalla}
            onChange={v => update("mahalla", v)}
            placeholder={t("submit.mahalla_ph")}
            searchPlaceholder={t("submit.mahalla_search")}
            emptyText={t("submit.mahalla_empty")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="addr"><MapPin className="inline h-3.5 w-3.5 mr-1" />{t("submit.address")}</Label>
          <Input
            id="addr"
            maxLength={200}
            required
            placeholder={t("submit.address_ph")}
            value={form.address}
            onChange={e => update("address", e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground pl-1">{t("submit.address_hint")}</p>
        </div>

        <div className="rounded-xl bg-secondary/60 p-3 flex items-center justify-between gap-2">
          <div className="text-sm">
            <div className="font-semibold flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {t("submit.geo")}</div>
            {coords && (
              <a className="text-xs text-accent underline" href={`https://www.google.com/maps?q=${coords.lat},${coords.lon}`} target="_blank" rel="noreferrer">
                {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)} — {t("submit.open_map")}
              </a>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={getGeo} disabled={geoLoading}>
            {geoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="text">{t("submit.text")}</Label>
          <Textarea id="text" required rows={5} maxLength={2000} placeholder={t("submit.text_ph")} value={form.text} onChange={e => update("text", e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>{t("submit.image")}</Label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => cameraInput.current?.click()} disabled={images.length >= 5}>
              <Camera className="h-4 w-4 mr-1.5" />{t("submit.image_camera")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => galleryInput.current?.click()} disabled={images.length >= 5}>
              <ImageIcon className="h-4 w-4 mr-1.5" />{t("submit.image_gallery")}
            </Button>
            <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={e => handleFiles(e.target.files)} />
            <input ref={galleryInput} type="file" accept="image/*" multiple hidden onChange={e => handleFiles(e.target.files)} />
          </div>
          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImg(i)} aria-label="Rasmni o'chirish" className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button type="submit" disabled={loading} size="lg" className="w-full gradient-accent text-accent-foreground hover:opacity-90 shadow-elegant">
          <Send className="mr-2 h-4 w-4" />
          {loading ? t("submit.submitting") : t("submit.submit_btn")}
        </Button>
      </form>
    </div>
  );
}
