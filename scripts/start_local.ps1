# SPDX-License-Identifier: GPL-3.0-only
param([Parameter(Position=0)][string]$Source, [switch]$NoOpen)
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
. "$PSScriptRoot/use_workspace_environment.ps1"
$localArguments = @('-B', '-m', 'gaiagis.local')
if ($Source) { $localArguments += @('--source', $Source, '--remember-source') }
if ($NoOpen) { $localArguments += '--no-open' }
python @localArguments
exit $LASTEXITCODE
