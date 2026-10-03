# Level A：模型、数据边界与复现

原创代码位于 `src/gaiagis/climate/`，全部输出位于 `output/climate_v2/`。V1 数学、GIS、3D、QGIS、Web 与原有测试未改写。

## 太阳几何与季节能量平衡

日平均 TOA 日照：`Q = S/π [H0 sinφ sinδ + cosφ cosδ sinH0]`，`cosH0=-tanφ tanδ`。截断日落时角处理极昼/极夜。赤纬按圆轨道和倾角计算，每个模型月份积分 30 个时刻；相位 0.218 是把春分放在约第 80 天的历法约定。

EBM：`C dT0/dt = (1-α)Q - (A+B T0) + 5.35 ln(CO2/Cref) + L(T0)`。

T0 为海平面温度（°C）；A=210 W/m²，B=2 W/m²/K。陆地/海洋 α=0.32/0.30 是有效**行星反照率**，不是裸水面反照率，也不从 Snow/Jungle 标签设置。热扩散在 x=sinφ 上用面积守恒有限体积，南北/经向系数为 0.555/0.12 W/m²/K，东西周期、极点零通量。隐式月步进，至少 5、最多 40 年，年周期最大差<0.02 K 停止；同时保存 TOA 收支和方程残差。

陆地热容量 1e7 J/m²/K，slab ocean 为 4.18e6 J/m³/K × 50 m。沿海陆地容量增加，以 300 km 尺度衰减，表达沿海调节。没有动态海洋环流。

地表温度 `T=T0-0.0065h` 是 EBM 之后的粗 environmental lapse 参数化，不是大气柱、稳定度或逆温计算。**能量守恒诊断仅对应 T0，不能据此声称修正后的场闭合同一能量方程。**

## 风、蒸发、水汽和地形

背景风使用连续 Gaussian 带表达信风、Ferrel 西风和极地东风；ITCZ 按 0.4×太阳赤纬季节移动。半球符号控制 meridional flow 与 Coriolis-like deflection，没有求解动量方程。Hadley 宽 18°、Ferrel 48°/14°、Polar 78°/12° 是当前闭合参数，不是气候分类边界。降水时间尺度、副热带/风暴带位置及强度集中在 TOML。

每月水柱稳态：`div(vW)+kW=E`，`P=kW`。W 为 kg/m²，P/E 为 mm/s；面积守恒迎风平流使全球面积加权 P−E 数值闭合。地形抬升 `max(0,u dh/dx+v dh/dy)` 增加 k，凝结高度尺度 1800 m，产生迎风增强与背风耗水。Desert/Forest 不参与雨量生成。

PET 采用 Priestley–Taylor 形式 `1.26 Δ/(Δ+γ) Rn/Lv`，γ=0.066 kPa/K，Lv=2.45e6 J/kg；`Rn=0.5Q` 是显式粗参数化。海洋 E=PET；陆地乘 0.65 与四次湿润度闭合迭代。后者不是真实 soil storage，也未证明土壤季节收敛。

水汽逐月准稳态，没有月份间储存变化；凝结潜热不反馈 EBM，背景风不响应温度或山脉。云、季风、动态海流和地表径流未解决。尤其不能把 Swamp 缺雨归因成 FF7 地理错误，局地水文和模型结构也可能解释冲突。

## 陆海、高度与采样精度

以 SQLite `mode=ro&immutable=1` 读取 V1 GeoPackage canonical corners/lineage，共 142586 个 WM0 base triangles；WM2 不参与。864×672 raw 格心采样三角形并插值高度，再用 sinφ 带面积与经度区间交集保守重映射到 5°/2.5°/Gaussian T21。**守恒对应采样栅格，不是连续三角形精确面积积分。**格距约 341.3 raw units，小岛、海岸与窄河存在混叠。

3 Sea、6 Water、26 Sea(2) 作 ocean；其余 29 个 ID 暂作 land，包括 River、Swamp、Underwater Tunnel 等 gameplay 类。这是边界假设，不是真实水文表。未知覆盖显式采用 0.5 land/0 elevation，上限 0.001，超出即失败。本数据未覆盖比例为零。

