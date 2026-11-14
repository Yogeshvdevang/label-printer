param(
  [Parameter(Mandatory=$true)][string]$PrinterName,
  [Parameter(Mandatory=$true)][string]$FilePath,
  [Parameter(Mandatory=$true)][double]$WidthMm,
  [Parameter(Mandatory=$true)][double]$HeightMm
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$doc = New-Object System.Drawing.Printing.PrintDocument
$image = $null
$printBitmap = $null
try {
  $doc.PrinterSettings.PrinterName = $PrinterName
  if (-not $doc.PrinterSettings.IsValid) { throw "Printer is unavailable: $PrinterName" }
  $image = [System.Drawing.Image]::FromFile($FilePath)
  # The DP27 driver needs an opaque 24-bit raster; 32-bit DrawImage jobs
  # were accepted by the spooler but produced no physical output.
  $printBitmap = New-Object System.Drawing.Bitmap($image.Width, $image.Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($printBitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::White)
    $graphics.DrawImage($image, 0, 0, $image.Width, $image.Height)
  } finally { $graphics.Dispose() }
  $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController
  $doc.DocumentName = 'Label Printer canvas'
  $paperWidth = [int][Math]::Round($WidthMm / 25.4 * 100)
  $paperHeight = [int][Math]::Round($HeightMm / 25.4 * 100)
  $doc.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('Custom label', $paperWidth, $paperHeight)
  $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)
  $doc.DefaultPageSettings.Landscape = $false
  $doc.add_PrintPage({
    param($sender, $e)
    $script:pageGeometry = @{
      pageWidth = $e.PageBounds.Width; pageHeight = $e.PageBounds.Height
      hardMarginX = $e.PageSettings.HardMarginX; hardMarginY = $e.PageSettings.HardMarginY
      graphicsUnit = [string]$e.Graphics.PageUnit
      dpiX = $e.Graphics.DpiX; dpiY = $e.Graphics.DpiY
    }
    $e.Graphics.DrawImage($printBitmap, 0, 0, $paperWidth, $paperHeight)
    $e.HasMorePages = $false
  })
  $doc.Print()
  @{ ok = $true; geometry = $script:pageGeometry } | ConvertTo-Json -Compress
} finally {
  if ($image) { $image.Dispose() }
  if ($printBitmap) { $printBitmap.Dispose() }
  $doc.Dispose()
}
