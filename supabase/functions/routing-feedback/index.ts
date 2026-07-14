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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { tracking_code, verdict } = await req.json();
    if (typeof tracking_code !== "string" || !/^HOK-\d{8}-\d{3,5}$/i.test(tracking_code.trim())) {
      return json({ error: "invalid_code" }, 400);
    }
    if (verdict !== "correct" && verdict !== "incorrect") {
      return json({ error: "invalid_verdict" }, 400);
    }
    const code = tracking_code.trim().toUpperCase();
    const { data: c } = await supabase.from("complaints").select("id").eq("tracking_code", code).maybeSingle();
    if (!c) return json({ error: "not_found" }, 404);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

    // De-dupe: one feedback per code+ip
    const { data: prev } = await supabase.from("activity_logs")
      .select("id").eq("complaint_id", c.id).eq("action", "routing_feedback")
      .ilike("details", `%|ip=${ip}%`).limit(1);
    if (prev && prev.length > 0) return json({ error: "already_submitted" }, 409);

    await supabase.from("activity_logs").insert({
      complaint_id: c.id,
      action: "routing_feedback",
      actor: "citizen",
      details: `verdict=${verdict}|ip=${ip}`,
    });
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
