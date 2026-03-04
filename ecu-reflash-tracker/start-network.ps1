param(
    [string] $IP           = "",
    [int]    $FrontendPort = 3000,
    [int]    $BackendPort  = 8000,
    [switch] $OpenFirewall
)

$ErrorActionPreference = "Stop"

function Write-Step { param($msg) Write-Host "" ; Write-Host "  >> $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "  OK $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "  !! $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "  XX $msg" -ForegroundColor Red; exit 1 }

Write-Host "  ECU Reflash Tracker - Network Startup" -ForegroundColor Magenta

$Root        = Split-Path -Parent $MyInvocation.MyCommand.Path
$ComposeFile = Join-Path $Root "docker-compose.yml"
if (-not (Test-Path $ComposeFile)) { Write-Fail "docker-compose.yml not found at: $Root" }

Write-Step "Detecting network IP..."

if ($IP -ne "") {
    Write-Ok "Using provided IP: $IP"
} else {
    $candidates = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -notmatch "^127\."    -and
        $_.IPAddress -notmatch "^169\.254" -and
        $_.IPAddress -notmatch "^172\."    -and
        $_.PrefixOrigin -ne "WellKnown"
    } | Sort-Object { if ($_.InterfaceAlias -match "Wi-?Fi|Wireless|WLAN") { 0 } else { 1 } })

    if ($candidates.Count -eq 0) { Write-Fail "No LAN IP found. Connect to a network or use -IP <address>." }

    $IP      = $candidates[0].IPAddress
    $Adapter = $candidates[0].InterfaceAlias
    Write-Ok "Detected IP: $IP  ($Adapter)"

    if ($candidates.Count -gt 1) {
        Write-Warn "Multiple adapters. Override with: .\start-network.ps1 -IP <address>"
        $candidates | ForEach-Object { Write-Host "     $($_.IPAddress)  [$($_.InterfaceAlias)]" -ForegroundColor DarkGray }
    }
}

$FrontendURL = "http://${IP}:${FrontendPort}"
$BackendURL  = "http://${IP}:${BackendPort}"

Write-Step "Patching docker-compose.yml..."
$content = Get-Content $ComposeFile -Raw
$content = $content -replace "(?<=VITE_API_URL:\s+http://)[\d\w.\-]+(?=:\d+)", $IP
$content = $content -replace "(?<=FRONTEND_URL:\s+http://)[\d\w.\-]+(?=:\d+)", $IP
$content = $content -replace "(?<=VITE_API_URL:\s+http://[^:]+:)\d+", "$BackendPort"
$content = $content -replace "(?<=FRONTEND_URL:\s+http://[^:]+:)\d+", "$FrontendPort"
Set-Content $ComposeFile -Value $content -Encoding UTF8 -NoNewline
Write-Ok "VITE_API_URL  -> $BackendURL"
Write-Ok "FRONTEND_URL  -> $FrontendURL"

if ($OpenFirewall) {
    Write-Step "Adding Windows Firewall rules..."
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Warn "Not running as admin - firewall rules skipped."
        Write-Warn "Run once as admin: .\start-network.ps1 -OpenFirewall"
    } else {
        $rulePairs = @(
            @{ Name = "ECU Frontend $FrontendPort"; Port = $FrontendPort },
            @{ Name = "ECU Backend $BackendPort";   Port = $BackendPort  }
        )
        foreach ($r in $rulePairs) {
            $exists = netsh advfirewall firewall show rule name="$($r.Name)" 2>$null
            if ($exists -match "Rule Name") {
                Write-Ok "Already exists: $($r.Name)"
            } else {
                netsh advfirewall firewall add rule name="$($r.Name)" dir=in action=allow protocol=TCP localport="$($r.Port)" | Out-Null
                Write-Ok "Rule added: $($r.Name)"
            }
        }
    }
}

Write-Step "Building and starting containers..."
Push-Location $Root
try {
    docker compose up -d --build frontend backend
    if ($LASTEXITCODE -ne 0) { Write-Fail "docker compose exited with code $LASTEXITCODE" }
} finally { Pop-Location }

Write-Host ""
Write-Host "  =======================================" -ForegroundColor DarkGray
Write-Host "  DONE - Stack is up!" -ForegroundColor Green
Write-Host ""
Write-Host "  Local  : http://localhost:$FrontendPort" -ForegroundColor White
Write-Host "  Network: $FrontendURL"                   -ForegroundColor Yellow
Write-Host "  API    : $BackendURL"                    -ForegroundColor White
Write-Host "  =======================================" -ForegroundColor DarkGray
Write-Host ""
