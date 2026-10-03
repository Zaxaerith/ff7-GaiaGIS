# GaiaGIS 阶段 0 技术验证报告

日期：2026-10-02（Asia/Hong_Kong）。本轮范围为独立只读解析、结构/拓扑与 Geography Probe。
没有实施正式 GIS conversion、DEM、等高线、坡度、hillshade、CRS、地图投影、球体或 synthetic poles。

## 1. 证据等级与范围

- **Observed**：本机二进制读取直接产生的 size/hash、记录数、字段、坐标与精确匹配。
- **Derived**：基于明确公式和外部 placement profile 计算的空间统计、邻接与位置焊接诊断。
- **Reconstructed**：参考经典引擎的 WM2 窗口模型、hypothetical orientation 候选。
- **Assumed**：probe 的 ocean 集合 {3,6,26}、面积选择、气候阈值等显式分析约定。
- **Unknown**：尚未验证的运行时行为、实际地理纬度、现实尺度、垂直基准与 POI 完备性。

“game_north”是第二水平坐标轴名称，并不宣称其正向是 Gaia 真实北方。
“geometrically periodic”有精确边界证据；“完美 torus GIS TIN”没有得到证明。

## 2. 输入与安全

唯一可写工作区：`D:\Project\FF7Gaia`。
读取源：`D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition`。
resolved world 目录：`ff7\workingdir\data\wm`。
直接只读读取，无游戏数据副本；没有在游戏目录运行、写缓存、创建 venv、解压或保存文件。
早期实验脚本/结果保留，新 parser 未调用旧脚本，也未执行第三方 editor/engine。
输出 guard resolve 路径及 junction/symlink 后要求落在工作区，拒绝游戏目录。
合成测试文件在 `output/tmp` 中创建并清理；Python 用 `-B`，venv 在 `.venv`。
参考源码缓存和所有 proprietary binary 扩展被 Git 忽略，未复用未授权参考源码。

**FF7 source modified: NO**

以下是整轮任务初始快照与报告时重新读取的比较，而非仅与用户给定值比较。


| 文件 | bytes 前→后 | SHA-256 before | SHA-256 after | 前后一致 | 参考匹配 |
| --- | --- | --- | --- | --- | --- |
| wm0.map | 3250176 → 3250176 | 43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C | 43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C | YES | MATCH |
| wm2.map | 565248 → 565248 | 404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02 | 404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02 | YES | MATCH |
| wm3.map | 188416 → 188416 | 70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3 | 70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3 | YES | MATCH |
| world_us.lgp | 3114259 → 3114259 | 975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C | 975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C | YES | MATCH |


额外记录并对比了 wm0.bot/wm2.bot/wm3.bot；详见 `source_fingerprint.json`。
哈希覆盖四个核心文件和三份 BOT，并非整个安装目录的 hash census。
本轮只对 MAP/LGP 做结构解析，BOT 只做 fingerprint/大小检查，没有重建 BOT。
wm0.bot 为 332 个 0xB800 blocks，wm2.bot 为 48、wm3.bot 为 16；这些规模与冗余加载布局相符，内容等价性未逐块验证。

fingerprint 只标记 known-compatible FF7 2026 数据；Unknown SHA 继续解析结构。
SourceDataset 将布局发现与核心 parser 分离，不读取 Steam AppID；GOG/2013/2026 的
实际渠道不能仅凭目录判断，当前 adapter 层尚未实现 exe/memory/语言差异。

## 3. 自有 MAP/LZSS 模型与轴

section=0xB800；前 64 bytes 为 16 个 little-endian offset；每 record 为 compressed_size + LZSS。
零初始化 4096 ring、cursor=4096-18、LSB-first flags、reference length=low_nibble+3。
每 mesh header 两个 uint16；triangles=12 bytes，vertices/normals 各 8 bytes。
精确检查解压长度=4+12*T+16*V、offset 对齐与 bounds、record overlap、byte index table 与引用范围。
保留 padding、terrain/script byte、raw_ids 和 bit14，避免丢失未解释字段。

