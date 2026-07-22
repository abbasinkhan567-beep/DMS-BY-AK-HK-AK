param([switch]$Setup)

$base = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $base
$log = "$base\data\server-log.txt"
$flag = "$base\.setup-done"

function Write-Msg {
  param($m)
  "$(Get-Date -Format HH:mm:ss) $m" | Out-File $log -Append
  if ($Setup) { Write-Host $m }
}

"--- $(Get-Date) Start ---" | Out-File $log

try {
  $v = node -v 2>$null
  Write-Msg "Node $v"
} catch {
  Write-Msg "Node.js missing"
  Start-Process "https://nodejs.org"
  if ($Setup) { Read-Host "Press Enter" }
  exit 1
}

if (-not (Test-Path "$base\node_modules")) {
  Write-Msg "Installing packages..."
  if ($Setup) { Write-Host "Running: npm install" }
  npm install 2>&1 | Out-File $log -Append
  if ($Setup) { Write-Host "npm install done" }
}

if (-not (Test-Path "$base\.next\BUILD_ID")) {
  Write-Msg "Building app..."
  if ($Setup) { Write-Host "Running: npm run build (may take 1-2 min)..." }
  npm run build 2>&1 | Out-File $log -Append
  if ($Setup) { Write-Host "Build done" }
}

# Create setup-done flag
if (-not (Test-Path $flag)) {
  Write-Msg "Setup complete!"
  "" | Out-File $flag
  if ($Setup) {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "  SETUP COMPLETE!"
    Write-Host "  Desktop icon will now run silently."
    Write-Host "========================================"
    Write-Host ""
    Start-Sleep 3
  }
}

Write-Msg "Killing old node"
taskkill /f /im node.exe 2>$null
Start-Sleep 2

Write-Msg "Starting server"
$p = Start-Process -WindowStyle Hidden -PassThru -FilePath cmd -ArgumentList "/c npx next start -p 3000"
$p.Id | Out-File "$base\data\server-pid.txt"

Write-Msg "Waiting for server..."
for ($i=0; $i -lt 30; $i++) {
  Start-Sleep 2
  try {
    $r = Invoke-WebRequest -Uri http://localhost:3000/login -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) {
      Write-Msg "Server ready"
      Start-Process "http://localhost:3000/login"
      Write-Msg "Done"
      if ($Setup) { Start-Sleep 2 }
      exit 0
    }
  } catch {}
}
Write-Msg "Server did not start"
if ($Setup) { Read-Host "Press Enter" }
exit 1
