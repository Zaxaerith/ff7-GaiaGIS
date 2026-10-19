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

Both folder-selection methods read recognized products at the selected root only. Nested `.build/visual-recovery` copies are recovery material, so they do not collide with the current Pack or Manifest during browser folder import. Keep the matching recovery pair private.

Application version and data-format version serve different purposes. v4.4 retains Manifest v1, Field Context schema 3, Walkmesh v1, Interaction Pack v1, FieldLocal GeoPackage v1/v2 and existing GaiaJSON/WM0/WM2/WM3 contracts. Visual Pack v2 is an explicit optional upgrade; the Viewer also accepts Visual v1 generators `field-visual-1` and `field-visual-2` with their original record semantics. An otherwise compatible older Workspace does not need regeneration just because its `tool_version` differs from the Viewer version. Old visual resources retain their static preview; the state explorer needs v2 evidence.

The manifest's asset lengths/hashes and dependencies are checked, followed by each component's bounded parser and source bindings. Unsupported format versions, truncation or inconsistent `flevel.lgp`/maplist/world hashes are rejected; selecting unrelated individually valid files does not make them a matched Workspace. Inspect **Data → Resources** for the affected component and availability, then re-select the complete, source-matched generated folder. Do not edit hashes or invent missing payloads to bypass validation.

Old Field Context v1/v2 can retain scene identity/Graph and compatible Walkmesh browsing. Missing Spatial Anchors disable exact entrance/arrival navigation; missing visual data leaves Plan View available. Missing private packs in Public source-only mode are expected, rather than proof of a parsing failure. Data replacement invalidates incompatible Field navigation history and caches. Manual import uses one page-session request identity across the normal UI remount during geometry adoption; older manual validation/status cannot replace a newer choice. Automatic-local responses cannot replace an already validated manual Workspace. A rejected manual choice keeps its alert through automatic connection but does not block that valid connection; a successful manual retry clears the alert. Page exit invalidates requests, and cancelled source reads do not begin owner adoption.

## Available resources

The manifest describes geometry/metadata, locations, encounters, events, routing, WM0 textures, WM2/WM3 native geometry and textures, transitions, Explorer models/animation, presentation audio, Atlas and optional Field Context. Availability depends on valid original inputs and enabled generation options. Data UI reports availability rather than implying a missing asset has loaded.

Generation uses component input hashes. Authored Atlas changes rebuild Atlas without re-extracting textures or geometry. Missing/corrupt optional Atlas does not invalidate the rest of the workspace. Native maps keep their own coordinate semantics. See [workspace format](../reference/workspace-format.md) for schemas, compatibility and components.

Workspaces, local launch receipts, private screenshots and user saves remain ignored and must never enter public packages. Keep the existing Workspace, research exports and unique private evidence during upgrades; no routine upgrade requires deleting them. Disposable QA/build cleanup is separate from Workspace maintenance.

## Private camera/background resource

`gaia-field-visual.bin` is optional and independent of Context schema 3 / Walkmesh v1. Explicit format **v2**, generator **`field-visual-4`**, binds `flevel.lgp`, maplist and original Section-4/9 hashes. It retains all original tile descriptors while storing supported pixel blocks once per texture region. Referenced palettes and per-scene compression avoid a second full texture collection. Only the selected scene is decompressed; changing a state reuses its decoded pixels. Source/scene replacement, World return and owner disposal release scene resources.

Upgrade this component without rebuilding world geometry, WM textures, Atlas, routing, Explorer, Walkmesh, Interaction or GeoPackages:

```powershell
. tools/build/environment.ps1
python -m gaiagis field-visual --source "YOUR_FF7_INSTALLATION" --workspace output/local-workspace --audit output/dev/current/field-background-audit.json
```

The optional `--audit` target must be `.json` under `output/dev/current`; existing files must be owned `gaiagis-field-background-audit` version-1 reports. It cannot overwrite an existing Workspace, research product or source file; report replacement is atomic.

The existing Manifest and Context must match the original archive/maplist. The command builds and validates a candidate, rechecks inputs and current files, then replaces only the Visual Pack and Manifest. Failure during replacement restores the previous pair. Their private recovery copies remain in **`output/local-workspace/.build/visual-recovery`**; a two-file replacement is not a crash-atomic transaction. After an interrupted update, stop the local server, retain both old copies and restore the matching pair together before re-importing. The recovery directory is private generated output. Do not delete the existing Workspace to upgrade backgrounds.

Re-import the folder into the v4.4 Viewer. In **Field Walkmesh → Spatial visualization → Background Overlay**, expand **Background State Explorer**. It starts with the unconditional static base. Choose a Group and State Bit, then explicitly enable selected conditional tiles; only one Group/bit is previewed at a time. Reset returns to the static base. Visible original-tile and unsupported counts describe the current selection. Expand source details for layer-local Tile IDs, Section-9 offsets, layer/page/palette, Group, mask, raw depth and draw order. Selecting a Trigger merely exposes evidence; **Preview associated background state** is the deliberate action that changes this research preview. `Trigger.state` is a bit index; tile state is a mask, matched by `tile.state & (1 << trigger.state)` within the same Group.