| 层次 | 轴映射 |
|---|---|
| FF7 binary | raw_x、raw_y、raw_z，都是 signed int16 mesh-local 值 |
| Landscaper rendering | X=(raw_x+mesh_x_offset)*0.05，Y=raw_y*0.05，Z=(raw_z+mesh_z_offset)*0.05 |
| GaiaGIS game-space | game_east=raw_x+col*8192；game_north=raw_z+row*8192；game_height=raw_y |

game_height 保留存储符号，不转米、不宣称 positive-up 或已知 sea-level datum。
runtime entity、camera、savemap 的 vertical 符号不能未经核对混用。
save-coordinate wiki 的 X/Y/Z 命名与 MAP binary XYZ 也不同，已单独记录来源。
每 triangle 可回溯 source_file/map_id/section_id/mesh_id/triangle_id。
parser 没有 write/save/rebuild 接口，也不依赖 GUI/QGIS/GIS 库。

MAP 无内嵌 grid header；9x7、3x4、2x2 是外部格式 profile。
实际 section count、mesh placement、坐标范围与邻接用于验证这些解释。
它们不是从文件长度唯一推导出来的 hidden metadata。

## 4. 实际结构与解析统计


| map | sections | grid | meshes 全部/base | base triangles | vertex records base | height | 失败/invalid refs |
| --- | --- | --- | --- | --- | --- | --- | --- |
| WM0 | 69 | [36, 28] | 1104/1008 | 142586 | 88950 | [-738, 4086] | 0/0 |
| WM2 | 12 | [12, 16] | 192/192 | 9967 | 6307 | [-7943, 3891] | 0/0 |
| WM3 | 4 | [8, 8] | 64/64 | 8268 | 5222 | [-7, 1372] | 0/0 |


WM0 总 triangles（含 alternatives）157791、vertex records 98271；基础 63 sections/1008 meshes。
三张图全部实际 records 解码成功，decoded trailing bytes=0，base bit14=0。
WM0 observed extent：east 0..294912、north 0..229376；WM2：0..98304、0..131072；WM3：0..65536 双轴。
这些 vertex records 不是“全球唯一顶点数”。

Observed region 实际出现：WM0=0..17；WM2={0,18}；WM3={11}。
WM2 region0 的 664 triangles 不应凭名字解释成海底 Midgar 的实际 POI。
WM3 gameplay types={1,2,9}，并未使用 terrain10 Snow；不能把 terrain 自动当气候/land-cover。
WM0 有 29 个实际 terrain 值；15、23、31 未出现。所有 0..31 均可保留并由合成测试覆盖。

## 5. 周期 seam 几何与属性


| seam | segments A/B | position | position+height | terrain/region/script/texture/normals equal | UV equal |
| --- | --- | --- | --- | --- | --- |
| West/East | 224/224 | 224 | 224 | 224/224/224/224/224 | 0 |
| low/high game_north | 288/288 | 288 | 288 | 288/288/288/288/288 | 0 |


比较对象为位于外边界的 triangle edge multiset，不仅仅是 boundary vertex set。
先把两侧固定坐标识别，再按沿边界位置和高度排序端点；无 ambiguous segments。
所有 seam 端点 raw normal=(0,-4096,0)，terrain3、region17、script1、texture56、chocobo=False。

UV observed：E/W 448 个端点 delta 均为 (-30,0)。N/S 576 个端点中，565 个为 (0,-30)，
5 个 (0,-28)、4 个 (-2,-30)、各 1 个 (0,-29)/(0,-27)。raw UV 精确匹配为 0。
texture56 与 ds1 的关系来自外部 texture table；实际 LGP 的 ds1.tex header 为 version1、32x32。
delta30/28/29/27 不是简单 modulo32 的等价条件。
wiki 提示 VRAM offset/repeating tile 解释，经典引擎还在加载后用 C_00760E1D 将 UV 向 triangle
均值内缩一个单位。因此原始 UV、runtime adjusted UV、atlas offset、filtering 与 tile sampling
需要分别研究。本轮没有读取/导出纹理像素，也没有证明视觉纹理连续。
**UV semantic/visual continuity: UNKNOWN / NOT YET VERIFIED**。

