// Multi-category keyword classifier + full severity/routing/ETA analysis.
import { FARGONA_TUMAN_MAHALLAS } from "@/lib/fargona";

export type Category = "gaz" | "elektr" | "suv" | "chiqindi" | "yo_l" | "boshqa";
export type Severity = "oddiy" | "orta" | "yuqori";
export type Routing = "mahalla" | "hokimiyat";

const RULES: { cat: Category; keywords: string[] }[] = [
  { cat: "gaz", keywords: ["gaz", "газ", "gas", "metan"] },
  { cat: "elektr", keywords: ["elektr", "svet", "tok", "электр", "свет", "ток", "электричество", "lampochka", "rozetka", "naprajeniye", "chirog", "чироқ", "фонар"] },
  { cat: "suv", keywords: ["suv", "сув", "вода", "water", "kanalizatsiya", "канализация", "ariq", "ичимлик"] },
  { cat: "chiqindi", keywords: ["chiqindi", "axlat", "ахлат", "чиқинди", "мусор", "tozalash", "musor"] },
  { cat: "yo_l", keywords: ["yo'l", "yol", "yo‘l", "йўл", "дорог", "asfalt", "асфальт", "chuqur", "ko'cha", "kocha", "кўча"] },
];

export interface CategoryDetail {
  category: Category;
  confidence: number;
  hits: string[];
}

