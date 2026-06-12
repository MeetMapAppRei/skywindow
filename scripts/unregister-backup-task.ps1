$ErrorActionPreference = 'Continue'
$taskName = 'SkyWindowBackup'
$null = schtasks.exe /Delete /TN $taskName /F 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "Removed scheduled task '$taskName'."
} else {
  Write-Host "Task '$taskName' was not found or could not be removed (exit $LASTEXITCODE)."
}
