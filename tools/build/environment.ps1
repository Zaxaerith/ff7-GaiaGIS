# SPDX-License-Identifier: GPL-3.0-only
# Dot-source for the current shell only; never changes global/user settings.
$gaiaWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$gaiaRuntime = Join-Path $gaiaWorkspace 'output\dev\current\runtime'
$gaiaCheck = $gaiaRuntime
while ($gaiaCheck -and $gaiaCheck -ne $gaiaWorkspace) {
    $gaiaEntry = Get-Item -LiteralPath $gaiaCheck -Force -ErrorAction SilentlyContinue
    if ($gaiaEntry -and ($gaiaEntry.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Workspace runtime path contains a filesystem redirect: $gaiaCheck"
    }
    $gaiaCheck = [IO.Path]::GetDirectoryName($gaiaCheck)
}
New-Item -ItemType Directory -Force -Path $gaiaRuntime | Out-Null
$env:TEMP = $gaiaRuntime
$env:TMP = $gaiaRuntime
$env:NPM_CONFIG_CACHE = Join-Path $gaiaWorkspace '.cache\npm'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $gaiaWorkspace '.cache\playwright'
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:PYTHONUTF8 = '1'
