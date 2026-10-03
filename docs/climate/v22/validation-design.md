# V2.2 validation design — declared before new reference correlations

Scope: native Windows. V1/V2/V2.1/Web are frozen. No WSL, GCM, new latitude search or Gaia climate ensemble before three acceptable Earth families exist.

## Calibration / validation separation

The three weak/medium/strong parameter families and Earth thermal fit are inherited unchanged from V2.1. No V2.2 calibration objective consumes aridity, snow, Köppen or regional results. The retained calibration measurements are global/zonal temperature and precipitation. No family is picked or retuned based on held-out outcomes.

Prospective holdout: the new FAO56 Penman–Monteith reference and its meteorological humidity, measured shortwave, pressure and wind-speed inputs have not been consumed by the model calibration. These files are assigned validation-only roles. Model PET is never a reference input. Temperature covariates share NCEP provenance with calibration; this is a **metric/input-role holdout**, not an independent-observation, spatial or temporal holdout. Full statistical independence is not claimed.

Snow and Köppen diagnostics were already visible in V2.1; they are retained supporting checks, not described as newly unseen datasets. New fixed regional regime tests are outcome holdouts; no same regional score enters calibration. If genuine independent-observation validation is still necessary, record it as a remaining limitation rather than relabel these data.

## PET and primary aridity metric

Use FAO56 Eq6 with independently sourced Earth temperature extremes, pressure, specific humidity, 10m mean wind speed and downwelling surface shortwave climatology. Saturation pressure uses Tmin/Tmax; humidity yields actual vapor pressure; measured shortwave and FAO longwave estimate define reference-grass net radiation. Convert 10m mean speed to 2m; do not take the magnitude of monthly mean wind components. Inputs are 1991–2020 monthly climatologies, conservatively resampled to 2.5°. Monthly mean application approximates the mean of a nonlinear daily formula. G=0 is explicit; reference crop ET0 is not ecosystem actual evaporation.

Rules fixed in `config/climate/v22/aridity_validation.toml`: reference-only valid-domain mask, annual ET0 >=100 mm, annual T >=0°C, warmest month >=10°C, at least three thawed months, snow fraction <=0.5 and land fraction >=0.5. Frozen months contribute zero liquid reference-crop ET0; unmasked PM results are preserved. These engineering thresholds define crop-aridity applicability, not universal FAO climate rules.

Primary: area-weighted correlation of raw P/PET on that valid land domain, threshold **0.35**, inherited from V2.1. Secondary P−PET, P/(P+PET) and unrestricted raw ratio cannot replace it. No post-result mask or threshold change. Model and reference ratios are evaluated over the identical reference-defined domain.

## Old / new gate

Retain the complete V2.1 gate result. New gate retains numeric T/P/snow/Köppen/large-scale-structure tolerances and adds the regional rule. Only aridity reference/domain are replaced on methodological grounds declared here. Soil tolerance stays 0.05 mm, years stay <=60. Diagnose soil and snow separately; positive persistent-ice accumulation is tagged nonequilibrium, never called soil instability and never hidden by a glacier model. Frozen inactive soil is still checked.

Eight bbox definitions/regime tests are in `regions.json`; at least seven must pass, and reference must support a test for it to count. The bboxes are fixed engineering approximations. Regional results are never used for calibration. Report every failure, not only a pass fraction.

## Soil investigation and targeted repair

Reproduce original weak/medium/strong equations with annual soil and SWE snapshots. Report maximum-drift cells with T, SWE, soil, runoff, P, PET, actual land ET, melt and saturation/frozen flags. Compare annual mass budgets and local contraction/time scale. Do not extend spinup or relax tolerance. Only after identifying a cause may a numerical periodic-state solver be considered; it must solve the same equations and preserve water budgets. No new parameter sweep.

## Extreme counterfactuals

Strong baseline versus one-at-a-time: no orographic condensation, no horizontal advection, no eddy diffusion, and no latitude modulation of rainout (uniform background 9 days). Completely zero rainout has no finite steady solution with nonzero evaporation, so it is not used. All changes are diagnostics, excluded from Earth family acceptance and Gaia scoring. Compare baseline extreme location and global maximum separately. Counterfactual differences are non-additive because feedbacks interact.

## Walkmesh semantics before policy

Detect positive-area XY overlap on original WM0 base triangles, retaining section/mesh/triangle/terrain/region/script/height lineage. Separate exact 3D duplicate, coincident footprint with height separation, bridge/tunnel/cliff-like, possible gameplay alternatives and unknown. Semantic tags are evidence-based hypotheses, not authoritative engine behavior. Alternatives 63–68 are not mixed into base geometry.

After the empirical inventory, compare exposed-highest, exposed-lowest and natural-terrain-priority hypotheses using clipped overlap fragments; no source triangle is edited. Retained/excluded climate area and lineage are recorded. Compare land fraction, height and terrain fractions, including local maximum differences. Additive conservation alone cannot settle physical surface semantics.

## Execution gate and stop

Only if three families pass may the existing four mappings and 180 scenarios run. Otherwise write `not_run_earth_gate_failed`, do not rank missing scores, report unresolved blockers and stop without automatic model expansion.

References: [FAO56 reference equation](https://www.fao.org/4/x0490e/x0490e06.htm), [FAO56 meteorological variables and conversions](https://www.fao.org/4/x0490e/x0490e07.htm), [NOAA PSL NCEP derived climatologies](https://psl.noaa.gov/thredds/catalog/Datasets/ncep.reanalysis.derived/surface_gauss/catalog.html).
