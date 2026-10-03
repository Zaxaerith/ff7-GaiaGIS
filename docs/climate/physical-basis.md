# Gaia V2：物理依据与证据边界

研究日期：2026-10-02。状态：**Level A completed / GCM validation pending**。

## 三类信息必须分开

**Observed FF7 evidence**：WM0 几何、原始高度及 gameplay terrain IDs 来自只读解析结果。Snow、Jungle、Desert 是游戏标签，不是实测气温、降水或植被覆盖。Region 名称只提供语境，不计入目标函数；Mountain 与 Northern Cave 不作为气候目标。

**Earth-climate physics**：球面日照、季节热储存、辐射收支、热扩散、水汽平流与地形抬升构成模型。背景风、凝结时间尺度和蒸发闭合属于参数化。数值守恒不是现实气候真实性的证明。

**Gaia assumptions**：行星参数、垂直比例、海面基准及 V1 朝向均为 ASSUMED/Reconstructed，而非 FF7 canon。它们不能被评分结果反向确认为事实。

## 查阅的主要来源

| 资料 | 对本实现的贡献 |
|---|---|
| [NASA Earth energy budget](https://science.nasa.gov/earth/earth-observatory/climate-and-earths-energy-budget/) | 全球平均日照 S/4、反照率、温室效应和热输送 |
| [NOAA atmospheric circulation](https://www.noaa.gov/jetstream/global/global-atmospheric-circulations) | Hadley/Ferrel/Polar、信风与西风的结构参照 |
| [NOAA climate zones](https://www.noaa.gov/jetstream/global/climate-zones) | 温度与降水共同决定气候，分类不是气候生成器 |
| [Met Office circulation](https://weather.metoffice.gov.uk/learn-about/weather/atmosphere/global-circulation-patterns) | 半球风向与环流的定性核对 |
| [North et al. 1981](https://agupubs.onlinelibrary.wiley.com/doi/abs/10.1029/rg019i001p00091)、[North & Coakley 1979](https://journals.ametsoc.org/abstract/journals/atsc/36/7/1520-0469_1979_036_1189_dbsama_2_0_co_2.xml) | 扩散 EBM、季节储热和陆海差异的理论依据 |
| [climlab EBM documentation](https://climlab.readthedocs.io/en/latest/api/climlab.model.ebm.html) | 方程与线性 OLR 参数起点；没有复制实现或引入 climlab |
| [Priestley & Taylor 1972](https://journals.ametsoc.org/view/journals/mwre/100/2/1520-0493_1972_100_0081_otaosh_2_3_co_2.xml)、[HESS 2024 limitations](https://hess.copernicus.org/articles/28/4349/2024/) | 辐射驱动 PET 形式及其在干燥/平流条件下的局限 |
| [Myhre et al. 1998](https://agupubs.onlinelibrary.wiley.com/doi/10.1029/98GL01908) | CO₂ 对数辐射强迫近似 |
| [Peel et al. 2007](https://hess.copernicus.org/articles/11/1633/2007/)、[公开讨论稿 Table 1](https://hess.copernicus.org/preprints/4/439/2007/hessd-4-439-2007.pdf) | 查表后独立实现 Köppen-like；已记录阈值与 tie convention |
| [ExoPlaSim](https://github.com/alphaparrot/ExoPlaSim)、[官方文档](https://exoplasim.readthedocs.io/en/latest/index.html) | Level B 平台调查与外部文件接口；没有 GCM 气候结果 |

## Earth-like baseline：全部 ASSUMED

集中配置：`config/climate/earthlike_gaia.toml`。半径 6371008.8 m，自转 24 h，公转 365.2422 d，倾角 23.44°，通量 1361 W/m²，重力 9.80665 m/s²，气压 101325 Pa，N₂/O₂ 类大气，CO₂ 400 ppm（参考浓度也为 400 ppm）。Level A 使用偏心率 0、十二个等时长月份，属于圆轨道近似，不是精确地球历法。

高度默认为 1 m/raw unit，并测试 0.5/2；海面模型高度为零，负陆面高度截至零。这些只改变气候边界输入，不改 V1 或原始高度记录。几公里的山脉量级不能证明 FF7 单位等于米。

## 尚未确定

真实 Gaia 行星参数、真实赤道/极点、垂直 datum、动态海流、云与海冰反馈、地表水文、游戏标签的气候含义均未确定。Score 不是物理真实性概率。Synthetic tests 和数值守恒不能替代 GCM、地球基准或观测校准。
