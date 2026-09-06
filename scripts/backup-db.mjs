// Exports all organization tables to a timestamped JSON backup in backups/.
// Usage: node scripts/backup-db.mjs <ACCESS_TOKEN> [PROJECT_REF]
// Schedule it daily (Task Scheduler / cron) and copy the backups/ folder somewhere safe.
import { mkdirSync, writeFileSync } from "node:fs";
const TOKEN = process.argv[2];
const REF = process.argv[3] ?? "slztfxrwrsnwyyrqfshc";
if (!TOKEN) { console.error("usage: node backup-db.mjs ACCESS_TOKEN [PROJECT_REF]"); process.exit(1); }
const tables = ["organizations","branches","profiles","organization_users","members","membership_plans","memberships","payment_records","pool_sessions","session_reservations","attendance_events","audit_logs"];
const dump = { taken_at: new Date().toISOString(), project: REF, tables: {} };
for (const t of tables) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: `select * from public.${t}` }),
  });
  if (!res.ok) { console.error(`FAIL ${t}: ${res.status}`); process.exit(1); }
  dump.tables[t] = await res.json();
  console.log(`${t}: ${dump.tables[t].length} rows`);
}
mkdirSync("backups", { recursive: true });
const file = `backups/dolphin-abi-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(file, JSON.stringify(dump));
console.log("saved:", file);
