// Multi-category keyword classifier. Detects ALL relevant categories in text.
export type Category = "gaz" | "elektr" | "suv" | "chiqindi" | "yo_l" | "boshqa";

const RULES: { cat: Category; keywords: string[] }[] = [
  { cat: "gaz", keywords: ["gaz", "газ", "gas", "metan"] },
  { cat: "elektr", keywords: ["elektr", "svet", "tok", "электр", "свет", "ток", "электричество", "lampochka", "rozetka", "naprajeniye"] },
  { cat: "suv", keywords: ["suv", "сув", "вода", "water", "kanalizatsiya", "канализация", "ariq"] },
  { cat: "chiqindi", keywords: ["chiqindi", "axlat", "ахлат", "чиқинди", "мусор", "tozalash"] },
  { cat: "yo_l", keywords: ["yo'l", "yol", "yo‘l", "йўл", "дорог", "asfalt", "асфальт", "chuqur", "ko'cha", "kocha"] },
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
  // Sort by confidence
  return out.sort((a, b) => b.confidence - a.confidence);
}

export function classify(text: string): { category: Category; confidence: number } {
  const m = classifyMulti(text);
  return { category: m[0].category, confidence: m[0].confidence };
}

export function generateTrackingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `HK-${s}`;
}

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
