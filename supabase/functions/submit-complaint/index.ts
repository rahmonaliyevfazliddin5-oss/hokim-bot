import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const str = (v: unknown, min: number, max: number) =>
  typeof v === "string" && v.trim().length >= min && v.trim().length <= max;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const p = await req.json();

    if (
      !str(p.citizen_name, 2, 120) ||
      !str(p.citizen_phone, 7, 30) ||
      !str(p.text, 10, 2000) ||
      !str(p.tracking_code, 3, 40) ||
      !Array.isArray(p.categories) ||
      p.categories.length === 0
    ) {
      return json({ error: "invalid_input" }, 400);
    }

    const image_urls: string[] = Array.isArray(p.image_urls)
      ? p.image_urls.filter((u: unknown) => typeof u === "string").slice(0, 5)
      : [];

    const row = {
      citizen_name: String(p.citizen_name).trim(),
      citizen_phone: String(p.citizen_phone).trim(),
      region: "fargona",
      district: typeof p.district === "string" ? p.district : null,
      mahalla: typeof p.mahalla === "string" ? p.mahalla : null,
      location: typeof p.location === "string" ? p.location : null,
      text: String(p.text).trim(),
      category: String(p.categories[0]),
      categories: p.categories.map((c: unknown) => String(c)),
      category_details: p.category_details ?? [],
      ai_confidence: typeof p.ai_confidence === "number" ? p.ai_confidence : 0,
      ai_response: typeof p.ai_response === "string" ? p.ai_response : null,
      tracking_code: String(p.tracking_code).trim().toUpperCase(),
      latitude: typeof p.latitude === "number" ? p.latitude : null,
      longitude: typeof p.longitude === "number" ? p.longitude : null,
      map_link: typeof p.map_link === "string" ? p.map_link : null,
      image_urls,
    };

    const { data, error } = await supabase.from("complaints").insert(row).select("id, tracking_code").single();
    if (error) return json({ error: error.message }, 500);

    await supabase.from("activity_logs").insert({
      action: "complaint_created",
      details: `Code: ${row.tracking_code}, cats: ${row.categories.join(",")}`,
      actor: row.citizen_name,
      complaint_id: data.id,
    });

    return json({ ok: true, tracking_code: data.tracking_code });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
