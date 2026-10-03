# GaiaGIS

Transform the periodic polygonal world geometry of Final Fantasy VII into a mathematically defined spherical GIS model and derive standard map projections from that sphere.

当前为 **数学球面重建与 GIS 导出阶段**：解析 inverse Mercator、原 N/S cut、E/W 周期经度、合成海洋极帽。这是数学重建，不是 FF7 官方地理定义。Stage 0 资料保留，本阶段不扩展气候、剧情、WM2 bathymetry 或 POI 研究。

## 球面构建与测试

核心数学、caps 与 GLB writer 为 Python 3.12+ 标准库实现。GIS 使用本机已有 QGIS 的 GDAL/PROJ/PyQGIS，用于 GeoPackage、自定义 CRS、投影与工程验证，无需 pip 安装。QGIS 根目录为 `C:\MYAPPLY\QGIS`，其 Python 3.12 运行构建；项目 `.venv` Python 3.14 作为启动器。

```powershell
Set-Location D:\Project\FF7Gaia
.\.venv\Scripts\python.exe -B scripts\build_gaia.py `
  --source 'D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition' `
  --output output
.\.venv\Scripts\python.exe -B scripts\build_gaia.py --test `
  --source 'D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition'
.\.venv\Scripts\python.exe -B scripts\check_sphere_source.py --source `
  'D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition'
```

QGIS 位于别处时加 `--qgis-root '<安装根目录>'`，或设置 `GAIAGIS_QGIS_ROOT`。所有子进程 profile/temp/cache 显式隔离在 workspace。已经配置 QGIS Python 环境及 `PYTHONPATH=src` 时，也支持 `python -m gaiagis build-sphere --source <root> --output output`。

配置为 [config/default.toml](config/default.toml)；CLI 支持 `--radius`、`--vertical-scale`、`--ring-count`、`--flip-latitude`、`--flatten`、`--antimeridian-game-east`。参数变更后重新构建；目前 artifact 测试验证默认配置。完整 discovery 需要三张 MAP 与 LGP，构建只解析 WM0 base surface。

| 输出 | 内容 |
|---|---|
| `crs/gaia_geographic.wkt` | 自定义 Gaia spherical WKT2，无伪造 EPSG |
| `crs/gaia_*.wkt`, `*.proj` | raw engineering CRS 与四种投影 |
| `output/gis/gaia_raw.gpkg` | `gaia_raw_triangles` raw PolygonZ |
| `output/gis/gaia_geographic.gpkg` | `gaia_surface`、`gaia_ff7_surface`、`gaia_polar_caps`、`gaia_cap_vertices` |
| `output/gis/gaia_projections.gpkg` | Equirectangular、Mercator、Mollweide、Orthographic |
| `output/3d/gaia_sphere.glb` | 原 mesh indices 保留的米制球面 |
| `output/3d/gaia_sphere_metadata.json` | 原字段、UV、normals、lineage 与合成 cap 记录 |
| `qgis/Gaia.qgz` | 图层分组、terrain 渲染、CRS-aware 投影视图书签 |
| `output/reconstruction/` | 本轮指纹、参数、拓扑、测试日志、5 张验证 PNG |

QGIS 默认 Geographic canvas；查看投影时启用相应 group，选择同名 bookmark。terrain 是 **FF7 gameplay terrain / walkmesh class**，不是 GIS land cover；合成 ocean 的原 terrain/region/script/texture 和 FF7 lineage 为 NULL。

默认 R=6371008.8m 和 height scale=1m/raw unit 为 **Assumed**；inverse Mercator/caps 为 **Reconstructed**；投影为 **Derived**。原三角形顺序、绕序和索引保留，不焊接源顶点、不删重复面、不修内部缺口。GPKG Float64；GLB Float32、radial validation normals、double-sided material，无原纹理。Mercator 显式裁纬度、Orthographic 裁正面半球，检查非有限坐标。没有物理 vertical datum、DEM 或官方极点/尺度声明。

公式、闭合性与工程限制见 [docs/spherical-reconstruction.md](docs/spherical-reconstruction.md)。

## 数据安全