normals 在 seam 完全一致，但全图不是所有 normal 都可无条件认定为有效单位法向。
WM0 两个 normal 为 (-1,-1,-1)，位于 section30/mesh6/vertex86 和 section48/mesh15/vertex54。
全图长度及面夹角统计在 summary；许多 stored normals 与 triangle winding 的 cross product
反向，不能直接把 cross 的符号作为坏法向判据，平滑法向也不必等于 face normal。
stored normals 的用途/符号/lighting convention 仍需后续核对。

## 6. 内部拓扑诊断：不能立即当作干净 TIN


| 位置焊接 diagnostic | 值 |
| --- | --- |
| used_position_keys | 71252 |
| edges | 213758 |
| faces | 142586 |
| euler_characteristic | 80 |
| duplicate_face_excess | 84 |
| edge_incidence_histogram | {'2': 213628, '4': 124, '1': 6} |


位置 key=(east mod W,north mod H,height)，只用于诊断，不是最终拓扑实体 ID。
WM0 84 个 exact-position duplicate face excess；124 条 edge incidence=4、6 条 incidence=1。
不能由它的 Euler=80 推出 genus；该原始 triangle complex 不满足干净 closed manifold 条件。
内部 mesh seam 16144 个 segment keys 中，2 个是每侧各重复两次的 edge。
6 条 incidence1 edges 集中于 section30、mesh13/14 的高处附近；topology JSON 保存全部异常的 lineage。
这可能涉及游戏模型重叠、局部开口、竖直表面或特殊构造；本轮未 repair，也未给它们编造原因。

水平投影面积为零不等于 3D triangle 必然退化；可能是垂直 cliff/重合投影。


| map | zero horizontal area triangles | sum projected area raw² | rectangle raw² | excess % |
| --- | --- | --- | --- | --- |
| WM0 | 246 | 67692515599.0 | 67645734912 | 0.069155 |
| WM2 | 1257 | 12937108540.5 | 12884901888 | 0.405177 |
| WM3 | 0 | 4295137996.0 | 4294967296 | 0.003974 |


面积总和超过矩形说明 projected triangles 不能直接等价于无重叠的二维 partition。
后续 DEM/TIN 必须区分 gameplay geometry 与可用的 2.5D surface，定义同一水平位置多高程的处理规则。
位置/高度不同的重复记录不能粗暴去重；属性与 lineage 必须保留。

## 7. Alternative sections

外部 mapping：63→50、64→41、65→42、66→60、67→47、68→48；六个 section 各 16 meshes 全通过。
单独比较 67/68 的 base perimeter 各有 5 条不匹配，因为 story change 可以改动它们共同内边界。
按游戏 replacement groups 联合比较 outer perimeter：


| alternative group | base group | outer segments | exact matches |
| --- | --- | --- | --- |
| [63] | [50] | 142 | 142 |
| [64, 65] | [41, 42] | 194 | 194 |
| [66] | [60] | 132 | 132 |
| [67, 68] | [47, 48] | 203 | 203 |


所有 group 的外边界精确匹配。此证据支持外部 mapping 的一致性，不能声称 MAP 本身编码了 replacement ID。
未来 story-state 应按组应用，不把六份 alternative 简单追加成新的大陆。

## 8. N/S canonical cut 研究


| mesh row | pure ocean meshes | triangles | non-ocean | terrain | region | script | height |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | 36/36 | 4608 | 0 | {'3': 4608} | {'17': 4608} | {'1': 4608} | [0, 0] |
| 27 | 36/36 | 4608 | 0 | {'3': 4608} | {'17': 4608} | {'1': 4608} | [0, 0] |


两侧各 8192 raw units 宽的完整 Sea 带；没有 hidden land triangle，script>=3 触发 triangle=0，chocobo=0。
script1 表示 gameplay encounter inhibit 一类状态，不能写成“所有脚本属性为 0”。
wm0.ev 的已登记 mesh call table 在 row0/27 无 mesh functions。
这不等于已经排除了所有 entity、system script、story-state 或 field entrance POI；后者未完整解码。

