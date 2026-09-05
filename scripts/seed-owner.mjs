// Seeds organization, main branch, and the first owner account on the new Supabase project.
// Usage: node scripts/seed-owner.mjs <ACCESS_TOKEN> <SERVICE_ROLE_KEY> <PROJECT_REF>
import { randomBytes } from "node:crypto";

const [token, serviceKey, ref] = process.argv.slice(2);
if (!token || !serviceKey || !ref) { console.error("usage: node seed-owner.mjs TOKEN SERVICE_KEY REF"); process.exit(1); }
const base = `https://${ref}.supabase.co`;

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text.slice(0, 1000)}`);
  return JSON.parse(text || "[]");
}

const existing = await sql(`select id from public.organizations where slug = 'dolphin-abi'`);
if (existing.length) { console.log("organization already exists:", existing[0].id); process.exit(0); }

const org = await sql(`insert into public.organizations (name, slug) values ('مجموعه آبی دلفین', 'dolphin-abi') returning id`);
const orgId = org[0].id;
const branch = await sql(`insert into public.branches (organization_id, name, code, capacity) values ('${orgId}', 'شعبه مرکزی', 'MAIN', 50) returning id`);
const branchId = branch[0].id;
console.log("org:", orgId, "branch:", branchId);

const username = "owner";
const tempPassword = "Dl-" + randomBytes(9).toString("base64url") + "7x";
const email = `dolphin-owner-${randomBytes(4).toString("hex")}@dolphinabi.local`;

const authRes = await fetch(`${base}/auth/v1/admin/users`, {
  method: "POST",
  headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: tempPassword, email_confirm: true }),
});
const authBody = await authRes.json();
if (!authRes.ok) throw new Error(`auth ${authRes.status}: ${JSON.stringify(authBody).slice(0, 800)}`);
const userId = authBody.id;
console.log("auth user:", userId);

await sql(`insert into public.profiles (id, username, full_name, must_change_password) values ('${userId}', '${username}', 'مدیر کل دلفین آبی', true)`);
await sql(`insert into public.organization_users (organization_id, user_id, role) values ('${orgId}', '${userId}', 'owner')`);

console.log(JSON.stringify({ username, tempPassword, email, orgId, branchId }, null, 2));
