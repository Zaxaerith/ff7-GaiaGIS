# SPDX-License-Identifier: GPL-3.0-only
<# A complete release transaction. Default is local validation/build only.
   -Publish is an explicit operator approval, never inferred by CI. #>
param([Parameter(Mandatory)][string]$Version,[string]$Notes,[string]$Source,[switch]$Publish)
$ErrorActionPreference='Stop'
$gaiaRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $gaiaRoot
. ./scripts/use_workspace_environment.ps1
$env:PYTHONUTF8='1'
function Invoke-Checked { param([scriptblock]$Action) & $Action; if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE)" } }
$gaiaGh=$env:GAIAGIS_GH_EXECUTABLE
if (-not $gaiaGh) { $gaiaGh=(Get-Command gh -ErrorAction SilentlyContinue).Source }
function Invoke-Gh { if (-not $gaiaGh) { throw 'Install/authenticate GitHub CLI, or set GAIAGIS_GH_EXECUTABLE for publication' }; & $gaiaGh @args }
function Git-Local {
    if ($gaiaGh) { git -c "safe.directory=$($gaiaRoot.Replace('\','/'))" -c credential.helper= -c ('credential.helper=!"'+$gaiaGh.Replace('\','/')+'" auth git-credential') @args }
    else { git -c "safe.directory=$($gaiaRoot.Replace('\','/'))" @args }
}
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Use a stable semantic version' }
if ((Get-Content web/package.json -Raw | ConvertFrom-Json).version -ne $Version) { throw 'Version does not match source' }
if ((Git-Local branch --show-current) -ne 'main' -or (Git-Local status --porcelain)) { throw 'Clean local main required; commit first' }
$gaiaHead=Git-Local rev-parse HEAD
$gaiaPython=Join-Path $gaiaRoot '.cache/packaging-venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $gaiaPython)) { throw 'Create workspace-local packaging venv and install scripts/packaging-requirements.txt' }
Invoke-Checked { npm --prefix web ci }
Invoke-Checked { npm --prefix web test }
Invoke-Checked { npm --prefix web run build }
Invoke-Checked { npm --prefix web run build:release }
Invoke-Checked { npm --prefix web run audit:release }
if ($Source) { Invoke-Checked { python -B scripts/test_application.py --source $Source --output output/release-private-tests } }
Invoke-Checked { & $gaiaPython -B scripts/build_windows.py --skip-web-build }
$gaiaZip=Join-Path $gaiaRoot "output/distribution/GaiaGIS-v$Version-windows-x64.zip"
if ($Source) { Invoke-Checked { python -B scripts/smoke_windows.py $gaiaZip --source $Source } }
else { Invoke-Checked { python -B scripts/smoke_windows.py $gaiaZip } }
if (-not $Publish) { Write-Output "Local release preparation complete for $gaiaHead. No remote action executed."; return }
if (-not $Source) { throw 'Publication requires a read-only real source smoke, not self-test alone' }
if (-not $Notes -or -not (Test-Path -LiteralPath $Notes)) { throw 'Reviewable release notes file required' }
$gaiaTag="v$Version"
Invoke-Checked { Git-Local fetch origin --tags }
Git-Local merge-base --is-ancestor origin/main HEAD
if ($LASTEXITCODE -ne 0) { throw 'Publication is not a fast-forward' }
$gaiaExisting=Git-Local ls-remote origin "refs/tags/$gaiaTag"
if ($gaiaExisting) { throw 'Tag already exists. Never overwrite released history; inspect/resume manually.' }
Invoke-Gh release view $gaiaTag --repo Zaxaerith/ff7-GaiaGIS *> $null
if ($LASTEXITCODE -eq 0) { throw 'Release already exists; never overwrite' }
if ((Git-Local status --porcelain) -or (Git-Local rev-parse HEAD) -ne $gaiaHead) { throw 'Source changed during release preparation' }
Invoke-Checked { Git-Local push origin main }
if ((Git-Local ls-remote origin refs/heads/main).Split()[0] -ne $gaiaHead) { throw 'Remote main differs' }
$gaiaRun=$null
for ($gaiaAttempt=0;$gaiaAttempt -lt 20;$gaiaAttempt++) {
    $gaiaRuns=Invoke-Gh run list --repo Zaxaerith/ff7-GaiaGIS --workflow web-checks.yml --commit $gaiaHead --json databaseId,status,conclusion | ConvertFrom-Json
    if ($gaiaRuns) { $gaiaRun=$gaiaRuns[0];break }; Start-Sleep -Seconds 3
}
if (-not $gaiaRun) { throw 'Actual CI not found. Stop before tag/release.' }
Invoke-Checked { Invoke-Gh run watch $gaiaRun.databaseId --repo Zaxaerith/ff7-GaiaGIS --exit-status }
Invoke-Checked { Git-Local tag -a $gaiaTag $gaiaHead -m "GaiaGIS v$Version" }
Invoke-Checked { Git-Local push origin $gaiaTag }
Invoke-Checked { Invoke-Gh release create $gaiaTag $gaiaZip "$gaiaZip.sha256" --verify-tag --repo Zaxaerith/ff7-GaiaGIS --title "GaiaGIS v$Version" --notes-file $Notes }
Invoke-Checked { Invoke-Gh workflow run deploy-pages.yml --repo Zaxaerith/ff7-GaiaGIS --ref main }
# Explicitly wait for matching Pages; avoid claiming a successful dispatch is deployment success.
$gaiaPages=$null
for ($gaiaAttempt=0;$gaiaAttempt -lt 20;$gaiaAttempt++) {
    $gaiaPagesRuns=Invoke-Gh run list --repo Zaxaerith/ff7-GaiaGIS --workflow deploy-pages.yml --commit $gaiaHead --json databaseId,status,conclusion,createdAt | ConvertFrom-Json
    if ($gaiaPagesRuns) { $gaiaPages=$gaiaPagesRuns[0];break };Start-Sleep -Seconds 3
}
if (-not $gaiaPages) { throw 'Pages run not found; post-release verification required' }
Invoke-Checked { Invoke-Gh run watch $gaiaPages.databaseId --repo Zaxaerith/ff7-GaiaGIS --exit-status }
$gaiaRelease=Invoke-Gh release view $gaiaTag --repo Zaxaerith/ff7-GaiaGIS --json isDraft,isPrerelease,assets,url | ConvertFrom-Json
if ($gaiaRelease.isDraft -or $gaiaRelease.isPrerelease -or $gaiaRelease.assets.Count -ne 2) { throw 'Post-release verification failed' }
if ((Git-Local rev-parse "$gaiaTag^{}") -ne $gaiaHead) { throw 'Wrong tag target' }
$gaiaVerification=Join-Path $gaiaRoot "output/distribution/verify-v$Version"
New-Item -ItemType Directory -Force -Path $gaiaVerification | Out-Null
Invoke-Checked { Invoke-Gh release download $gaiaTag --repo Zaxaerith/ff7-GaiaGIS --pattern ([IO.Path]::GetFileName($gaiaZip)) --pattern ([IO.Path]::GetFileName("$gaiaZip.sha256")) --dir $gaiaVerification }
$gaiaDownloaded=Join-Path $gaiaVerification ([IO.Path]::GetFileName($gaiaZip))
if ((Get-FileHash -LiteralPath $gaiaDownloaded -Algorithm SHA256).Hash.ToLowerInvariant() -ne ((Get-Content -LiteralPath "$gaiaDownloaded.sha256").Split()[0])) { throw 'Published ZIP checksum mismatch' }
Invoke-Checked { python -B scripts/smoke_windows.py $gaiaDownloaded --source $Source }
if ((Invoke-WebRequest 'https://zaxaerith.github.io/ff7-GaiaGIS/').StatusCode -ne 200) { throw 'Public Pages not reachable' }
Write-Output "Published $($gaiaRelease.url); main/tag $gaiaHead, CI and Pages successful; downloaded ZIP checksum and portable smoke passed. Complete the documented public browser checklist."