**Derived recommendation**：沿 n=0/229376 识别边界切开 Y 周期，在保留 X 周期的 cylinder 上研究极区。
纯海、零高程和缺乏 triangle-level trigger 让这里优于复杂 minimum-cost seam solver。
旧 wrapping path 实验已保留，没有继续优化 seam solver。
synthetic polar ocean caps 几何上可研究；它们属于 Reconstructed layer，应有独立 provenance，
不得伪装成原游戏资产。cap 面积、纬度边界、气候及视觉连续性仍 Unknown，本轮没有创建。

原 gameplay coordinate domain 是双轴周期的 T²。矩形 quotient 的拓扑与地理球 S² 不同；
需要显式记录 cut/cap 过程，不能把原矩形静默解释为经纬度全球。

## 9. Geography Probe 方法

仅 WM0 base triangles；替代 story sections 不参与下列默认 geography。
area=abs(2D cross)/2，centroid=三个 game-space vertices 的均值。
linear centroid 按 projected area 加权；circular centroid 对 triangle centroid 的
2π*x/W、2π*n/H 分别加权 sin/cos，用 atan2 返回周期位置。
这是 centroid quadrature 的描述统计，不是对每个 triangle 面积连续积分的解析 circular mean。
zero projected area faces 仍计入 triangle count/bbox，但 centroid weight=0。

resultant R=|Σw*exp(iθ)|/Σw；接近 0 意味分散、均值不稳定；严格均匀时输出 UNDEFINED。
圆 span 用各 triangle 在轴上的投影 intervals 的 union，取最大 uncovered gap 的补集。
若整轴都有支持，span=period；避免只取顶点最大 gap 将 Sea 误判成小缺口。
CSV 同时含 vertex bbox、triangle-centroid bbox、height bbox、linear/circular centroid、
R、minimal arc 起止/span、linear-circular 周期距离、crosses_periodic_{x,y}_seam。
其中 crosses 定义为 support 同时触及两条被识别边；minimal_arc_wraps 则描述最小覆盖弧跨零，
二者不是同一概念，也不证明某 region 是单个 connected polygon。
region17 Sea 对两条 seam 有实际支持；所有其他 region 均未触及两侧配对边。

### Region 结果


| id/name | triangles | linear E/N | circular E/N | R E/N | span E/N | cross X/Y |
| --- | --- | --- | --- | --- | --- | --- |
| 0 Midgar Area | 4649 | 197,260.3/116,051.8 | 197,251.5/116,073.3 | 0.933/0.962 | 68673/44505 | False/False |
| 1 Grasslands Area | 4394 | 238,136.3/139,973.9 | 238,121.0/140,052.2 | 0.962/0.923 | 54388/69632 | False/False |
| 2 Junon Area | 5371 | 194,316.9/158,809.4 | 194,352.7/158,877.2 | 0.956/0.929 | 64835/58368 | False/False |
| 3 Corel Area | 1657 | 128,411.9/129,225.4 | 128,409.7/129,220.6 | 0.982/0.984 | 37947/31239 | False/False |
| 4 Gold Saucer Area | 2707 | 120,954.9/151,254.0 | 120,907.3/151,344.2 | 0.968/0.952 | 42682/51200 | False/False |
| 5 Gongaga Area | 3822 | 112,136.5/182,062.2 | 112,154.5/182,123.5 | 0.936/0.968 | 72613/47216 | False/False |
| 6 Cosmo Area | 2115 | 85,404.1/165,932.2 | 85,411.9/165,942.2 | 0.982/0.976 | 37888/32387 | False/False |
| 7 Nibel Area | 2194 | 86,325.7/140,659.8 | 86,339.6/140,670.4 | 0.978/0.974 | 37888/35840 | False/False |
| 8 Rocket Launch Pad Area | 3396 | 74,501.8/113,971.3 | 74,481.6/113,951.9 | 0.976/0.934 | 46080/56112 | False/False |
| 9 Wutai Area | 6323 | 40,445.0/130,330.6 | 40,329.7/132,266.4 | 0.974/0.729 | 93367/118784 | False/False |
| 10 Woodlands Area | 1846 | 165,429.0/184,387.4 | 165,431.6/184,389.1 | 0.979/0.987 | 39936/24576 | False/False |
| 11 Icicle Area | 8509 | 141,546.4/74,986.9 | 141,526.9/75,385.5 | 0.948/0.816 | 76288/92791 | False/False |
| 12 Mideel Area | 5330 | 241,674.5/185,613.0 | 241,890.8/186,132.8 | 0.890/0.906 | 89967/73274 | False/False |
| 13 North Corel Area | 1531 | 110,603.4/109,396.4 | 110,600.7/109,398.5 | 0.986/0.979 | 34816/34556 | False/False |
| 14 Cactus Island | 76 | 76,570.5/217,328.5 | 76,570.4/217,328.5 | 1.000/0.999 | 5264/6413 | False/False |
| 15 Goblin Island | 998 | 243,719.9/74,543.7 | 243,738.5/74,678.6 | 0.984/0.903 | 34835/48279 | False/False |
| 16 Round Island | 307 | 261,979.0/15,746.9 | 261,978.9/15,746.8 | 0.998/0.997 | 11221/11831 | False/False |
| 17 Sea | 87361 | 146,576.4/104,915.5 | 1,767.0/24,563.9 | 0.130/0.267 | 294912/229376 | True/True |


