param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$siteDirectory = $PSScriptRoot
$siteUrl = 'http://127.0.0.1:2027'
$running = $false
try {
    $health = Invoke-RestMethod -Uri "$siteUrl/api/health" -TimeoutSec 3
    if ($health.app -ne 'food-campus-2027') { throw 'Port 2027 is occupied by another application.' }
    $running = $true
} catch {
    if ($_.Exception.Message -like '*occupied*') { throw }
}
if (-not $running) {
    $pythonExecutable = (Get-Command python.exe -ErrorAction Stop).Source
    $pythonWindowless = Join-Path (Split-Path $pythonExecutable) 'pythonw.exe'
    if (Test-Path -LiteralPath $pythonWindowless) { $pythonExecutable = $pythonWindowless }
    Start-Process -FilePath $pythonExecutable -ArgumentList @('"' + (Join-Path $siteDirectory 'server.py') + '"') -WorkingDirectory $siteDirectory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $siteDirectory 'server.log') -RedirectStandardError (Join-Path $siteDirectory 'server-error.log')
    for ($attempt = 0; $attempt -lt 15; $attempt++) {
        Start-Sleep -Milliseconds 400
        try {
            $health = Invoke-RestMethod -Uri "$siteUrl/api/health" -TimeoutSec 2
            if ($health.app -eq 'food-campus-2027') { $running = $true; break }
        } catch { }
    }
    if (-not $running) { throw 'Website did not start. See server-error.log.' }
}
if (-not $NoBrowser) { Start-Process $siteUrl }
Write-Output $siteUrl
