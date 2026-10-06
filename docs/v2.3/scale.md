# Local horizontal scale and layer presentation

The scale bar estimates distance represented by a short horizontal screen segment
near the current viewport center. It is local, not a constant for a projection.
Planar projections cast the screen samples onto the display plane and use existing
`inverseDisplay` plus existing reference-sphere `measureDistance`. Mercator therefore
changes with latitude; Equal Earth and other projections use their actual inverse
finite differences. Existing projection formulas and V1 radius are unchanged.

Globe samples intersect the assumed reference sphere through the current camera.
The existing geographic conversion and great-circle distance measure the two hits.
No intersection, unresolved inverse, singular/unstable distance, projection morph,
Explorer or native map hides the bar. Relief is not interpreted as horizontal terrain
distance. The tooltip identifies the V1 reference-sphere assumption. Scale visibility
is a central navigation preference, adjustable in View.

Eight registered opacity controls cover Terrain tint, Encounters, Traversal,
Reachability, Events, Atlas, Distortion/Tissot and Routes. Values persist together in
user state, and Reset layers restores default visibility and opacity. Controls require
the appropriate loaded WM0 data and are unavailable in public/native/Explorer states
that lack it. Opacity changes render presentation only. Base terrain/texture surfaces
remain opaque; selected marker/Inspector/critical selection styling stays readable.

The existing terrain legend (also reused for encounters/traversal) and Chocobo Tracks
legend move into Layers → Map legend, with an Atlas representative-point note.
Existing analysis metrics/keys remain beside their analysis tools. Projection Compare
uses shared surface colors and synchronizes applicable event/route/Tissot opacity.
Original textures, UVs, relief and source geometry are unchanged.

Pure tests check Mercator equator/high latitude, ten other planar projection inverses,
and Globe hit/miss behavior. Browser acceptance exercises Mercator, Equal Earth,
Globe, native hiding, layer preferences and Projection Compare.
