param(
  [Parameter(Mandatory = $true)][string]$IconPng,
  [Parameter(Mandatory = $true)][string]$OutJpg,
  [string]$OutPng = ''
)

Add-Type -AssemblyName System.Drawing

$icon = [System.Drawing.Bitmap]::FromFile($IconPng)
if (-not $icon) { throw "Could not load icon: $IconPng" }

$w = 1024
$h = 500
$bmp = New-Object System.Drawing.Bitmap -ArgumentList @($w, $h, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb))
$bmp.SetResolution(72, 72)

$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Background
$g.Clear([System.Drawing.Color]::FromArgb(10, 14, 26))

# Subtle stars
$rng = New-Object System.Random 42
$starBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 220, 230, 245))
for ($i = 0; $i -lt 90; $i++) {
  $sx = $rng.Next(0, $w)
  $sy = $rng.Next(0, $h)
  $g.FillRectangle($starBrush, $sx, $sy, 1, 1)
}
$starBrush.Dispose()

# Splash / app icon (loading screen mark)
$iconSize = 300
$g.DrawImage($icon, 60, 100, $iconSize, $iconSize)

$titleFont = New-Object System.Drawing.Font('Segoe UI', 46, [System.Drawing.FontStyle]::Bold)
$subFont = New-Object System.Drawing.Font('Segoe UI', 21, [System.Drawing.FontStyle]::Regular)
$featFont = New-Object System.Drawing.Font('Segoe UI', 15, [System.Drawing.FontStyle]::Regular)

$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(232, 238, 247))
$muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(140, 152, 170))
$teal = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(77, 217, 192))

$g.DrawString('SkyWindow', $titleFont, $white, 395, 158)
$g.DrawString('Plan your night sky', $subFont, $muted, 395, 232)
$g.DrawString('Horizon    Weather    Moon    Targets', $featFont, $teal, 395, 288)

$linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 77, 217, 192)), 3
$g.DrawLine($linePen, 395, 330, 735, 330)

$titleFont.Dispose()
$subFont.Dispose()
$featFont.Dispose()
$white.Dispose()
$muted.Dispose()
$teal.Dispose()
$linePen.Dispose()
$g.Dispose()
$icon.Dispose()

if ($bmp.Width -ne 1024 -or $bmp.Height -ne 500) {
  throw "Export size mismatch: $($bmp.Width)x$($bmp.Height)"
}

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]92)
$bmp.Save($OutJpg, $jpegCodec, $encoderParams)
$encoderParams.Dispose()

if ($OutPng -ne '') {
  $bmp.Save($OutPng, [System.Drawing.Imaging.ImageFormat]::Png)
}

$bmp.Dispose()

$check = [System.Drawing.Image]::FromFile($OutJpg)
if ($check.Width -ne 1024 -or $check.Height -ne 500) {
  $check.Dispose()
  throw "Saved JPEG is not 1024x500"
}
$check.Dispose()

Write-Host "wrote $OutJpg (1024x500 JPEG)"
