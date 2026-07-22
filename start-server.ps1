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

function Check-LastExit {
  param($label)
  if ($LASTEXITCODE) {
    Write-Msg "FAILED: $label (exit $LASTEXITCODE)"
    if ($Setup) { Write-Host "ERROR: $label failed - check $log" -ForegroundColor Red }
    exit 1
  }
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

# Auto-update: fetch latest code from GitHub if git repo exists
$hasGitRepo = Test-Path "$base\.git"
if ($hasGitRepo) {
  try {
    $remote = git remote get-url origin 2>$null
    if ($remote) {
      Write-Msg "Auto-update: fetching latest code..."
      git fetch origin main 2>&1 | Out-File $log -Append
      git checkout -B main origin/main 2>&1 | Out-File $log -Append
      git clean -fd -e data/ 2>&1 | Out-File $log -Append
      Write-Msg "Auto-update done"
    }
  } catch {
    Write-Msg "Auto-update skipped (no remote)"
  }
}

if (-not (Test-Path "$base\node_modules")) {
  Write-Msg "Installing packages..."
  if ($Setup) { Write-Host "Running: npm install" }
  npm install 2>&1 | Out-File $log -Append
  Check-LastExit "npm install"
  if ($Setup) { Write-Host "npm install done" }
}

# Handle allow-scripts if needed
try { npm approve-scripts --allow-scripts-pending 2>$null | Out-File $log -Append } catch {}

if (-not (Test-Path "$base\.next\BUILD_ID")) {
  Write-Msg "Building app..."
  if ($Setup) { Write-Host "Running: npm run build (may take 1-2 min)..." }
  npm run build 2>&1 | Out-File $log -Append
  Check-LastExit "npm run build"
  if ($Setup) { Write-Host "Build done" }
}

if (-not (Test-Path "$base\.next\BUILD_ID")) {
  Write-Msg "Build output missing - giving up"
  if ($Setup) {
    Write-Host "ERROR: Build failed - .next/BUILD_ID not found. Check $log" -ForegroundColor Red
    Read-Host "Press Enter"
  }
  exit 1
}

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
Start-Sleep 3

$portCheck = netstat -ano 2>$null | Select-String ":3000 "
if ($portCheck) {
  Write-Msg "Port 3000 still in use by another process"
  if ($Setup) { Write-Host "Warning: Port 3000 in use, trying anyway..." -ForegroundColor Yellow }
}

Write-Msg "Starting server"
$nextBin = "$base\node_modules\.bin\next.cmd"
if (-not (Test-Path $nextBin)) { $nextBin = "npx --yes next" }
$p = Start-Process -WindowStyle Hidden -PassThru -FilePath cmd -ArgumentList "/c `"$nextBin`" start -p 3000"
$p.Id | Out-File "$base\data\server-pid.txt"
Write-Msg "Server PID: $($p.Id)"

Write-Msg "Waiting for server..."
$ready = $false
for ($i=0; $i -lt 30; $i++) {
  Start-Sleep 2
  try {
    $r = Invoke-WebRequest -Uri http://localhost:3000/login -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) {
      Write-Msg "Server ready"
      Start-Process "http://localhost:3000/login"
      Write-Msg "Done"
      if ($Setup) { Start-Sleep 2 }
      $ready = $true
      break
    }
  } catch {}
}

if (-not $ready) {
  Write-Msg "Server did not start in 60s"
  $proc = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
  if (-not $proc) {
    Write-Msg "Server process exited early - check $log or run: npm run build && next start -p 3000"
  } else {
    Write-Msg "Process $($p.Id) still running but not responding on port 3000"
  }
  if ($Setup) {
    Write-Host ""
    Write-Host "Server did not start. Possible fixes:" -ForegroundColor Yellow
    Write-Host "  1. Run: npm run build" -ForegroundColor White
    Write-Host "  2. Then: next start -p 3000" -ForegroundColor White
    Write-Host "  3. Check log: $log" -ForegroundColor White
  }
  Read-Host "Press Enter"
  exit 1
}
