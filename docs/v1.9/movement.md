# Explorer movement and interpretation (v1.9)

Three different claims must remain separate: **source geometry movement**,
**static terrain compatibility**, and **original runtime behavior**. Explorer
implements the first two within the limits below; runtimeClaim always stays
false. It does not load saves, execute EV scripts, own/board vehicles, simulate
story conditions, battles, fields, NPCs or original physics.

## Authoritative state

State records mapId, movement profile, actual visual model ID, source triangle,
barycentric position, native X/Z, raw interpolated height, heading, speed/movement
state, clip index, airborne state and relative preview altitude. Air travel can
have a null underlying triangle/height where the surface is unresolved; it does
not claim a ground anchor. MAP binary raw Y is the signed raw height; native Z is
not model-local bone Z. Display axes and exaggeration never determine movement. Ground display position uses the same barycentric weights on projected source corners, so the model rests on the rendered triangular facet rather than hovering above its spherical chord; this does not alter authoritative X/Z or raw height.

## Surface walker

Advance in native X/Z, convert the desired point to barycentric weights, and find
the first crossed edge. Only the exact stored opposite-corner neighbor may be
entered, after its static occupancy gate passes. Re-express barycentrics on the
neighbor and repeat with a 128-crossing guard. Height always interpolates original
source corner heights. Multiple-edge/vertex ambiguity, degenerate faces,
non-manifold edges, duplicate faces, unresolved adjacency and boundaries stop
crossing. There is no nearest-face snap, topology repair or teleport.

WM0 identifies exact endpoint XYZ across E/W X modulo 294912. N/S remains cut at
0/229376 and synthetic caps are never placement/movement candidates. WM2 and WM3
use native coordinates and bounded edges; geometric WM3 periodicity does not
establish gameplay wrap. Conservative blocked edges can disconnect passages the
original game would permit. This is a diagnostic limitation, not a source repair.

Foot, Buggy, Tiny Bronco and five Chocobo variants reuse the unchanged v1.3
occupancy evaluator. Only Allowed is entered; Conditional/Blocked/Unknown is
excluded. Bridge history, special script overrides, edge/cliff physics and story
state are not reconstructed. A profile change is accepted only at a compatible
source face; refusal keeps the exact position. Visual Chocobo tint does not
alter the movement mask or Chocobo Tracks encounter flag.

## Air and native previews

Highwind is airborne navigation, not surface traversal. X wraps E/W; Z is clamped
at the canonical cut. Air travel ignores occupancy masks. Land requires a unique
point-in-triangle source surface and unchanged Highwind Landing Allowed result;
ambiguous overlap, missing anchor and conditional eligibility cannot become a
guaranteed landing. Landed Highwind does not drive along the ground. Takeoff
returns to relative preview altitude. Altitude is a display/source-relative
navigation value, not official meters above Gaia sea level.

WM2 Submarine uses the native geometry walker plus bounded nonnegative relative
altitude. Q/E moves that relative preview altitude; it cannot become negative
through the supporting floor. This is a visual floor guard, not full 3D hull,
wall or original submarine collision. WM3 party exploration similarly follows
bounded native geometry without applying the WM0 Foot mask. Their original
movement/collision, gravity, camera and runtime rules are NOT VERIFIED.

Existing map transitions are reused. The 104 v1.8 records have no verified
native destination placement. Switching map stops Explorer and states that the
runtime destination is unresolved; manual source placement is required. No
radial dive, fake geographic WM2 transform or nearest-triangle arrival is added.

## Controls and camera

W/S or up/down: forward/back. A/D or left/right: heading. Shift: twice preview
speed. Drag: orbit around the model; wheel: follow distance. Q/E: preview altitude
for Highwind/Submarine. Touch buttons use press/release/pointer-cancel capture;
one-finger canvas drag controls the camera. Keyboard movement ignores focused
inputs/selects/textareas. Blur clears pressed keys. Escape/Return to GIS stops.

The third-person frame uses radial up/east/north on WM0 and native Y-up on
WM2/WM3. Camera smoothing respects prefers-reduced-motion. Preview speeds are
900/1500/1800/3500 raw units per second for ordinary/Buggy/Bronco/air navigation;
they are tool choices, not measured FF7 runtime speed. Model scale follows the
classic loader registry and local display parameterization, not human meters.
The camera has no full terrain collision or pixel-perfect original preset.

Explorer temporarily uses WM0 Globe/native 3D, locks conflicting projection
controls, and saves/restores GIS camera/target/zoom/up/projection/native view.
Only the current model is instantiated. Exit/change/map switch releases model
geometry/materials/textures; the bounded encoded pack remains cached on CPU.
Other overlays, searches and GIS datasets remain independent and unchanged.
