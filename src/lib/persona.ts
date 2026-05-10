import { Flame, Zap, Droplet, Trash2, Construction, Shield, Building2, HeartPulse, Scale, Bot, LucideIcon } from "lucide-react";
import gazImg from "@/assets/avatars/gaz.jpg";
import elektrImg from "@/assets/avatars/elektr.jpg";
import suvImg from "@/assets/avatars/suv.jpg";
import iibImg from "@/assets/avatars/iib.jpg";
import chiqindiImg from "@/assets/avatars/chiqindi.jpg";
import yolImg from "@/assets/avatars/yol.jpg";
import hokimImg from "@/assets/avatars/hokim.jpg";
import tibbiyImg from "@/assets/avatars/tibbiy.jpg";
import psixologImg from "@/assets/avatars/psixolog.jpg";
import huquqiyImg from "@/assets/avatars/huquqiy.jpg";

export type PersonaKey =
  | "gaz" | "elektr" | "suv" | "chiqindi" | "yo_l"
  | "iib" | "hokimlik" | "tibbiy" | "psixolog" | "huquqiy" | "default";

export type Gender = "male" | "female";

export interface Persona {
  key: PersonaKey;
  label: { uz: string; uz_cyrl: string; ru: string; en: string };
  icon: LucideIcon;
  bg: string;
  ring: string;
  text: string;
  hotline?: string;
  image?: string;
  /** Gender — drives TTS voice selection */
  gender: Gender;
  /** ElevenLabs voice IDs per language */
  voice: {
    uz: string;   // also used for uz_cyrl
    ru: string;
    en?: string;
  };
}

// Curated ElevenLabs voice IDs (multilingual_v2 supports uz/ru well)
// Male: George (warm, official), Brian (deep), Daniel (clear)
// Female: Sarah (warm), Alice (clear), Matilda (friendly)
const V_MALE   = { uz: "JBFqnCBsd6RMkjVDRZzb", ru: "JBFqnCBsd6RMkjVDRZzb", en: "JBFqnCBsd6RMkjVDRZzb" }; // George
const V_MALE2  = { uz: "nPczCjzI2devNBz1zQrb", ru: "nPczCjzI2devNBz1zQrb", en: "nPczCjzI2devNBz1zQrb" }; // Brian
const V_MALE3  = { uz: "onwK4e9ZLuTAKqWW03F9", ru: "onwK4e9ZLuTAKqWW03F9", en: "onwK4e9ZLuTAKqWW03F9" }; // Daniel
const V_FEM    = { uz: "EXAVITQu4vr4xnSDxMaL", ru: "EXAVITQu4vr4xnSDxMaL", en: "EXAVITQu4vr4xnSDxMaL" }; // Sarah
const V_FEM2   = { uz: "Xb7hH8MSUJpSbSDYk0k2", ru: "Xb7hH8MSUJpSbSDYk0k2", en: "Xb7hH8MSUJpSbSDYk0k2" }; // Alice
const V_FEM3   = { uz: "XrExE9yKIg1WjnnlVkGX", ru: "XrExE9yKIg1WjnnlVkGX", en: "XrExE9yKIg1WjnnlVkGX" }; // Matilda

