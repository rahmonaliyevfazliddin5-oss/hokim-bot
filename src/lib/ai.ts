// Simple keyword-based AI classifier (MVP). Extendable to real NLP later.
export type Category = "gaz" | "elektr" | "suv" | "chiqindi" | "yo_l" | "boshqa";

const RULES: { cat: Category; keywords: string[] }[] = [
  { cat: "gaz", keywords: ["gaz", "газ", "gas"] },
  { cat: "elektr", keywords: ["elektr", "svet", "tok", "электр", "свет", "ток", "электричество"] },
  { cat: "suv", keywords: ["suv", "сув", "вода", "water"] },
  { cat: "chiqindi", keywords: ["chiqindi", "axlat", "ахлат", "чиқинди", "мусор"] },
  { cat: "yo_l", keywords: ["yo'l", "yol", "yo‘l", "йўл", "дорог", "asfalt", "асфальт"] },
];

export function classify(text: string): { category: Category; confidence: number } {
  const lower = text.toLowerCase();
  let best: { category: Category; confidence: number } = { category: "boshqa", confidence: 0.3 };
  for (const r of RULES) {
    const hits = r.keywords.filter(k => lower.includes(k.toLowerCase())).length;
    if (hits > 0) {
      const conf = Math.min(0.95, 0.6 + hits * 0.15);
      if (conf > best.confidence) best = { category: r.cat, confidence: conf };
    }
  }
  return best;
}

export function generateTrackingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `HK-${s}`;
}

export function autoResponse(category: Category): string {
  const map: Record<Category, string> = {
    gaz: "Murojaatingiz gaz ta'minoti bo'limiga yo'naltirildi.",
    elektr: "Murojaatingiz elektr tarmog'i bo'limiga yo'naltirildi.",
    suv: "Murojaatingiz suv ta'minoti xizmatiga yo'naltirildi.",
    chiqindi: "Murojaatingiz kommunal xizmat ko'rsatish bo'limiga yo'naltirildi.",
    yo_l: "Murojaatingiz yo'l-transport bo'limiga yo'naltirildi.",
    boshqa: "Murojaatingiz operator tomonidan ko'rib chiqiladi.",
  };
  return map[category];
}
