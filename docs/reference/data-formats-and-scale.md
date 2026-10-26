# 数据格式、规模与数据库边界

本文面向课程开题/答辩说明，记录 v5.5.1 所沿用的实际数据链与一个本地 Workspace 样本。游戏资料来自用户合法持有的只读安装；公开 Web 交付包含代码和有来源的 Atlas 文字资料，不包含整套游戏几何、纹理或场景资源。

## 原始资源到 Web Viewer

1. **发现来源**：Python `dataset.py` 识别安装或解包目录，并按用户选择配对 EN/FR/DE/ES 的 World/Field LGP；游戏数据语言与界面语言分开。保留实际归档 basename、内容 SHA-256 和成员来源，不把外语归档改名为英文来源。
2. **只读解析**：`map_reader.py` 读取 WM0/WM2/WM3 MAP 的 Section、压缩 Mesh、原始整数顶点与面属性；BOT 是对应地图的补充来源。LGP 是带成员目录/偏移/长度的资源归档，World 中包含世界脚本、纹理等；Field LGP 的 `maplist` 与各压缩场景成员提供身份和分节数据。
3. **转换与关联**：已有生成器验证原始边界和来源关系，生成 Gaia Workspace。WM0 V1 球面与投影是已冻结的重建显示；原始 Section/Mesh/Triangle 身份与人工极冠保持区分。Field 的脚本、Camera、Walkmesh、Gateway、Palette/Background 来自各自原始 Section，不能根据名字或距离补齐关联。
4. **清单与传输**：`build_workspace.py` 增量管理资产依赖和 generator revision。JSON 用于名称、身份、属性、证据关系、清单及小型结构；二进制用于较大的顶点/索引、Routing CSR、纹理、模型和按场景组织的 Field 数据，带独立 magic、版本、长度与校验字段。二进制并非一个 Web 数据库。
5. **浏览器采用**：`workspace.ts` 先检查文件名、清单版本、字节数、SHA-256、地图身份、依赖缺失/循环和跨资产来源一致性，再交给既有 Codec。缺少可选资产时局部降级；错误基础几何不能作为有效 Workspace 使用。文件由用户主动打开，在浏览器本机会话处理，不上传到服务器。

WM0、WM2、WM3 是三个独立空间。WM0 支持 V1 球面与十三投影；WM2/WM3 使用各自 Native 坐标，不能直接当作 WM0 经纬度。Field 是按场景区分的局部空间，不存在已经验证的统一全球 Field 坐标。

## 当前保留样本的真实清单

核查日期：2026-10-26。来源是现有 `output/local-workspace/gaia-workspace.json`；清单格式 v1、generator `workspace-1`、当前 `tool_version` **5.5.1**。原有 20 项来自持续保留的历史英文 Workspace，本轮只增量生成 Gameplay Evidence，其余 20 项的 Manifest 记录逐项保持相同，没有重建几何/Field GIS 或复算整套原始来源哈希。下表是最终清单，不是新版本完整重建规模。

最终清单列有 **21 个资产，共 133,755,441 bytes（127.559 MiB）**；另有清单本身 8,618 bytes。新增 Gameplay 为 **9,871,992 bytes（9.415 MiB）**；增量前 20 项合计 123,883,449 bytes。MiB 按 1,048,576 bytes 计算。逻辑 `mapId` 分组为 WM0 17,087,052、WM2 986,671、WM3 723,057、shared 114,958,661 bytes；`shared` 表示跨视图共享用途，不表示同一个坐标系。

