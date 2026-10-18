# Repair Google Drive Music environment variables in the EXISTING Vercel production project.
# Run from VS Code PowerShell: powershell -ExecutionPolicy Bypass -File .\scripts\repair-drive-music-production.ps1
# This script reads the key from your own computer. Never upload the JSON to GitHub/chat.
[CmdletBinding()]
param(
  [string]$KeyPath = (Join-Path $env:USERPROFILE "Downloads\apdf-music-backend-f914afe870b7.json"),
  [string]$FolderId = "1GiJCrqQ-WYt-013sy37UJVkK9H2cGWDm",
  [switch]$SkipDeploy
)
$ErrorActionPreference = "Stop"
$ExpectedProject = "prj_ZEqdd07mNGA07g8fuwRIt1FxdbpH"
$ExpectedTeam = "team_ilcznoQ0ViVw6DJpKNFYYLcj"
$ExpectedReader = "id-apdf-music-reader@apdf-music-backend.iam.gserviceaccount.com"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Write-Host "8aPDF Music production repair" -ForegroundColor Yellow

if (-not (Test-Path -LiteralPath $KeyPath -PathType Leaf)) {
  throw "Original Google service-account key not found. Pass -KeyPath with the full path to your original downloaded .json file."
}
$ResolvedKeyPath = (Resolve-Path -LiteralPath $KeyPath).Path
if ($ResolvedKeyPath.StartsWith($Root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw "For safety, move the private JSON key file OUTSIDE the 8aPDF website/repository folder first."
}
if ($FolderId -notmatch '^[A-Za-z0-9_-]{10,180}$') { throw "Google Drive folder ID format invalid." }
$RawJson = [IO.File]::ReadAllText($ResolvedKeyPath, [Text.Encoding]::UTF8).TrimStart([char]0xFEFF).Trim()
try { $Key = $RawJson | ConvertFrom-Json } catch { throw "The local key file is not valid JSON." }
if (-not $Key.client_email -or -not $Key.private_key -or $Key.private_key -notlike "*BEGIN PRIVATE KEY*") {
  throw "File is not a valid Google service-account JSON. Check the downloaded .json key."
}
if ($Key.client_email -ne $ExpectedReader) {
  throw "The key's service-account email is not the email currently shared with your Drive folder. Select the key belonging to the shared service account."
}
$ProjectFile = Join-Path $Root ".vercel\project.json"
if (-not (Test-Path -LiteralPath $ProjectFile)) {
  throw "This folder is not linked to Vercel. Run 'npx vercel link', choose the EXISTING 'the-8apdf' project, then retry."
}
try { $Project = Get-Content -LiteralPath $ProjectFile -Raw | ConvertFrom-Json } catch { throw "Cannot read .vercel/project.json. Run 'npx vercel link' again." }
if ($Project.projectId -ne $ExpectedProject -or $Project.orgId -ne $ExpectedTeam) {
  throw "STOP: This folder is linked to a different Vercel project or team. Link it to the-8apdf before continuing."
}
Push-Location $Root
try {
  Write-Host "Verified existing Vercel project, Drive folder ID and matching service-account key." -ForegroundColor Green
  Write-Host "1/3 Updating Production Google Drive folder ID (safe value)..."
  & npx.cmd vercel env update GOOGLE_DRIVE_MUSIC_FOLDER_ID production --value $FolderId --yes
  if ($LASTEXITCODE -ne 0) { throw "Could not update GOOGLE_DRIVE_MUSIC_FOLDER_ID. Check Vercel CLI login/project permissions." }
  Write-Host "2/3 Updating Production service-account credential (secret stays off-screen)..."
  # Value passed via process arguments only (not saved to GitHub, clipboard or PowerShell history).
  & npx.cmd vercel env update GOOGLE_SERVICE_ACCOUNT_JSON production --value $RawJson --sensitive --yes
  if ($LASTEXITCODE -ne 0) { throw "Could not update GOOGLE_SERVICE_ACCOUNT_JSON. Check Vercel CLI login/project permissions." }
  Write-Host "Production variables updated!" -ForegroundColor Green
  if (-not $SkipDeploy) {
    Write-Host "3/3 Publishing existing 8aPDF to Vercel Production..."
    & npx.cmd vercel --prod --yes
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Secrets updated, but production redeploy failed (possibly Vercel Free daily deployment limit). After the limit resets, run: npx vercel --prod --yes"
      exit 2
    }
    Write-Host "Deployment command completed. Verify readiness in Vercel Dashboard and open: https://8apdf.vercel.app/api/music-search?action=status" -ForegroundColor Green
  } else {
    Write-Host "Deployment skipped by request. You must redeploy for updated values to reach the live function." -ForegroundColor Yellow
  }
} finally {
  Pop-Location
  # Clear copies of the key from this script's variables.
  $RawJson = $null
  $Key = $null
}
