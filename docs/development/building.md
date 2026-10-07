# Building and development

All project writes, caches and outputs belong in the checkout. Original installations and saves are read-only. Start PowerShell sessions with `. tools/build/environment.ps1` to set workspace-local temporary/npm/Playwright paths.

## Python

Use a workspace `.venv`, install `pyproject.toml` with `pip install -e .`, or use the root checkout adapter. `src/gaiagis/_version.py` is the single application-version authority; setuptools metadata, launcher status, Viewer build and portable packaging derive from it. Schema/generator compatibility versions are separate contracts.

```text
gaiagis --version
gaiagis local --source YOUR_FF7_INSTALLATION
gaiagis build-workspace --source YOUR_FF7_INSTALLATION --output output/local-workspace
gaiagis validate --help
gaiagis build-sphere --help
```

The full developer spherical GIS exporter can use an installed QGIS/GDAL runtime selected with `GAIAGIS_QGIS_ROOT`. The portable workspace runtime uses its bundled transport and needs no QGIS installation. The shared native-map workspace exporter is used by both source and frozen launchers.

## Web

Node 24: `npm --prefix web ci`, `npm --prefix web test`, `npm --prefix web run build`. Source-only public builds use `build:release` followed by `audit:release`; they never copy private packs. Vite reads the Python version authority through `web/scripts/version.mjs`.

## Local portable recipe verification

Use pinned CPython 3.14.7, create `.cache/packaging-venv`, install `tools/build/requirements.txt`, and run its Python on `tools/build/local_package.py`. The recipe automatically performs portable launch smoke and removes the local ZIP/build on success. Add `--keep-artifacts` only when intentionally retaining a temporary candidate. A separately invoked `portable_smoke.py` accepts a read-only `--source` for cold workspace verification; it always removes its extracted tree on success, and removes input distribution artifacts unless `--keep-artifacts` is supplied.

Local artifacts validate the recipe only. Jobs use disposable `output/dev/current/`; failures retain only current necessary evidence under `output/dev/failed-package/` or `failed-smoke/`. The next successful corresponding job clears its previous failure. See [release process](release-process.md) for the exact-tag Actions build that explicitly retains official upload artifacts.

## Output cleanup

`gaiagis clean-output` previews paths and expected bytes without deleting. `gaiagis clean-output --execute` deletes disposable output while retaining `output/local-workspace` and `output/dev/STATUS.md`. Add `--all` to include the regenerable workspace. Filesystem redirects and active job ownership are rejected. The command never acts outside workspace/output.