export const PERSONAS: Record<PersonaKey, Persona> = {
  gaz: {
    key: "gaz",
    label: { uz: "Hududiy gaz ta'minoti xodimi", uz_cyrl: "Ҳудудий газ таъминоти ходими", ru: "Сотрудник газоснабжения", en: "Regional Gas Supply Officer" },
    icon: Flame, bg: "bg-orange-500/15", ring: "ring-orange-500/40", text: "text-orange-600", hotline: "104", image: gazImg,
  },
  elektr: {
    key: "elektr",
    label: { uz: "Elektr tarmoqlari xodimi", uz_cyrl: "Электр тармоқлари ходими", ru: "Сотрудник электросетей", en: "Power Grid Officer" },
    icon: Zap, bg: "bg-yellow-400/20", ring: "ring-yellow-500/40", text: "text-yellow-700", hotline: "1059", image: elektrImg,
  },
  suv: {
    key: "suv",
    label: { uz: "Suvoqova xodimi", uz_cyrl: "Сувоқова ходими", ru: "Сотрудник Водоканала", en: "Water Utility Officer" },
    icon: Droplet, bg: "bg-sky-500/15", ring: "ring-sky-500/40", text: "text-sky-600", hotline: "1063", image: suvImg,
  },
  chiqindi: {
    key: "chiqindi",
    label: { uz: "Kommunal xizmat xodimi", uz_cyrl: "Коммунал хизмат ходими", ru: "Сотрудник комм. службы", en: "Sanitation Officer" },
    icon: Trash2, bg: "bg-emerald-500/15", ring: "ring-emerald-500/40", text: "text-emerald-700", image: chiqindiImg,
  },
  yo_l: {
    key: "yo_l",
    label: { uz: "Yo'l-transport xodimi", uz_cyrl: "Йўл-транспорт ходими", ru: "Сотрудник дорожной службы", en: "Roads Dept. Officer" },
    icon: Construction, bg: "bg-amber-500/15", ring: "ring-amber-500/40", text: "text-amber-700", image: yolImg,
  },
  iib: {
    key: "iib",
    label: { uz: "IIB xodimi", uz_cyrl: "ИИБ ходими", ru: "Сотрудник ОВД", en: "Internal Affairs Officer" },
    icon: Shield, bg: "bg-blue-700/15", ring: "ring-blue-700/40", text: "text-blue-800", hotline: "102", image: iibImg,
  },
  hokimlik: {
    key: "hokimlik",
    label: { uz: "Hokimlik matbuot xizmati", uz_cyrl: "Ҳокимлик матбуот хизмати", ru: "Пресс-служба хокимията", en: "Khokimiyat Press Office" },
    icon: Building2, bg: "bg-primary/15", ring: "ring-primary/40", text: "text-primary", image: hokimImg,
  },
  tibbiy: {
    key: "tibbiy",
    label: { uz: "Tibbiy yo'naltirish", uz_cyrl: "Тиббий йўналтириш", ru: "Медицинская переадресация", en: "Medical Referral" },
    icon: HeartPulse, bg: "bg-red-500/15", ring: "ring-red-500/40", text: "text-red-600", hotline: "103", image: tibbiyImg,
  },
  psixolog: {
    key: "psixolog",
    label: { uz: "Ishonch telefoni", uz_cyrl: "Ишонч телефони", ru: "Телефон доверия", en: "Helpline" },
    icon: HeartPulse, bg: "bg-pink-500/15", ring: "ring-pink-500/40", text: "text-pink-600", hotline: "1086", image: psixologImg,
  },
  huquqiy: {
    key: "huquqiy",
    label: { uz: "Yuridik yo'naltirish", uz_cyrl: "Юридик йўналтириш", ru: "Юридическая переадресация", en: "Legal Referral" },
    icon: Scale, bg: "bg-indigo-500/15", ring: "ring-indigo-500/40", text: "text-indigo-700", image: huquqiyImg,
  },
  default: {
    key: "default",
    label: { uz: "Hokim AI yordamchisi", uz_cyrl: "Ҳоким AI ёрдамчиси", ru: "Помощник Хоким AI", en: "Hokim AI Assistant" },
    icon: Bot, bg: "bg-accent/15", ring: "ring-accent/40", text: "text-accent", image: hokimImg,
  },
};

const TOPIC_RULES: { key: PersonaKey; words: string[] }[] = [
  { key: "gaz", words: ["gaz", "газ", "gas", "metan", "балон", "ballon", "плита"] },
  { key: "elektr", words: ["elektr", "электр", "svet", "свет", "tok", "ток", "lampochka", "лампочка", "rozetka", "розетка", "naprajeniye", "напряжение", "электричество"] },
  { key: "suv", words: ["suv", "сув", "вода", "water", "kanalizatsiya", "канализация", "ariq", "vodokanal", "водоканал", "ichimlik"] },
  { key: "chiqindi", words: ["chiqindi", "axlat", "ахлат", "чиқинди", "мусор", "tozalash", "уборка", "musor"] },
  { key: "yo_l", words: ["yo'l", "yol", "yo‘l", "йўл", "дорог", "asfalt", "асфальт", "chuqur", "ko'cha", "kocha", "улица"] },
  { key: "iib", words: ["politsiya", "полиция", "iib", "ovd", "ичкии", "militsiya", "uchastkov"] },
  { key: "tibbiy", words: ["dori", "лекарств", "tabletka", "таблетк", "kasal", "болезн", "shifokor", "врач", "diagnoz", "диагноз", "dozasi", "дозировк", "retsept", "рецепт"] },
  { key: "psixolog", words: ["o'zimni", "ozimni", "suicid", "суицид", "o'lim", "olim", "depres", "депресс", "yashagim kelmayapti", "хочу умереть"] },
  { key: "huquqiy", words: ["sud", "суд", "advokat", "адвокат", "yurist", "юрист", "qonun", "закон", "huquqiy", "правов"] },
];

