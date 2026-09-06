// One-shot E2E test for the tenancy/subscription feature. Run: node scripts/e2e-tenants.mjs
import { randomBytes } from "node:crypto";
const REF = "slztfxrwrsnwyyrqfshc";
const BASE = `https://${REF}.supabase.co`;
const ACCESS_TOKEN = process.argv[2];
const SERVICE_KEY = process.argv[3];
const ORG_ID = process.argv[4]; // existing dolphin-abi org for linking the test platform admin
if (!ACCESS_TOKEN || !SERVICE_KEY || !ORG_ID) { console.error("usage: node e2e-tenants.mjs ACCESS_TOKEN SERVICE_KEY ORG_ID"); process.exit(1); }

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return JSON.parse(await res.text() || "[]");
}
const fn = async (name, body, token, method = "POST") => {
  const res = await fetch(`${BASE}/functions/v1/${name}`, { method, headers: { "Content-Type": "application/json", Origin: "https://dolphin-abi.vercel.app", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: method === "GET" ? undefined : JSON.stringify(body) });
  let j = {}; try { j = await res.json(); } catch {}
  return { status: res.status, body: j };
};
const login = async (username, password) => fn("username-login", { username, password });

let pass = 0, fail = 0;
const check = (label, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${label} ${extra}`); };

// 1. create test platform admin
const adminEmail = `platform-test-${randomBytes(3).toString("hex")}@tenants.dolphinabi.local`, adminPass = "PlatformTest!2026x";
const createRes = await fetch(`${BASE}/auth/v1/admin/users`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: adminEmail, password: adminPass, email_confirm: true }) });
const adminUser = (await createRes.json());
check("create platform admin auth user", createRes.ok && !!adminUser.id);
await sql(`insert into public.profiles (id,username,full_name,is_platform_admin) values ('${adminUser.id}','platform-test','ادمین تستی پلتفرم',true)`);
await sql(`insert into public.organization_users (organization_id,user_id,role) values ('${ORG_ID}','${adminUser.id}','owner')`);

// 2. platform admin login + list
let r = await login("platform-test", adminPass);
check("platform admin login", r.status === 200 && !!r.body.access_token, `status=${r.status}`);
const platToken = r.body.access_token;
r = await fn("platform-tenants", {}, platToken, "GET");
check("list tenants", r.status === 200 && Array.isArray(r.body.organizations) && r.body.organizations.some(o => o.id === ORG_ID));

// 3. create a new tenant
const ends = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
r = await fn("platform-tenants", { name: "استخر آزمایش موج", owner_full_name: "مدیر آزمایشی", username: "wave-test-" + randomBytes(2).toString("hex"), ends_on: ends }, platToken);
check("create tenant", r.status === 201 && !!r.body.username, JSON.stringify(r.body).slice(0, 120));
const { org_id: tenantOrg, username: tenantUser, temp_password: tenantPass } = r.body;

// 4. tenant owner login + operate
r = await login(tenantUser, tenantPass);
check("tenant owner login", r.status === 200 && r.body.must_change_password === true, `status=${r.status}`);
const tenantToken = r.body.access_token;
r = await fn("admin-members", {}, tenantToken, "GET");
check("tenant owner loads members (active subscription)", r.status === 200, `status=${r.status}`);

// 5. suspend → access denied everywhere
r = await fn("platform-tenants", { org_id: tenantOrg, action: "set_status", status: "suspended" }, platToken, "PATCH");
check("suspend tenant", r.status === 200 && r.body.status === "suspended", `status=${r.status} body=${JSON.stringify(r.body).slice(0,200)}`);
r = await fn("admin-members", {}, tenantToken, "GET");
check("suspended tenant blocked from admin-members", r.status === 403 && r.body.error === "Subscription suspended", `status=${r.status} body=${JSON.stringify(r.body)}`);
r = await login(tenantUser, tenantPass);
check("suspended tenant blocked from login", r.status === 403 && r.body.error === "Subscription suspended", `status=${r.status}`);

// 6. reactivate → access restored
r = await fn("platform-tenants", { org_id: tenantOrg, action: "set_status", status: "active" }, platToken, "PATCH");
check("reactivate tenant", r.status === 200);
r = await fn("admin-members", {}, tenantToken, "GET");
check("reactivated tenant can operate again", r.status === 200, `status=${r.status}`);

// 7. expire subscription → blocked
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
r = await fn("platform-tenants", { org_id: tenantOrg, action: "set_subscription", ends_on: yesterday }, platToken, "PATCH");
check("expire subscription", r.status === 200, `status=${r.status} body=${JSON.stringify(r.body).slice(0,200)}`);
r = await fn("admin-members", {}, tenantToken, "GET");
check("expired tenant blocked", r.status === 403 && r.body.error === "Subscription suspended", `status=${r.status}`);

// 8. non-platform user cannot use platform-tenants
r = await fn("platform-tenants", {}, tenantToken, "GET");
check("tenant owner denied platform panel", r.status === 403, `status=${r.status}`);

// 9. cleanup test tenant + test admin
await sql(`delete from public.organizations where id='${tenantOrg}'`);
const tenantAuth = await sql(`select auth_user_id from public.members limit 0`); // noop keep types
await sql(`delete from public.profiles where id in (select user_id from public.organization_users where organization_id='${tenantOrg}')`).catch(() => {});
await sql(`delete from auth.users where id in (select id from auth.users where email like 'wave-test-%@tenants.dolphinabi.local' or email like '%@tenants.dolphinabi.local' and email like 'wave-%')`).catch(() => {});
await sql(`delete from public.profiles where username like 'wave-test-%'`);
await sql(`delete from auth.users where email='${adminEmail}'`).catch(() => {});
await sql(`delete from public.profiles where username='platform-test'`);
console.log(`cleanup done (tenant org removed)`);
console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
