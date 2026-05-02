import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const SYSTEM_PROMPT = `Sen "Hokim AI" — Farg'ona viloyati hokimligining sun'iy intellekt yordamchisi. 
Foydalanuvchilarga hokimlik xizmatlari, murojaat tartibi, viloyat tuzilmasi, ijtimoiy xizmatlar, 
gaz/elektr/suv/yo'l/chiqindi muammolarini hal qilish yo'llari haqida o'zbek tilida (lotin yoki kirill)
yoki rus tilida do'stona, aniq va batafsil javob ber. Javoblaringni qisqa, tushunarli va foydali qilib
markdown formatida yoz. Agar foydalanuvchi murojaat qoldirmoqchi bo'lsa, "Murojaat yuborish" sahifasiga
o'tishni tavsiya qil.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages } = await req.json();
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
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return new Response(JSON.stringify({ error: txt }), {
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
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
