# Gera o ícone do Bipa em PNG (256×256 e 512×512) e um ICO multi-size.
# Requer apenas Windows (System.Drawing).

Add-Type -AssemblyName System.Drawing

function New-BipaBitmap {
    param([int]$Size)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    # Escala a partir do viewbox 40×40
    $s = $Size / 40.0

    # Rounded rect (10% corner)
    $r  = 10 * $s
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $r * 2, $r * 2, 180, 90) | Out-Null
    $path.AddArc($Size - $r * 2, 0, $r * 2, $r * 2, 270, 90) | Out-Null
    $path.AddArc($Size - $r * 2, $Size - $r * 2, $r * 2, $r * 2, 0, 90) | Out-Null
    $path.AddArc(0, $Size - $r * 2, $r * 2, $r * 2, 90, 90) | Out-Null
    $path.CloseFigure()

    # Gradient azul → roxo (mesmo do SVG)
    $c1 = [System.Drawing.Color]::FromArgb(255, 59, 130, 246)
    $c2 = [System.Drawing.Color]::FromArgb(255, 139, 92, 246)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF(0, 0)),
        (New-Object System.Drawing.PointF($Size, $Size)),
        $c1, $c2
    )
    $g.FillPath($brush, $path)
    $brush.Dispose()

    # Barras brancas (bar radius = 1.5 no SVG → ~0.6*escala aproxima)
    function Draw-Bar([single]$x, [single]$y, [single]$w, [single]$h, [int]$alpha) {
        $rectPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $rr = ($w * $s) * 0.5
        $rx = $x * $s
        $ry = $y * $s
        $rw = $w * $s
        $rh = $h * $s
        $rectPath.AddArc($rx, $ry, $rr * 2, $rr * 2, 180, 90) | Out-Null
        $rectPath.AddArc($rx + $rw - $rr * 2, $ry, $rr * 2, $rr * 2, 270, 90) | Out-Null
        $rectPath.AddArc($rx + $rw - $rr * 2, $ry + $rh - $rr * 2, $rr * 2, $rr * 2, 0, 90) | Out-Null
        $rectPath.AddArc($rx, $ry + $rh - $rr * 2, $rr * 2, $rr * 2, 90, 90) | Out-Null
        $rectPath.CloseFigure()
        $whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
        $g.FillPath($whiteBrush, $rectPath)
        $whiteBrush.Dispose()
        $rectPath.Dispose()
    }

    Draw-Bar 9  13 3 14 242
    Draw-Bar 14 9  3 22 255
    Draw-Bar 19 15 3 10 217
    Draw-Bar 24 11 3 18 230

    # Circle "beep"
    $circleBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $cx = 31 * $s
    $cy = 11 * $s
    $cr = 2.4 * $s
    $g.FillEllipse($circleBrush, $cx - $cr, $cy - $cr, $cr * 2, $cr * 2)
    $circleBrush.Dispose()

    $g.Dispose()
    return $bmp
}

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$buildDir = Join-Path $root 'build'
if (-not (Test-Path $buildDir)) { New-Item -ItemType Directory -Path $buildDir | Out-Null }
$publicDir = Join-Path $root 'public'
if (-not (Test-Path $publicDir)) { New-Item -ItemType Directory -Path $publicDir | Out-Null }

# PNGs em vários tamanhos
$sizes = @(16, 32, 48, 64, 128, 256, 512)
$bitmaps = @{}
foreach ($sz in $sizes) {
    $bm = New-BipaBitmap -Size $sz
    $bitmaps[$sz] = $bm
    if ($sz -eq 256) {
        $bm.Save((Join-Path $buildDir 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
        $bm.Save((Join-Path $publicDir 'bipa-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "Wrote build/icon.png (256x256)"
    }
    if ($sz -eq 512) {
        $bm.Save((Join-Path $publicDir 'bipa-icon-512.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    }
}

# Monta um ICO com múltiplos frames
$icoPath = Join-Path $buildDir 'icon.ico'
$icoSizes = @(16, 32, 48, 64, 128, 256)
$pngStreams = @()
foreach ($sz in $icoSizes) {
    $ms = New-Object System.IO.MemoryStream
    $bitmaps[$sz].Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngStreams += ,@{ Size = $sz; Bytes = $ms.ToArray() }
    $ms.Dispose()
}

$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter($fs)
try {
    # ICONDIR (6 bytes)
    $bw.Write([uint16]0)             # reserved
    $bw.Write([uint16]1)             # type = 1 (icon)
    $bw.Write([uint16]$pngStreams.Count)  # count

    # Calc offset onde começam os dados PNG (após ICONDIR + ICONDIRENTRY*count)
    $offset = 6 + (16 * $pngStreams.Count)
    foreach ($entry in $pngStreams) {
        $bw.Write([byte]($entry.Size % 256))    # width  (0 = 256)
        $bw.Write([byte]($entry.Size % 256))    # height (0 = 256)
        $bw.Write([byte]0)                       # colors in palette
        $bw.Write([byte]0)                       # reserved
        $bw.Write([uint16]1)                     # color planes
        $bw.Write([uint16]32)                    # bits per pixel
        $bw.Write([uint32]$entry.Bytes.Length)   # size of bitmap data
        $bw.Write([uint32]$offset)               # offset
        $offset += $entry.Bytes.Length
    }
    foreach ($entry in $pngStreams) {
        $bw.Write($entry.Bytes)
    }
} finally {
    $bw.Dispose()
    $fs.Dispose()
}

Write-Host "Wrote build/icon.ico ($(($pngStreams | Measure-Object Size -Sum).Sum / 1KB) KB, sizes: $($icoSizes -join ', '))"

foreach ($bm in $bitmaps.Values) { $bm.Dispose() }
