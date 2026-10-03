# SPDX-License-Identifier: GPL-3.0-only
"""Research artifacts and explicit gated-stage delivery, no invented Gaia scores."""
import csv,json
from pathlib import Path
import numpy as np
from scipy.io import netcdf_file
from .common import ROOT,OUT,target,write_json,write_csv,raster,digest
from .benchmark import weighted_mean,correlation
from .model import extremes
from .rasterization import mappings
from ..geography import load_source
from ..moisture import uplift
from ..circulation import winds

def read(path):return json.loads(path.read_text(encoding='utf-8'))
def old_extremes(grid,fields,c):
    enhanced=[]
    for month in range(12):
        u=fields['prevailing_wind_u'][month];v=fields['prevailing_wind_v'][month];_,_,background=winds(grid,month,c)
        rate=uplift(grid,fields['elevation'],u,v)/c['moisture']['condensation_height_m'];enhanced.append(rate/(rate+background))
    fields={**fields,'monthly_orographic_rain_fraction':np.array(enhanced),'moisture_convergence':fields['monthly_precipitation']-fields['monthly_evaporation']}
    return extremes(grid,fields)
def audit_aridity(grid,reference,families):
    weights=grid.area*reference['land_fraction'];pet=reference['monthly_pet'].sum(axis=0);ai=reference['aridity_index'];diagnostics={}
    for family in families:
        model=dict(np.load(OUT/f'earth_benchmark/{family["name"]}_fields.npz'));m=model['aridity_index']
        diagnostics[family['name']]={'all_land_raw_ratio_correlation':correlation(m,ai,weights),'reference_pet_ge_100mm_land_correlation':correlation(m,ai,weights*(pet>=100)),
          'land_abs_latitude_le_60_correlation':correlation(m,ai,weights*(abs(grid.lat[:,None])<=60)),
          'bounded_ratio_land_correlation':correlation(m/(1+m),ai/(1+ai),weights),
          'low_reference_pet_land_area_fraction':weighted_mean((pet<100).astype(float),weights)}
    write_json(OUT/'earth_benchmark/aridity_audit.json',{'status':'Additional post-screen diagnostics only. Does not replace, loosen, or override predeclared full-land raw P/PET gate.','families':diagnostics,'interpretation':'Hargreaves PET goes to zero for very cold monthly T; PT PET uses approximate surface radiation and behaves differently. Clipped near-zero denominators dominate raw ratio statistics. Need an independently justified PET reference/domain definition and soil convergence before accepting physics.'})
    return diagnostics
def jungle_audit(grid):
    source=load_source(ROOT);mapping=mappings()[0];sel=source['ids'][:,4]==25;centers=source['raw'].mean(axis=1);area=source['area_v1'][sel]
    lon=360*(centers[:,0]/source['width']-.5);lat=mapping(centers[:,1]/source['height']);j,i=grid.indices(lon,lat)
    with netcdf_file(ROOT/'output/climate_v2/shortlist/v1_baseline/fast_model.nc','r',mmap=False) as nc:fields={k:v.data.copy() for k,v in nc.variables.items()}
    def mean(x):return weighted_mean(x[sel],area)
    base_temp=fields['annual_temperature'][j,i];lapse=.0065*fields['elevation'][j,i]
    result={'status':'Forensic decomposition of frozen V2 legacy V1 run only; no revised Gaia physics rerun. No causal counterfactual continentality or moisture experiment.',
      'triangle_count':int(sel.sum()),'areaweighted_latitude_deg':mean(lat),'latitude_min':float(lat[sel].min()),'latitude_max':float(lat[sel].max()),'raw_triangle_mean_height':mean(centers[:,2]),
      'legacy_annual_temperature_c':mean(base_temp),'legacy_sealevel_temperature_component_c':mean(base_temp+lapse),'legacy_lapse_temperature_component_c':-mean(lapse),'legacy_climate_grid_elevation_m_at_assumed_scale_1':mean(fields['elevation'][j,i]),
      'legacy_coast_distance_m':mean(fields['coast_distance'][j,i]),'legacy_temperature_seasonality_c':mean(fields['temperature_seasonality'][j,i]),'legacy_precipitation_mm':mean(fields['annual_precipitation'][j,i]),
      'legacy_wind_u_m_s':mean(fields['prevailing_wind_u'].mean(axis=0)[j,i]),'legacy_wind_v_m_s':mean(fields['prevailing_wind_v'].mean(axis=0)[j,i]),
      'temperature_moisture_coupling':'Zero direct contribution by model architecture: old EBM has no latent heat or soil cooling feedback; this is a limitation, not a measured physical zero.'}
    path=OUT/'rasterization/v1_baseline.npz'
    if path.exists():
        agg=dict(np.load(path));weight=agg['evidence_reference_area'][25]
        result['legacy_temperature_sampled_with_polygon_cell_weights_c']=weighted_mean(fields['annual_temperature'],weight)
        result['sampling_difference_c']=result['legacy_temperature_sampled_with_polygon_cell_weights_c']-result['legacy_annual_temperature_c']
    result['hypothetical_fixed_sealevel_lapse_only_by_scale']={str(scale):result['legacy_sealevel_temperature_component_c']+result['legacy_lapse_temperature_component_c']*scale for scale in [.5,.75,1.,1.5,2.]}
    result['scale_note']='Analytic lapse-only decomposition holding legacy sea-level temperature/grid geography fixed. These are not new climate model runs or robustness scores.'
    write_json(OUT/'comparison/jungle_legacy_decomposition.json',result);return result
