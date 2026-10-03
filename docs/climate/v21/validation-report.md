# Gaia V2.1 — Earth-calibrated physical climate research

**Decision: No physically robust V2 mapping yet.** No proposed physics family passed the complete predeclared Earth gate. The 180 Gaia scenario records are explicitly NOT RUN; their climate scores are blank, not zero. No climate Pareto winner or robust Balanced mapping can be established.

This stage is native Windows only. No WSL check/install, GCM run, system change, Web edit, latitude search, WM2/bathymetry work or original texture work was performed.

## 1. Earth benchmark and data

Seven public inputs total 4331626 bytes. Natural Earth land v4.1.0, NCEP/NCAR model-smoothed orography and temperature climatology, GPCP V2.3 precipitation are conservatively aggregated to 2.5 degrees. Temperature/precipitation period: 1991–2020; snow SWE: 1981–2010. Dataset URLs, versions, licenses, SHA-256 and resampling are in `output/climate_v21/earth_benchmark/data/provenance.json`.

Natural Earth polygon-to-grid land area relative error: 1.06e-15. The compact public model orography is an equivalent coarse benchmark input, not a substitute for high resolution observed terrain. NCEP 2m air temperature is compared with a bulk model surface temperature proxy. The reference aridity and Köppen classes are derived products, not independent observations. Earth reference astronomical parameters are radius 6371008.8 m, obliquity 23.44°, rotation 24 h and orbital period 365.2422 days. The Level A circular-orbit approximation omits actual Earth eccentricity; CO2=400 ppm is a nominal model reference, not the exact 1991–2020 climatological concentration. Monthly model steps are equal duration, while observed rates use mean Gregorian month lengths. These approximations are not claimed as Gaia canon.

| Scheme | Global T °C | Land T °C | T zonal RMSE °C | Global P mm/year | Land P | P zonal RMSE | P pattern r | Snow land r | Aridity land r | Major Köppen agreement | Gate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| legacy | 11.69 | 5.87 | 4.78 | 1376.3 | 850.2 | 792.4 | 0.489 | 0.895 | -0.087 | 0.583 | FAIL |
| weak | 14.20 | 7.78 | 2.62 | 982.2 | 739.9 | 474.5 | 0.508 | 0.898 | -0.035 | 0.685 | FAIL |
| medium | 14.20 | 7.78 | 2.62 | 994.2 | 789.1 | 457.8 | 0.504 | 0.913 | 0.059 | 0.703 | FAIL |
| strong | 14.20 | 7.78 | 2.62 | 1006.7 | 845.8 | 434.6 | 0.494 | 0.917 | 0.152 | 0.710 | FAIL |

Reference global T 14.21 °C, global P 983.1 mm/year; land P 797.1. Full global/land/zonal/gradient metrics: `earth_benchmark_metrics.json`, `earth_zonal_means.csv`. Both hemispheres at 0/15/30/45/60/75 degrees: `earth_benchmark/latitude_bands.csv`.

Predeclared thresholds live in `config/climate/v21/earth_gate.json`; thresholds were not lowered after results. Soil periodicity was added as a further mandatory invariant when spinup failed. Earth thermal calibration fits mean outgoing-radiation intercept analytically, then selects B/D from 12 predefined pairs using Earth zonal temperature plus land seasonality errors. This is in-sample screening; no held-out validation is claimed.

## 2. Level A physics changes

The original monthly soil availability reset is replaced by a persistent 150 mm bucket, with implicit water-limited land evaporation, snow accumulation/melt and overflow runoff. Atmospheric advection remains conservative finite volume; isotropic eddy diffusion uses 0.5/1.06/2.0 million m²/s proposal families. Neither terrain labels nor Gaia temperatures enter calibration. PET now estimates surface absorbed shortwave minus longwave loss before applying Priestley–Taylor, rather than assigning net radiation as 50% of TOA insolation. Transmissivity .55 and relative humidity .7 remain explicit approximations. Actual land ET and ocean potential ET are separate; frozen land ET is zero.

Maximum atmospheric/soil balance residuals are recorded per family; strict soil drift tolerance is 0.05 mm/year. Weak and medium still fail soil periodicity after 60 years; strong converges after 12 years. Persistent snow can accumulate without glacier discharge. Bulk temperature has no latent-energy feedback, cloud dynamics, ocean currents or resolved monsoon circulation. Fixed circulation plus diffusion is not a GCM.

