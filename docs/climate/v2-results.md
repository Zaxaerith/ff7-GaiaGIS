# Gaia V2：结果、冲突与建议

由 `scripts/climate_v2_report.py` 从实际保存的计算结果生成。当前 **Level A completed / GCM validation pending**，不是 GCM-confirmed Gaia。

## 推荐与保留 V1

当前 Earth-like baseline 下最小 regularized J 为 **v1_baseline**。即暂时保留精确 V1 latitude；独立 V2 气候层已完成，但没有足够证据采用新的 warp。V1 GeoPackage、GLB、QGIS、Web、源码与测试没有覆盖。未创建 Git tag，因为 V1 repository 有未提交/未跟踪文件。

Source root：`D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition`，原 WM 子目录 `ff7\workingdir\data\wm`。计算输入为只读 V1 `output/gis/gaia_geographic.gpkg`，原始游戏文件仅用于 hash 与既有 read-only integration tests。WM2 没有被作为气候边界或 bathymetry。

## 搜索和候选

6 个 shortlist，64 个实际计算候选（V1 + 63 PCHIP）；提案记录 6122 条，全部保存在 all_proposals.json，包括拒绝原因。种子、锚点、边界、stretch、curvature、objective 权重见独立 TOML 与 latitude-optimization.md。先 5° 搜索，再 2.5° 复算。这个有限随机搜索不是全局最优证明。

| 候选 | C ↑ | J ↓ | RMS Δlat° | 最大 Δlat° | stretch min–max | cap % |
| --- | --- | --- | --- | --- | --- | --- |
| v1_baseline | 0.2655 | 0.7443 | 0.00 | 0.00 | 1.000–1.000 | 1.50 |
| candidate_056 | 0.4922 | 0.8008 | 12.28 | 22.62 | 0.466–1.747 | 0.81 |
| candidate_017 | 0.4654 | 0.8421 | 13.64 | 24.21 | 0.616–1.752 | 2.75 |
| candidate_052 | 0.2914 | 0.7931 | 3.10 | 4.76 | 0.571–1.221 | 1.72 |
| candidate_009 | 0.4258 | 0.8868 | 13.33 | 24.08 | 0.418–1.424 | 5.40 |
| candidate_010 | 0.2758 | 0.9044 | 7.09 | 12.70 | 0.741–2.277 | 2.83 |

综合替代：candidate_052（较低变形）、candidate_056（较高气候 C）、candidate_017（另一较高 C、不同 warp）。候选 056 C 较高，但最大移动超过 22°，不能只给地图看起来较合理的说明而隐藏变形。Shortlist Pareto 与全部 score 保存于 JSON/CSV，未调权重强行让 V2 胜出。

## FF7 environmental conflict

下表类内按固定 V1 chord-triangle area 加权，matched 为 soft score≥0.5 的固定面积比例；不是实测气候通过率。

| 候选/terrain | triangles | 年 T °C | 年 P mm | AI | 雪月比例 | soft score | matched % |
| --- | --- | --- | --- | --- | --- | --- | --- |
| v1_baseline/snow | 1908 | 1.69 | 715.5 | 0.789 | 0.465 | 0.6153 | 69.3 |
| v1_baseline/jungle | 1300 | -9.30 | 903.0 | 1.505 | 0.861 | 0.0000 | 0.0 |
| v1_baseline/desert | 430 | 16.82 | 1646.6 | 0.758 | 0.004 | 0.2964 | 30.3 |
| v1_baseline/swamp | 533 | 10.29 | 94.8 | 0.059 | 0.189 | 0.0250 | 0.0 |
| candidate_056/snow | 1908 | -4.48 | 1399.3 | 1.865 | 0.744 | 0.8553 | 99.8 |
| candidate_056/jungle | 1300 | -6.57 | 865.2 | 1.196 | 0.775 | 0.0001 | 0.0 |
| candidate_056/desert | 430 | 12.97 | 341.1 | 0.180 | 0.007 | 0.8636 | 93.8 |
| candidate_056/swamp | 533 | 17.22 | 563.7 | 0.254 | 0.000 | 0.1244 | 8.7 |

