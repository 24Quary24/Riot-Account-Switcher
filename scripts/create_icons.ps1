Add-Type -AssemblyName System.Drawing

$src = "C:\Users\Jamie\.gemini\antigravity-ide\brain\1ce3b3e4-2e5d-44a8-ba88-1fc1cb8656a5\riot_app_icon_1788262609931.jpg"
if (-not (Test-Path $src)) {
    Write-Error "Source image not found: $src"
    exit 1
}

New-Item -ItemType Directory -Force -Path "assets" | Out-Null

$img = [System.Drawing.Image]::FromFile($src)

# 1. 256x256 app icon PNG
$bmp256 = New-Object System.Drawing.Bitmap 256, 256
$g256 = [System.Drawing.Graphics]::FromImage($bmp256)
$g256.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g256.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g256.DrawImage($img, 0, 0, 256, 256)
$bmp256.Save("assets\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# 2. 32x32 tray icon PNG
$bmp32 = New-Object System.Drawing.Bitmap 32, 32
$g32 = [System.Drawing.Graphics]::FromImage($bmp32)
$g32.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g32.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g32.DrawImage($img, 0, 0, 32, 32)
$bmp32.Save("assets\tray-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# 3. Windows ICO format (256x256)
$hIcon = $bmp256.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = [System.IO.File]::Create("assets\icon.ico")
$icon.Save($fs)
$fs.Close()

# Clean up
$g256.Dispose()
$bmp256.Dispose()
$g32.Dispose()
$bmp32.Dispose()
$img.Dispose()

Write-Output "Assets created: assets/icon.png, assets/tray-icon.png, assets/icon.ico"
