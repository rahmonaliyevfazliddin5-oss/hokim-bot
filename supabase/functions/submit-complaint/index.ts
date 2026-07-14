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

function ymdUTC(d: Date) {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

function randSuffix(len = 5): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function nextTrackingCode(): Promise<string> {
  const now = new Date();
  const ymd = ymdUTC(now);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)).toISOString();
  const { count } = await supabase.from("complaints")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start)
    .lte("created_at", end);
  const seq = String((count ?? 0) + 1).padStart(4, "0");
  // Random suffix prevents enumeration of citizen complaints via the public tracking endpoint.
  return `HOK-${ymd}-${seq}-${randSuffix(5)}`;
}

const ALLOWED_SEVERITY = new Set(["oddiy", "orta", "yuqori"]);
const ALLOWED_ROUTING = new Set(["mahalla", "hokimiyat"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const p = await req.json();

    if (
      !str(p.citizen_name, 2, 120) ||
      !str(p.citizen_phone, 7, 30) ||
      !str(p.text, 10, 2000) ||
      !Array.isArray(p.categories) ||
      p.categories.length === 0 ||
      p.categories.length > 10
    ) {
      return json({ error: "invalid_input" }, 400);
    }

    // Optional string fields — capped lengths
    const optStr = (v: unknown, max: number): string | null =>
      typeof v === "string" && v.length <= max ? v : null;

    const district = optStr(p.district, 120);
    const mahalla = optStr(p.mahalla, 200);
    const location = optStr(p.location, 500);

    // map_link must be a bounded https URL if provided
    let map_link: string | null = null;
    if (typeof p.map_link === "string" && p.map_link.length > 0 && p.map_link.length <= 500) {
      try {
        const u = new URL(p.map_link);
        if (u.protocol === "https:") map_link = u.toString();
      } catch { /* ignore invalid URL */ }
    }

    // Numeric ranges for coordinates
    const inRange = (v: unknown, min: number, max: number) =>
      typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
    const latitude = inRange(p.latitude, -90, 90) ? (p.latitude as number) : null;
    const longitude = inRange(p.longitude, -180, 180) ? (p.longitude as number) : null;

    // categories: bounded strings only
    const categories = p.categories
      .map((c: unknown) => String(c).slice(0, 60))
      .filter((c: string) => c.length > 0)
      .slice(0, 10);
    if (categories.length === 0) return json({ error: "invalid_input" }, 400);

    // category_details: array, max 20 entries, each stringified to ≤500 chars
    const category_details = Array.isArray(p.category_details)
      ? p.category_details.slice(0, 20).map((d: unknown) => {
          if (typeof d === "string") return d.slice(0, 500);
          if (d && typeof d === "object") {
            try { return JSON.parse(JSON.stringify(d)); } catch { return null; }
          }
          return null;
        }).filter((x: unknown) => x !== null)
      : [];

    // ai_response bounded, ai_analysis must be plain object with bounded serialized size
    const ai_response = typeof p.ai_response === "string" ? p.ai_response.slice(0, 2000) : null;
    let ai_analysis: unknown = null;
    if (p.ai_analysis && typeof p.ai_analysis === "object" && !Array.isArray(p.ai_analysis)) {
      try {
        const s = JSON.stringify(p.ai_analysis);
        if (s.length <= 4000) ai_analysis = p.ai_analysis;
      } catch { /* ignore */ }
    }

    const ai_confidence =
      typeof p.ai_confidence === "number" && Number.isFinite(p.ai_confidence)
        ? Math.max(0, Math.min(1, p.ai_confidence))
        : 0;

    const image_urls: string[] = Array.isArray(p.image_urls)
      ? p.image_urls
          .filter((u: unknown) => typeof u === "string" && (u as string).length <= 500)
          .slice(0, 5)
      : [];

    const severity = typeof p.severity === "string" && ALLOWED_SEVERITY.has(p.severity) ? p.severity : "oddiy";
    const routing_target = typeof p.routing_target === "string" && ALLOWED_ROUTING.has(p.routing_target) ? p.routing_target : "mahalla";
    const responsible_org = typeof p.responsible_org === "string" && p.responsible_org.length <= 200 ? p.responsible_org : null;
    const eta_days = typeof p.eta_days === "number" && p.eta_days >= 0 && p.eta_days <= 365 ? Math.floor(p.eta_days) : null;

    // Server-side canonical tracking code
    const tracking_code = await nextTrackingCode();

    // AI-decided initial status
    const initial_status = routing_target === "hokimiyat" ? "hokimiyatga_yuborildi" : "mahallaga_yuborildi";

    const row = {
      citizen_name: String(p.citizen_name).trim(),
      citizen_phone: String(p.citizen_phone).trim(),
      region: "fargona",
      district,
      mahalla,
      location,
      text: String(p.text).trim(),
      category: categories[0],
      categories,
      category_details,
      ai_confidence,
      ai_response,
      ai_analysis,
      severity,
      routing_target,
      responsible_org,
      eta_days,
      status: initial_status,
      tracking_code,
      latitude,
      longitude,
      map_link,
      image_urls,
    };

    const { data, error } = await supabase.from("complaints").insert(row).select("id, tracking_code").single();
    if (error) { console.error("db_error:", error); return json({ error: "internal_error" }, 500); }

    await supabase.from("activity_logs").insert({
      action: "complaint_created",
      details: `Code: ${row.tracking_code}, cats: ${row.categories.join(",")}, sev: ${severity}, route: ${routing_target}`,
      actor: row.citizen_name,
      complaint_id: data.id,
    });

    return json({
      ok: true,
      tracking_code: data.tracking_code,
      severity,
      routing_target,
      responsible_org,
      eta_days,
      status: initial_status,
    });
  } catch (e) {
    console.error("unhandled:", e); return json({ error: "internal_error" }, 500);
  }
});
