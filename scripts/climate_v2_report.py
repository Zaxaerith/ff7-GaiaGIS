# SPDX-License-Identifier: GPL-3.0-only
"""Produce research figures and an evidence-based report from saved V2 results."""
import csv,json,re
from pathlib import Path
import numpy as np
from scipy.io import netcdf_file
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
from gaiagis.climate.settings import ROOT
from gaiagis.climate.classification import CLASSES
from gaiagis.climate.geography import load_source
from gaiagis.climate.pipeline import reconstruct

OUT=ROOT/'output/climate_v2';DOC=ROOT/'docs/climate'

def read_json(path):return json.loads(path.read_text(encoding='utf-8'))
def write_json(path,data):
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,indent=2,allow_nan=False)+'\n',encoding='utf-8')
def nc_fields(path):
    with netcdf_file(path,'r',mmap=False) as nc:return {k:v.data.copy() for k,v in nc.variables.items()}
def table(headers,rows):
    return '\n'.join(['| '+' | '.join(headers)+' |','| '+' | '.join(['---']*len(headers))+' |',*['| '+' | '.join(str(x) for x in row)+' |' for row in rows]])

def plots(mappings,source,fields):
    directory=OUT/'plots';directory.mkdir(exist_ok=True)
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':9,'figure.dpi':140})
    palette={3:'#366b93',26:'#366b93',6:'#4e8faa',0:'#80a968',1:'#376a47',2:'#99836f',8:'#d9c084',10:'#e4eaeb',7:'#678e7b',25:'#376a47'}
    colors=[palette.get(int(t),'#9b927d') for t in source['ids'][:,4]]
    fig,axes=plt.subplots(2,3,figsize=(14,8),layout='constrained',sharex=True,sharey=True)
    for ax,m in zip(axes.flat,mappings):
        points=source['geo'][:,:,:2].copy();points[:,:,1]=m(source['raw'][:,:,1]/source['height'])
        ax.add_collection(PolyCollection(points,facecolors=colors,edgecolors='none',rasterized=True));ax.set_facecolor('#366b93')
        diag=read_json(OUT/'shortlist'/m.name/'diagnostics.json')['record']
        ax.set(xlim=(-180,180),ylim=(-90,90),title=f'{m.name}\nC={diag["climate_consistency"]:.3f}; RMS shift={diag["latitude_rms_delta_deg"]:.2f} deg')
        ax.set_xticks([-180,-90,0,90,180]);ax.set_yticks([-60,0,60]);ax.grid(alpha=.2)
    fig.suptitle('Shared extent and unchanged longitude: geometric baseline / latitude alternatives')
    fig.supxlabel('Longitude (deg)');fig.supylabel('Latitude (deg)');fig.savefig(directory/'shortlist-terrain.png');plt.close(fig)
    names=['v1_baseline','candidate_056'];fig,axes=plt.subplots(3,2,figsize=(12,10),layout='constrained')
    for row,(key,title,cmap,lo,hi) in enumerate([('annual_temperature','Annual temperature (C)','coolwarm',-40,30),('annual_precipitation','Annual precipitation (mm/year)','YlGnBu',0,3000),('snow_fraction','Land snow-season fraction','Blues',0,1)]):
        for col,name in enumerate(names):
            f=fields[name];ax=axes[row,col];data=f[key]
            if key=='snow_fraction':data=np.ma.masked_where(f['land_fraction']==0,data)
            image=ax.pcolormesh(f['lon_bounds'][:,0].tolist()+[f['lon_bounds'][-1,1]],f['lat_bounds'][:,0].tolist()+[f['lat_bounds'][-1,1]],data,cmap=cmap,vmin=lo,vmax=hi,shading='flat')
            ax.set(xlim=(-180,180),ylim=(-90,90),title=f'{name}: {title}');ax.set_xticks([-180,-90,0,90,180]);ax.set_yticks([-60,0,60]);fig.colorbar(image,ax=ax,shrink=.7,extend='both' if key!='snow_fraction' else 'neither')
    fig.suptitle('2.5-degree Level A comparison: higher climate score entails more geometry change\nGCM validation pending; shared scales, ocean snow masked')
    fig.savefig(directory/'climate-alternative-comparison.png');plt.close(fig)
    fig,ax=plt.subplots(figsize=(10,5),layout='constrained');u=np.linspace(0,1,800)
    for m in mappings:ax.plot(u,m(u),label=m.name,lw=2 if m.name=='v1_baseline' else 1.3)
    ax.set(xlabel='Normalized game_north (0 = V1 north boundary)',ylabel='Latitude (deg)',title='Six global monotone mappings; no terrain-specific anchors');ax.grid(alpha=.2);ax.legend(ncol=2);fig.savefig(directory/'shortlist-latitudes.png');plt.close(fig)
    cases=['aquaplanet','flat_continent','mountain_barrier'];fig,axes=plt.subplots(2,3,figsize=(14,7),layout='constrained')
    for col,name in enumerate(cases):
        f=nc_fields(OUT/'synthetic'/f'{name}.nc')
        for row,(key,cmap,lo,hi) in enumerate([('annual_temperature','coolwarm',-40,30),('annual_precipitation','YlGnBu',0,3000)]):
            ax=axes[row,col];im=ax.pcolormesh(f['lon'],f['lat'],f[key],cmap=cmap,vmin=lo,vmax=hi,shading='nearest');fig.colorbar(im,ax=ax,shrink=.7,extend='both');ax.set(title=f'{name}: {key}',xlim=(-180,180),ylim=(-90,90))
    fig.suptitle('Synthetic-world diagnostics before Gaia calibration');fig.savefig(directory/'synthetic-worlds.png');plt.close(fig)

