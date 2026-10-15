# Local workspace

A workspace is GaiaGIS-generated data, not the FF7 installation or its raw `wm` folder. The default location is **`output/local-workspace`**, relative to the checkout or portable package. The alternative root `local-workspace` folder is not the launcher default. Web is the primary Viewer; the same generated folder can be selected in its Data panel without running the native launcher.

Historical, unmaintained macOS behaviour (not a current distribution target): `output/local-workspace` is relative to the dedicated writable root **`~/Library/Application Support/GaiaGIS`**. App resources stay read-only in `GaiaGIS.app/Contents/Resources`. The launcher displays the writable root; remembered source, caches, temporary files and logs stay beneath it. `GAIAGIS_WORKSPACE_ROOT` or the Mac app's `--workspace-root` launch argument can explicitly select an absolute dedicated root. Developer/packaging tests always use a checkout-local override. Windows EXE and source-checkout defaults are unchanged.

## Automatic connection

Run `python -m gaiagis local --source "YOUR_FF7_INSTALLATION"` (or the portable EXE). The launcher generates missing components, reuses compatible components, serves only allowlisted workspace payloads and supplies local status. The Viewer connects automatically. The source installation is strictly read-only.

The Data status card distinguishes auto-local, manually selected folder and public source-only mode. Local mode can display the workspace path; paths are never put in public share links.

## Manual selection

Use **Data → Workspace Folder** and choose the generated folder containing `gaia-workspace.json`. Do **not** select the installation or its `wm` directory. The folder picker checks the manifest and reports missing/invalid components. Public source-only mode remains usable when optional components are absent. Manual file handles stay in the current page session; re-select the folder after refresh. Auto-local mode instead reconnects to its still-running loopback launcher/server.

An explicit build is available:

```powershell
python -m gaiagis build-workspace --source "YOUR_FF7_INSTALLATION" --output output/local-workspace
```

For an existing workspace, run this command with its **same output folder**. Generation checks component hashes and generator compatibility, preserves reusable world/GIS components, and updates the manifest. The explicit builder is incremental by default; avoid the local launcher's full `--rebuild` for a Viewer upgrade. A Viewer upgrade alone does not add missing private resources to an older workspace. Fresh source geometry generation requires GDAL/QGIS or a compatible existing Stage-1 cache; an incremental build with reusable core geometry does not regenerate it.

For Camera View / Background Overlay, the folder must contain `gaia-field-context.json`, `gaia-field-walkmesh.bin` and `gaia-field-visual.bin`, registered in `gaia-workspace.json`. After generation finishes, use **Data → Workspace Folder** in the browser to select that updated folder again. This works with the ordinary Web Viewer; neither the Windows EXE nor the auto-local server is required. The browser imports generated files only and does not generate resources from the game installation.

## Compatibility and failed imports

Application version and data-format version serve different purposes. v4.0 retains Manifest v1, Field Context schema 3, Walkmesh v1, visual pack v1, FieldLocal GeoPackage v1 and existing GaiaJSON/WM0 exchange contracts. An otherwise compatible v3.x Workspace does not need regeneration just because its `tool_version` differs from the Viewer version.

The manifest's asset lengths/hashes and dependencies are checked, followed by each component's bounded parser and source bindings. Unsupported format versions, truncation or inconsistent `flevel.lgp`/maplist/world hashes are rejected; selecting unrelated individually valid files does not make them a matched Workspace. Inspect **Data → Resources** for the affected component and availability, then re-select the complete, source-matched generated folder. Do not edit hashes or invent missing payloads to bypass validation.

Old Field Context v1/v2 can retain scene identity/Graph and compatible Walkmesh browsing. Missing Spatial Anchors disable exact entrance/arrival navigation; missing visual data leaves Plan View available. Missing private packs in Public source-only mode are expected, rather than proof of a parsing failure. Data replacement invalidates incompatible Field navigation history and caches. Manual import uses one page-session request identity across the normal UI remount during geometry adoption; older manual validation/status cannot replace a newer choice. Automatic-local responses cannot replace an already validated manual Workspace. A rejected manual choice keeps its alert through automatic connection but does not block that valid connection; a successful manual retry clears the alert. Page exit invalidates requests, and cancelled source reads do not begin owner adoption.

