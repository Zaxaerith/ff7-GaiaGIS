# Local projection distortion

The frozen thirteen forward formulas are the sole projection definitions.
For 2D views, centered finite differences in longitude/latitude (step 1e-5
radians) form a local Jacobian in orthonormal east/north sphere coordinates.
The longitude derivative is divided by cos(latitude). The determinant is area
scale; singular values give maximum/minimum scale; column lengths give parallel
and meridional scale. Maximum angular deformation is
2 asin((max-min)/(max+min)), in degrees. These dimensionless scales compare the
projection plane to the reference sphere, not to FF7 physical accuracy.

Tissot ellipses use this Jacobian on a 30° sampling grid and an illustrative 2°
tangent-circle radius. Globe has no intrinsic planar Jacobian and hides this
layer. Pole, seam, hidden hemisphere and antipodal singular samples are omitted.
This is local differential analysis, not a quality percentage or global error
rating. Equal Earth/Mollweide/Sinusoidal/Gall–Peters/LAEA are area-preserving;
Mercator is conformal with increasing latitude-dependent area scale. Neither
property preserves every other cartographic quantity.

Primary reference for cartographic factor terminology:
[PROJ factors](https://proj.org/en/stable/development/reference/functions.html#c.proj_factors).
Analytic properties and independent numerical fixtures cross-check the evaluator.
No runtime PROJ/D3 dependency or second projection formula is introduced.

Tests cross-check area factors against independent D3 forward differences,
spherical areas against D3 geoArea, and analytic unit-area/Mercator secant/AEQD
center properties. The unchanged forward formulas are also covered by the
existing D3/PROJ projection fixtures. Exact poles, the ±180° derivative seam,
hidden Orthographic samples and singular antipodal neighborhoods are unavailable,
not zero distortion. Tissot samples above maximum scale 20 are omitted; each
ellipse has 32 segments. These numerical guards are deliberately conservative.
