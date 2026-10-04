# Adaptive graticule design

Auto estimates spacing by projecting visible geographic samples through the
active forward formula and camera into CSS pixels, including Globe perspective.
It selects a discrete interval near 120 px, targeting roughly 80–160 px. The
current interval is retained inside a wider 60–190 px hysteresis band. This is a
local estimate; strongly anisotropic projections cannot satisfy both axes
everywhere with a single angular interval.

Candidates: 90, 60, 45, 30, 20, 15, 10, 5, 2, 1, 0.5, 0.25, 0.1 degrees.
Fixed selector: 90, 45, 30, 15, 10, 5, 2, 1, 0.5; plus Auto and Off.
Optional minor lines appear only for clean subdivisions with estimated
28–60 px spacing. They are dimmer and have no labels. Equator and zero meridian
remain visually distinct; zero meridian is a game-coordinate reconstruction
reference, not an assertion of official Gaia geography.

Generation covers a conservative visible geographic window, splits longitude
seams, masks projection boundaries and increases curve sampling step for dense
manual grids to bound work. Updates are throttled and require meaningful camera,
zoom, viewport or interval changes; no unconditional per-frame rebuild occurs.
Labels use Intl numbers and major intervals with screen-space collision checks.

The same screen-policy evaluator is used independently in both comparison
viewports. It samples east/west and north/south near the visible center, averaging
available screen spans. Near a seam or clipped hemisphere, unavailable samples
are omitted. A normalized zoom change of about 2.5%, center movement of about
0.5°, resize or policy change invalidates the estimate. Regeneration is throttled
to 180 ms and still requires a changed snapped grid window or interval.
Dense manual grids coarsen curved-line sampling rather than silently changing
the requested degree interval. Auto cannot promise equal spacing everywhere on
an anisotropic projection. Labels are capped at eleven collision-tested major
coordinates; minor lines have no labels.