## Available resources

The manifest describes geometry/metadata, locations, encounters, events, routing, WM0 textures, WM2/WM3 native geometry and textures, transitions, Explorer models/animation, presentation audio, Atlas and optional Field Context. Availability depends on valid original inputs and enabled generation options. Data UI reports availability rather than implying a missing asset has loaded.

Generation uses component input hashes. Authored Atlas changes rebuild Atlas without re-extracting textures or geometry. Missing/corrupt optional Atlas does not invalidate the rest of the workspace. Native maps keep their own coordinate semantics. See [workspace format](../reference/workspace-format.md) for schemas, compatibility and components.

Workspaces, local launch receipts, private screenshots and user saves remain ignored and must never enter public packages. Keep the existing Workspace, research exports and unique private evidence during upgrades; no routine upgrade requires deleting them. Disposable QA/build cleanup is separate from Workspace maintenance.

## Private camera/background resource

`gaia-field-visual.bin` is optional and independent of Context schema 3 / Walkmesh v1. Its metadata binds `flevel.lgp` and maplist SHA256 to Field identities. Generator revision `field-visual-2` includes indexed Layer 0 and unconditional, unblended Layer 1 tiles, in stored depth/sub-ID order. The pack schema remains v1; the compact descriptor's texture byte uses bit 6 for Layer 1, preserving the layer-local tile ID and Section-9 offset. Older `field-visual-1` resources remain readable but contain only Layer 0; an incremental build replaces only the visual component to obtain the corrected static background. Indexed texels, only referenced palettes and fixed-size source descriptors are compressed per scene; the selected scene is bounded, hashed and decoded on demand. There is no PNG collection or copied LGP. The whole optional pack is capped at 64 MB, metadata at 8 MB, a decoded scene at 8 MB and composed image at 4 million pixels. One selected-scene cache is released on source/scene replacement and application disposal.

Generation is one separate incremental component; it reuses unrelated world/GIS outputs. Delete only this optional file to clear its private visual cache; the next workspace build regenerates it. Never put it in public Viewer assets or a Release. Failed background parsing leaves cameras and Plan View available, with explicit unsupported status; background omissions are not repaired with placeholder textures.


## Optional Field Interaction resource

`gaia-field-interaction.bin` is a separate private format v1. Existing Context schema 3, Walkmesh v1, visual resources, WM0 exchange and FieldLocal GeoPackage v1 do not change. Old Workspaces retain Graph, Walkmesh, anchors and cameras without this pack; the v4.1 Viewer explains that interaction evidence is unavailable.

Add it to the existing source-matched folder without rebuilding world maps, background pixels, Atlas or research GeoPackages:

```powershell
. tools/build/environment.ps1
python -m gaiagis field-interaction --source "YOUR_FF7_INSTALLATION" --workspace output/local-workspace
```

The command requires the existing validated Manifest, Context and Walkmesh, refuses mismatched flevel/maplist identity, builds its candidate before replacing files and updates only the pack plus Manifest entry. Normal incremental Workspace generation also registers this optional component. Re-import **Data → Workspace Folder** in the v4.1 browser Viewer; there is no requirement to run the native launcher. Windows Release and hosted Pages updates are separate; use a v4.1 Viewer for this resource.

The pack retains Trigger slots/raw bytes, entry-rooted LINE/LINON/SLINE records, every Actor/script-entry alias and conservative decoding stops. Literal SLINE is modification evidence, never initial state; dynamic banks remain addresses and produce no invented line. Raw XYZ remain local units. Exact 3D, XY-only and Disjoint records are retained, with all candidate triangle IDs and optional validated background group/mask evidence. Runtime enabling, collision range and story conditions remain UNKNOWN.

One source-bound header indexes compressed JSON spans, decoded only for the selected scene. Limits: pack 8,000,000 bytes; metadata 512,000 bytes; a decoded scene 2,000,000 bytes. Each scene has a payload hash and raw Section-5 hash; the Viewer compares that hash to its loaded original mesh, including raw4 and Access. Source/scene replacement and owner disposal clear selected records and decoded scene references. It stores no background images or copied LGP and adds no network file-reading API.

