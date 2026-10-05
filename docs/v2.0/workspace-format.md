# Private local workspace

`python -B -m gaiagis.build_workspace --source "YOUR_FF7_INSTALLATION" --output local-workspace`
is the unified CLI. With an editable project installation the equivalent entry
point is `gaiagis-build-workspace`. See [user guide](../user-guide.md) for environment
setup, GDAL/QGIS and optional `--stage1` cache reuse.

## Manifest

`gaia-workspace.json` uses schema `gaiagis-workspace`, version **1**. Application
version (`tool_version: 2.0.0`) and generator revision are separate from the format
version. `timestamp_policy: omitted` explicitly avoids wall-clock timestamps.
Source keys and asset filenames are safe basenames; there are no absolute paths.
Each asset stores filename, logical type, mapId, SHA-256, byte size and dependency
filenames. Sources bind read MAP/BOT/LGP and available field archive fingerprints.
This real manifest is itself local/private and ignored by Git.

Public synthetic examples/tests contain fabricated hashes and payloads only.
The manifest is a discovery/provenance contract; it does not replace codec checks.
The browser checks hashes before adoption, map identity, declared references/cycles,
dependency availability and cross-asset source hashes, then calls existing codecs.
Unsupported transport versions are rejected. Missing optional assets degrade
independently; a missing or invalid base geometry prevents workspace adoption.

## Inventory

| Logical data | Files | Domain/dependency |
|---|---|---|
| Geometry | gaia-meta.json + gaia-mesh.bin | WM0/V1, required for full workspace |
| Locations | gaia-poi.json | WM0 source lineage |
| Encounters | gaia-encounters.json | WM0 region/terrain |
| World events | gaia-events.json | WM0 anchors/lineage |
| Routing | gaia-routing.bin | WM0 source topology |
| Original textures | gaia-textures.bin | matching WM0 mesh/source |
| Native maps | gaia-map-WM2.bin, gaia-map-WM3.bin | independent native domains |
| Native textures | gaia-textures-WM2.bin, gaia-textures-WM3.bin | respective native map |
| Transitions | gaia-transitions.json | source hashes, unresolved transforms retained |
| Explorer | gaia-explorer.bin | version2 borrows matching loaded map surfaces |

Thirteen payload files comprise twelve logical groups. No geometry is duplicated
into a workspace wrapper. Folder loading reads recognized root files only, using
the user-initiated directory picker or folder-input fallback. Multi-file loading
works without File System Access API. Unmanifested legacy sets are labeled Legacy.

## Incremental and deterministic behavior

The CLI calls stable individual exporters in eight steps. A step is reused only
if manifest/schema/tool/generator/source bindings and every file size/hash match.
Missing/corrupt output rebuilds its owning step. A failed build does not publish a
new manifest. Outputs, private Stage 1 cache and temporary native reports remain
inside the repository; output inside the selected source dataset is rejected.

Repeated builds with identical source/runtime/cache inputs retain byte-identical
payloads and manifest. Do not confuse this with portability across every runtime:
different zlib versions may compress identical PNG pixels differently, and fresh
GeoPackage provenance includes the actual generated cache hash. Imported Stage 1
cache versus newly generated Stage 1 are distinct inputs. Both paths were tested;
their WM0 geometry and non-texture gameplay outputs agree exactly. This limitation
does not alter decoded texture semantics, geometry or dataset compatibility.