/** Detect persona from user text (fast client-side hint). */
export function detectPersona(text: string): PersonaKey {
  const lower = text.toLowerCase();
  for (const r of TOPIC_RULES) {
    if (r.words.some(w => lower.includes(w))) return r.key;
  }
  return "default";
}

/** Detect from assistant markdown response, e.g. "**👤 Hududiy gaz ta'minoti..."  */
export function detectPersonaFromAssistant(text: string): PersonaKey {
  const head = text.slice(0, 200).toLowerCase();
  if (/(gaz|газ|gas\b)/.test(head)) return "gaz";
  if (/(elektr|электр|svet|свет|power|tok\b|ток)/.test(head)) return "elektr";
  if (/(suv|сув|water|vodokanal|водокан)/.test(head)) return "suv";
  if (/(chiqindi|kommunal|коммунал|мусор|sanit)/.test(head)) return "chiqindi";
  if (/(yo'l|yol|йўл|дорог|road)/.test(head)) return "yo_l";
  if (/(iib|ичкии|police|полиц|внутренн)/.test(head)) return "iib";
  if (/(matbuot|пресс|press|hokimlik|ҳокимлик)/.test(head)) return "hokimlik";
  if (/(tibbiy|медиц|medic|103)/.test(head)) return "tibbiy";
  if (/(ishonch|довери|psix|психо|1086)/.test(head)) return "psixolog";
  if (/(yurid|юрид|advokat|адвокат|legal)/.test(head)) return "huquqiy";
  return "default";
}

export const SAFETY_REDIRECTS = {
  tibbiy: {
    uz: "⚠️ Tibbiy savollarga javob bera olmayman. Iltimos, **103 (Tez yordam)** ga qo'ng'iroq qiling yoki shifokoringizga murojaat qiling.",
    uz_cyrl: "⚠️ Тиббий саволларга жавоб бера олмайман. Илтимос, **103 (Тез ёрдам)** га қўнғироқ қилинг ёки шифокорингизга мурожаат қилинг.",
    ru: "⚠️ Я не отвечаю на медицинские вопросы. Пожалуйста, позвоните **103 (Скорая)** или обратитесь к врачу.",
  },
  psixolog: {
    uz: "💙 Sizga g'amxo'rlik qilamiz. Iltimos, **1086 (Ishonch telefoni)** ga qo'ng'iroq qiling — mutaxassis sizni tinglaydi va yordam beradi.",
    uz_cyrl: "💙 Сизга ғамхўрлик қиламиз. Илтимос, **1086 (Ишонч телефони)** га қўнғироқ қилинг — мутахассис сизни тинглайди.",
    ru: "💙 Мы заботимся о вас. Позвоните на **1086 (Телефон доверия)** — специалист выслушает и поможет.",
  },
  huquqiy: {
    uz: "⚖️ Huquqiy maslahat bera olmayman. Iltimos, **advokat** yoki Yuridik yordam markaziga murojaat qiling.",
    uz_cyrl: "⚖️ Ҳуқуқий маслаҳат бера олмайман. Илтимос, **адвокат**га ёки Юридик ёрдам марказига мурожаат қилинг.",
    ru: "⚖️ Я не даю юридических консультаций. Пожалуйста, обратитесь к **адвокату** или в центр юридической помощи.",
  },
} as const;

export function detectSafetyTopic(text: string): "tibbiy" | "psixolog" | "huquqiy" | null {
  const lower = text.toLowerCase();
  if (TOPIC_RULES.find(r => r.key === "psixolog")!.words.some(w => lower.includes(w))) return "psixolog";
  if (TOPIC_RULES.find(r => r.key === "tibbiy")!.words.some(w => lower.includes(w))) return "tibbiy";
  if (TOPIC_RULES.find(r => r.key === "huquqiy")!.words.some(w => lower.includes(w))) return "huquqiy";
  return null;
}
