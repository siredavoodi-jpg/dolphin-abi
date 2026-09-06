// One-shot: append tenants panel styles to members.css
import { readFileSync, writeFileSync } from "node:fs";
const path = new URL("../app/members/members.css", import.meta.url);
let css = readFileSync(path, "utf8");
if (!css.includes(".tenants-grid")) {
css += `
.tenants-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.tenant-card{background:#fff;border:1px solid #ebe8f1;border-radius:16px;padding:17px;box-shadow:0 12px 35px #23183d0d}
.tenant-card.suspended{opacity:.75;background:#fbfafa}
.tenant-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.tenant-head b{font-size:14px;display:block}
.tenant-head small{color:#8b8495;font-size:10px;direction:ltr;display:block}
.tenant-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}
.tenant-stats>div{background:#faf9fc;border-radius:10px;padding:9px;text-align:center}
.tenant-stats svg{width:15px;color:#8b8495}
.tenant-stats b{display:block;font-size:15px;margin-top:2px}
.tenant-stats small{font-size:9px;color:#8b8495}
.tenant-sub{display:flex;align-items:center;gap:7px;background:#f4f2fa;color:#5f5870;border-radius:9px;padding:8px 11px;font-size:11px}
.tenant-sub svg{width:15px;flex-shrink:0}
.tenant-sub.warn{background:#fff4e3;color:#9a6b19}
.tenant-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:13px}
.tenant-actions>button{border:1px solid #ddd8e7;background:#fff;border-radius:9px;padding:8px;font-size:11px;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:5px;cursor:pointer;color:#5f5870}
.tenant-actions>button svg{width:14px}
.tenant-actions>button:hover{background:#f7f5fb}
.tenant-actions>button.danger{border-color:#f0d3d5;color:#c5434d}
.tenant-actions>button.activate{border-color:#cde9db;color:#16845e}
.tenant-actions>button:disabled{opacity:.5;cursor:default}
.tenants-users{display:flex;flex-direction:column;gap:8px}
.tenant-user{display:flex;justify-content:space-between;align-items:center;border:1px solid #eeeaf3;border-radius:11px;padding:11px 13px}
.tenant-user b{font-size:12px;display:block}
.tenant-user small{color:#8b8495;font-size:10px}
.tenant-user>button{border:1px solid #e2d8f7;background:#f8f5ff;color:#6a4bc9;border-radius:8px;padding:7px 10px;font-size:11px;font-family:inherit;display:inline-flex;align-items:center;gap:5px;cursor:pointer}
.tenant-user>button svg{width:13px}
.tenant-user>button:disabled{opacity:.5}
.tenants-detail-modal{width:min(560px,96vw)}
`;
writeFileSync(path, css);
console.log("css appended");
} else console.log("already present");
