import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const allowedOrigins = new Set([
  "https://dolphin-abi-pool.gerayeli60.chatgpt.site",
  "http://localhost:3000",
  "http://localhost:3001",
]);

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://dolphin-abi-pool.gerayeli60.chatgpt.site",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const authHeader = req.headers.get("Authorization");
  if (req.method !== "POST" || !authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors(req) });
  }
  const origin = req.headers.get("origin") ?? "";
  if (origin && !allowedOrigins.has(origin)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: cors(req) });
  }

  try {
    const { password } = await req.json();
    if (
      typeof password !== "string" ||
      password.length < 12 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      return new Response(JSON.stringify({ error: "Weak password" }), { status: 400, headers: cors(req) });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const token = authHeader.slice(7);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors(req) });
    }

    const { error: passwordError } = await admin.auth.admin.updateUserById(userData.user.id, { password });
    if (passwordError) throw passwordError;
    const { error: profileError } = await admin
      .from("profiles")
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq("id", userData.user.id);
    if (profileError) throw profileError;

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors(req) });
  } catch {
    return new Response(JSON.stringify({ error: "Password change failed" }), { status: 500, headers: cors(req) });
  }
});
