# Deploy dashboard-summary Edge Function via Supabase Management API (no CLI needed)
# Usage:  .\deploy-dashboard-summary.ps1 -Token "sbp_xxx"
param([Parameter(Mandatory=$true)][string]$Token)
$ErrorActionPreference = "Stop"
$ref = "zhowwkyvaakelmznvjef"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$file = Join-Path $root "supabase\functions\dashboard-summary\index.ts"
if (-not (Test-Path $file)) { Write-Error "Function source not found: $file" }
$meta = '{"entrypoint_path":"index.ts","name":"dashboard-summary","verify_jwt":true}'
Write-Host "Deploying dashboard-summary to project $ref ..."
curl.exe -sS -X POST "https://api.supabase.com/v1/projects/$ref/functions/deploy?slug=dashboard-summary" `
  -H "Authorization: Bearer $Token" `
  -F "metadata=$meta;type=application/json" `
  -F "index.ts=@$file;type=application/typescript"
Write-Host ""
Write-Host "Done. If the response above was empty or an error, re-run and send me the output."