Sea 的 linear centroid 位于 map 内部，circular east 靠近 X seam；R 较低，不能把任一平均点称为“海洋中心”。
大部分局部大陆 region 的 linear/circular 差异较小；Wutai 的 north 差异约 1936 raw units，
其南北分布更广。bbox/arc 与 centroid 必须联合阅读，不能仅凭一个平均点确定大陆或气候边界。

### 重点 terrain 结果


| id/name | triangles | linear E/N | circular E/N | R E/N | vertex N bbox | circular span E/N |
| --- | --- | --- | --- | --- | --- | --- |
| 1 Forest | 1193 | 150,548.3/101,289.0 | 145,769.6/103,295.3 | 0.551/0.233 | 12999..181435 | 194106/168436 |
| 2 Mountain | 8146 | 138,917.2/115,862.6 | 137,640.8/123,919.7 | 0.419/0.494 | 10791..201738 | 250401/190947 |
| 3 Sea | 87411 | 146,590.0/104,985.9 | 1,676.7/24,439.3 | 0.129/0.267 | 0..229376 | 294912/229376 |
| 6 Water | 15226 | 153,108.1/140,605.2 | 159,451.8/141,775.8 | 0.126/0.554 | 9903..209423 | 256062/199520 |
| 7 Swamp | 533 | 224,786.4/145,793.6 | 224,781.6/145,799.1 | 0.994/0.990 | 133652..157380 | 23343/23728 |
| 8 Desert | 430 | 107,096.4/120,322.3 | 107,189.5/115,857.3 | 0.980/0.898 | 108188..220306 | 46471/112118 |
| 10 Snow | 1908 | 134,196.3/69,768.3 | 134,185.4/70,342.0 | 0.960/0.909 | 26555..93362 | 74147/66807 |
| 25 Jungle | 1300 | 141,024.5/185,768.1 | 132,526.2/185,757.6 | 0.521/0.973 | 165888..203665 | 140205/37777 |
| 27 Northern Cave | 48 | 131,065.2/36,917.1 | 131,065.2/36,917.1 | 1.000/1.000 | 34774..39072 | 4364/4298 |


全部 29 类见 wm0_terrain.csv。Desert8 与 Gold Saucer Desert24 分开保留；单一 Desert centroid
不足以解释 Cactus Island。Swamp 主要 n≈145799，不能无条件把全部 Swamp 当南部 tropical biome。
Snow 的 support n=26555..93362，Northern Cave n≈36917；Jungle 在165888..203665。
Icicle / Snow / Cave 倾向较小 n，Gongaga / Mideel / Jungle 倾向较大 n，提供 orientation 证据。
但 gameplay terrain≠GIS land cover；未来另建 gis_surface_class，不覆盖 ff7_terrain_type。

## 10. Orientation 候选，未定案

候选研究使用 hypothetical degrees 便于比较，不输出经纬度数据或定义 CRS。
50°/30° 阈值只是气候 diagnostic，不是 FF7 canon；所有比较按 triangle centroid 面积加权。

