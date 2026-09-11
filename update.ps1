$ErrorActionPreference = 'Stop'
$siteDirectory = $PSScriptRoot
& (Join-Path $siteDirectory 'start.ps1') -NoBrowser
$result = Invoke-RestMethod -Uri 'http://127.0.0.1:2027/api/update' -Method Post -Headers @{ Origin = 'http://127.0.0.1:2027'; 'X-Food-Campus' = '1' } -TimeoutSec 90
if (-not $result.ok) { throw $result.error }
$result | ConvertTo-Json -Compress
