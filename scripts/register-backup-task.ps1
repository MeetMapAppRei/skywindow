<#
.SYNOPSIS
  Registers a Scheduled Task that runs scripts/backup-skywindow.ps1 every N minutes.

.NOTES
  Uses schtasks.exe (reliable long-running repetition). Run elevated if permission errors.
  Interval is read from backup-config.local.json (intervalMinutes); default 15.
#>
$ErrorActionPreference = 'Stop'

$scriptDir = $PSScriptRoot
$backupScript = Join-Path $scriptDir 'backup-skywindow.ps1'
$configPath = Join-Path $scriptDir 'backup-config.local.json'
$taskName = 'SkyWindowBackup'

if (-not (Test-Path -LiteralPath $configPath)) {
  Write-Host "Create scripts/backup-config.local.json first (copy from backup-config.example.json)."
  exit 1
}

$cfg = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
$minutes = 15
if ($cfg.PSObject.Properties.Name -contains 'intervalMinutes' -and $cfg.intervalMinutes -gt 0) {
  $minutes = [int]$cfg.intervalMinutes
}

$ps = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$taskRun = "`"$ps`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$backupScript`""

$null = schtasks.exe /Create /TN $taskName /F /SC MINUTE /MO $minutes /TR $taskRun /IT /RL LIMITED 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "schtasks /Create failed with exit code $LASTEXITCODE"
}

Write-Host "Registered scheduled task '$taskName' (every $minutes min). Backup script: $backupScript"
