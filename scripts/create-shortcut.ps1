$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Pepsi Distribution.lnk"
$target = Join-Path $root "START.bat"
$workDir = $root

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($shortcutPath)
$sc.TargetPath = $target
$sc.WorkingDirectory = $workDir
$sc.WindowStyle = 7
$sc.Description = "Pepsi Distribution Management System"
$sc.IconLocation = "$env:SystemRoot\System32\shell32.dll,21"
$sc.Save()

Write-Host "Desktop shortcut created: $shortcutPath"
