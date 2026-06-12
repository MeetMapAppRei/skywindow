$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $root 'android'
$keystoreDir = Join-Path $androidDir 'keystore'
$keystoreFile = Join-Path $keystoreDir 'skywindow-upload.jks'
$propsFile = Join-Path $androidDir 'keystore.properties'
$alias = 'skywindow-upload'

function New-RandomPassword {
  param([int]$Length = 24)
  $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  -join ((1..$Length) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
  Write-Error 'keytool not found. Install a JDK (Android Studio includes one) and ensure keytool is on PATH.'
}

New-Item -ItemType Directory -Force -Path $keystoreDir | Out-Null

$created = $false
if (-not (Test-Path $keystoreFile)) {
  $password = New-RandomPassword
  $dname = 'CN=SkyWindow, OU=Mobile, O=SkyWindow, L=Unknown, ST=Unknown, C=US'
  Write-Host "Creating upload keystore at $keystoreFile"
  keytool -genkeypair -v `
    -keystore $keystoreFile `
    -alias $alias `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -storepass $password `
    -keypass $password `
    -dname $dname | Out-Null
  $created = $true
} else {
  Write-Host "Upload keystore already exists: $keystoreFile"
  if (-not (Test-Path $propsFile)) {
    Write-Error "Keystore exists but $propsFile is missing. Restore keystore.properties from your backup."
  }
  Write-Host 'Release signing is already configured.'
  exit 0
}

@"
storeFile=keystore/skywindow-upload.jks
storePassword=$password
keyAlias=$alias
keyPassword=$password
"@ | Set-Content -Path $propsFile -Encoding ASCII

Write-Host ''
Write-Host 'Release signing configured.'
Write-Host "  Keystore:  $keystoreFile"
Write-Host "  Props:     $propsFile"
Write-Host ''
Write-Host 'IMPORTANT: Back up both files somewhere safe (password manager + offline copy).'
Write-Host 'You need this upload key for every future Play Store update.'
if ($created) {
  Write-Host ''
  Write-Host "Generated store/key password: $password"
}
