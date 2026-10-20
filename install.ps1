#Requires -Version 5.1
<#
.SYNOPSIS
  Installs AllCode Desktop (fork of OpenCode by Alltomatos) on Windows.

.DESCRIPTION
  Downloads the latest release installer from GitHub and runs it silently.

.EXAMPLE
  irm https://raw.githubusercontent.com/alltomatos/allcode/prod/install.ps1 | iex
#>

$ErrorActionPreference = "Stop"

$repo = "alltomatos/allcode"
$assetName = "allcode-desktop-win-x64.exe"

Write-Host "AllCode Desktop installer (fork of OpenCode by Alltomatos)" -ForegroundColor Cyan

$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers @{ "User-Agent" = "allcode-installer" }
$asset = $release.assets | Where-Object { $_.name -eq $assetName } | Select-Object -First 1

if (-not $asset) {
    throw "Could not find $assetName in the latest release of $repo."
}

$version = $release.tag_name
Write-Host "Latest version: $version" -ForegroundColor Green

$installerPath = Join-Path $env:TEMP $assetName
Write-Host "Downloading installer..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $installerPath -UseBasicParsing

Write-Host "Running installer..."
Start-Process -FilePath $installerPath -Wait

Remove-Item $installerPath -Force -ErrorAction SilentlyContinue

Write-Host "Done. AllCode Desktop $version installed." -ForegroundColor Green
