<#
.SYNOPSIS
  Incremental backup of SkyWindow to a folder on an external drive when that path is reachable.

.DESCRIPTION
  Reads scripts/backup-config.local.json (copy from backup-config.example.json).
  If the destination drive or path is missing, exits quietly so scheduled runs do not error.
  Uses robocopy (no /MIR): adds and updates files; does not delete removed files on the backup.
#>
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$configPath = Join-Path $PSScriptRoot 'backup-config.local.json'
$examplePath = Join-Path $PSScriptRoot 'backup-config.example.json'

function Write-Log([string]$Message) {
  $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Write-Host "[$ts] $Message"
}

if (-not (Test-Path -LiteralPath $configPath)) {
  Write-Log "No backup config at $configPath - copy $examplePath and edit destinationDirectory."
  exit 0
}

$cfg = Get-Content -LiteralPath $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
$destRoot = $cfg.destinationDirectory
if ([string]::IsNullOrWhiteSpace($destRoot)) {
  Write-Log "destinationDirectory is empty in backup-config.local.json"
  exit 0
}

$destRoot = $destRoot.TrimEnd('\', '/')
$driveRoot = Split-Path -Qualifier $destRoot
if (-not $driveRoot) {
  Write-Log "Could not resolve drive for path: $destRoot"
  exit 0
}

if (-not (Test-Path -LiteralPath $driveRoot)) {
  Write-Log "Backup drive not available ($driveRoot) - skipping."
  exit 0
}

if ($cfg.PSObject.Properties.Name -contains 'requiredVolumeLabel' -and $cfg.requiredVolumeLabel) {
  $letter = $driveRoot.TrimEnd('\')
  if ($letter.Length -lt 2) {
    Write-Log "Could not parse drive letter from $driveRoot"
    exit 0
  }
  $dl = $letter[0]
  $vol = Get-Volume -DriveLetter $dl -ErrorAction SilentlyContinue
  if (-not $vol) {
    Write-Log "Could not read volume for drive $dl - skipping."
    exit 0
  }
  if ($vol.FileSystemLabel -ne $cfg.requiredVolumeLabel) {
    Write-Log "Volume label is '$($vol.FileSystemLabel)', expected '$($cfg.requiredVolumeLabel)' - skipping."
    exit 0
  }
}

$excludeDirs = @('node_modules', 'dist', 'dist-ssr')
if ($cfg.excludeDirs) {
  $excludeDirs = @($cfg.excludeDirs)
}

$dirNames = @(
  foreach ($d in $excludeDirs) {
    if (-not [string]::IsNullOrWhiteSpace($d)) {
      $d.Trim('\', '/')
    }
  }
)
$xdArgs = @()
if ($dirNames.Count -gt 0) {
  $xdArgs = @('/XD') + @([string[]]$dirNames)
}

Write-Log "Backing up to $destRoot ..."

$robocopyArgs = @(
  $projectRoot,
  $destRoot,
  '/E',
  '/COPY:DAT',
  '/R:2',
  '/W:2',
  '/MT:8',
  '/FFT',
  '/XJ',
  '/NFL',
  '/NDL',
  '/NJH',
  '/NJS',
  '/NP',
  '/XF',
  'backup-config.local.json'
) + $xdArgs

& robocopy.exe @robocopyArgs
$code = $LASTEXITCODE

# Robocopy: 0–7 are success/partial success; 8+ are failures
if ($code -ge 8) {
  Write-Log "robocopy failed with exit code $code"
  exit $code
}

Write-Log "robocopy finished (exit code $code)."
exit 0
