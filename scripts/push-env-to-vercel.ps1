# Push VITE_* keys from .env.local to Vercel (production + preview).
# Run from repo root: powershell -ExecutionPolicy Bypass -File scripts/push-env-to-vercel.ps1
# Requires: vercel login, vercel link (see .vercel/project.json).

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$envFile = Join-Path $root '.env.local'
if (-not (Test-Path $envFile)) {
  Write-Error ('.env.local not found at ' + $envFile + ' - copy from .env.example and fill values.')
}

$vars = @{}
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -match '^\s*#' -or $line -eq '') { return }
  if ($line -match '^([A-Za-z0-9_]+)=(.*)$') {
    $key = $matches[1]
    $val = $matches[2].Trim()
    if ($val.StartsWith('"') -and $val.EndsWith('"')) { $val = $val.Substring(1, $val.Length - 2) }
    $vars[$key] = $val
  }
}

$required = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY')
$targets = @('production', 'preview')
$missing = @()
foreach ($k in $required) {
  if ([string]::IsNullOrWhiteSpace($vars[$k])) { $missing += $k }
}
$anthropicKey = $vars['ANTHROPIC_API_KEY']
if ([string]::IsNullOrWhiteSpace($anthropicKey)) { $anthropicKey = $vars['VITE_ANTHROPIC_API_KEY'] }
if ([string]::IsNullOrWhiteSpace($anthropicKey)) { $missing += 'ANTHROPIC_API_KEY (or legacy VITE_ANTHROPIC_API_KEY)' }
if ($missing.Count -gt 0) {
  Write-Host "Fill these in .env.local first, then re-run:" -ForegroundColor Yellow
  $missing | ForEach-Object { Write-Host "  $_" }
  exit 1
}

foreach ($k in $required) {
  $v = $vars[$k]
  foreach ($envName in $targets) {
    Write-Host "Setting $k ($envName)..."
    & vercel env add $k $envName --value $v --yes --sensitive --force 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
      Write-Error "vercel env add failed for $k ($envName)"
    }
  }
}

foreach ($envName in $targets) {
  Write-Host "Setting ANTHROPIC_API_KEY ($envName)..."
  & vercel env add ANTHROPIC_API_KEY $envName --value $anthropicKey --yes --sensitive --force 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) {
    Write-Error "vercel env add failed for ANTHROPIC_API_KEY ($envName)"
  }
}

Write-Host 'Done. Trigger a new deployment so the build picks up the variables.' -ForegroundColor Green