| 候选 | north direction | proposed equator | 气候一致性 | 几何影响/不确定性 |
|---|---|---|---|---|
| A | decreasing game_north | n=114688 | Cave 在北高纬，但 Snow 多在中纬；热带过偏南 | uniform meridional diagnostic 保留 raw 相对形状，球面转换仍有纬度相关形变；不能自动接受 uniform latitude |
| B | increasing game_north | n=114688 | Cave/Icicle 在南，Jungle 更偏北高纬，作为反向 control 较弱 | A 的南北翻转，不解决 tropical 高纬问题；名称和环境暗示不是数学证明 |
| C | decreasing game_north | n≈185000（可研究170000..190000） | Snow 高纬、Jungle/Mideel/Gongaga 接近赤道，较符合气候暗示 | 非均匀 meridional scale，南极 cap 明显不对称，Round Island 仍很高纬；属于人为重建，需公平量化大陆变形 |

C 的仅供诊断的 anchors：(n,φ)=(0,80),(80000,60),(150000,20),(185000,0),(229376,-35)。
没有实施这些 anchors 的地图变换，未把任何原始坐标改写成 canonical latitude。


| candidate | feature | hypothetical mean φ | |φ|>=50 area fraction | |φ|>30 area fraction |
| --- | --- | --- | --- | --- |
| A | terrain_10 | 35.25 | 14.7% | 53.3% |
| A | terrain_27 | 61.03 | 100.0% | 100.0% |
| A | terrain_25 | -55.78 | 84.9% | 100.0% |
| A | region_12 | -55.66 | 73.8% | 94.6% |
| A | region_5 | -52.87 | 68.6% | 100.0% |
| A | region_14 | -80.55 | 100.0% | 100.0% |
| A | region_16 | 77.64 | 100.0% | 100.0% |
| B | terrain_10 | -35.25 | 14.7% | 53.3% |
| B | terrain_27 | -61.03 | 100.0% | 100.0% |
| B | terrain_25 | 55.78 | 84.9% | 100.0% |
| B | region_12 | 55.66 | 73.8% | 94.6% |
| B | region_5 | 52.87 | 68.6% | 100.0% |
| B | region_14 | 80.55 | 100.0% | 100.0% |
| B | region_16 | -77.64 | 100.0% | 100.0% |
| C | terrain_10 | 62.14 | 100.0% | 100.0% |
| C | terrain_27 | 70.77 | 100.0% | 100.0% |
| C | terrain_25 | -1.25 | 0.0% | 0.0% |
| C | region_12 | -1.85 | 0.0% | 0.0% |
| C | region_5 | 1.17 | 0.0% | 0.0% |
| C | region_14 | -25.50 | 0.0% | 0.0% |
| C | region_16 | 76.06 | 100.0% | 100.0% |


只翻 north direction 无法解决 climate distortion。A 的 Jungle 100% 超过|30°|，约84.9%超过|50°|；
C 可以改变这个结果，但证明的是设定的拟合效果，不是 C 是真实 Gaia 坐标系。
Round Island 在小 n 端，Cactus Island 接近另一边缘；二者会约束 future cap 和 latitude 方案。
推荐先保留 N/S cut 和 raw coordinate，再让用户在“大陆形状/游戏距离”与“气候纬度”之间做明确工程取舍。

## 11. Longitude seam / prime meridian

X=0/294912 实际穿过 terrain3、region17、零高程纯海 edge，没有 triangle trigger。
mesh col0、1、34、35 各28/28 pure ocean，原 X seam 两侧有宽8192的至少两列纯海缓冲。
由此，game X=0 是很强的 cartographic longitude seam 候选，能够避免切割大陆。
若 seam 移到这个环绕纯海走廊内（例如相邻 ocean-only mesh 边界），也可作为备选；
后续需要查看 POI/故事状态、版面中心和 continent grouping 后再选。
**X=0 不是已定义的 prime meridian**。经线原点与 cartographic seam 可以独立设置。
本轮未选择 Gaia longitude zero，也未决定世界中心或地球半径。

## 12. WM0 ↔ WM2 坐标与垂直基准预研