V1 Jungle 显著偏冷且有长雪季；Swamp 在模型中明显偏干，Desert 也未稳定对应干旱。候选 056 不能同时消除全部冲突。可能原因包括：纬度映射、未标定高度、固定背景风/蒸发闭合、粗格采样、gameplay terrain 与气候语义差异；Swamp 还可能依赖径流/地下水，当前没有水文模型。不能从单一模型断定游戏大陆应该移动。

候选 056 的主要收益来自 Snow 和 Desert，**并没有解决 Jungle**。因此“最高总 C”不能简写成“整体真实气候已合理”。

## 气候场与数值质量

推荐网格 72×144（2.5°）、12 个月。模型表面全球面积加权年 T=10.78°C，年均格温范围 -25.45…24.24°C；全球年 P=1259.7 mm，格年 P 范围 43.6…11170.6 mm。Fractional land 面积比例 31.79%。这是模型假设下的输出，不是 Gaia 观测。

| Köppen-like | 全球完整分类格面积 % |
| --- | --- |
| BWk | 7.42 |
| ET | 5.18 |
| Cfb | 3.98 |
| BSk | 3.91 |
| Cwb | 1.70 |
| Cwa | 1.68 |
| Dfb | 1.40 |
| Dfc | 1.39 |

表中面积为完整 majority-land 分类格面积占全球比例，并非 FF7 terrain 面积或 fractional land 面积；Ocean 分类格占 68.40%。所有类别在 climate-distribution.json。

对照图仍有显著纬向降水带，最高格年 P 超过 11000 mm。这些受固定背景环流/凝结时间尺度支配，须 GCM 和地球基准验证；不能把细小 residual 当成降水场真实性保证。

推荐方案 TOA 海平面 EBM 年残差 -0.00911 W/m²，局部离散方程最大残差 1.59e-09 W/m²，周期漂移 0.01525 K；水汽月全球残差最大 2.34e-14 mm。数值闭合很小，**不意味着复杂物理已被校准**；TOA 指标不适用于 post-EBM lapse 后的同一方程。

## Synthetic worlds 与采样风险

Aquaplanet、平坦对称大陆、山脉障碍均已跑，三个 EBM 都在 9 年级别到周期平衡。测试检验日照积分 S/4、极昼/夜、季节半球对称、aqua zonal symmetry、热带较暖/湿、副热带较干趋势、land/ocean seasonal storage、迎风/背风降水与雪融化。属于定性行为和数值测试，未做真实地球 hindcast 或多模型验证。

Raw boundary 样本 580608，未覆盖 0.000000，overlap hits 146126，水平退化三角形 246。Overlap hits 是重复命中次数，**不是独立重叠 cell 数或精确重叠面积**。采用第一 canonical 三角形，可能影响边界和高度；全部 142586 三角形仍保留在 vector lineage 中。

## 敏感性：高度足以改变推荐

九种场景，每种六方案，合计 54 次 5° 模拟。注意这张表与 2.5° shortlist 有不同 grid resolution。

| 场景 | 最低 J 候选 | C | J | 第二名 J 差 |
| --- | --- | --- | --- | --- |
| baseline | v1_baseline | 0.2376 | 0.7723 | 0.0275 |
| vertical_0_5 | candidate_056 | 0.4871 | 0.8059 | 0.0104 |
| vertical_2 | v1_baseline | 0.2876 | 0.7223 | 0.0580 |
| obliquity_22 | v1_baseline | 0.2280 | 0.7819 | 0.0151 |
| obliquity_25 | v1_baseline | 0.2383 | 0.7716 | 0.0315 |
| co2_280 | v1_baseline | 0.2431 | 0.7668 | 0.0312 |
| co2_800 | v1_baseline | 0.2229 | 0.7870 | 0.0170 |
| mixed_layer_20 | v1_baseline | 0.2406 | 0.7692 | 0.0435 |
| mixed_layer_100 | v1_baseline | 0.2321 | 0.7778 | 0.0176 |

