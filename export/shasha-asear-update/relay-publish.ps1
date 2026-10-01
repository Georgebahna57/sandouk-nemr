$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$relayPath = Join-Path $root "relay.json"
$jsonPath = Join-Path $env:APPDATA "MetaQuotes\Terminal\Common\Files\shop-board.json"

if (-not (Test-Path $relayPath)) {
  Write-Host "relay.json not found — cloud sync disabled."
  Write-Host "Copy relay.json.example to relay.json and set uploadUrl + apiKey."
  exit 0
}

try {
  $cfg = Get-Content $relayPath -Raw | ConvertFrom-Json
} catch {
  Write-Host "relay.json is invalid JSON."
  exit 1
}

if (-not $cfg.uploadUrl) {
  Write-Host "relay.json: uploadUrl is required."
  exit 1
}

Write-Host "Cloud relay: uploading MT5 prices to"
Write-Host $cfg.uploadUrl
Write-Host "MT5 file: $jsonPath"
Write-Host "Keep this window open with MT5 + ShopPriceBridge."

$lastSig = ""
$lastUpload = [DateTime]::MinValue

function Read-SharedBytes([string]$path) {
  if (-not (Test-Path $path)) { return $null }
  for ($i = 0; $i -lt 4; $i++) {
    try {
      $fs = [IO.File]::Open($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
      try {
        $len = [int]$fs.Length
        if ($len -le 0) { return $null }
        $buf = New-Object byte[] $len
        [void]$fs.Read($buf, 0, $len)
        return $buf
      } finally {
        $fs.Close()
      }
    } catch {
      Start-Sleep -Milliseconds 20
    }
  }
  return $null
}

while ($true) {
  $bytes = Read-SharedBytes $jsonPath
  if ($bytes -and $bytes.Length -gt 2) {
    $sig = [Text.Encoding]::UTF8.GetString($bytes)
    $now = [DateTime]::UtcNow
    if ($sig -ne $lastSig -or ($now - $lastUpload).TotalSeconds -ge 2) {
      try {
        $headers = @{
          "Content-Type" = "application/json"
          "Cache-Control" = "no-store"
          "x-upsert" = "true"
        }
        if ($cfg.apiKey) {
          $key = [string]$cfg.apiKey
          $headers["apikey"] = $key
          $headers["Authorization"] = "Bearer $key"
        }
        Invoke-RestMethod -Uri ([string]$cfg.uploadUrl) -Method Put -Headers $headers -Body $bytes -TimeoutSec 12 | Out-Null
        $lastSig = $sig
        $lastUpload = $now
      } catch {
        Write-Host ("Upload failed: " + $_.Exception.Message)
      }
    }
  }
  Start-Sleep -Milliseconds 300
}