Observed：WM2 是12 sections、12x16 mesh local patch，extent 98304x131072，height -7943..3891。
它不是 WM0 同尺寸的全球网格。terrain15 在 WM2 有227 triangles；wiki 旧表把15称 unused，
但当前参考与实际 underwater 文件支持其 underwater tunnel 用途。

经典 PC 静态引擎证据（固定 commit 见 sources.md/manifest）：

- C_00750F3C 将 global block row 减2、col减3，以4/3 blocks调整后读取 WM2 MAP。
- C_007533AF 将 WM2 BOT 本地 blocks 映射到 global cols3..5、rows2..5。
- 因 section side=32768，reference window 的 nominal raw offset 候选为
  game_east +98304、game_north +65536，horizontal scale1；world player position 与本地 tile addressing 必须区分。
- 该 loader 会按局部 block 宽高调整索引，这不是将 underwater 文件线性缩放覆盖全球的证据。
- C_0074D6F6/C_0074D6BB 触发 undersea/surface 状态及淡出，随后 main state6/7 切 map。
  初始化 WM2 设置 runtime player/model y=-3000；这不是 MAP vertex heights 的 datum 变换证明。
- C_0075378A(3000) 后的 C_00766417 会按车辆朝向移动水平位置，涉及碰撞恢复/离开边界，
  不应把3000简单解释成 vertical offset 或全局 WM0→WM2 transform。

**Reconstructed**：参考引擎支持一个带 offsets 的局部 underwater window/loader 模型，
比“WM2=全球 bathymetry”更有证据。这里只记录模型，不实现转换或拼接。

**UNKNOWN / NOT YET VERIFIED**：2026 Steam executable 是否完全保留这些 runtime 路径；
每个潜水入口/出口坐标是否另有 script 调整；window 边界的物理限制；shared vertical datum；
raw_y 与 runtime model height 的完整关系；undersea negative values 的实际物理深度。
没有把 WM2 合并到 WM0，也没有宣称现实米尺度。

## 13. LGP inventory 与下一阶段专题


Observed：world_us.lgp 有 **985** TOC entries、**415** TEX entries、conflict_count=0。


| filename | record offset | payload offset | size |
| --- | --- | --- | --- |
| ds1.tex | 1311065 | 1311089 | 1324 |
| enc_w.bin | 3025925 | 3025949 | 2208 |
| field.tbl | 3023317 | 3023341 | 1536 |
| mes | 3020423 | 3020447 | 2870 |
| wm0.ev | 3028157 | 3028181 | 28672 |
| wm2.ev | 3056853 | 3056877 | 28672 |
| wm3.ev | 3085549 | 3085573 | 28672 |


inventory reader 检查 TOC/lookup/conflict metadata 的长度、record/payload bounds、TOC/data filename 一致性，
以及 payload record 非重叠。offset 是 file header offset；data_offset=offset+24，size 不含 header。
本文件 conflict_count=0；未来含 conflict-path 的 LGP 还需输出完整 folder disambiguation。
没有 extract/rebuild API，没有写出原始 entry payload。

- 三份 EV 各0x7000；call table0x400，后面0x6C00 word code；检查 IP 在 code 范围。
  wm0/wm2/wm3 active call entries 分别143/26/38，可能含原始 duplicate/padding entries，
  不是 unique interpreted functions。没有完整反编译或 opcode CFG。
- field.tbl=1536，支持64对 default/alternative 12-byte field entry records。
  entry 坐标属于 field-local；POI 需追踪 EV enter-field 参数与 world mesh/entity 坐标。
- enc_w.bin=2208，符合32 bytes Yuffie +128 bytes chocobo +2048 bytes encounter sets。
  encounter region/type lookup 部分在 executable，不能仅靠 MAP region label 直接生成 encounter layer。
- mes=2870；count62，offset table bounds 通过；保留 FF7 文本编码问题，未做多语言 message decoder。
- 415 个 TEX 仅 inventory；ds1 只读 header 辅助 seam 解释。没有提取或绘制游戏纹理。

## 14. 测试、复现与产物


实测 **35 tests**，failures=0、errors=0、skipped=0，successful=True。