| 逻辑内容 / 文件 | 字节数 | 清单中的直接依赖 |
|---|---:|---|
| WM0 元数据 `gaia-meta.json` | 2,905 | 无 |
| WM0 几何 `gaia-mesh.bin` | 5,396,280 | meta |
| 地点/入口 `gaia-poi.json` | 66,877 | mesh |
| 静态遭遇 `gaia-encounters.json` | 93,386 | mesh |
| 世界事件 `gaia-events.json` | 266,566 | mesh |
| Routing CSR `gaia-routing.bin` | 7,971,076 | mesh |
| WM0 纹理 `gaia-textures.bin` | 2,649,006 | mesh |
| WM2 Native `gaia-map-WM2.bin` | 719,095 | 无 |
| WM3 Native `gaia-map-WM3.bin` | 596,765 | 无 |
| WM2 纹理 `gaia-textures-WM2.bin` | 267,576 | WM2 Native |
| WM3 纹理 `gaia-textures-WM3.bin` | 126,292 | WM3 Native |
| 地图转换证据 `gaia-transitions.json` | 117,407 | mesh |
| Explorer `gaia-explorer.bin` | 1,545,008 | mesh |
| 表现层 `gaia-presentation.json` | 80,989 | 无 |
| 私有 Atlas 绑定 `gaia-atlas.json` | 127,258 | POI |
| Field Context `gaia-field-context.json` | 513,698 | POI |
| Field Walkmesh `gaia-field-walkmesh.bin` | 2,596,589 | Field Context |
| Field Interaction `gaia-field-interaction.bin` | 621,296 | Field Context、Walkmesh |
| Field Visual `gaia-field-visual.bin` | 98,099,799 | Field Context |
| Field Script Evidence `gaia-field-script-evidence.bin` | 2,025,581 | Field Context |
| Gameplay Evidence `gaia-gameplay.json` | 9,871,992 | Field Context |

其中 `gaia-meta.json` 记录 **94,136 个传输顶点、152,378 个面**：142,586 个原始 WM0 BASE 来源面与 9,792 个人工极冠面。区域统计只计前者。此样本的 Field Context v3 有 **722 个身份记录，其中 702 个 available**；这些是该历史包的状态，不是四种语言所有场景的无条件可用性保证。完整原始 LGP、恢复缓存、研究 GeoPackage 不在本表合计内；公开 Atlas 文字与私有 Atlas 空间绑定也不是同一份数据。

## 已实现的加载与规模约束

- Manifest 最多 32 个资产；一次选择最多 64 个文件；清单最多 100,000 bytes；一般单资产最多 160,000,000 bytes，后续 Codec 仍有更严格约束。这些是拒绝异常输入的上限，不是性能承诺。
- Field Walkmesh 包上限 32,000,000 bytes；读取有界元数据并以场景 ID 索引，选中场景才 `File.slice()` 和解码 Section 5，单场景三角形数最多 65,535。Field Visual generator-4 包上限 100,000,000 bytes，Script Evidence 包上限 4,000,000 bytes；各自仍检查场景跨度、解压预算与来源校验。
- Field owner 保留当前 Workspace 的文件/索引和当前解码结果；切换场景、替换 Workspace 或销毁 owner 会取消过时请求并释放资源，不预先把所有场景创建为 Canvas 或渲染对象。完整文件的完整性检查会读取编码文件，**懒解码不等于导入时完全不读取大文件**。
- WM0 几何使用 TypedArray；Routing 使用紧凑 CSR 和来源键索引；Field 身份/连接按 ID 建索引。拓扑与区域统计按当前来源 owner 按需缓存，筛选/翻页复用结果，不为每帧重新聚合。当前查询不依赖服务器空间索引，也没有新增持久数据库。

Field Visual 占最终样本编码资产约 **73.34%**，但编码大小不能等同于解压后像素、GPU 纹理或峰值内存。本轮未进行完整浏览器加载时间、手机内存、多语言全场景或超大 MOD 性能长测；不能将容量限制写成已实测并发量或帧率。

## 可选 Gameplay Evidence（v5.5.1）

`gaia-gameplay.json` 是一个有界私有 JSON（最多 20,000,000 bytes），不是新的 Workspace 格式或服务端数据库。记录实际 Field/World 归档、`maplist`、`wm0.ev`、`enc_w.bin`、`scene.bin`、`kernel.bin`、`kernel2.bin` 来源 Hash、精确 Context 文件 Hash，并按 Field/Scene/Formation/Enemy 身份建立会话索引。缺少它仍可读公开 Atlas 和旧 Workspace。公开 Atlas/Profile 文本身份仅统一 LF 行尾以便 Windows/Linux 互用；游戏资源指纹始终针对原始字节。

