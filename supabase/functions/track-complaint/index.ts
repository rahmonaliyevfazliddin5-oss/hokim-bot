import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "complaint-images";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function toPath(v: string): string {
  const marker = `/${BUCKET}/`;
  const idx = v.indexOf(marker);
  return idx >= 0 ? v.slice(idx + marker.length) : v;
}

async function signImages(urls: string[] | null | undefined): Promise<string[]> {
  if (!urls || urls.length === 0) return [];
  const out: string[] = [];
  for (const u of urls) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(toPath(u), 3600);
    if (data?.signedUrl) out.push(data.signedUrl);
  }
  return out;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { tracking_code } = await req.json();
    if (typeof tracking_code !== "string" || tracking_code.trim().length < 3 || tracking_code.length > 40) {
      return json({ error: "invalid_code" }, 400);
    }

    const { data, error } = await supabase
      .from("complaints")
      .select(
        "id, tracking_code, status, category, categories, category_details, text, ai_response, ai_analysis, severity, routing_target, responsible_org, eta_days, admin_notes, location, district, mahalla, map_link, image_urls, created_at, updated_at",
      )
      .eq("tracking_code", tracking_code.trim().toUpperCase())
      .maybeSingle();

    if (error) { console.error("db_error:", error); return json({ error: "internal_error" }, 500); }
    if (!data) return json({ complaint: null });

    // Fetch timeline (activity_logs) for this complaint — sanitized: only action/details/created_at
    const { data: logs } = await supabase
      .from("activity_logs")
      .select("action, details, created_at")
      .eq("complaint_id", data.id)
      .order("created_at", { ascending: true });

    // Strip internal fields (IP addresses, actor identifiers) from public timeline details.
    const sanitizeDetails = (s: string | null): string | null => {
      if (!s) return s;
      return s
        .split("|")
        .map((seg) => seg.trim())
        .filter((seg) => {
          const k = seg.split("=")[0]?.toLowerCase() ?? "";
          return k !== "ip" && k !== "actor" && k !== "user_agent" && k !== "ua";
        })
        .join(" | ");
    };
    const timeline = (logs ?? []).map((l: any) => ({
      action: l.action,
      details: sanitizeDetails(l.details),
      created_at: l.created_at,
    }));

    const { id: _hidden, ...safe } = data as any;
    const complaint = { ...safe, image_urls: await signImages(data.image_urls), timeline };
    return json({ complaint });
  } catch (e) {
    console.error("unhandled:", e); return json({ error: "internal_error" }, 500);
  }
});
