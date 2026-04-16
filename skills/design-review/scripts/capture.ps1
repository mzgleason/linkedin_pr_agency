param(
  [Parameter(Mandatory = $false)]
  [string]$BaseUrl = "http://localhost:3000",

  [Parameter(Mandatory = $false)]
  [string]$Config = "skills/design-review/templates/routes.example.json",

  [Parameter(Mandatory = $false)]
  [string]$OutDir = "artifacts/design-review",

  [Parameter(Mandatory = $false)]
  [switch]$Install
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path ".").Path
$scriptPath = Join-Path $repoRoot "skills/design-review/scripts/capture.mjs"

if ($Install) {
  Write-Host "Installing Playwright (dev dependency)..." -ForegroundColor Cyan
  npm i -D playwright
  Write-Host "Installing Playwright browsers..." -ForegroundColor Cyan
  npx playwright install
}

node $scriptPath --baseUrl $BaseUrl --config $Config --outDir $OutDir