已有来源时只增量执行：`python -m gaiagis.gameplay --source YOUR_FF7_INSTALLATION --workspace output/local-workspace --game-language en`。命令只发布该资产与 Manifest 对应记录，不重建原有几何或 Field 产品。首次索引核验相关原始来源；之后浏览器无需再次扫描原版 Field。Battle/Kernel 查找先用所选 `data/lang-en/`（或对应语言）再检查经典共享目录；输入缺失时不编造名称或编队。当前真实验证仅 EN；其他语言不能因此宣称全覆盖。

Field 奖励索引复用共享 Section 1 CFG，解读 STITM/SMTRA/BATTLE 与有限标志写操作。完整 CFG 与常量操作数才能标记静态授予；条件是否实际执行、独立拾取点、宝箱和存档领取状态仍未知。本次所有奖励仅有场景身份，无 FieldLocal 坐标。`scene.bin` 解析物理 Scene、四个 Formation 与敌人记录，保留重复引用和跨 Scene 的同 ID；只解读名称、Level、HP、MP 等已核对字段，不执行 AI。Kernel 提供原始名称索引。

现有 58 条 Atlas/19 条奖励不变，只有已证明的场景关系进入 `atlasLinks`。两条 Godo/Snow 攻略附件使用完整成员、Section 1、Scene Hash 与原 Actor/Entry/BATTLE/Enemy 链的显式白名单；变化即不提供该语义关联，不按名称/HP猜 Boss。World code-word 偏移、Field 字节偏移和遇敌表字节偏移分别记录。浏览器沿用原导航搜索和共享 Inspector；原始证据没有攻略剧透分级，只在展开原版证据时加入共享搜索，关闭即撤销。没有背包推断宝箱、全收集进度或运行时判断。

## 数据库实际使用情况

Web Viewer 是 TypeScript/Vite/Three.js 应用，**没有 MySQL、PostgreSQL、Web SQL 后端或数据库服务接口**。公开部署可静态托管；本地 Launcher 可以提供文件与控制接口，但没有因此成为 SQL 数据服务。用户首选项和个人标注采用既有的浏览器本地状态；这不等于把游戏 Workspace 导入 SQL。

GIS 研究/交换导出可使用 **GeoPackage（基于 SQLite）**，由 Python/GDAL 在本地写入与核查，供 QGIS 等工具使用。WM0 重建空间、Native 和 FieldLocal 导出有各自的坐标与契约约束；Native/FieldLocal 不伪装为地球 EPSG 坐标。浏览器的正常 Atlas、Source GIS、Routing 或 Field 浏览不要求连接或读取这些 GeoPackage，也不依赖实时 SQL 查询。

## 原版与 MOD 来源的区别

已知原版指纹可建立经过验证的来源基线；同样的文件扩展名或成员名称不能证明内容相同。MOD 如果保持受支持的压缩、Section、顶点/脚本结构，可能通过部分结构解析，但归档/成员 SHA 改变后必须重新检查依赖并重新转换受影响产品，不能复用旧来源证据。若改变布局、脚本边界、地图身份或超过预算，相关能力应拒绝或显示未验证；不是简单换路径即可保证兼容。

例如 Atlas 文字知识可在 source-only 模式读取，但地图入口必须有实际 POI/Field 证据；Save Field 标记继续要求 Field、Walkmesh、Triangle 与具体来源一致；世界状态预测继续以已验证**完整 EV** 指纹为门槛。格式可读取、关联已验证、原版运行时行为已验证是三个不同层次。本版没有 MOD 通用适配、存档写回或运行时模拟。

代码依据：[`dataset.py`](../../src/gaiagis/dataset.py)、[`map_reader.py`](../../src/gaiagis/map_reader.py)、[`lgp.py`](../../src/gaiagis/lgp.py)、[`build_workspace.py`](../../src/gaiagis/build_workspace.py)、[`workspace.ts`](../../web/src/app/workspace.ts)、[`fieldContext.ts`](../../web/src/data/fieldContext.ts)、[`fieldCamera.ts`](../../web/src/data/fieldCamera.ts)、[`fieldScriptEvidence.ts`](../../web/src/data/fieldScriptEvidence.ts)。契约细节见 [Workspace](workspace-format.md)、[架构](architecture.md)、[多语言来源](multilingual-sources.md)、[数据分发边界](data-policy.md)。
