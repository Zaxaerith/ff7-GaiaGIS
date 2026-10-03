# SPDX-License-Identifier: GPL-3.0-only
"""Generate the evidence report and a reproducible V22 delivery manifest."""
import csv,platform
from pathlib import Path
import numpy as np
from .common import ROOT,OUT,V21,read,write_json,digest

def csvrows(path):
    with Path(path).open(encoding='utf-8') as f:return list(csv.DictReader(f))

def table(headers,rows):
    return '\n'.join(['| '+' | '.join(headers)+' |','| '+' | '.join(['---']*len(headers))+' |',*['| '+' | '.join(str(v) for v in row)+' |' for row in rows]])

def run():
    safety=read(OUT/'safety-final.json');tests=read(OUT/'tests.json');gate=read(OUT/'earth/heldout_metrics.json');pet=read(OUT/'earth/pet_reference.json');aridity=read(OUT/'earth/aridity_validation.json')['families'];inventory=read(OUT/'overlap/inventory.json');sem=read(OUT/'overlap/semantic_audit.json');policies=csvrows(OUT/'overlap/policy_summary.csv');comparison=csvrows(OUT/'overlap/policy_comparison.csv');extreme=csvrows(OUT/'precipitation/extreme_attribution.csv');repairs=csvrows(OUT/'soil/periodic_bucket_repair.csv');soil=read(OUT/'soil/summary.json');regions=csvrows(OUT/'earth/regional_validation.csv')
    if safety['ff7_source_modified']!='NO' or safety['changed_files'] or not tests['successful']:raise RuntimeError('Report cannot claim successful delivery with failed safety/tests')
    write_json(OUT/'overlap/recommendation.json',{'provisional_research_default':'natural_priority','mandatory_sensitivity_bounds':['highest','lowest'],'canonical_surface_established':False,'overlap_negligible':False,'reason':'Global fraction changes are small, but local land/height/terrain changes are large; actor collision depends on prior height and vehicle state.'})
    fingerprints=table(['文件','size 前/后','SHA-256 前','SHA-256 后','known match'],[(a['filename'],f"{a['size']} / {b['size']}",a['sha256'],b['sha256'],a['known_match']) for a,b in zip(safety['before']['files'],safety['after']['files'])])
    gate_table=table(['family / numerical revision','原 raw aridity r','新 primary r','secondary P−PET r','bounded r','regional passes','old/new gate'],[(name+' / '+value['evaluated_revision'],f"{read(V21/f'earth_benchmark/{name}_metrics.json')['metrics']['aridity_index']['land_pattern_correlation']:.4f}",f"{aridity[name]['primary_raw_ratio_r']:.4f}",f"{aridity[name]['P_minus_PET_r']:.4f}",f"{aridity[name]['bounded_r']:.4f}",str(value['regions_passed'])+'/8','FAIL / FAIL') for name,value in gate['families'].items()])
    policy_table=table(['policy','全球 land %','条件 land 高程 raw','raw union relative error','spherical additive relative error'],[(r['policy'],f"{100*float(r['land_fraction_global']):.6f}",f"{float(r['mean_elevation_land_raw']):.3f}",r['union_conservation_relative_error'],r['additive_relative_error']) for r in policies])
    pair=next(r for r in comparison if r['policy_a']=='highest' and r['policy_b']=='lowest')
    extreme_table=table(['关闭项','基线极值格 P mm/y','变化 mm/y','本次全球 max mm/y','soil periodic'],[(r['disabled_term'],f"{float(r['precipitation_mm']):.2f}",f"{float(r['delta_mm']):+.2f}",f"{float(next(q for q in extreme if q['disabled_term']==r['disabled_term'] and q['location_role']=='run_extreme')['precipitation_mm']):.2f}",r['soil_converged']) for r in extreme if r['location_role']=='baseline_extreme'])
    region_table=table(['region','reference T °C','model T °C','reference P mm/y','strong P mm/y','weak/medium/strong'],[(r['region'],f"{float(r['reference_temperature']):.2f}",f"{float(r['model_temperature']):.2f}",f"{float(r['reference_precipitation']):.1f}",f"{float(r['model_precipitation']):.1f}",'/'.join(next(q['model_pass'] for q in regions if q['family']==name and q['region']==r['region']) for name in ['weak','medium','strong'])) for r in regions if r['family']=='strong'])
    met_table=table(['variable','period','resolution source→target','canonical units','source units','size bytes'],[(r['variable'],r['period'],'94×192 Gaussian → 2.5°',r['units'],r['metadata']['units'],r['size']) for r in pet['meteorology']])
    repair_table=table(['family','lon / lat','原 soil drift mm/y','SWE drift mm/y','解析周期起始 storage mm','解析 spill mm/y'],[(r['family'],r['lon']+' / '+r['lat'],r['original_soil_drift_mm'],r['snow_drift_mm'],r['periodic_soil_start_mm'],r['new_runoff_mm']) for r in repairs])
    text=f'''# Gaia V2.2 — Earth Gate Hardening 技术报告

本阶段完成 PET 参考、Earth 诊断、有限的同方程数值修复、重叠面敏感性与回归验证。**完整 Earth Gate FAIL；0 个 acceptable families；不运行 Gaia ensemble。No physically robust V2 mapping yet.** 本报告中的 PASS 是预声明工程筛选，不是气候真实性认证。

## 1. 范围、输入与安全

唯一项目写区：`D:\\Project\\FF7Gaia`。FF7 source：`D:\\SteamLibrary\\steamapps\\common\\FINAL FANTASY VII Steam Edition`，数据位于 `ff7/workingdir/data/wm`。直接只读重新解析 wm0.map，用于 script/lineage 和原始坐标交叉验证；既有 V1 GPKG 通过 SQLite `mode=ro&immutable=1` 读取。没有复制原始 FF7 资产。

Windows native Python {platform.python_version()}，复用现有 QGIS 的 NumPy/SciPy/GDAL/Shapely。没有安装或探测 WSL、ExoPlaSim/GCM、Docker、VM、Linux 工具链或系统功能。未修改 Web 或产生新纬度候选；仅用既有 V1 进行 overlap 输入研究，未运行 Gaia 气候。

**FF7 source modified: NO**。{safety['frozen_files']} 个冻结文件全部相同，changed files = 0。V1/V2/V2.1/Web 的冻结产品没有覆盖。前后 size/hash 对照：

{fingerprints}

## 2. 独立 PET reference

FAO56 grass-reference Penman–Monteith Eq6；输入为 NOAA PSL NCEP/NCAR Reanalysis Derived Products 的 1991–2020 月 climatology。新四变量在 V21 校准中未使用，位于 `output/climate_v22/earth/data/`；没有使用 model PET 作为 reference。NCEP downwelling shortwave 是**再分析估计**，不是逐站测量。预声明设计中“measured shortwave”用词不准确，此处明确勘误，不改原始声明文件。

{met_table}

具体 URL、文件 SHA-256、metadata 和 license/attribution 存于 `earth/pet_reference.json`。humidity grams/kg 显式除以1000；Pascals=Pa，转 kPa 仅在公式入口除以1000；W/m² ×0.0864=MJ/m²/day。10m mean wind speed 用 FAO Eq47 转2m，未用平均风矢量模长代替 mean speed。

温度 Tmin/Tmax 和月均 T、NCEP 地形与 Earth land mask 来自冻结 V21 数据；FAO 公式 mean T=(Tmin+Tmax)/2，cold-domain mask 仍用原 reference mean T。ea=qP/(0.622+0.378q)，es 为 Tmin/Tmax 饱和压均值；albedo=.23；clear-sky Rso=(.75+2e−5z)Ra；FAO Eq39 估计长波，Rs/Rso 限制为1/3..1，极夜取1/3。G=0、negative ET0→0、无 sublimation。逐月用1991–2020平均 Gregorian 月长乘日率。保存未冻结掩膜的 PET，方便审计。

局限：月均非线性重采样近似；G=0 忽略 FAO 指出的春秋月尺度土壤热通量；湿度、云及温度有再分析误差；参考 crop ET0 不等于 ecosystem actual ET。模型仍使用 radiation/PT proxy PET，新 reference 含空气动力项，因此不要求数值相等。有效域平均 model PET≈1191.36，reference≈1523.72 mm/y，约−21.8%。

## 3. Aridity 与 cold-domain

规则在最终相关系数出现前声明，`aridity_validation.toml` 与 `validation-design.md` SHA-256 已记录在 PET provenance，回归测试确认字节未改。域：reference annual PET≥100 mm，annual T≥0°C，warmest month≥10°C，≥3 thawed months，reference snow fraction≤.5，land fraction≥.5。涵盖约 {100*pet['valid_land_area_fraction']:.2f}% reference land area。

Primary 是同域、面积加权 raw P/PET Pearson r，门槛仍为.35。两个 ratio 的 monthly liquid-crop PET 都使用同一 reference T>0 掩膜；模型未掩膜 PET 的同域 r 也单独输出。该共享 monthly mask 在看结果前已写在程序中；不是逐模型挑选域。次指标 P−PET、P/(P+PET) 不参与 gate。

{gate_table}

三组 primary 通过，secondary 与其一致。新 PM 的 unrestricted all-land raw r 为 weak {aridity['weak']['raw_all_land_r']:.4f}、medium {aridity['medium']['raw_all_land_r']:.4f}、strong {aridity['strong']['raw_all_land_r']:.4f}；未掩膜 model PET 同有效域 r 为 {aridity['weak']['unmasked_model_pet_primary_r']:.4f}/{aridity['medium']['unmasked_model_pet_primary_r']:.4f}/{aridity['strong']['unmasked_model_pet_primary_r']:.4f}。改善同时来自 reference 与适用域改变，不能把全部增益归功于 PM。极区 crop-aridity 标为不适用，region PET<100 时不输出巨大比值；不将 frozen ET0 当作实际冰雪蒸发。

## 4. Soil drift 根因与同方程修复

V22 baseline 精确复现 V21 三组 T/P/soil/SWE，最大绝对差≤1e−8，实际上均为0。原60年/.05mm准则不变；weak 原 max drift=.560506975 mm，medium=.081589010 mm；strong12年 drift=.028794556 mm。top20 cells / family 与逐年 reservoir 体积见两个 CSV。

漂移不是极干格点，也不是数值水预算失衡。weak 两个边缘北极 mixed cells 仅有一个略高于0°C月份，degree-day melt 已受温度上限限制，ET达到暖月PET，SWE仍增长。medium 位于103.75°E/73.75°N，soil漂移而SWE周期稳定。三个格点都在 **PET-saturated ET 且 runoff=0** 的分支：固定液态净输入不再通过增加ET产生负反馈，空桶持续线性填充直到出现spill。原60年截断把这种缓慢填桶记成未达到周期状态。

{repair_table}

修复 `v22_weak_periodic_bucket` / `v22_medium_periodic_bucket` 是解析求解**同一** PET-saturated bucket 的周期储量，而不是增加年份、改capacity、放宽容差或拟合气候。设月净输入 f，prefix c，年净输入 F>0，容量C，周期起始 S0=C+F−max(0,max(c))，按原式逐月clip/spill。程序再验证原 beta ET 方程仍产生完全相同ET，并证明 melt 可重复。仅三个已证明条件的格点适用，未满足则明确报错。P、温度、ET、melt、SWE 完全不变；修改soil周期储量、spill及其routing/wetness诊断。

解析后 weak max drift≈1.11e−10 mm、medium≈5.68e−14 mm，strong保留原值。新增 spinup years=0，physical parameter changes=false。原baseline与FAIL日志保留。不是完整雪/冰 equilibrium 解，也不推广到未满足饱和条件的格点。

## 5. Soil / snow 分离

基线 max annual SWE drift weak≈1396.62、medium≈1549.86、strong≈2309.85 mm；正SWE drift>.05 的 land area fraction 约13.40%/13.48%/13.73%。没有 glacier discharge 时，这些 persistent ice reservoir 非平衡；即使soil周期通过，也不能声称完整水文系统平衡。soil与SWE分别存储、分别诊断。weak top cells snow增长且melt温度受限；medium top cell snow drift=0，明确排除把两者一概混淆。没有实现动态冰川。

## 6. Held-out 的实际强度与泄漏检查

未进行V22参数校准或根据heldout结果挑选/调参。新 PM 的湿度/气压/风速/短波四文件只用于 validation；`earth/dataset_roles.json` 与测试核对文件hash不与原 calibration T/P 文件重叠。

这是 **metric/input-role holdout**，不是 independent-observation 或 spatial/temporal holdout：temperature、Earth surface covariates 共用NCEP来源；Köppen用同一 T/P 派生；SWE参考1981–2010，T/P主要1991–2020；snow/Köppen结果已在V21看过，不能宣称首次未见。原设计未详细列出 V21 thermal loss 的 land-temperature-seasonality 项：实际为 zonal T RMSE+0.15×land seasonality RMSE，这也是已用校准/supporting metric，不能当新holdout。原声明保持不变，此处记勘误。

没有任何一个新 aridity 或 regional score 进入校准目标。shared-data caveat 不被role测试“证明独立”掩盖；真正独立观测或时间划分仍是后续未决事项。

## 7. Regional Earth validation

八个固定 bbox 与 regime 门槛在运行前声明，至少7/8通过。reference全部支持所声明regime。按参考land与球面面积加权区域T/P/snow；区域AI采用 weighted mean P / weighted mean PET，而不是平均局部巨大比值。全部结果与失败项输出，没有改门槛。

{region_table}

共同失败：Sahara17.986°C低于18°C（门槛差仅.014°C，但相对reference偏冷4.63°C）；western Europe2.770°C vs9.052°C，低于5°C。weak额外失败Siberia snow fraction≈.350<.4；strong额外失败central Asia AI≈.662>.65，reference≈.260。region通过数5/6/5，仍不足7。Sahara/central Asia门槛边缘性需如实看待；不得事后放宽来PASS。SE Asia广义regime通过，但强组P≈1093 vsreference1918，说明粗regime PASS允许明显偏差。

Western Europe缺失海洋输热等过程是模型结构的可能解释，**未在本阶段证明因果**。不自动加入复杂环流或海洋模型。

## 8. Precipitation extreme attribution

strong baseline max at38.75°E/1.25°S，P≈5857.89 mm/y。当地budget：E≈1601.14 + advection convergence≈2120.49 + eddy convergence≈2136.27 =P，残差≈6e−12 mm。orographic condensation fraction≈.726不是可相加的因果贡献百分比。

{extreme_table}

每次只关闭一项；rainout实验关闭纬度调制，保留均匀9天背景，因为E>0而全部关闭condensation没有有限稳态。无orography使原峰下降≈60.4%；无advection下降≈32.7%；无eddy原峰只下降≈3.0%，但全球峰移至别处并增至7189.26，显示相互反馈和峰位变化。均匀rainout反而使原峰升至9211.65，不支持“单一雨出时间尺度放大”解释。差值不具可加性。

no-advection / no-eddy 的soil周期检查仍失败，明确保留警告；其局地budget仍满足原方程，但不是已通过equilibrium validation的气候。所有counterfactual均排除Earth-family acceptance与Gaia scoring。

## 9. WM0 overlaps 实际观测

142586 base triangles，803 affected，2222 positive-area pairs，246 zero-XY-area triangles。source union精确覆盖原矩形67645734912 raw²；overlap union≈23448935.98 raw²。正面积阈值1e−6 raw²只用于浮点edge noise；height equality1e−6 raw单位，cliff-like梯度cutoff4是研究标签，不是引擎阈值。

multi-label pair counts：{inventory['multi_label_pair_counts']}。84对为exact duplicate；本数据未发现同一完整XY footprint却不同height的对、tunnel-like或明确gameplay-alternate footprint；这不否定部分footprint的不同层。除84对外，交叠域height不同，maximum separation≈{sem['maximum_abs_height_separation_raw']:.3f} raw。{sem['pairs_terrain_different']}对terrain不同、{sem['pairs_region_different']}对region不同、{sem['pairs_script_different']}对script不同；全部发生在同一section/mesh内。932对unknown，不能强行改名为自然地形。

script从只读MAP重新提取，所有lineage和原始坐标逐三角与V1交叉验证。替代sections63–68未混进base几何。零水平面积记录完整保留为cliff/vertical-like evidence，气候面积贡献为0。

代码级证据：[FF7 worldmap fixed-commit actor terrain lookup](https://github.com/ergonomy-joe/ff7-worldmap/blob/bc7576e68b118e776ccefecfbc982a702a7f9e0f/NEWFF7/C_0074C9A0.cpp#L267) 的 C_0074CC07 使用缓存、previous height、vehicle/terrain checks；通常比较当前高度距离，部分状态比较原始高度。 [triangle height interpolation](https://github.com/ergonomy-joe/ff7-worldmap/blob/bc7576e68b118e776ccefecfbc982a702a7f9e0f/NEWFF7/C_0075F090.cpp#L435) 的 C_0076085F 做投影包含与平面高度插值。故 gameplay walkmesh 不等于单层最高面；此证据来自反编译研究，未在2026 executable运行级复核。无明确许可证资料只作行为参考，没有复制代码。

## 10. 三种 physical surface policy

先写真实inventory，再声明 highest / lowest / natural_priority。两面比较在实际 overlap fragment 上按affine height做裁切；跨高度平面有确定点位排序，同高以原lineage序打破平手。natural_priority优先非bridge13/14、非tunnel15，然后选最高；这仍是研究假设。Shapely constrained triangulation产生计算片段，不改原始三角形。

{policy_table}

三者 raw selected面积=source union；逐terrain球面积守恒约1.86e−13，最大cell cover≈1+1.34e−12，unknown fraction≈1.24e−13。报告使用V1既有纬度与既有polar-ocean convention；不创建新球/投影/正式GIS产品。raw height保留，气候height integration仅按现有约定clip负高程，不解释为真实米。

highest−lowest 全球land差≈{100*float(pair['land_global_fraction_delta']):.5f} percentage points，但最大local land差≈{100*float(pair['land_local_max_abs_delta']):.2f} percentage points；area-mean height local max差≈{float(pair['height_area_mean_local_max_abs_delta_raw']):.2f} raw，conditional land mean local max≈{float(pair['height_conditional_land_local_max_abs_delta_raw']):.2f} raw。因此**overlap不能视为不重要**。全部32terrain的global/local差异在policy_comparison.csv。

`surface_selection_report.csv` 对每种policy记录所有affected与zero-XY三角的原source/section/mesh/triangle/terrain/region/script、保留/排除面积；未受影响者完整保留原lineage。暂建议自然地表研究用 natural_priority，highest/lowest保留为强制敏感性范围；不把任何一个提升为唯一canonical surface。

积分数值问题：lowest裁切产生细长fragment，直接用绝对大坐标shoelace发生消减，触发7.01e−5的relative conservation error。V22独立积分实现改为local-origin shoelace后误差降至~1.86e−13；不放宽原1e−8准则，V21代码未改。

## 11. Old / new gates 与停止条件

V21原FAIL保留：原aridity三组失败，weak/medium另有soil失败。V22保留原T/P/snow/Köppen/结构与water-balance数值门槛；aridity reference/适用域有预声明方法理由，r门槛仍.35，soil仍.05mm，regional规则增加而非放宽。数值bucket修复后soil通过，完整gate仍三组regional FAIL；acceptable_family_count={gate['acceptable_family_count']}。

没有新增physics parameter family sweep，没有根据heldout结果重新拟合。仅两个同方程numerical revision。下一阶段需要决定如何处理region结构性偏差及真正独立验证；本阶段不继续扩展模型。

## 12. Gaia ensemble

0<3，180 scenarios 明确 `not_run_earth_gate_failed`，保留既有V1/052/056/017 ×5height scales ×3family ×3evidence schemes的manifest，缺失分数保持缺失。没有运行Gaia物理模型、计算Pareto或对missing scores排名。

## 13. Balanced candidate 与 formal V2

没有实际ensemble scores，Balanced candidate不存在。Earth gate失败、Gaia ensemble未运行，无法证明physics/height/evidence-weight robustness。**No physically robust V2 mapping yet.** 不提出formal Climate V2 mapping。

## 14. 测试、交付与剩余决策

完整测试 {tests['tests']}，failures={tests['failures']}，errors={tests['errors']}，skipped={tests['skipped']}。保留全部原116项，新增PM官方worked example/unit转换、cold-domain、bounded、soil/snow分离、actual dataset-role leakage、regions、overlap类别/交叉平面/同高lineage、真实surface union/spherical conservation及解析bucket水预算和物理场不变检查。

主要新增目录为 `src/gaiagis/climate/v22/`、`config/climate/v22/`、`docs/climate/v22/`、`output/climate_v22/`，启动器/测试runner/safety位于scripts，新增test_climate_v22.py。完整路径/size/hash见delivery-manifest.json；原游戏资产不进入Git，输出目录已gitignored。Git原仓库仍存在用户既有未提交文件，本轮未执行commit。

建议后续设计决策（未自动执行）：

1. Western Europe冷偏差的成因应先做热输运/land-ocean响应诊断；Sahara marginal gate miss与reference大偏差应分开讨论。不要直接调heldout阈值。
2. 决定是否需要独立观测或时间/空间holdout；当前role holdout不足以证明科学独立性。
3. 若下一轮改变physics，应预登记regional测试与独立validation后再运行少量families；保留本轮结果，不回写V21。
4. 决定永久ice accumulation如何限制模型适用性，当前没有glacier equilibrium，soil周期通过不解决这个问题。
5. 对局部敏感overlap确认自然地表语义，再讨论Gaia输入主policy；继续保留lineage与敏感性，不改源三角。

References: [FAO56 Eq6](https://www.fao.org/4/x0490e/x0490e06.htm), [meteorological conversions](https://www.fao.org/4/x0490e/x0490e07.htm), [monthly applicability and official Example18](https://www.fao.org/4/x0490e/x0490e08.htm), [NOAA PSL catalog](https://psl.noaa.gov/thredds/catalog/Datasets/ncep.reanalysis.derived/surface_gauss/catalog.html), [NOAA disclaimer](https://psl.noaa.gov/disclaimer/). PET不是实测ET，surface政策不是canonical地表，全球均值匹配不能消除区域失败。
'''
    (ROOT/'docs/climate/v22/validation-report.md').write_text(text,encoding='utf-8')
    files=[*list((ROOT/'src/gaiagis/climate/v22').glob('*.py')),*list((ROOT/'docs/climate/v22').glob('*.md')),*list((ROOT/'config/climate/v22').glob('*')),ROOT/'tests/test_climate_v22.py',*list((ROOT/'scripts').glob('climate_v22*.py'))]
    records=lambda paths:[{'path':p.relative_to(ROOT).as_posix(),'size':p.stat().st_size,'sha256':digest(p)} for p in sorted(paths) if p.is_file()]
    outputs=[p for p in OUT.rglob('*') if p.is_file() and 'temp' not in p.relative_to(OUT).parts and p.name!='delivery-manifest.json']
    write_json(OUT/'delivery-manifest.json',{'source_document_files':records(files),'outputs':records(outputs),'tests':tests,'frozen_files_verified':safety['frozen_files'],'ff7_source_modified':'NO','earth_gate_passed':False,'gaia_ensemble':'not_run_earth_gate_failed','formal_v2_mapping':False})
    print('V22 report and delivery manifest written',len(files),len(outputs),flush=True)