- 唯一项目可写位置：`D:\Project\FF7Gaia`。
- 本地游戏源：`D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition`，始终只读。
- 默认直接读取源，无游戏数据副本；所有输出、临时文件、venv 在工作区。
- MAP/LGP reader 只有 read API；输出路径先 resolve，并拒绝工作区外路径及游戏目录。
- Square Enix 的 MAP/BOT/LGP/TEX/executable 等资产不进入 Git，`local_data/` 已忽略。
- `output/` 包含可复现的统计及本机路径，默认不进 Git；参考源码缓存也不进 Git。
- 原有 `scripts/ff7_wm_validate.py`、`ff7_wm_topology_probe.py` 和旧 JSON 已保留。
  它们属于此前实验；本轮新结果由 `src/gaiagis` 独立实现生成。

## Stage 0 独立运行（本轮不需要重跑）

Stage 0 validator 为 Python 3.12+ 标准库实现，无需 QGIS；会更新 `output/validation/`，不是球面构建所需步骤。
在项目根目录运行 PowerShell：

```powershell
Set-Location D:\Project\FF7Gaia
$env:TEMP = 'D:\Project\FF7Gaia\output\tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force output\tmp | Out-Null
python -m venv --without-pip .venv
.\.venv\Scripts\python.exe -B scripts\validate_ff7_source.py `
  'D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition'
.\.venv\Scripts\python.exe -B scripts\run_tests.py --source `
  'D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition'
```

也可直接指定 `data\wm`、`data`、`ff7\workingdir` 或 extracted dataset 根目录。
discovery 显式忽略大小写、拒绝多个候选；当前完整 validator 需要三张 MAP 与 `world_us.lgp`。
布局或指纹不能证明发行渠道；不同版本使用同一个核心 parser，运行时版本差异留给未来 adapter。
未知 SHA 不会阻止结构检测。若结构不完整，明确输出失败并停止依赖完整数据的 Geography Probe。

本轮开始前的 `source_before.json` 是不可替代的任务初始快照。
完成整个研究后执行以下命令与其比较；不要用后来的 hash 重建或覆盖初始快照：

```powershell
.\.venv\Scripts\python.exe -B scripts\finalize_fingerprint.py `
  'D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition'
```

普通 validator 会比较自己运行前后指纹；finalize 则比较整轮任务前后指纹。
`run_tests.py` 不指定 `--source` 时运行合成数据单元测试，并明确标记真实源集成测试 skipped。

## 当前已验证数据

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| wm0.map | 3250176 | `43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C` |
| wm2.map | 565248 | `404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02` |
| wm3.map | 188416 | `70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3` |
| world_us.lgp | 3114259 | `975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C` |

这些值只是兼容性参考，不是 parser 接受条件。
WM0/WM2/WM3 全部 1360 meshes 解码成功。WM0 四边几何与高度精确周期匹配，
两条边缘 row 完全纯 Sea，但 UV 不严格相同，原 mesh 也不是已清理的二维 GIS TIN。

## 文件结构与结果

`src/gaiagis/`：SourceDataset/discovery、安全输出、LZSS、MAP 模型、LGP inventory、
空间统计、topology、orientation 研究 probe 与 CLI。
`tests/`：合成二进制、错误输入、格式不变量和真实数据集集成测试。
`scripts/`：validator、测试与最终指纹检查。
`docs/validation-report.md`：完整技术报告；`docs/research/`：资料与 commit/许可记录。
`output/validation/`：fingerprint、三张 summary、topology、region/terrain CSV、mesh grid、
LGP inventory/preflight、orientation candidates、SVG 验证图、测试日志及运行环境。

## 限制与下一阶段

MAP 没有内嵌网格尺寸；placement profile 与 story replacement 来自外部引擎研究，
再通过实际数量、范围、邻接和组外 perimeter 验证。
vertex records 是 mesh 表记录总数，不是唯一拓扑顶点数。
region 不是现实行政区，terrain 是 FF7 gameplay terrain / walkmesh class，不是 GIS land cover。
水平面积以 raw units² 统计，保留重叠、竖直面和来源；不假装是无重叠的地图分区面积。

本阶段保留这些原始验证输出。后续工程问题是可追溯的 soup repair policy、globe Float32 局部原点与纹理/法线着色；不把气候拟合、剧情或 WM2 拼接纳入当前任务。详见新报告中的证据分级。
