# SPDX-License-Identifier: GPL-3.0-only
# Source in bash/zsh. Changes this shell only; all development writes stay in checkout.
if [ -n "${BASH_VERSION:-}" ]; then
  gaiaEnvironmentFile="${BASH_SOURCE[0]}"
elif [ -n "${ZSH_VERSION:-}" ]; then
  gaiaEnvironmentFile="${(%):-%x}"
else
  printf '%s\n' 'Source tools/build/environment.sh from bash or zsh.' >&2
  return 1
fi
gaiaWorkspace="$(cd -- "$(dirname -- "$gaiaEnvironmentFile")/../.." && pwd -P)" || return 1
gaiaRuntime="$gaiaWorkspace/output/dev/current/runtime"
gaiaCheck="$gaiaRuntime"
while [ "$gaiaCheck" != "$gaiaWorkspace" ]; do
  if [ -L "$gaiaCheck" ]; then
    printf 'Refusing redirected runtime path: %s\n' "$gaiaCheck" >&2
    return 1
  fi
  gaiaCheck="$(dirname -- "$gaiaCheck")"
done
mkdir -p -- "$gaiaRuntime" || return 1
export TEMP="$gaiaRuntime" TMP="$gaiaRuntime" TMPDIR="$gaiaRuntime"
export NPM_CONFIG_CACHE="$gaiaWorkspace/.cache/npm" PIP_CACHE_DIR="$gaiaWorkspace/.cache/pip"
export PLAYWRIGHT_BROWSERS_PATH="$gaiaWorkspace/.cache/playwright"
export PYINSTALLER_CONFIG_DIR="$gaiaWorkspace/.cache/pyinstaller" XDG_CACHE_HOME="$gaiaWorkspace/.cache"
export GAIAGIS_WORKSPACE_ROOT="$gaiaWorkspace/output/dev/current/mac-workspace"
export PYTHONDONTWRITEBYTECODE=1 PYTHONUTF8=1
unset gaiaEnvironmentFile gaiaWorkspace gaiaRuntime gaiaCheck
