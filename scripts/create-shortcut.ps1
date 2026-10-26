param(
  [switch]$CopyToDesktop,
  [string]$DesktopPath = [Environment]::GetFolderPath('DesktopDirectory')
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$appUrl = 'https://ver-dikt.github.io/DNEVNIK/'
$browserPaths = @(
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
)
$browser = $browserPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browser) { throw 'Chrome or Edge is required for the separate app window.' }

# Windows ICO can contain a PNG image directly. Reuse the existing app artwork.
$pngPath = Join-Path $projectRoot 'public\icon-192.png'
$iconPath = Join-Path $projectRoot 'public\icon.ico'
$png = [IO.File]::ReadAllBytes($pngPath)
if ($png.Length -lt 24 -or $png[0] -ne 137 -or $png[1] -ne 80 -or $png[2] -ne 78 -or $png[3] -ne 71) { throw 'Invalid PNG icon.' }
$stream = [IO.MemoryStream]::new()
$writer = [IO.BinaryWriter]::new($stream)
try {
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]1)
  $writer.Write([byte]192)
  $writer.Write([byte]192)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$png.Length)
  $writer.Write([UInt32]22)
  $writer.Write($png)
  $writer.Flush()
  [IO.File]::WriteAllBytes($iconPath, $stream.ToArray())
} finally {
  $writer.Dispose()
  $stream.Dispose()
}

$shortcutName = 'Ежедневник.lnk'
$shortcutPath = Join-Path $projectRoot $shortcutName
$shell = New-Object -ComObject WScript.Shell
try {
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $node = (Get-Command node -ErrorAction Stop).Source
  $entrypoint = Join-Path $projectRoot 'scripts\start-local-ai.mjs'
  $shortcut.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $shortcut.Arguments = '-NoProfile -WindowStyle Hidden -Command "& ''' + $node.Replace("'", "''") + ''' ''' + $entrypoint.Replace("'", "''") + '''"'
  $shortcut.WorkingDirectory = $projectRoot
  $shortcut.IconLocation = $iconPath + ',0'
  $shortcut.Description = 'Ежедневник — задачи, покупки и заметки с синхронизацией Supabase'
  $shortcut.Save()
  $saved = $shell.CreateShortcut($shortcutPath)
  if ($saved.Arguments -notlike '*start-local-ai.mjs*') { throw 'Shortcut verification failed.' }
  if ($CopyToDesktop) {
    if (-not (Test-Path -LiteralPath $DesktopPath -PathType Container)) { throw 'Desktop directory does not exist.' }
    $desktopShortcut = Join-Path $DesktopPath $shortcutName
    if (Test-Path -LiteralPath $desktopShortcut) {
      $existing = $shell.CreateShortcut($desktopShortcut)
      if ($existing.Arguments -notlike '*https://ver-dikt.github.io/DNEVNIK/*' -and $existing.Arguments -notlike '*start-local-ai.mjs*') { throw 'An unrelated shortcut already exists on the desktop.' }
    }
    Copy-Item -LiteralPath $shortcutPath -Destination $desktopShortcut -Force
  }
  # Remove only the obsolete launcher created by the earlier two-shortcut setup.
  $obsoletePaths = @((Join-Path $projectRoot 'Ежедневник с ИИ.lnk'))
  if ($CopyToDesktop) { $obsoletePaths += Join-Path $DesktopPath 'Ежедневник с ИИ.lnk' }
  foreach ($obsoletePath in $obsoletePaths) {
    if (Test-Path -LiteralPath $obsoletePath -PathType Leaf) {
      $obsolete = $shell.CreateShortcut($obsoletePath)
      if ($obsolete.Arguments.Contains($entrypoint)) { Remove-Item -LiteralPath $obsoletePath -Force }
    }
  }
  [pscustomobject]@{ Shortcut = $shortcutPath; Browser = $saved.TargetPath; Arguments = $saved.Arguments; Icon = $saved.IconLocation; DesktopCopy = [bool]$CopyToDesktop } | ConvertTo-Json
} finally {
  [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)
}
