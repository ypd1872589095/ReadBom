Add-Type -AssemblyName System.Drawing
$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)

$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 56
$path.AddArc(0, 0, $r, $r, 180, 90)
$path.AddArc($size - $r, 0, $r, $r, 270, 90)
$path.AddArc($size - $r, $size - $r, $r, $r, 0, 90)
$path.AddArc(0, $size - $r, $r, $r, 90, 90)
$path.CloseFigure()

$bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(79, 70, 229))
$g.FillPath($bg, $path)

$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White, 12)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$g.DrawLine($pen, 128, 92, 128, 128)
$g.DrawLine($pen, 80, 128, 176, 128)
$g.DrawLine($pen, 80, 128, 80, 168)
$g.DrawLine($pen, 176, 128, 176, 168)

$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$g.FillEllipse($white, 112, 72, 32, 32)
$g.FillEllipse($white, 64, 168, 32, 32)
$g.FillEllipse($white, 160, 168, 32, 32)

$bmp.Save("D:/readtree/desktop/ReadTree.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
