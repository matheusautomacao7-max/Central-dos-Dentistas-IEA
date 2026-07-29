$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = 'C:\Users\adm.note\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$url = 'http://127.0.0.1:8000'

if (-not (Test-Path $python)) {
    $python = (Get-Command python -ErrorAction Stop).Source
}

function Get-PilotHealth {
    try {
        return Invoke-RestMethod -Uri "$url/api/health" -TimeoutSec 2
    } catch {
        return $null
    }
}

$health = Get-PilotHealth
$running = $null -ne $health -and $health.api_version -ge 4
if (-not $running) {
    $listener = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        $existing = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
        if ($existing -and $existing.Path -eq $python) {
            Stop-Process -Id $existing.Id -Force
            Start-Sleep -Milliseconds 350
        } else {
            throw "A porta 8000 está sendo utilizada por outro programa. Feche-o antes de iniciar o sistema."
        }
    }
    Start-Process -FilePath $python -ArgumentList '.\app\server.py' -WorkingDirectory $root -WindowStyle Hidden
    $attempts = 0
    do {
        Start-Sleep -Milliseconds 250
        $attempts++
        $health = Get-PilotHealth
        $running = $null -ne $health -and $health.api_version -ge 4
    } while (-not $running -and $attempts -lt 20)
    if (-not $running) {
        throw "O servidor não iniciou corretamente."
    }
}

Start-Process $url
