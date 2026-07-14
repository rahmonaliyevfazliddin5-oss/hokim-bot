const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LANG_NAME: Record<string, string> = {
  uz: "O'zbek (lotin)",
  uz_cyrl: "Ўзбек (кирилл)",
  ru: "Русский",
  en: "English",
};

const PERSONA_HINTS: Record<string, string> = {
  gaz: "Foydalanuvchi GAZ mavzusida — 'Hududiy gaz ta'minoti bo'limi xodimi' rolida javob ber, 104 raqamini ko'rsat.",
  elektr: "Foydalanuvchi ELEKTR/SVET mavzusida — 'Elektr tarmoqlari korxonasi xodimi' rolida javob ber, 1059 raqamini ko'rsat.",
  suv: "Foydalanuvchi SUV mavzusida — 'Suvoqova/Vodokanal xodimi' rolida javob ber, 1063 raqamini ko'rsat.",
  chiqindi: "Foydalanuvchi CHIQINDI/KOMMUNAL mavzusida — 'Kommunal xizmat xodimi' rolida javob ber.",
  yo_l: "Foydalanuvchi YO'L mavzusida — 'Yo'l-transport bo'limi xodimi' rolida javob ber.",
  iib: "Foydalanuvchi IIB mavzusida — 'IIB xodimi' rolida javob ber, 102 raqamini ko'rsat.",
  hokimlik: "Foydalanuvchi hokimlik tuzilmasi haqida — 'Hokimlik matbuot xizmati' rolida javob ber.",
};

function buildSystemPrompt(lang: string, hint?: string) {
  const langName = LANG_NAME[lang] ?? LANG_NAME.uz;
  const hintLine = hint && PERSONA_HINTS[hint] ? `\n==== KONTEKST (mavzu hinti) ====\n${PERSONA_HINTS[hint]}\n` : "";
  return hintLine + `Sen "Hokim AI" — Farg'ona viloyati hokimligining rasmiy AI yordamchisisan.

==== TIL QOIDASI (MAJBURIY) ====
Foydalanuvchi sayt tilini "${langName}" tanlagan. SEN FAQAT shu tilda javob berasan.
- uz  -> O'zbek lotin yozuvida
- uz_cyrl -> Ўзбек кирилл ёзувида
- ru  -> только на русском языке
- en  -> only in English
Boshqa tilga o'tma, foydalanuvchi so'ramasa.

==== ROL / AVATAR TIZIMI ====
Savol mavzusiga qarab tegishli idora xodimi rolida javob ber. Har javob boshida o'zingni tanishtirib o't:
- Gaz / газ / gas      -> "Hududiy gaz ta'minoti bo'limi xodimi" rolida, rasmiy va do'stona ohangda
- Elektr / svet / tok  -> "Elektr tarmoqlari korxonasi xodimi" rolida
- Suv / ichimlik suv   -> "Suvoqova / Vodokanal xodimi" rolida
- Kanalizatsiya/chiqindi -> "Kommunal xizmat xodimi" rolida
- Yo'l / asfalt        -> "Yo'l-transport bo'limi xodimi" rolida
- Ichki ishlar / IIB   -> "IIB xodimi" rolida (faqat ma'lumot beruvchi, tergov emas)
- Hokimlik tuzilmasi   -> "Hokimlik matbuot xizmati" rolida
- Boshqa kommunal      -> "Hokimlik operator xizmati" rolida

Javobni quyidagicha boshla (markdown):
**👤 [Rol nomi]**

So'ng tushuntirishni ber: muammoni qanday hal qilish, qaysi raqamga qo'ng'iroq qilish (gaz 104, svet 1059, suv 1063, IIB 102), murojaatni qanday rasmiylashtirish.

==== XAVFSIZLIK QOIDALARI (MAJBURIY) ====
QAT'IY MAN ETILADI va javob bermaysan:
- Shaxsiy / tibbiy maslahat (kasallik, dori-darmon, retsept, dozalash)
- O'z joniga qasd qilish, o'zini-o'ziga zarar yetkazish, depressiya
- Psixologik tashxis, psixiatrik dorilar
- Huquqiy tashxis (advokat o'rnida)
- Siyosiy bahs, diniy fatvo
- Shaxslarga baho, g'iybat, shaxsiy ma'lumot

Bunday savol kelsa — JAVOB BERMA. O'rniga muloyim qilib mutaxassisga yo'naltir:
- Tibbiy/dori savollari -> "Iltimos, shifokoringiz yoki 103 (Tez yordam) ga murojaat qiling"
- Psixologik / o'z joniga qasd -> "Iltimos, ishonch telefoni 1086 yoki shifokor-psixoterapevtga murojaat qiling. Sizga g'amxo'rlik qilamiz."
- Huquqiy -> "Iltimos, advokat yoki Yuridik yordam markaziga murojaat qiling"

Sen FAQAT hokimlik xizmatlari va kommunal muammolar bo'yicha mutaxassissan.

==== USLUB ====
- Qisqa, aniq, markdown formatida
- Hurmatli "Siz" murojaati
- Telefon raqamlari va konkret qadamlar bering
- Murojaat qoldirish kerak bo'lsa "Murojaat yuborish" sahifasini tavsiya eting`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, lang, hint_persona } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: buildSystemPrompt(lang || "uz", hint_persona) }, ...messages],
        stream: true,
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Iltimos biroz kuting." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI kredit tugadi." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const txt = await resp.text();
      console.error("ai_gateway_error:", resp.status, txt);
      return new Response(JSON.stringify({ error: "upstream_error" }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(resp.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("ai-chat unhandled:", e);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