Supported reconstruction covers Layer 0 and ordinary Layer 1 using 4-bit indexed, 8-bit indexed or verified PC16 direct-color pages. Generator 4 additionally composites indexed Type 1/2 blends. Layer 0 ignores its unused condition/blend operands. Layer 2/3 retain original 32×32 descriptors and generator-4 research pixels; only an explicit Experimental switch displays them at raw positions because runtime scrolling/wrapping is unverified. Inconsistent Group/mask operands remain unsupported evidence. Original target coordinates outside ±4096 retain their descriptors and complete texture/Palette validation, but have no preview pixels and are excluded from fixed preview bounds. Their omissions remain visible; this does not prove a runtime parking convention. Fractional Type 0/3 and PC16 blending remain unsupported; no arbitrary Canvas alpha substitutes for them. Palette animation and runtime occlusion are also unverified. User selections are labelled **research background state preview; not a verified original runtime state**. BGON/BGOFF/BGCLR/BGROL/BGROL2 or Palette instructions are static evidence only; the Viewer runs no story branches, variables or event simulation.

`static_complete` means all applicable tiles for the unconditional base were reconstructed. `static_partial` means the base contains supported pixels plus explicit omissions. `unsupported` has no safely drawable base, `invalid_source` violates a confirmed structural/reference constraint, and `unknown` lacks sufficient format evidence. A selected conditional combination has its own visible/unsupported counts and may be partial even when the base is complete. Parsing failure and absence of a static base are separate outcomes; neither is replaced with a fabricated image. Camera View and Plan View remain available independently of background success.

Visual v1 `field-visual-1` retains Layer 0; v1 `field-visual-2` retains its original indexed Layer 0 plus unconditional unblended Layer 1 subset. Their 8-byte descriptors are never read as v2's 36-byte descriptors. An old Workspace opens without this optional upgrade; missing visual data leaves Walkmesh and validated cameras usable. Visual v1 keeps its **64,000,000-byte** total limit. Explicit v2 / `field-visual-3` permits **96,000,000 total bytes**; generator 4 alone permits **100,000,000 bytes**, following a measured 98.1 MB full-archive candidate; metadata stays **8,000,000 bytes**, each decoded scene **8,000,000 bytes** and composition **4,000,000 pixels**. The earlier generator-3 v2 candidate was about 86.1 MB versus 54.0 MB for the old v1 subset: broader Field coverage, conditional pixels and PC16 increase disk storage, while the File owner lazily reads only the header and selected scene. Generator 3 measured a 0.990 MB header and 0.528 MB largest decoded scene; generator 4 measures 1.042 MB and 0.763 MB respectively; pack size is not simultaneous decoded-texture memory. No background image, Palette, texture page, LGP or private Pack belongs in public Viewer assets or a Release. [Binary contract](../reference/workspace-format.md#optional-field-visual-transport).

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

### Multilayer compositing research (v4.4)

In the existing State Explorer, expand **Layers and compositing**. Layer 0/1 are enabled by default. Indexed Type 1 additive and Type 2 subtractive tiles use explicit integer pixel equations. Type 0/3 and PC16 blending stay omitted with diagnostics. **Only opaque tiles** recovers the older opaque rendering; **Research: outline blended tiles** marks contributing tile borders in magenta and is not an original-game appearance.

To inspect Layer 2 or Layer 3, enable that layer and **Experimental: raw positions for Layer 2/3**. Disable the other layers to inspect its full 32×32 source rectangles. This uses original target positions and stored order; camera-dependent scrolling, dynamic depth and initialization are unknown. It is never enabled automatically. Each layer lists raw/state-applicable/shown/blend counts and omission reasons. Reset restores base-only Layer 0/1 and clears research modes. Group/State remains a manual selection; Trigger selection never activates a state by itself.

Existing v4.3 generator-3 packs still decode exactly as before but do not contain blend or Layer 2/3 pixels. Run the incremental command above to obtain generator 4. Earlier v1 recovery and any previous recovery pair are preserved; later matching backups use `.build/visual-recovery/<manifest SHA256>/`. These are private recovery files, not public assets. Source spans now check actual Section-9 length in generator 4; old packs retain their bounded legacy contract.


## Private Field script evidence

An older Workspace remains usable without the optional script evidence. To add
only this product, use a source-matched existing Workspace:

```powershell
. tools/build/environment.ps1
python -m gaiagis field-script-evidence --source "YOUR_FF7_INSTALLATION" --workspace output/local-workspace --audit output/dev/current/field-evidence-registration/script-index-audit.json
```

The source is read-only. The updater stages and validates a separate bounded
resource, binds Context and original Section 1/8/source hashes, reads it back and
updates its Manifest entry. A matching previous Manifest/resource pair is kept
under the private `.build/script-evidence-recovery` directory. Interrupted
replacement is recoverable, not a claim of crash-atomic two-file publication.
The prior Visual/Interaction/Walkmesh, GIS products and recovery pairs are not
rebuilt. Re-import the folder in the new Viewer. Do not select the game directory
as a Workspace and do not publish the generated script-evidence file.

## Native map raw GIS

WM2/WM3 need no new Workspace product. In Map select a Native map, then Analysis → Native TIN diagnostics; inspect ordinary faces or filter zero X/Z area, true 3D degeneracy, duplicates and edge incidence. All source faces restores normal layer colouring. Selected-corner X/Z measurement uses raw units and ignores display relief. Source vertex-table IDs and padding are available through the independent private [Native GeoPackage export](../reference/native-gis.md). QGIS may display Meter for undefined Cartesian data; this does not make FF7 raw units physical metres.
