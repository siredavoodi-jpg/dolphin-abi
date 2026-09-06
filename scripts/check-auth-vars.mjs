// One-shot: verify auth actor variable consistency in edge functions.
import { readFileSync } from "node:fs";
for (const f of ["admin-users","admin-branches","admin-members","admin-memberships","admin-payments","admin-sessions","admin-attendance","dashboard-summary","platform-tenants","reports"]) {
  const s = readFileSync(`../supabase/functions/${f}/index.ts`, "utf8");
  const defined = ["authData","auth","a"].filter(v => new RegExp(`(const\\s*\\{\\s*data:\\s*${v}\\b)|(const\\s+${v}\\s*=)`).test(s));
  const uses = [...new Set((s.match(/authData\.user\.id|auth\.user\.id|[^a-zA-Z0-9_.]a\.user\.id/g) ?? []).map(u => u.trim().split(".")[0]))];
  const bad = uses.filter(u => !defined.includes(u));
  console.log(`${f}: defined=[${defined}] uses=[${uses}] ${bad.length ? "*** BROKEN: " + bad : "OK"}`);
}