Physical references: [FAO56 radiation and Hargreaves](https://www.fao.org/4/x0490e/x0490e07.htm), [bucket schemes/observational comparison](https://climate.envsci.rutgers.edu/pdf/RobockMudJClim1995.pdf), [diffusive transport model](https://acp.copernicus.org/articles/18/2287/2018/). Formula reference alone does not validate our monthly proxy assumptions.

## 3. Polygon aggregation and conservation

The first-hit raster is replaced by own raw-coordinate polygon/grid clipping. Eight-point Gaussian quadrature integrates the nonlinear spherical latitude Jacobian on horizontal strips, split at latitude-function anchors. Affine triangle height moments provide land-conditional mean/std and min/max; climate grid mean height is land fraction × land-conditional height. Source lineage remains in immutable V1 vectors. Zero horizontal-area triangles are counted, not treated as climate area. Negative raw heights are retained in source and clipped only for the climate boundary.

Walkmesh projected overlap is real. Additive polygon areas conserve independently against additive cell contributions; physical fractions are locally normalized to land+ocean+unknown=1. These are distinct budgets. The report exposes physical-area difference instead of claiming exact single-cover area conservation. Net coverage is not a polygon-union proof. Synthetic latitude caps contribute ocean but no FF7 terrain lineage.

| Mapping | Additive relative error | Physical land-area delta | Land fraction old → new | Mean absolute cell land difference | Elevation mean absolute delta raw |
|---|---:|---:|---|---:|---:|
| v1_baseline | 1.86e-13 | -0.341% | 31.791% → 31.827% | 0.00217 | 1.996 |
| candidate_052 | 1.55e-14 | -0.331% | 31.151% → 31.186% | 0.00225 | 1.974 |
| candidate_056 | 1.23e-13 | -0.364% | 36.662% → 36.694% | 0.00234 | 2.391 |
| candidate_017 | 1.11e-13 | -0.334% | 32.474% → 32.504% | 0.00210 | 1.932 |

All terrain fractions and elevation moments are retained in each candidate NPZ. GeoTIFF height units are raw game units, not certified meters. Required `areaweighted_land_fraction.tif` and `areaweighted_elevation.tif` use the Gaia custom geographic CRS and V1 mapping, without changing V1 output.

## 4. Precipitation extreme audit

| Earth run | Maximum mm/year | Latitude | Longitude | Cells >11000 |
|---|---:|---:|---:|---:|
| legacy | 9521.2 | -6.25 | 38.75 | 0 |
| weak | 6138.9 | -6.25 | 38.75 | 0 |
| medium | 5841.7 | -1.25 | 38.75 | 0 |
| strong | 5857.9 | -1.25 | 38.75 | 0 |

Each top20 CSV includes lon/lat, land fraction, elevation, u/v, P, PET, moisture convergence and orographic rain fraction. The revised Earth extrema are reduced, but a 2.5-degree mean exceeding several thousand mm/year remains an uncertain model concentration, not evidence of a local gauge extreme. The old Gaia 11170 mm/year extreme was not rerun: Earth results cannot certify its correction.

## 5. Jungle / Snow / Desert / Swamp

Revised Gaia statistics are **NOT RUN** because Earth physics failed. Old values remain untouched and must not be rebranded as V2.1. Desert soft evidence is P/PET; Jungle combines cold-month warmth, rain, dry-month count and absence of persistent snow; Swamp uses storage/lowland/depression/upstream wetness instead of local precipitation alone. Forest/Grass/Wasteland remain lower-confidence evidence. Bridge/Cliff/River labels do not enter climate scoring.

Frozen legacy Jungle diagnosis: 1300 triangles; mean latitude -63.42° (range -72.88 to -53.22), raw mean height 1127.3. Legacy T -9.30°C = sea-level component -2.52 + lapse component -6.78. Polygon sampling delta -0.028°C. This exposes the scale/latitude issue without adjusting Gaia.

The latitude term is represented by the sea-level background, not an isolated causal estimate. Continentality is reported with coast distance and seasonality; no exact annual-temperature attribution is made without a counterfactual. In the old model wind/moisture cannot directly alter temperature because latent feedback is absent. Lapse-only values across .5/.75/1/1.5/2 scales are algebraic diagnostics in `comparison/jungle_legacy_decomposition.json`, not ensemble reruns.

## 6–8. Vertical / physics / evidence sensitivity

The five vertical scales are nuisance assumptions, never a declaration that one raw unit is one meter. Three physics proposal families were Earth-tested; zero were accepted. Evidence schemes: default; equal-high Snow/Jungle/Desert weights doubled together; Swamp reduced from 1.5 to .25. The schemes preserve the equal high-confidence ordering. These axes define 45 planned scenarios per mapping. Their Gaia sensitivities remain UNKNOWN until three Earth-acceptable families exist.

## 9. Four-candidate ensemble

V1, 052, 056 and 017 are all represented in `candidate_ensemble.csv` (180 rows) and `candidate_robustness.csv`. All 180 statuses are `not_run_earth_gate_failed`, with blank climate consistency. They are a reproducible experiment schedule, not computed ensemble results. Distortion, stretch and curvature are derived from existing immutable mappings; no new latitude search occurred.

## 10–12. Pareto, Balanced and formal V2

The Pareto algorithm compares consistency median, worst scenario and latitude RMS, and never ranks missing scores. `pareto.csv` therefore records four unevaluable candidates, not a fictitious frontier. V1 retains the Geometric role as an existing geometry reference. Balanced and Climate-first roles are unassigned. No robust Balanced candidate has been demonstrated; there is insufficient evidence for a formal Climate V2.

## 13. Remaining uncertainty and next work

1. Raw P/PET reference is sensitive to near-zero cold-climate Hargreaves PET. Additional valid-domain and bounded-ratio diagnostics are reported without changing the gate. Establish an independent justified PET reference and prespecified valid domain, preferably meteorology-based Penman–Monteith, before revising benchmark rules.
2. Weak/medium soil periodicity is unresolved. Investigate slow dry-cell convergence and snow accumulation rather than relaxing tolerance.
3. Earth verification is in-sample, coarse and partly reanalysis-model based. A held-out spatial/domain assessment and independent aridity/snow evidence are needed.
4. Resolve overlapping walkmesh surface-selection semantics; additive quadrature conservation is excellent, but normalized physical terrain area differs.
5. Vertical scale, atmospheric cloud/latent coupling, ocean circulation, model winds and regional monsoon structure remain assumptions. Coarse wetness is not a swamp location predictor or river GIS.
6. After Earth gate and synthetic diagnostics pass, run the 180 scheduled Gaia evaluations and test all three sensitivities before assigning climate roles.

## Hydrology products and safety

`wetness_index.tif` is explicitly an **Earth EPSG:4326 diagnostic from the rejected strong family**, not Gaia. Its sidecar states this; Gaia wetness products are withheld. D4 priority flood routes runoff to ocean spill outlets with conserved volume. The basin diagnostic recognizes depression depth; it does not simulate a closed-lake water balance. Wetness weights are stated proxies, not calibrated Swamp coefficients.

Original source root: `D:\SteamLibrary\steamapps\common\FINAL FANTASY VII Steam Edition`. Only read/hash access is used. Spatial input is immutable `output/gis/gaia_geographic.gpkg`. No game assets copied. V1/V2/Web frozen files and all seven FF7 source fingerprints are checked with `scripts/climate_v21_safety.py check`. Final hash comparison is `output/climate_v21/safety-final.json`. **FF7 source modified: NO** is valid only after that check passes.

Tests: `output/climate_v21/tests.json` and `tests.log`; original regression fixture roots are redirected at runtime to V2.1 temp. The original test sources are unchanged. Existing GCM file-format regression assertions read frozen products only; no GCM/platform preflight script is executed.

![Earth reference / legacy / revised comparison](../../../output/climate_v21/comparison/earth_maps.png)

![Zonal diagnostics](../../../output/climate_v21/comparison/earth_zonal.png)

## Reproduction

```powershell
python -B scripts/climate_v21.py earth-data
python -B scripts/climate_v21.py earth
python -B scripts/climate_v21.py synthetic
python -B scripts/climate_v21.py rasters
python -B scripts/climate_v21.py ensemble
python -B scripts/climate_v21.py test
python -B scripts/climate_v21.py report
python -B scripts/climate_v21_safety.py check
```

Use the installed native QGIS Python runtime for NumPy/SciPy/GDAL/Shapely; the parser and model have no GUI dependency. `GAIAGIS_QGIS_ROOT` can select a compatible installed runtime. No runtime is installed by the launcher. Do not rerun `freeze`: the baseline is immutable. Raster cache signatures include source hash, code hash, grid and mapping; mismatches raise an explicit error. `rasters --rebuild` explicitly regenerates only V2.1 caches/products.

## Supplemental frozen Gaia precipitation audit

All four frozen Gaia runs are additionally audited read-only in `comparison/legacy_gaia_*_wettest_top20.csv` and `legacy_gaia_extreme_audit.json`. These expose old >11000 cells without using rejected revised physics or changing scores. A 2.5-degree cell represents a large area: a point rainfall record cannot justify an 11 m/year cell mean. Fixed wind convergence and rainout concentration remain plausible model causes; physical realism is NOT VERIFIED.

## Final automated checks

Tests: 116 run, 0 failures, 0 errors, 0 skipped. Successful: True.

Frozen V1/V2/Web bytes: 393 checked; unchanged = True. FF7 source modified: NO.

| Source file | Before bytes | After bytes | Before SHA-256 | After SHA-256 | Known reference match |
|---|---:|---:|---|---|---|
| wm0.map | 3250176 | 3250176 | `43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C` | `43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C` | True |
| wm2.map | 565248 | 565248 | `404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02` | `404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02` | True |
| wm3.map | 188416 | 188416 | `70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3` | `70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3` | True |
| world_us.lgp | 3114259 | 3114259 | `975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C` | `975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C` | True |
| wm0.bot | 15638528 | 15638528 | `8C4312419869A3ED862F56A53713123ABED4938962E986460E300786D51A719E` | `8C4312419869A3ED862F56A53713123ABED4938962E986460E300786D51A719E` | None |
| wm2.bot | 2260992 | 2260992 | `D1F90526594F0F70089AE2D71E9A1643C4434414A04FA13CF3B9BEAB2EE43720` | `D1F90526594F0F70089AE2D71E9A1643C4434414A04FA13CF3B9BEAB2EE43720` | None |
| wm3.bot | 753664 | 753664 | `B98E10B46D4E8427DEAE3514A4A448C28971E99F584011E7102E61B94F1FC3FF` | `B98E10B46D4E8427DEAE3514A4A448C28971E99F584011E7102E61B94F1FC3FF` | None |