合成测试覆盖 literal/partial flags、initial zero references、overlap、ring wrap、truncation、output limit；
MAP buffer/refs/offsets/对齐/压缩 bounds/record overlap、所有terrain/region bit范围、texture/chocobo/bit14；
多布局大小写 discovery、候选歧义、未知 fingerprint 继续 parse、工作区输出隔离；
圆均值跨 seam/均匀 undefined、minimal arc/full support；LGP 合成合法及损坏记录。
真实源测试遍历全部 meshes/triangles，包括 alternatives，检查 grid/extent、外边界属性、纯海 cut、
area/count conservation、LGP、group perimeter；读取模式和 tests 前后 SHA 也受检查。
测试验证的是 reader invariants 与指定 dataset 的 Observed 属性，不要求 Euler0 或自动“修好”游戏地形。

Python 3.14.3；标准库，未安装第三方包。命令从工作区执行，完整运行环境在 run_environment.json。

```powershell
.\.venv\Scripts\python.exe -B scripts\validate_ff7_source.py `
  'D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition'
.\.venv\Scripts\python.exe -B scripts\run_tests.py --source `
  'D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition'
.\.venv\Scripts\python.exe -B scripts\build_validation_report.py `
  'D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition'
.\.venv\Scripts\python.exe -B scripts\finalize_fingerprint.py `
  'D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition'
```

输出：source_before/run_before/source_fingerprint；wm0/wm2/wm3_summary；wm0_topology；
wm0_regions/wm0_terrain/wm0_region_centroids/mesh_grid CSV；world_us_inventory/preflight；
orientation_candidates；wm0_validation.svg；tests.json/tests.log；run_environment.json。
SVG 是 ocean mask/centroid/cut validation plot，无投影和正式制图。
源码、venv、测试、docs、output、临时资料全部位于项目工作区。

## 15. 进入真正 GIS conversion 前的优先事项

1. **TIN contract**：区分 vertical surfaces、重复/overlapping faces、局部 open edges；
   定义 2.5D surface selection，任何 derived repair 必须可撤销并保留 lineage。
2. **坐标 contract**：保留 raw axes；验证 runtime vertical sign/datum 和 WM2 window，
   用多组已知 transition/POI 对照后再允许 underwater overlay，保持 scale/offset 不确定性。
3. **地理 contract**：以已验证 N/S ocean cut 为优先，量化 orientation A/C 的大陆形变和气候冲突；
   决定是否保持 relative game distances，再独立决定 equator/latitude function/prime meridian。
4. **专题 lineage**：有限读取 EV/table 的 POI 与 story-state，引入 map/section/mesh/triangle/function
   标识；region/terrain/messages/encounter adapter 不能互相混为一层。
5. **尺度与构造 provenance**：Gaia radius、raw horizontal/vertical meters、caps、GIS land cover
   全部仍未确定；必须将 Reconstructed/Assumed 产品与原始 Observed geometry 分开标记。

仍 Unknown：视觉 UV连续、完整 normals convention、内部异常设计意图、全部 POI/entity scripts、
2026运行时 WM2 adapter、真实 north/equator/poles/prime meridian/radius/米尺度、bathymetry基准。
这些 Unknown 是本阶段正式输出，不用猜测补齐。

## 16. 资料与归属

许可处理、查阅的具体模块、固定 commit 与勘误见 [sources.md](research/sources.md)
及 [reference-manifest.json](research/reference-manifest.json)。
MAP 位字段交叉核对参考 [Landscaper](https://github.com/maciej-trebacz/ff7-landscaper) 和
[经典 PC worldmap 引擎](https://github.com/ergonomy-joe/ff7-worldmap)。
补充格式依据：[MAP/BOT wiki](https://wiki.ffrtt.ru/index.php/FF7/WorldMap_Module)、
[coordinate encoding](https://wiki.ffrtt.ru/index.php/FF7/Coordinates_encoding)、
[world scripts](https://wiki.ffrtt.ru/index.php/FF7/WorldMap_Module/Script)、
[encounters](https://wiki.ffrtt.ru/index.php/FF7/WorldMap_Module/Encounters)。
上述参考均不是 Gaia canon 地理证明；核心 reader 独立实现，没有拷贝参考程序的源码。