def plots(grid,reference,models):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    plt.rcParams.update({'font.size':10})
    selected=models['strong'];old=models['legacy']
    fig,axes=plt.subplots(2,3,figsize=(14,7),layout='constrained')
    for row,(key,cmap,limits,title) in enumerate([('annual_temperature','coolwarm',(-40,35),'Temperature (C)'),('annual_precipitation','Blues',(0,4000),'Annual precipitation (mm)')]):
        for col,(name,f) in enumerate([('Earth reference',reference),('Legacy Level A',old),('Revised, rejected by aridity gate',selected)]):
            im=axes[row,col].pcolormesh(grid.lon_edges,grid.lat_edges,f[key],cmap=cmap,vmin=limits[0],vmax=limits[1],shading='flat');axes[row,col].set_title(name+'\n'+title);axes[row,col].set_xlabel('Longitude');axes[row,col].set_ylabel('Latitude')
        fig.colorbar(im,ax=list(axes[row,:]),shrink=.75)
    fig.savefig(target(OUT/'comparison/earth_maps.png'),dpi=160);plt.close(fig)
    fig,axes=plt.subplots(1,3,figsize=(14,4),layout='constrained')
    for ax,key,label in zip(axes,['annual_temperature','annual_precipitation','aridity_index'],['Temperature (C)','Precipitation (mm/year)','Aridity P/PET']):
        ax.plot(grid.lat,reference[key].mean(axis=1),color='black',label='Reference')
        for name,f in models.items():ax.plot(grid.lat,f[key].mean(axis=1),label=name,alpha=.8)
        ax.set_xlabel('Latitude');ax.set_ylabel(label);ax.grid(alpha=.3)
    axes[0].legend(fontsize=8);fig.savefig(target(OUT/'comparison/earth_zonal.png'),dpi=160);plt.close(fig)
    fig,axes=plt.subplots(1,2,figsize=(11,4),layout='constrained')
    for ax,name in zip(axes,['closed_basin','coastal_plain']):
        f=dict(np.load(OUT/f'synthetic/{name}.npz'));im=ax.imshow(f['wetness_index'],origin='lower',extent=(-180,180,-90,90),vmin=0,vmax=1,cmap='YlGnBu');ax.set_title(name+' synthetic wetness');ax.set_xlabel('Longitude');ax.set_ylabel('Latitude')
    fig.colorbar(im,ax=list(axes),shrink=.8);fig.savefig(target(OUT/'hydrology/synthetic_wetness.png'),dpi=160);plt.close(fig)
    path=OUT/'rasterization/v1_baseline.npz'
    if path.exists():
        f=dict(np.load(path));fig,axes=plt.subplots(1,2,figsize=(11,4),layout='constrained')
        for ax,key,title in zip(axes,['land_fraction','mean_elevation_raw'],['Polygon area land fraction','Area mean elevation (raw units)']):
            im=ax.pcolormesh(grid.lon_edges,grid.lat_edges,f[key],shading='flat',cmap='terrain');ax.set_title(title);fig.colorbar(im,ax=ax,shrink=.7)
        fig.savefig(target(OUT/'rasterization/areaweighted_v1.png'),dpi=160);plt.close(fig)
