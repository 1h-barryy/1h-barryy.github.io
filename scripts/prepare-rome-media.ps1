# Optional Windows image preparation; not a website build dependency.
# Original evidence is never overwritten. Crops only remove unused editor space.
Add-Type -AssemblyName System.Drawing
$root = Join-Path $PSScriptRoot '../portfolio/lighting_rome_temple/media'
$output = Join-Path $root 'display'
New-Item -ItemType Directory -Force -Path $output | Out-Null
function Save-Display($source, $name, $width, $crop) {
  $image = [System.Drawing.Bitmap]::FromFile((Join-Path $root $source))
  if (!$crop) { $crop = @(0,0,$image.Width,$image.Height) }
  $height = [int][math]::Round($crop[3] * $width / $crop[2])
  $bitmap = New-Object System.Drawing.Bitmap $width,$height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $dest = New-Object System.Drawing.Rectangle 0,0,$width,$height
  $graphics.DrawImage($image,$dest,$crop[0],$crop[1],$crop[2],$crop[3],[System.Drawing.GraphicsUnit]::Pixel)
  $path = Join-Path $output $name
  if ($name.EndsWith('.jpg')) {
    $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
    $parameters = New-Object System.Drawing.Imaging.EncoderParameters 1
    $parameters.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality),([long]88)
    $bitmap.Save($path,$encoder,$parameters)
    $parameters.Dispose()
  } else { $bitmap.Save($path,[System.Drawing.Imaging.ImageFormat]::Png) }
  Write-Output "$name ${width}x${height}"
  $graphics.Dispose(); $bitmap.Dispose(); $image.Dispose()
}
$renders = @{'150925'='facade';'151004'='colonnade';'151035'='interior';'151120'='alcove';'151240'='hero';'151347'='interior-overhead'}
foreach ($stamp in $renders.Keys) {
  Save-Display "Screenshot 2026-02-27 $stamp.png" "$($renders[$stamp]).jpg" 1600 $null
}
Save-Display 'Screenshot 2026-02-27 151240.png' 'thumbnail.jpg' 800 $null
Save-Display 'Screenshot 2026-10-27 012637.png' 'scene.jpg' 1600 $null
Save-Display 'Screenshot 2026-10-27 012705.png' 'lighting.png' 2423 @(0,40,2423,610)
Save-Display 'Screenshot 2026-10-27 012735.png' 'environment.png' 2433 @(0,40,2433,290)
Save-Display 'Screenshot 2026-10-27 012751.png' 'atlases.png' 500 @(0,45,500,270)
Save-Display 'Screenshot 2026-10-27 014126.png' 'probe-settings.png' 383 @(0,170,383,450)
Save-Display 'Screenshot 2026-10-27 014126.png' 'probe-preview.png' 383 @(0,825,383,401)