export function classifyMulti(text: string): CategoryDetail[] {
  const lower = text.toLowerCase();
  const out: CategoryDetail[] = [];
  for (const r of RULES) {
    const hits = r.keywords.filter((k) => lower.includes(k.toLowerCase()));
    if (hits.length > 0) {
      out.push({
        category: r.cat,
        confidence: Math.min(0.97, 0.6 + hits.length * 0.12),
        hits,
      });
    }
  }
  if (out.length === 0) {
    out.push({ category: "boshqa", confidence: 0.4, hits: [] });
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

export function classify(text: string): { category: Category; confidence: number } {
  const m = classifyMulti(text);
  return { category: m[0].category, confidence: m[0].confidence };
}

// New tracking code: HOK-YYYYMMDD-XXXX (fallback random when server sequence isn't available)
export function generateTrackingCode(): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `HOK-${ymd}-${rand}`;
}

// ---- Responsible orgs ----
const ORG_MAP: Record<Category, string> = {
  gaz: "Hududiy gaz ta'minoti bo'limi",
  elektr: "Elektr tarmoqlari korxonasi",
  suv: "Suv ta'minoti xizmati (Suvokova)",
  chiqindi: "Kommunal xizmat / MFY",
  yo_l: "Yo'l qurilishi va ta'mirlash bo'limi",
  boshqa: "Farg'ona tumani hokimligi kotibiyati",
};

export function responsibleOrg(cats: CategoryDetail[], routing: Routing): string {
  if (routing === "mahalla") return "Mahalla fuqarolar yig'ini (MFY)";
  const c = cats[0]?.category ?? "boshqa";
  return ORG_MAP[c];
}

// ---- Severity + routing decision ----
const HOKIMIYAT_KEYWORDS = [
  "qurilish", "қурилиш", "строительств",
  "loyiha", "лойиҳа", "проект",
  "kapital", "капитал", "капитальн",
  "byudjet", "бюджет",
  "yangi bino", "yangi maktab", "yangi shifoxona", "yangi kasalxona",
  "asosiy yo'l", "asosiy yol", "магистрал",
  "ish bilan ta'minl", "иш билан", "трудоустрой",
  "tadbirkor", "тадбиркор", "инвест",
  "avariya", "авария", "portlash", "yong'in", "ёнғин",
];

// If ONLY these categories are present, and no hokimiyat keywords → mahalla.
const PURE_MAHALLA_CATS: Category[] = ["chiqindi"];

// Mahalla can typically handle a single lightbulb/small road fix (severity oddiy).
const MAHALLA_LIGHT_KEYWORDS = [
  "chirog", "чироқ", "фонар", "lampochka", "chirogi",
  "obodonlashtir", "обод", "daraxt", "gul",
  "kichik", "ichki yo'l", "ichki yol",
];

export interface AiAnalysis {
  categories: CategoryDetail[];
  severity: Severity;
  routing: Routing;
  responsible_org: string;
  eta_days: number;
  eta_label: string;
  detected_mahalla: string | null;
  summary: string;
  ai_response: string;
}

function detectMahalla(text: string): string | null {
  const lower = text.toLowerCase();
  for (const m of FARGONA_TUMAN_MAHALLAS) {
    const needle = m.toLowerCase().replace(/[ʻ'`]/g, "");
    const hay = lower.replace(/[ʻ'`]/g, "");
    if (needle.length >= 4 && hay.includes(needle)) return m;
  }
  return null;
}

function severityFor(cats: CategoryDetail[], text: string): Severity {
  const lower = text.toLowerCase();
  if (HOKIMIYAT_KEYWORDS.some((k) => lower.includes(k))) return "yuqori";
  const heavy: Category[] = ["gaz", "elektr", "suv", "yo_l"];
  const heavyHit = cats.some((c) => heavy.includes(c.category));
  const lightHit = MAHALLA_LIGHT_KEYWORDS.some((k) => lower.includes(k));
  if (heavyHit && !lightHit) return "orta";
  if (heavyHit && lightHit) return "oddiy";
  return "oddiy";
}

function routingFor(cats: CategoryDetail[], severity: Severity, text: string): Routing {
  const lower = text.toLowerCase();
  if (HOKIMIYAT_KEYWORDS.some((k) => lower.includes(k))) return "hokimiyat";
  if (severity === "yuqori") return "hokimiyat";
  if (cats.every((c) => PURE_MAHALLA_CATS.includes(c.category))) return "mahalla";
  // Mahalla-level light infra (broken streetlight, small road)
  if (severity === "oddiy" && MAHALLA_LIGHT_KEYWORDS.some((k) => lower.includes(k))) return "mahalla";
  if (severity === "orta") return "hokimiyat";
  return "mahalla";
}

function etaForSeverity(s: Severity): { days: number; label: string } {
  if (s === "oddiy") return { days: 5, label: "3–7 kun" };
  if (s === "orta") return { days: 21, label: "7–30 kun" };
  return { days: 45, label: "30+ kun" };
}

const CAT_LABELS: Record<Category, string> = {
  gaz: "Gaz ta'minoti",
  elektr: "Elektr ta'minoti",
  suv: "Suv ta'minoti",
  chiqindi: "Chiqindi / tozalik",
  yo_l: "Yo'l infratuzilmasi",
  boshqa: "Umumiy murojaat",
};

export function analyze(text: string, providedMahalla?: string | null): AiAnalysis {
  const cats = classifyMulti(text);
  const severity = severityFor(cats, text);
  const routing = routingFor(cats, severity, text);
  const org = responsibleOrg(cats, routing);
  const eta = etaForSeverity(severity);
  const detected_mahalla = providedMahalla || detectMahalla(text);

  const catLabel = cats.map((c) => CAT_LABELS[c.category]).join(" + ");
  const targetLabel = routing === "mahalla"
    ? (detected_mahalla ? `${detected_mahalla} MFY paneliga` : "tegishli MFY paneliga")
    : "Farg'ona tumani hokimligi paneliga";
  const sevLabel = severity === "yuqori" ? "yuqori" : severity === "orta" ? "o'rta" : "oddiy";
  const summary = `${catLabel} bo'yicha ${sevLabel} darajali murojaat. ${targetLabel} yo'naltirildi. Mas'ul: ${org}. Taxminiy muddat: ${eta.label}.`;

  return {
    categories: cats,
    severity,
    routing,
    responsible_org: org,
    eta_days: eta.days,
    eta_label: eta.label,
    detected_mahalla,
    summary,
    ai_response: summary,
  };
}

// ---- Backward-compat helpers ----
const RESP_MAP: Record<Category, string> = {
  gaz: "Gaz ta'minoti bo'limiga yo'naltiriladi.",
  elektr: "Elektr tarmog'i bo'limiga yo'naltiriladi.",
  suv: "Suv ta'minoti xizmatiga yo'naltiriladi.",
  chiqindi: "Kommunal xizmat ko'rsatish bo'limiga yo'naltiriladi.",
  yo_l: "Yo'l-transport bo'limiga yo'naltiriladi.",
  boshqa: "Operator tomonidan ko'rib chiqiladi.",
};

export function autoResponse(category: Category): string {
  return RESP_MAP[category];
}

export function autoResponseMulti(cats: CategoryDetail[]): string {
  if (cats.length === 0) return RESP_MAP.boshqa;
  if (cats.length === 1) return RESP_MAP[cats[0].category];
  const labels = cats.map((c) => RESP_MAP[c.category].replace(" yo'naltiriladi.", ""));
  return `Murojaatingiz quyidagi bo'limlarga yo'naltirildi: ${labels.join(", ")}.`;
}

// Legacy escalation (kept for chat/history compat)
export type EscalationLevel = "mahalla" | "mahalla_org" | "mahalla_org_hokimiyat";
export function computeEscalation(text: string, cats: CategoryDetail[]): EscalationLevel {
  const lower = text.toLowerCase();
  if (HOKIMIYAT_KEYWORDS.some((k) => lower.includes(k))) return "mahalla_org_hokimiyat";
  const ORG_CATS: Category[] = ["gaz", "elektr", "suv", "yo_l"];
  if (cats.some((c) => ORG_CATS.includes(c.category))) return "mahalla_org";
  return "mahalla";
}
export function escalationLabel(l: EscalationLevel): string {
  if (l === "mahalla") return "Mahalla darajasi";
  if (l === "mahalla_org") return "Mahalla + tashkilot";
  return "Mahalla + tashkilot + Hokimiyat";
}
