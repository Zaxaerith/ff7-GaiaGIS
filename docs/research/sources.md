# 资料、许可证与证据来源

查阅日期：2026-10-02（Asia/Hong_Kong）。GitHub tree/原文的本地研究缓存位于
`docs/research/references/`，被 Git 忽略；不执行这些代码，不从中复制实现到核心模块。
commit 标识由 GitHub tree API 获取，记录于本地 `*-tree.json`。核心 Python reader 为独立实现。

| 参考 | 查阅内容 | 许可证处理 |
|---|---|---|
| [ff7-landscaper](https://github.com/maciej-trebacz/ff7-landscaper) | MAP、LZSS、useMaps、map-data、field.tbl、LGP、EV、worldscript、encw、mes、TEX | 查阅的 tree 无 LICENSE，API license 为空；仅作为格式/行为研究，不复用源码 |
| [ff7-worldmap](https://github.com/ergonomy-joe/ff7-worldmap) | 经典 PC 世界引擎静态反编译研究，重点 C_0074FFC0、C_0074C9A0、C_00760FB0、C_0075F090、C_007663E0、C_00766B70 | 无明确许可；不复用、不编译、不运行；其中反编译内容亦有原游戏版权因素 |
| [WorldMap Module wiki](https://wiki.ffrtt.ru/index.php/FF7/WorldMap_Module) | MAP/BOT、分块、walkmesh、region | 历史格式研究，存在勘误；未复制页面正文 |
| [World scripts wiki](https://wiki.ffrtt.ru/index.php/FF7/WorldMap_Module/Script) | EV call table、word instruction pointers、context | 原理参考，不开展完整反编译 |
| [ff7-terraform-cli](https://github.com/maciej-trebacz/ff7-terraform-cli) | 项目 tree、README/许可证与编译工具边界 | GPL-3.0；本轮不复用其代码 |
| [ff7-wm-scripts](https://github.com/maciej-trebacz/ff7-wm-scripts) | tree、潜艇 function0/function4 文本 | 无明确许可；仅研究，且这些文本属于游戏脚本派生研究，不纳入 Git |
| [ff7-lgp-explorer](https://github.com/maciej-trebacz/ff7-lgp-explorer) | LGP 格式规格及项目 tree | 无明确许可；自写只读 TOC reader |

## 交叉核对与勘误

- wiki 将 WM0 写成 68 blocks、5 replacements，但同一段列出 63..68 六个编号。
  实际本地长度 / 0xB800 = 69；六个 alternatives 全部可解码。
- wiki 旧 triangle bitfield 声明与 PC 行为不一致。Landscaper readMesh、引擎
  `C_00762162`/`C_00762191` 分别支持 region=(ids>>9)&31、chocobo=(ids>>15)&1。
  引擎 wTerrainInfo 合并 byte3 与 ids 高字节；因此 texture 位不参与 terrain 判断。
  ids bit14 本轮保留、不赋予语义；实际三张 base map 均未置位。
- MAP 不包含 section grid 宽高和 alternative replacement 编号。
  引擎 `D_00969B30/D_00969B34` 提供各 map 的 9x7、3x4、2x2 profile；
  `C_00750F3C` 提供 replacement 选择。这是外部解释证据，不是通过文件长度唯一推导。
- `useMaps` 的 rendering XYZ 为 (raw_x+offset_x, raw_y, raw_z+offset_z)*SCALE。
  GaiaGIS 不采用 SCALE=0.05，保留原始单位。game_north 仅是项目第二水平轴的名称。
- 独立 LZSS 使用零初始化 ring、初始写指针 4096-18、LSB flags、length=nibble+3。
  本轮所有实际 compressed records 在严格 decoded length 检查下通过。
- `field.tbl` 是 field-local 进入位置与替代位置，不是 world POI 坐标表。
  世界位置需要 EV 的 entity/mesh/script context 联合解析，后续不能直接用该表作点图层。

## 定位到引擎函数的研究证据

固定 commit permalink 见 `reference-manifest.json`。

- `C_00750134`/`C_00750202`：世界 36x28 chunk 与水平 wrap。
- `C_00750F3C`：WM2 global block row-2、column-3，再以 4/3 block ranges 调整，
  本地 block index=row*3+column；支持局部窗口水平 offset 候选。
- `C_007533AF`：WM2 BOT 初始化嵌入 global block cols3..5、rows2..5。
- `C_0074D6BB`/`C_0074D6F6`、`C_0074DB8C`：surface/undersea 状态变化、淡出淡入、
  map id 选择；WM2 初始化设置 runtime model y=-3000。
- `C_0075378A` + `C_00766417`：3000 参数用于恢复后避碰/水平移动，移动方向取车辆朝向；
  不能把这个参数误解释成通用 vertical datum offset。
- `C_00760E1D`：加载后按 triangle UV 平均值向内调整每个 UV 分量一单位。
  本轮解析器保留文件里的原始 UV，不修改 MAP 或内存 reader 的数据。

经典 PC 反编译代码不是 2026 Steam executable 的逐指令验证；格式 fingerprint 匹配
也不能证明运行时 adapter 的所有行为一致。WM2 runtime transform 和垂直基准仍需下一阶段验证。