## FieldLocal GeoPackage research export

This optional source CLI exports one scene from an existing private workspace. It does not generate game data or modify the workspace. Use Python providing **GDAL >= 3.9**; on Windows an installed standalone QGIS/OSGeo4W environment can be selected through the existing runtime adapter:

```powershell
. tools/build/environment.ps1
$env:GAIAGIS_QGIS_ROOT = "C:/path/to/QGIS"
python -m gaiagis field-gis export --workspace output/local-workspace --field mds5_5 --output output/exports/fieldlocal/mds5_5-research.gpkg --start-triangle 16
```

The QGIS root contains `bin/python.exe`, `apps/Python3*` and `apps/qgis/python`. A Python environment already providing `osgeo` needs no root override. QGIS/GDAL is not included in the Windows portable Viewer; the browser requires neither. No browser button claims to generate a GeoPackage.

Omit `--start-triangle` for components only: Triangle 0 is never an implicit entrance. Add `--end-triangle 115` with a start for a minimum directed Access-hop path. An unreachable path has no fabricated geometry. Default/Alternative entrances retain independent IDs/triangles. No cross-Field route or runtime script execution is inferred.

Each output belongs to one Field and uses **Undefined Cartesian `srs_id=-1`**, original X/Y/Z, no axis change, translation, scale or geographic reference. Do not assign EPSG:4326, WGS84 or GaiaGame. In QGIS, keep ellipsoidal measurements disabled; Cartesian `length($geometry)` / `area($geometry)` results are Raw Unit / Raw Unit², not metres. Different Fields have independent coordinate spaces and should be opened separately.

The five spatial layers are `walkmesh_triangles` (Polygon Z), `walkmesh_edges` and `gateway_segments` (LineString Z), `field_entrances` and `arrival_points` (Point Z). Nonspatial tables are `raw_vertices`, `anchor_records`, `gateway_candidates`, `network_components`, `network_path` and `field_metadata`. Empty layers are retained. Query `triangle_id`, classify triangles by `wcc_id`/`scc_id`, and query edges with `blocked = 1` or a specific `from_triangle`; edge slots remain directed Access evidence. Gateway candidates preserve one-to-many exact 3D relations, without snapping XY-only geometry.

XYZ and raw4 retain original S16 integers and source-relative offsets. Raw4 is an integer attribute, never M or a verified collision/height flag. Point Z for entrances/arrivals is explicitly **Derived Raw Z** from the designated triangle plane; their original records provide XY only. Degenerate polygons remain unchanged, with diagnostics and independent vertex records. The private format is `gaiagis-fieldlocal-gpkg` version 1, recording source hashes and **Static Walkmesh Topology — Not Verified Gameplay Reachability**.

Only new `.gpkg` files beneath the ignored `output/exports/fieldlocal` directory are allowed. Existing files are refused; choose a new name. Export uses bounded staging, at least 256 MB free disk, a 128 MB output limit, source rechecks and SQLite/OGR validation before atomic delivery. It reads/hashes the existing pack but decodes only the selected raw Section 5. There is no automatic all-Field export or copied LGP/background collection.

Open the GeoPackage in QGIS, inspect all layers/tables and raw attributes, classify WCC/SCC, locate anchors, then save a **research copy** and reopen it. Editing that copy does not modify FF7 or update GaiaGIS source evidence. The exporter never writes changes back. Keep exports, projects and screenshots private and ignored; do not include them in Pages, source commits or Release assets. Camera/background visualization stays in Web; no GeoTIFF, orthophoto or geographic control points are exported.

### Interaction GIS: explicit v2

Omitting `--format-version` (or selecting `1`) keeps the eleven v1 layers/tables and fields. Use v1 for original mesh/anchors/network research or when the optional interaction pack is unavailable. Use `2` to query original interaction evidence in QGIS:

```powershell
. tools/build/environment.ps1
$env:GAIAGIS_QGIS_ROOT = "C:/path/to/QGIS"
python -m gaiagis field-gis export --workspace output/local-workspace --field mds5_1 --format-version 2 --output output/exports/fieldlocal/mds5_1-interaction-v2.gpkg
python -m gaiagis field-gis export --workspace output/local-workspace --field elm --format-version 2 --start-triangle 119 --output output/exports/fieldlocal/elm-interaction-v2.gpkg
```

