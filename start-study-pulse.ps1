param(
    [switch]$SkipInstall,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ApiUrl = "http://127.0.0.1:7788"
$WebUrl = "http://127.0.0.1:5173"
$RuntimeStatePath = Join-Path $Root "data\runtime-state.json"

function Test-PortOpen([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Get-PortProcessId([int]$Port) {
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        return [int]$listener.OwningProcess
    }
    return $null
}

function Write-RuntimeState() {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $RuntimeStatePath) | Out-Null
    $state = [ordered]@{
        updatedAt = (Get-Date).ToString("s")
        backend = @{
            label = "FastAPI"
            pid = Get-PortProcessId 7788
            startedAt = (Get-Date).ToString("s")
        }
        frontend = @{
            label = "Vite"
            pid = Get-PortProcessId 5173
            startedAt = (Get-Date).ToString("s")
        }
    }
    $state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $RuntimeStatePath -Encoding UTF8
}

function Wait-HttpOk([string]$Url, [int]$Seconds) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        } catch {
            Start-Sleep -Milliseconds 700
        }
    }
    return $false
}

Set-Location $Root

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js was not found. Install Node.js 20 or newer, then run this script again."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found. Install npm, then run this script again."
}

if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
        throw "Python was not found. Install Python 3.11 or newer, then run this script again."
    }
    Write-Host "Creating Python virtual environment..."
    python -m venv .venv
}

if (-not $SkipInstall) {
    if (-not (Test-Path ".\node_modules")) {
        Write-Host "Installing frontend dependencies..."
        npm install
    }

    Write-Host "Installing backend dependencies..."
    .\.venv\Scripts\python.exe -m pip install -r apps/api/requirements.txt
}

if (Test-PortOpen 7788) {
    Write-Host "Backend already running at $ApiUrl"
} else {
    Write-Host "Starting backend at $ApiUrl"
    Start-Process powershell.exe -WorkingDirectory $Root -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command", ".\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir apps/api --host 127.0.0.1 --port 7788"
    )
}

if (Test-PortOpen 5173) {
    Write-Host "Frontend already running at $WebUrl"
} else {
    Write-Host "Starting frontend at $WebUrl"
    Start-Process powershell.exe -WorkingDirectory $Root -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command", "npm --workspace apps/web run dev -- --host 127.0.0.1 --port 5173"
    )
}

Write-Host "Waiting for services..."
$apiReady = Wait-HttpOk "$ApiUrl/api/health" 25
$webReady = Wait-HttpOk $WebUrl 25

if ($apiReady -and $webReady) {
    Write-RuntimeState
    Write-Host "StudyPulse is ready: $WebUrl"
    if (-not $NoBrowser) {
        Start-Process $WebUrl
    }
} else {
    Write-Host "Startup commands were launched, but one service did not respond in time."
    Write-Host "API ready: $apiReady"
    Write-Host "Web ready: $webReady"
}