MAP 层次/竖面导致水平投影重叠或退化：格心采用第一 canonical triangle 归属，并输出 overlap hits 和 collapsed triangles。海洋帽是 source boundary 外的零 land/elevation，属于 Reconstructed；不增加 V1 cap geometry。Coast distance 为到 land_fraction<0.5 格心的球面距离，处理经度周期，但不是精确海岸距离。高度为 cell-area 平均正陆面高度，海洋分量为零。

## 雪、干旱与分类

雪桶低于 0°C 时积累月降水，正温度按 3 mm/K/day 融化，预循环六年，最后一年雪储量>1 mm 的月份形成 snow-season diagnostic。snow_fraction 是**有雪月份/12**，不是面积覆盖率；用于 fractional cell 陆地分量，纯海洋为零。无海冰、冰川动力或 ice-albedo feedback。

AI=年 P/年 PET（分母下限 1 mm）；deficit=max(PET−P,0)。二者都受雨量和近似 PET 的结构误差影响。

Köppen-like 独立实现 Peel 2007 Table 1 的 30 个陆地类别，另有 Ocean。B 类先判：Pannual<10(2Tmean+季节偏置)，夏季≥70% 时偏置 28，冬季≥70% 为 0，否则 14；BW 用该阈值一半，h/k 分界 18°C。A 最冷月≥18°C，Af 最干月≥60 mm，Am 最干月≥100−Pannual/25，余为 Aw。C/D 最热月>10°C、最冷月 0°C 分界，s/w 按夏冬雨量，a/b/c/d 按最热月、>10°C 月数与−38°C 极寒阈值。E 分 ET/EF。

已知差异：最热月**恰好 10°C** 归 E；同时满足干夏/干冬条件时依季节总雨量取 s/w。NH 夏季 AMJJAS，SH ONDJFM，月份为模型等时长近似。land_fraction<0.5 归 Ocean，故沿海 Snow/Jungle triangle 也可能采到 Ocean 格。这是分辨率问题，不是原标签被修改。分类称 Köppen–Geiger-like，未声称是正式观测气候区。

## 产品与复现

使用既有 QGIS Python 3.12：NumPy 做数组，SciPy 做稀疏求解/PCHIP/NetCDF，Matplotlib 做验证图，GDAL 做 GIS。无新框架安装。netCDF4/xarray 未安装，采用 SciPy CDF-2，带 lat/lon/time bounds、cell_area、球半径与月历说明。GeoTIFF 为 2.5°；年平均风为 u/v 双波段。GeoPackage 保留 raw/V1/V2 corners、原始高度、顶点引用及 map/section/mesh/triangle；气候按 raw centroid 所在 cell 采样，记录 row/column、grid_degrees、sampling_method 和 Level A 标记。不能称为 triangle-scale 气候精度。该 vector layer 不额外新增 polar caps。

在 `D:\Project\FF7Gaia` 运行：

```powershell
& .\.venv\Scripts\python.exe -B scripts\climate_v2.py probe
& .\.venv\Scripts\python.exe -B scripts\climate_v2.py all
& .\.venv\Scripts\python.exe -B scripts\climate_v2.py report
& .\.venv\Scripts\python.exe -B scripts\climate_v2.py test-all
& .\.venv\Scripts\python.exe -B scripts\climate_v2_safety.py check
```

all=synthetic/search/export/sensitivity，也可分别运行各 phase。可用 GAIAGIS_QGIS_ROOT 指定准备好的运行时。TEMP/TMP、绘图缓存、日志全部在工作区。run-settings signature 包含配置、权重、数值模块、V1 输入 SHA 和 NumPy/SciPy 版本；签名不同拒绝缓存。新场景应保存既有 run 并另建研究记录，不能覆盖结果掩盖历史。

## 许可与实现边界

代码沿用项目 GPL-3.0-only。未复制参考模型实现。现有运行时库：NumPy/SciPy BSD，Matplotlib PSF-compatible，GDAL MIT/X。ExoPlaSim 为外部 GPL-2.0 模型，源码与编译产物未 vendoring。未来组合发布需单独审查许可，本轮没有声称 GPL-2 与 GPL-3-only 可直接合并。