Choose unused output names. V2 requires a registered, matching `gaia-field-interaction.bin`; a missing/corrupt/mismatched pack is rejected before delivery. Generate it separately with the [interaction increment](#optional-field-interaction-resource) if needed; export itself never reads the game installation or regenerates assets. V1 remains usable without this optional file. Existing five research GeoPackages are not upgraded or overwritten.

V2 adds `field_triggers` and `script_lines` (LineString Z), plus six nonspatial tables: `interaction_scripts`, `interaction_memberships`, `interaction_line_links`, `interaction_candidates`, `interaction_background`, `interaction_stops`. A LINE has one geometry per original instruction offset; its multiple Actor/entry memberships remain separate rows. LINON and all SLINE records remain nonspatial evidence. Constant SLINE coordinates describe a possible modification, not an unconditional initial line; dynamic bank operands are not coordinates. `runtime_active` is NULL everywhere.

### QGIS 中文操作与查询

1. 先复制需要保留原始文件哈希的研究文件，再在 **浏览器** 面板找到新 `.gpkg`，展开并把所需图层拖到地图；也可用 **图层 → 添加图层 → 添加矢量图层**。表没有地图几何，但可打开属性表。每个 Field 单独研究，保留未定义 Cartesian CRS；不要在 CRS 提示中指定 WGS84、EPSG:4326 或米制投影。
2. 右键 `field_triggers` → **打开属性表**，使用 **筛选** 查询 `group_id = 4` 或 `geometry_relation = 'disjoint'`。在 **属性 → 符号系统 → 分类** 中按 `behavior` / `group_id` 分类，再点击 **分类**。LINE、Gateway 和网格保持不同线型；颜色不说明运行时启用状态。
3. `script_lines` 用 `instruction_offset` 查询原始 LINE；`interaction_memberships` 中用同一 `field_id` + `instruction_offset` 查询 `actor_name`、`script_slot`、`entry_offset`。共享指令不等于一个 Actor 独占。
4. 打开 **数据库 → 数据库管理器**，连接该 GeoPackage，进入 **SQL 窗口** 查询来源或全部候选。例如：

```sql
SELECT l.instruction_offset, m.actor_name, m.script_slot, m.entry_kind
FROM script_lines AS l JOIN interaction_memberships AS m
ON l.field_id=m.field_id AND l.instruction_offset=m.instruction_offset;

SELECT c.record_type, c.record_id, c.triangle_id, c.exact_3d,
       c.xy_only, c.reachable, t.wcc_id, t.scc_id
FROM interaction_candidates AS c JOIN walkmesh_triangles AS t
ON c.field_id=t.field_id AND c.triangle_id=t.triangle_id;
```

5. `interaction_background` 的 `state_bit` 是编号，`state_mask` 是瓦片位掩码；匹配条件是 `state_mask & (1 << state_bit)` 非零。`tile_count` 与 `source_offset` 是 Section 9 静态来源证据，未复制背景像素。`unknown` 保留严格背景解析失败原因。
6. 只有显式 `--start-triangle` 的快照才有 BFS。候选表的 `reachable` 只给精确 3D 候选；XY-only 保持 NULL。无候选或 Disjoint 不表示原版事件无效。不要把最少 Access 跨边数当作角色轨迹。
7. 用 **项目 → 另存为** 保存私有 `.qgz`。若要编辑，用资源管理器先复制 `.gpkg` 为研究副本，再在 QGIS 开启编辑、保存、关闭并重开。编辑副本不写回 FF7，也不成为新的 GaiaGIS 原始证据。

PyQGIS 自动化验收与桌面人工验收分开记录。当前本机 QGIS 的多层筛选可能显示计数 -1，并报 SQLite 打开错误；原有 v1 同条件也会发生，实际过滤记录和独立 SQLite/OGR 查询一致。遇到此情况可用数据库管理器核对结果，并在桌面复核计数；不得把 -1 当作空图层或成功计数。无地理 CRS 的 PROJ 警告不应通过赋予虚假 CRS 消除。