def main():
    DOC.mkdir(parents=True,exist_ok=True)
    recommendation=read_json(OUT/'latitude_mapping.json');short=read_json(OUT/'shortlist.json');mappings=[reconstruct(d) for d in short['candidates']]
    fields={m.name:nc_fields(OUT/'shortlist'/m.name/'fast_model.nc') for m in mappings};source=load_source(ROOT);plots(mappings,source,fields)
    diagnostics={m.name:read_json(OUT/'shortlist'/m.name/'diagnostics.json') for m in mappings}
    records=[diagnostics[m.name]['record'] for m in mappings]
    f=fields[recommendation['recommended']['name']];area=f['cell_area'];total=area.sum()
    def mean(value):return float(np.sum(value*area)/total)
    land=float(mean(f['land_fraction']));classes={name:float(np.sum(area[f['koppen_class']==i])/total) for i,name in enumerate(CLASSES)}
    climate={'grid_degrees':2.5,'grid_rows':72,'grid_columns':144,'fractional_land_area_fraction':land,
             'global_surface_temperature_c':mean(f['annual_temperature']),'surface_temperature_extrema_c':[float(f['annual_temperature'].min()),float(f['annual_temperature'].max())],
             'global_annual_precipitation_mm':mean(f['annual_precipitation']),'precipitation_extrema_mm':[float(f['annual_precipitation'].min()),float(f['annual_precipitation'].max())],
             'binary_cell_koppen_area_fractions':classes,'classification_area_note':'entire-cell area of categorical majority-land grid, not FF7 triangle area or fractional land area'}
    write_json(OUT/'climate-distribution.json',climate)
    sensitivity=list(csv.DictReader((OUT/'sensitivity.csv').open(encoding='utf-8')));scenarios={}
    for row in sensitivity:scenarios.setdefault(row['scenario'],[]).append(row)
    sensitivity_rows=[]
    for name,group in scenarios.items():
        ranked=sorted(group,key=lambda r:float(r['objective']));winner,second=ranked[:2]
        sensitivity_rows.append([name,winner['name'],f'{float(winner["climate_consistency"]):.4f}',f'{float(winner["objective"]):.4f}',f'{float(second["objective"])-float(winner["objective"]):.4f}'])
    proposals=read_json(OUT/'all_proposals.json');raster=read_json(OUT/'raw_rasterization.json');tests=read_json(OUT/'tests.json') if (OUT/'tests.json').exists() else {'successful':'PENDING'}
    safety=read_json(OUT/'safety-final.json') if (OUT/'safety-final.json').exists() else None
    synthetic=read_json(OUT/'synthetic-diagnostics.json')
    write_json(OUT/'terrain-statistics-all.json',{name:d['terrain_statistics'] for name,d in diagnostics.items()})
    terrain_rows=[]
    for name in ['v1_baseline','candidate_056','candidate_052']:
        for terrain,s in diagnostics[name]['terrain_statistics'].items():
            terrain_rows.append({'candidate':name,'terrain':terrain,**{key:value for key,value in s.items() if key!='classes'}})
    with (OUT/'terrain-evidence.csv').open('w',newline='',encoding='utf-8') as stream:
        writer=csv.DictWriter(stream,fieldnames=list(terrain_rows[0]));writer.writeheader();writer.writerows(terrain_rows)
    candidate_table=table(['候选','C ↑','J ↓','RMS Δlat°','最大 Δlat°','stretch min–max','cap %'],[[r['name'],f'{r["climate_consistency"]:.4f}',f'{r["objective"]:.4f}',f'{r["latitude_rms_delta_deg"]:.2f}',f'{r["latitude_max_delta_deg"]:.2f}',f'{r["stretch_ratio_min"]:.3f}–{r["stretch_ratio_max"]:.3f}',f'{100*r["cap_area_fraction"]:.2f}'] for r in records])
    terrain_table=table(['候选/terrain','triangles','年 T °C','年 P mm','AI','雪月比例','soft score','matched %'],[[name+'/'+terrain,s['triangle_count'],f'{s["annual_temperature_c"]:.2f}',f'{s["annual_precipitation_mm"]:.1f}',f'{s["aridity_index"]:.3f}',f'{s["snow_fraction"]:.3f}',f'{s["soft_score"]:.4f}',f'{100*s["matched_fraction_score_ge_0_5"]:.1f}'] for name in ['v1_baseline','candidate_056'] for terrain,s in diagnostics[name]['terrain_statistics'].items() if terrain in ['snow','jungle','desert','swamp']])
    significant=sorted([(name,frac) for name,frac in classes.items() if name!='Ocean' and frac>0],key=lambda p:-p[1])[:8]
    class_table=table(['Köppen-like','全球完整分类格面积 %'],[[name,f'{100*value:.2f}'] for name,value in significant])
    hashes='待运行 safety check。'
    if safety:
        hashes=table(['文件','bytes before=after','SHA-256 before=after','match'],[[a['filename'],a['size'],a['sha256'],a['sha256']==b['sha256'] and a['size']==b['size']] for a,b in zip(safety['before']['files'],safety['after']['files'],strict=True)])
    result=f'''# Gaia V2：结果、冲突与建议

由 `scripts/climate_v2_report.py` 从实际保存的计算结果生成。当前 **Level A completed / GCM validation pending**，不是 GCM-confirmed Gaia。

## 推荐与保留 V1

当前 Earth-like baseline 下最小 regularized J 为 **{recommendation['recommended']['name']}**。即暂时保留精确 V1 latitude；独立 V2 气候层已完成，但没有足够证据采用新的 warp。V1 GeoPackage、GLB、QGIS、Web、源码与测试没有覆盖。未创建 Git tag，因为 V1 repository 有未提交/未跟踪文件。

Source root：`D:\\SteamLibrary\\steamapps\\common\\FINAL FANTASY VII Steam Edition`，原 WM 子目录 `ff7\\workingdir\\data\\wm`。计算输入为只读 V1 `output/gis/gaia_geographic.gpkg`，原始游戏文件仅用于 hash 与既有 read-only integration tests。WM2 没有被作为气候边界或 bathymetry。

## 搜索和候选

{len(records)} 个 shortlist，64 个实际计算候选（V1 + 63 PCHIP）；提案记录 {len(proposals)} 条，全部保存在 all_proposals.json，包括拒绝原因。种子、锚点、边界、stretch、curvature、objective 权重见独立 TOML 与 latitude-optimization.md。先 5° 搜索，再 2.5° 复算。这个有限随机搜索不是全局最优证明。

{candidate_table}

综合替代：candidate_052（较低变形）、candidate_056（较高气候 C）、candidate_017（另一较高 C、不同 warp）。候选 056 C 较高，但最大移动超过 22°，不能只给地图看起来较合理的说明而隐藏变形。Shortlist Pareto 与全部 score 保存于 JSON/CSV，未调权重强行让 V2 胜出。

## FF7 environmental conflict

下表类内按固定 V1 chord-triangle area 加权，matched 为 soft score≥0.5 的固定面积比例；不是实测气候通过率。

{terrain_table}

V1 Jungle 显著偏冷且有长雪季；Swamp 在模型中明显偏干，Desert 也未稳定对应干旱。候选 056 不能同时消除全部冲突。可能原因包括：纬度映射、未标定高度、固定背景风/蒸发闭合、粗格采样、gameplay terrain 与气候语义差异；Swamp 还可能依赖径流/地下水，当前没有水文模型。不能从单一模型断定游戏大陆应该移动。

候选 056 的主要收益来自 Snow 和 Desert，**并没有解决 Jungle**。因此“最高总 C”不能简写成“整体真实气候已合理”。

## 气候场与数值质量

推荐网格 72×144（2.5°）、12 个月。模型表面全球面积加权年 T={climate['global_surface_temperature_c']:.2f}°C，年均格温范围 {climate['surface_temperature_extrema_c'][0]:.2f}…{climate['surface_temperature_extrema_c'][1]:.2f}°C；全球年 P={climate['global_annual_precipitation_mm']:.1f} mm，格年 P 范围 {climate['precipitation_extrema_mm'][0]:.1f}…{climate['precipitation_extrema_mm'][1]:.1f} mm。Fractional land 面积比例 {100*land:.2f}%。这是模型假设下的输出，不是 Gaia 观测。

{class_table}

表中面积为完整 majority-land 分类格面积占全球比例，并非 FF7 terrain 面积或 fractional land 面积；Ocean 分类格占 {100*classes['Ocean']:.2f}%。所有类别在 climate-distribution.json。

对照图仍有显著纬向降水带，最高格年 P 超过 11000 mm。这些受固定背景环流/凝结时间尺度支配，须 GCM 和地球基准验证；不能把细小 residual 当成降水场真实性保证。

推荐方案 TOA 海平面 EBM 年残差 {recommendation['record']['annual_global_toa_imbalance_w_m2']:.5f} W/m²，局部离散方程最大残差 {recommendation['record']['energy_equation_max_residual_w_m2']:.3g} W/m²，周期漂移 {recommendation['record']['periodic_max_drift_k']:.5f} K；水汽月全球残差最大 {recommendation['record']['water_balance_max_monthly_residual_mm']:.3g} mm。数值闭合很小，**不意味着复杂物理已被校准**；TOA 指标不适用于 post-EBM lapse 后的同一方程。

## Synthetic worlds 与采样风险

Aquaplanet、平坦对称大陆、山脉障碍均已跑，三个 EBM 都在 {synthetic['aquaplanet']['spinup_years']} 年级别到周期平衡。测试检验日照积分 S/4、极昼/夜、季节半球对称、aqua zonal symmetry、热带较暖/湿、副热带较干趋势、land/ocean seasonal storage、迎风/背风降水与雪融化。属于定性行为和数值测试，未做真实地球 hindcast 或多模型验证。

Raw boundary 样本 {raster['samples']}，未覆盖 {raster['uncovered_fraction']:.6f}，overlap hits {raster['overlap_hits']}，水平退化三角形 {raster['collapsed_source_triangles']}。Overlap hits 是重复命中次数，**不是独立重叠 cell 数或精确重叠面积**。采用第一 canonical 三角形，可能影响边界和高度；全部 142586 三角形仍保留在 vector lineage 中。

## 敏感性：高度足以改变推荐

九种场景，每种六方案，合计 54 次 5° 模拟。注意这张表与 2.5° shortlist 有不同 grid resolution。

{table(['场景','最低 J 候选','C','J','第二名 J 差'],sensitivity_rows)}

垂直尺度 0.5 m/raw unit 改由 candidate_056 胜出，其他八种场景仍为 V1。**排名不是完全稳健，高度标定是下一步优先事项。**此处没有覆盖证据权重、水汽/风、海洋动力与 GCM 结构敏感性。

## GCM、产品与测试

ExoPlaSim executed: NO。Fortran compiler smoke 成功，WSL 子系统未安装；真实 GCM smoke 和 shortlist comparison 均 pending，Level A/GCM 一致性 UNKNOWN。六套 T21 land/orography/config 已准备并做文件数值读回检查，详见 gcm-validation.md。

产品：best_fast_model.nc；shortlist/*/fast_model.nc；九种场景 sensitivity.csv；temperature/precipitation/snow/aridity/Köppen/land/elevation/coast GeoTIFF；双波段风；gaia_climate_v2.gpkg（FF7 triangle raw/V1/V2 lineage + 2.5° sampled fields）。没有 triangle-scale 气候精度，也没有 Web、WM2、texture 或正式 weather 产品。

Python regression tests：{tests.get('tests','PENDING')}，successful={tests['successful']}，failures={tests.get('failures','PENDING')}，errors={tests.get('errors','PENDING')}，skipped={tests.get('skipped','PENDING')}。范围包括 V1 parser/source/sphere/Web export 和 V2 physics/evidence/saved products/hash；完整日志 output/climate_v2/tests.log。本轮不修改 Web，因此未把先前浏览器 QA 当作新的 V2 气候验证。

## 安全核查与 hash

V1 frozen files：{safety['v1_file_count'] if safety else 'PENDING'}；unchanged={safety['v1_unchanged'] if safety else 'PENDING'}。**FF7 source modified: {safety['ff7_source_modified'] if safety else 'PENDING'}**。before/after 全值保存在 safety-final.json。

审计补充：首次复用 legacy CRS test 时，它在固定 V1 临时路径重建了空的 test_crs/wkt2.gpkg，仅改变生成时间戳。已按冻结文件完整 SHA-256 恢复原字节（不是修改 freeze manifest），保存 regenerated-fixture.gpkg 与 recovery.json。其余冻结文件及全部正式产品未变化；后续 regression runner 把这个临时 fixture 的创建/读回重定向到 V2。最终 195 文件匹配是结束状态，不隐瞒此中间副作用。

{hashes}

## 下一步与未知

先确认垂直尺度/地形边界和重叠采样策略；为 wind/PET/soil 及 evidence 权重建立结构敏感性；在支持的 Linux/WSL 环境做真实 GCM smoke，再跑相同 shortlist 到足够平衡。原始行星参数、真实赤道/极点、气候标签含义、海洋环流、云/海冰、局地水文均 UNKNOWN 或 Assumed。

目前值得保留 V2 为**实验气候图层**，但不建议把新的 latitude warp 作为默认 Web 世界。Web 接入应留到下一阶段，以 Geometric/Experimental Climate 并存并明确 Pending；本轮没有接入 Web。

## 对照图

![Six candidate geometries](../../output/climate_v2/plots/shortlist-terrain.png)

![Level A climate comparison](../../output/climate_v2/plots/climate-alternative-comparison.png)

![Latitude functions](../../output/climate_v2/plots/shortlist-latitudes.png)

![Synthetic references](../../output/climate_v2/plots/synthetic-worlds.png)
'''
    (DOC/'v2-results.md').write_text(result,encoding='utf-8')
    refs={}
    for path in DOC.glob('*.md'):
        for url in re.findall(r'\]\((https?://[^)]+)\)',path.read_text(encoding='utf-8')):refs.setdefault(url,[]).append(path.name)
    write_json(ROOT/'research/climate/reference-manifest.json',{'reviewed':'2026-10-02','policy':'primary papers/official documentation; no climate-zone blog calibration; no source vendoring','sources':[{'url':url,'used_in':sorted(set(files))} for url,files in sorted(refs.items())]})
    print('V2 report, all-terrain statistics, reference manifest and four additional comparison figures saved')

if __name__=='__main__':main()
