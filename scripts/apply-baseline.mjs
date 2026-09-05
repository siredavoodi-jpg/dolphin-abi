// Applies the baseline schema to the new Supabase project via the Management API SQL endpoint.
// Usage: node scripts/apply-baseline.mjs <TOKEN> <PROJECT_REF> <SQL_FILE>
import { readFileSync } from "node:fs";

const [token, ref, file] = process.argv.slice(2);
if (!token || !ref || !file) { console.error("usage: node apply-baseline.mjs TOKEN REF SQLFILE"); process.exit(1); }

const sql = readFileSync(file, "utf8");
// Split on statement boundaries at top level (the file uses $$ blocks, so split on ";\n" heuristics is unsafe).
// Instead: split into logical chunks by the known section markers, each executed whole.
const markers = [
  "-- Dolphin Abi — MVP baseline migration",
  "-- Foreign-key and common filter indexes.",
  "-- Manual payment registration and membership activation must succeed atomically.",
  "-- RLS is mandatory for every table reachable through the Data API.",
];
const idx = markers.map(m => sql.indexOf(m));
if (idx.some(i => i < 0)) { console.error("marker missing"); process.exit(1); }
const chunks = [
  sql.slice(idx[0], idx[1]),
  sql.slice(idx[1], idx[2]),
  sql.slice(idx[2], idx[3]),
  sql.slice(idx[3]),
];

for (let i = 0; i < chunks.length; i++) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: chunks[i] }),
  });
  const text = await res.text();
  console.log(`chunk ${i + 1}/${chunks.length}: HTTP ${res.status}`);
  if (!res.ok) { console.error(text.slice(0, 4000)); process.exit(1); }
  console.log(text.slice(0, 300));
}
console.log("baseline applied");
