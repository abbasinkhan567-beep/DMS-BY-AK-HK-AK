$base = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $base
$log = "$base\data\server-log.txt"
"--- $(Get-Date) Start ---" | Out-File $log

try {
  node -v | Out-File $log -Append
} catch {
  "Node.js missing" | Out-File $log -Append
  Start-Process "https://nodejs.org"
  exit 1
}

if (-not (Test-Path "$base\node_modules")) {
  "Installing..." | Out-File $log -Append
  npm install | Out-File $log -Append
}

if (-not (Test-Path "$base\.next\BUILD_ID")) {
  "Building..." | Out-File $log -Append
  npm run build | Out-File $log -Append
}

"Killing old node" | Out-File $log -Append
taskkill /f /im node.exe 2>$null
Start-Sleep 2

"Starting server" | Out-File $log -Append
$p = Start-Process -WindowStyle Hidden -PassThru -FilePath cmd -ArgumentList "/c npx next start -p 3000"
$p.Id | Out-File "$base\data\server-pid.txt"

"Waiting..." | Out-File $log -Append
for ($i=0; $i -lt 30; $i++) {
  Start-Sleep 2
  try {
    $r = Invoke-WebRequest -Uri http://localhost:3000/login -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) {
      "Ready on try $i" | Out-File $log -Append
      Start-Process "http://localhost:3000/login"
      "Done" | Out-File $log -Append
      exit 0
    }
  } catch {}
}
"Server did not start" | Out-File $log -Append
exit 1