def run_report(grid):
    from .common import config
    metrics=read(OUT/'earth_benchmark_metrics.json');families=read(OUT/'earth_benchmark/parameter_families.json');reference=dict(np.load(OUT/'earth_benchmark/reference.npz'));models={name:dict(np.load(OUT/f'earth_benchmark/{name}_fields.npz')) for name in ['legacy','weak','medium','strong']}
    ai=audit_aridity(grid,reference,families);jungle=jungle_audit(grid);synth=read(OUT/'synthetic/results.json');conclusion=read(OUT/'gaia_ensemble/conclusion.json')
    extreme_summary={}
    for name,f in models.items():
        rows=old_extremes(grid,f,config()) if name=='legacy' else extremes(grid,f)
        write_csv(OUT/f'earth_benchmark/{name}_wettest_top20.csv',rows)
        extreme_summary[name]={'maximum_mm_year':rows[0]['precipitation'],'latitude':rows[0]['lat'],'longitude':rows[0]['lon'],'cells_above_11000':int(np.sum(f['annual_precipitation']>11000)),'cells_above_5000':int(np.sum(f['annual_precipitation']>5000))}
    write_json(OUT/'comparison/precipitation_extremes.json',{'same_geography_earth_comparison':extreme_summary,'gaia_v2_extreme':'Frozen old Gaia >11000 mm/year is not rerun or certified in V2.1. Earth improvement is not proof of Gaia extreme correction.'})
    legacy_gaia={}
    for mapping in mappings():
        with netcdf_file(ROOT/f'output/climate_v2/shortlist/{mapping.name}/fast_model.nc','r',mmap=False) as nc:
            f={k:v.data.copy() for k,v in nc.variables.items() if k not in ['lat','lon','lat_bounds','lon_bounds','cell_area','time','time_bounds','gaia_crs']}
        rows=old_extremes(grid,f,config());write_csv(OUT/f'comparison/legacy_gaia_{mapping.name}_wettest_top20.csv',rows)
        legacy_gaia[mapping.name]={'status':'Frozen old model audit only; not revised Gaia rerun','wettest':rows[0],'cells_above_11000':int(np.sum(f['annual_precipitation']>11000))}
    write_json(OUT/'comparison/legacy_gaia_extreme_audit.json',legacy_gaia)
    for key in ['wetness_index','soil_moisture_fraction','annual_runoff','depression_depth']:
        raster(OUT/f'hydrology/earth_strong_{key}.tif',grid,models['strong'][key],earth=True,unit='mm year-1' if key=='annual_runoff' else 'm' if key=='depression_depth' else '1')
    # Required filename is explicitly WGS84 Earth diagnostic while Gaia is gated.
    raster(OUT/'wetness_index.tif',grid,models['strong']['wetness_index'],earth=True)
    write_json(OUT/'hydrology/wetness_index_metadata.json',{'file':'output/climate_v21/wetness_index.tif','body':'Earth','CRS':'EPSG:4326','status':'Rejected strong-family Earth diagnostic; not a Gaia product','Gaia_wetness':'NOT RUN because no Earth-acceptable physics family'})
    bands=[]
    for center in [0,15,30,45,60,75]:
        for sign in ([1] if center==0 else [-1,1]):
            lat=center*sign;mask=(abs(grid.lat-lat)<3.75)[:,None]
            for name,f in [('reference',reference),*models.items()]:
                for key in ['annual_temperature','annual_precipitation','aridity_index','snow_fraction','temperature_seasonality']:bands.append(dict(dataset=name,band_center_deg=lat,half_width_deg=3.75,variable=key,global_band_mean=weighted_mean(f[key],grid.area*mask),land_band_mean=weighted_mean(f[key],grid.area*mask*reference['land_fraction'])))
    write_csv(OUT/'earth_benchmark/latitude_bands.csv',bands)
    audits={m.name:read(OUT/f'rasterization/{m.name}_audit.json') for m in mappings()}
    write_json(OUT/'rasterization/comparison.json',audits);plots(grid,reference,models)
    lines=['# Gaia V2.1 — Earth-calibrated physical climate research','',
      '**Decision: No physically robust V2 mapping yet.** No proposed physics family passed the complete predeclared Earth gate. The 180 Gaia scenario records are explicitly NOT RUN; their climate scores are blank, not zero. No climate Pareto winner or robust Balanced mapping can be established.','',
      'This stage is native Windows only. No WSL check/install, GCM run, system change, Web edit, latitude search, WM2/bathymetry work or original texture work was performed.','',
      '## 1. Earth benchmark and data','',
      'Seven public inputs total '+str(sum(p.stat().st_size for p in (OUT/'earth_benchmark/data').iterdir() if p.suffix in ['.nc','.zip']))+' bytes. Natural Earth land v4.1.0, NCEP/NCAR model-smoothed orography and temperature climatology, GPCP V2.3 precipitation are conservatively aggregated to 2.5 degrees. Temperature/precipitation period: 1991–2020; snow SWE: 1981–2010. Dataset URLs, versions, licenses, SHA-256 and resampling are in `output/climate_v21/earth_benchmark/data/provenance.json`.','',
      'Natural Earth polygon-to-grid land area relative error: '+f"{read(OUT/'earth_benchmark/reference_metadata.json')['mask_audit']['relative_error']:.3g}"+'. The compact public model orography is an equivalent coarse benchmark input, not a substitute for high resolution observed terrain. NCEP 2m air temperature is compared with a bulk model surface temperature proxy. The reference aridity and Köppen classes are derived products, not independent observations. Earth reference astronomical parameters are radius 6371008.8 m, obliquity 23.44°, rotation 24 h and orbital period 365.2422 days. The Level A circular-orbit approximation omits actual Earth eccentricity; CO2=400 ppm is a nominal model reference, not the exact 1991–2020 climatological concentration. Monthly model steps are equal duration, while observed rates use mean Gregorian month lengths. These approximations are not claimed as Gaia canon.','',
      '| Scheme | Global T °C | Land T °C | T zonal RMSE °C | Global P mm/year | Land P | P zonal RMSE | P pattern r | Snow land r | Aridity land r | Major Köppen agreement | Gate |',
      '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|']
    for name,result in [('legacy',metrics['legacy']),*metrics['families'].items()]:
        m=result['metrics'];t=m['annual_temperature'];p=m['annual_precipitation'];lines.append(f"| {name} | {t['model_global_mean']:.2f} | {t['model_land_mean']:.2f} | {t['zonal_rmse']:.2f} | {p['model_global_mean']:.1f} | {p['model_land_mean']:.1f} | {p['zonal_rmse']:.1f} | {p['pattern_correlation']:.3f} | {m['snow_fraction']['land_pattern_correlation']:.3f} | {m['aridity_index']['land_pattern_correlation']:.3f} | {m['koppen_major_land_agreement']:.3f} | FAIL |")
    lines+=['',f"Reference global T {metrics['legacy']['metrics']['annual_temperature']['reference_global_mean']:.2f} °C, global P {metrics['legacy']['metrics']['annual_precipitation']['reference_global_mean']:.1f} mm/year; land P {metrics['legacy']['metrics']['annual_precipitation']['reference_land_mean']:.1f}. Full global/land/zonal/gradient metrics: `earth_benchmark_metrics.json`, `earth_zonal_means.csv`. Both hemispheres at 0/15/30/45/60/75 degrees: `earth_benchmark/latitude_bands.csv`.",'',
      'Predeclared thresholds live in `config/climate/v21/earth_gate.json`; thresholds were not lowered after results. Soil periodicity was added as a further mandatory invariant when spinup failed. Earth thermal calibration fits mean outgoing-radiation intercept analytically, then selects B/D from 12 predefined pairs using Earth zonal temperature plus land seasonality errors. This is in-sample screening; no held-out validation is claimed.','',
      '## 2. Level A physics changes','',
      'The original monthly soil availability reset is replaced by a persistent 150 mm bucket, with implicit water-limited land evaporation, snow accumulation/melt and overflow runoff. Atmospheric advection remains conservative finite volume; isotropic eddy diffusion uses 0.5/1.06/2.0 million m²/s proposal families. Neither terrain labels nor Gaia temperatures enter calibration. PET now estimates surface absorbed shortwave minus longwave loss before applying Priestley–Taylor, rather than assigning net radiation as 50% of TOA insolation. Transmissivity .55 and relative humidity .7 remain explicit approximations. Actual land ET and ocean potential ET are separate; frozen land ET is zero.','',
      'Maximum atmospheric/soil balance residuals are recorded per family; strict soil drift tolerance is 0.05 mm/year. Weak and medium still fail soil periodicity after 60 years; strong converges after 12 years. Persistent snow can accumulate without glacier discharge. Bulk temperature has no latent-energy feedback, cloud dynamics, ocean currents or resolved monsoon circulation. Fixed circulation plus diffusion is not a GCM.','',
      'Physical references: [FAO56 radiation and Hargreaves](https://www.fao.org/4/x0490e/x0490e07.htm), [bucket schemes/observational comparison](https://climate.envsci.rutgers.edu/pdf/RobockMudJClim1995.pdf), [diffusive transport model](https://acp.copernicus.org/articles/18/2287/2018/). Formula reference alone does not validate our monthly proxy assumptions.','',
      '## 3. Polygon aggregation and conservation','',
      'The first-hit raster is replaced by own raw-coordinate polygon/grid clipping. Eight-point Gaussian quadrature integrates the nonlinear spherical latitude Jacobian on horizontal strips, split at latitude-function anchors. Affine triangle height moments provide land-conditional mean/std and min/max; climate grid mean height is land fraction × land-conditional height. Source lineage remains in immutable V1 vectors. Zero horizontal-area triangles are counted, not treated as climate area. Negative raw heights are retained in source and clipped only for the climate boundary.','',
      'Walkmesh projected overlap is real. Additive polygon areas conserve independently against additive cell contributions; physical fractions are locally normalized to land+ocean+unknown=1. These are distinct budgets. The report exposes physical-area difference instead of claiming exact single-cover area conservation. Net coverage is not a polygon-union proof. Synthetic latitude caps contribute ocean but no FF7 terrain lineage.','',
      '| Mapping | Additive relative error | Physical land-area delta | Land fraction old → new | Mean absolute cell land difference | Elevation mean absolute delta raw |',
      '|---|---:|---:|---|---:|---:|']
    for name,a in audits.items():
        l=a['legacy_comparison'];lines.append(f"| {name} | {a['maximum_additive_relative_error']:.3g} | {100*a['physical_land_relative_area_difference']:.3f}% | {100*l['legacy_land_fraction_global']:.3f}% → {100*l['areaweighted_land_fraction_global']:.3f}% | {l['land_fraction_mean_abs_difference']:.5f} | {l['elevation_area_mean_abs_difference_raw']:.3f} |")
    lines+=['','All terrain fractions and elevation moments are retained in each candidate NPZ. GeoTIFF height units are raw game units, not certified meters. Required `areaweighted_land_fraction.tif` and `areaweighted_elevation.tif` use the Gaia custom geographic CRS and V1 mapping, without changing V1 output.','',
      '## 4. Precipitation extreme audit','',
      '| Earth run | Maximum mm/year | Latitude | Longitude | Cells >11000 |','|---|---:|---:|---:|---:|']
    for name,e in extreme_summary.items():lines.append(f"| {name} | {e['maximum_mm_year']:.1f} | {e['latitude']:.2f} | {e['longitude']:.2f} | {e['cells_above_11000']} |")
    lines+=['','Each top20 CSV includes lon/lat, land fraction, elevation, u/v, P, PET, moisture convergence and orographic rain fraction. The revised Earth extrema are reduced, but a 2.5-degree mean exceeding several thousand mm/year remains an uncertain model concentration, not evidence of a local gauge extreme. The old Gaia 11170 mm/year extreme was not rerun: Earth results cannot certify its correction.','',
      '## 5. Jungle / Snow / Desert / Swamp','',
      'Revised Gaia statistics are **NOT RUN** because Earth physics failed. Old values remain untouched and must not be rebranded as V2.1. Desert soft evidence is P/PET; Jungle combines cold-month warmth, rain, dry-month count and absence of persistent snow; Swamp uses storage/lowland/depression/upstream wetness instead of local precipitation alone. Forest/Grass/Wasteland remain lower-confidence evidence. Bridge/Cliff/River labels do not enter climate scoring.','',
      f"Frozen legacy Jungle diagnosis: {jungle['triangle_count']} triangles; mean latitude {jungle['areaweighted_latitude_deg']:.2f}° (range {jungle['latitude_min']:.2f} to {jungle['latitude_max']:.2f}), raw mean height {jungle['raw_triangle_mean_height']:.1f}. Legacy T {jungle['legacy_annual_temperature_c']:.2f}°C = sea-level component {jungle['legacy_sealevel_temperature_component_c']:.2f} + lapse component {jungle['legacy_lapse_temperature_component_c']:.2f}. Polygon sampling delta {jungle.get('sampling_difference_c',float('nan')):.3f}°C. This exposes the scale/latitude issue without adjusting Gaia.",'',
      'The latitude term is represented by the sea-level background, not an isolated causal estimate. Continentality is reported with coast distance and seasonality; no exact annual-temperature attribution is made without a counterfactual. In the old model wind/moisture cannot directly alter temperature because latent feedback is absent. Lapse-only values across .5/.75/1/1.5/2 scales are algebraic diagnostics in `comparison/jungle_legacy_decomposition.json`, not ensemble reruns.','',
      '## 6–8. Vertical / physics / evidence sensitivity','',
      'The five vertical scales are nuisance assumptions, never a declaration that one raw unit is one meter. Three physics proposal families were Earth-tested; zero were accepted. Evidence schemes: default; equal-high Snow/Jungle/Desert weights doubled together; Swamp reduced from 1.5 to .25. The schemes preserve the equal high-confidence ordering. These axes define 45 planned scenarios per mapping. Their Gaia sensitivities remain UNKNOWN until three Earth-acceptable families exist.','',
      '## 9. Four-candidate ensemble','',
      'V1, 052, 056 and 017 are all represented in `candidate_ensemble.csv` (180 rows) and `candidate_robustness.csv`. All 180 statuses are `not_run_earth_gate_failed`, with blank climate consistency. They are a reproducible experiment schedule, not computed ensemble results. Distortion, stretch and curvature are derived from existing immutable mappings; no new latitude search occurred.','',
      '## 10–12. Pareto, Balanced and formal V2','',
      'The Pareto algorithm compares consistency median, worst scenario and latitude RMS, and never ranks missing scores. `pareto.csv` therefore records four unevaluable candidates, not a fictitious frontier. V1 retains the Geometric role as an existing geometry reference. Balanced and Climate-first roles are unassigned. No robust Balanced candidate has been demonstrated; there is insufficient evidence for a formal Climate V2.','',
      '## 13. Remaining uncertainty and next work','',
      '1. Raw P/PET reference is sensitive to near-zero cold-climate Hargreaves PET. Additional valid-domain and bounded-ratio diagnostics are reported without changing the gate. Establish an independent justified PET reference and prespecified valid domain, preferably meteorology-based Penman–Monteith, before revising benchmark rules.','2. Weak/medium soil periodicity is unresolved. Investigate slow dry-cell convergence and snow accumulation rather than relaxing tolerance.','3. Earth verification is in-sample, coarse and partly reanalysis-model based. A held-out spatial/domain assessment and independent aridity/snow evidence are needed.','4. Resolve overlapping walkmesh surface-selection semantics; additive quadrature conservation is excellent, but normalized physical terrain area differs.','5. Vertical scale, atmospheric cloud/latent coupling, ocean circulation, model winds and regional monsoon structure remain assumptions. Coarse wetness is not a swamp location predictor or river GIS.','6. After Earth gate and synthetic diagnostics pass, run the 180 scheduled Gaia evaluations and test all three sensitivities before assigning climate roles.','',
      '## Hydrology products and safety','',
      '`wetness_index.tif` is explicitly an **Earth EPSG:4326 diagnostic from the rejected strong family**, not Gaia. Its sidecar states this; Gaia wetness products are withheld. D4 priority flood routes runoff to ocean spill outlets with conserved volume. The basin diagnostic recognizes depression depth; it does not simulate a closed-lake water balance. Wetness weights are stated proxies, not calibrated Swamp coefficients.','',
      'Original source root: `D:\\SteamLibrary\\steamapps\\common\\FINAL FANTASY VII Steam Edition`. Only read/hash access is used. Spatial input is immutable `output/gis/gaia_geographic.gpkg`. No game assets copied. V1/V2/Web frozen files and all seven FF7 source fingerprints are checked with `scripts/climate_v21_safety.py check`. Final hash comparison is `output/climate_v21/safety-final.json`. **FF7 source modified: NO** is valid only after that check passes.','',
      'Tests: `output/climate_v21/tests.json` and `tests.log`; original regression fixture roots are redirected at runtime to V2.1 temp. The original test sources are unchanged. Existing GCM file-format regression assertions read frozen products only; no GCM/platform preflight script is executed.','',
      '![Earth reference / legacy / revised comparison](../../../output/climate_v21/comparison/earth_maps.png)','',
      '![Zonal diagnostics](../../../output/climate_v21/comparison/earth_zonal.png)','',
      '## Reproduction','',
      '```powershell','python -B scripts/climate_v21.py earth-data','python -B scripts/climate_v21.py earth','python -B scripts/climate_v21.py synthetic','python -B scripts/climate_v21.py rasters','python -B scripts/climate_v21.py ensemble','python -B scripts/climate_v21.py test','python -B scripts/climate_v21.py report','python -B scripts/climate_v21_safety.py check','```','',
      'Use the installed native QGIS Python runtime for NumPy/SciPy/GDAL/Shapely; the parser and model have no GUI dependency. `GAIAGIS_QGIS_ROOT` can select a compatible installed runtime. No runtime is installed by the launcher. Do not rerun `freeze`: the baseline is immutable. Raster cache signatures include source hash, code hash, grid and mapping; mismatches raise an explicit error. `rasters --rebuild` explicitly regenerates only V2.1 caches/products.']
    doc=ROOT/'docs/climate/v21/validation-report.md';doc.parent.mkdir(parents=True,exist_ok=True);doc.write_text('\n'.join(lines)+'\n',encoding='utf-8')
    verification=['','## Supplemental frozen Gaia precipitation audit','',
      'All four frozen Gaia runs are additionally audited read-only in `comparison/legacy_gaia_*_wettest_top20.csv` and `legacy_gaia_extreme_audit.json`. These expose old >11000 cells without using rejected revised physics or changing scores. A 2.5-degree cell represents a large area: a point rainfall record cannot justify an 11 m/year cell mean. Fixed wind convergence and rainout concentration remain plausible model causes; physical realism is NOT VERIFIED.','']
    if (OUT/'tests.json').exists():
        test=read(OUT/'tests.json');verification+=['## Final automated checks','',f"Tests: {test['tests']} run, {test['failures']} failures, {test['errors']} errors, {test['skipped']} skipped. Successful: {test['successful']}."]
    if (OUT/'safety-final.json').exists():
        safe=read(OUT/'safety-final.json');verification+=['',f"Frozen V1/V2/Web bytes: {safe['frozen_file_count']} checked; unchanged = {safe['v1_v2_unchanged']}. FF7 source modified: {safe['ff7_source_modified']}.",'','| Source file | Before bytes | After bytes | Before SHA-256 | After SHA-256 | Known reference match |','|---|---:|---:|---|---|---|']
        for before,after in zip(safe['before']['files'],safe['after']['files'],strict=True):verification.append(f"| {before['filename']} | {before['size']} | {after['size']} | `{before['sha256']}` | `{after['sha256']}` | {after['known_match']} |")
    with doc.open('a',encoding='utf-8') as stream:stream.write('\n'.join(verification)+'\n')
    (doc.parent/'README.md').write_text('# Gaia V2.1\n\n[Research and validation report](validation-report.md).\n\nStatus: Earth screening failed; no formal Climate V2. Three proposal physics families, polygon aggregation, hydrology, six synthetic experiments and a gated four-mapping ensemble schedule. V1/V2/Web remain frozen.\n',encoding='utf-8')
    write_json(OUT/'run-provenance.json',{'scope':'V2.1 Earth benchmark, new area aggregation, conditional ensemble','data_inputs':read(OUT/'earth_benchmark/data/provenance.json'),'candidate_source':'output/climate_v2/shortlist.json','candidate_source_sha256':digest(ROOT/'output/climate_v2/shortlist.json'),'spatial_source':'output/gis/gaia_geographic.gpkg','spatial_source_sha256':digest(ROOT/'output/gis/gaia_geographic.gpkg'),'grid_degrees':2.5,'accepted_family_count':len([f for f in families if f['accepted']]),'conclusion':conclusion})
    print('V21 report and plots written',flush=True)