垂直尺度 0.5 m/raw unit 改由 candidate_056 胜出，其他八种场景仍为 V1。**排名不是完全稳健，高度标定是下一步优先事项。**此处没有覆盖证据权重、水汽/风、海洋动力与 GCM 结构敏感性。

## GCM、产品与测试

ExoPlaSim executed: NO。Fortran compiler smoke 成功，WSL 子系统未安装；真实 GCM smoke 和 shortlist comparison 均 pending，Level A/GCM 一致性 UNKNOWN。六套 T21 land/orography/config 已准备并做文件数值读回检查，详见 gcm-validation.md。

产品：best_fast_model.nc；shortlist/*/fast_model.nc；九种场景 sensitivity.csv；temperature/precipitation/snow/aridity/Köppen/land/elevation/coast GeoTIFF；双波段风；gaia_climate_v2.gpkg（FF7 triangle raw/V1/V2 lineage + 2.5° sampled fields）。没有 triangle-scale 气候精度，也没有 Web、WM2、texture 或正式 weather 产品。

Python regression tests：89，successful=True，failures=0，errors=0，skipped=0。范围包括 V1 parser/source/sphere/Web export 和 V2 physics/evidence/saved products/hash；完整日志 output/climate_v2/tests.log。本轮不修改 Web，因此未把先前浏览器 QA 当作新的 V2 气候验证。

## 安全核查与 hash

V1 frozen files：195；unchanged=True。**FF7 source modified: NO**。before/after 全值保存在 safety-final.json。

审计补充：首次复用 legacy CRS test 时，它在固定 V1 临时路径重建了空的 test_crs/wkt2.gpkg，仅改变生成时间戳。已按冻结文件完整 SHA-256 恢复原字节（不是修改 freeze manifest），保存 regenerated-fixture.gpkg 与 recovery.json。其余冻结文件及全部正式产品未变化；后续 regression runner 把这个临时 fixture 的创建/读回重定向到 V2。最终 195 文件匹配是结束状态，不隐瞒此中间副作用。

| 文件 | bytes before=after | SHA-256 before=after | match |
| --- | --- | --- | --- |
| wm0.map | 3250176 | 43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C | True |
| wm2.map | 565248 | 404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02 | True |
| wm3.map | 188416 | 70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3 | True |
| world_us.lgp | 3114259 | 975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C | True |
| wm0.bot | 15638528 | 8C4312419869A3ED862F56A53713123ABED4938962E986460E300786D51A719E | True |
| wm2.bot | 2260992 | D1F90526594F0F70089AE2D71E9A1643C4434414A04FA13CF3B9BEAB2EE43720 | True |
| wm3.bot | 753664 | B98E10B46D4E8427DEAE3514A4A448C28971E99F584011E7102E61B94F1FC3FF | True |

## 下一步与未知

先确认垂直尺度/地形边界和重叠采样策略；为 wind/PET/soil 及 evidence 权重建立结构敏感性；在支持的 Linux/WSL 环境做真实 GCM smoke，再跑相同 shortlist 到足够平衡。原始行星参数、真实赤道/极点、气候标签含义、海洋环流、云/海冰、局地水文均 UNKNOWN 或 Assumed。

目前值得保留 V2 为**实验气候图层**，但不建议把新的 latitude warp 作为默认 Web 世界。Web 接入应留到下一阶段，以 Geometric/Experimental Climate 并存并明确 Pending；本轮没有接入 Web。

## 对照图

![Six candidate geometries](../../output/climate_v2/plots/shortlist-terrain.png)

![Level A climate comparison](../../output/climate_v2/plots/climate-alternative-comparison.png)

![Latitude functions](../../output/climate_v2/plots/shortlist-latitudes.png)

![Synthetic references](../../output/climate_v2/plots/synthetic-worlds.png)
