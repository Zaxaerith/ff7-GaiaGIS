# Explorer locomotion

The previous controller chose source clip 1 for every moving party member. This
correctly selected world-leader locomotion, but selected the slower field walk for
the six Extended characters. Models, skeletons and pack bindings remain unchanged.

## Semantic evidence

Actual read-only `char.lgp`/`flevel.lgp` section-3 records bind each HRC to its own
ordered clips; internal model names identify the corresponding party member.
The [field-loader layout](https://wiki.ffrtt.ru/index.php/FF7/Field/Model_Loader)
describes those records. Order alone was not accepted as proof.

The [Q-Gears animation metadata](https://github.com/q-gears/q-gears/blob/master/output/field_models_and_animation_metadata.xml)
directly names Barret adcc/adcd and Red XIII aeaf/aeba as Walk/Run.
The [Fenrir playable-field movement reference](https://github.com/dangarfield/ff7-fenrir/blob/master/app/field/field-movement-player.js)
uses animation 0 for standing, 1 for walking and 2 for running. This is independently
observed reference behavior, not code imported into GaiaGIS or proof of Steam 2026
timing. Actual source binding, matching skeleton, root motion and posed leg/body
cycles cross-check the other four characters. Private posed frames confirm stronger
fast leg/arm cycles and body lean/bounce; Red XIII retains its quadruped cycle and
Cait Sith the original Moogle/cat skeleton. Frame counts support cadence measurement
after classification; they do not determine semantic identity.

## Final inventory

| Character | HRC | Idle (frames) | Old moving / walk (frames) | Final moving / run (frames) | Preview rate | Evidence |
|---|---|---|---|---|---:|---|
| Cloud | bbe.hrc | bid (1) | bie (15) | bie (15) | 1 | Existing world loader |
| Barret | acgd.hrc | adcb (1) | adcc (30) | adcd (15) | 1 | blackbg1; named Q-Gears run; own posed cycle |
| Tifa | dlb.hrc | dse (1) | dta (15) | dta (15) | 1 | Existing world loader |
| Aerith | auff.hrc | avbf (2) | avca (20) | avcb (15) | 1 | blackbg1; playable-field convention and own posed cycle |
| Red XIII | adda.hrc | aeae (1) | aeaf (20) | aeba (15) | 1 | blackbg1; named Q-Gears run; own quadruped cycle |
| Yuffie | abjb.hrc | acfb (2) | acfc (25) | acfd (14) | 14/15 | blackbg4; playable-field convention and own posed cycle |
| Cait Sith | aebc.hrc | aeha (2) | aehb (30) | aehc (15) | 1 | blackbg5; playable-field convention and own hopping cycle |
| Vincent | aehd.hrc | afdf (2) | afea (30) | afeb (15) | 1 | blackbgi; playable-field convention and own posed cycle |

All resource names use the original `.a` files. World leaders do not gain a newly
invented walk binding. Extended bones are respectively 21/23/29/24/28/25; the old
bound source files remain in the existing private pack. A whitelist checks HRC,
bone count and exact clip names before selecting fast locomotion. Unknown/legacy
bindings keep their existing motion behavior, without a humanoid fallback.

## Preview and displacement

Nominal fast loop cadence is two cycles per second at 30 fps; Yuffie's 14-frame
clip uses rate 14/15. Shift doubles the preview cadence along with the existing
preview speed. Reverse input reverses frame playback rather than applying a
forward-running clip over backward displacement. This is **Explorer preview
timing**, never verified original Steam runtime timing.

Appearance never enters the walker speed or traversal rules. All nine party members
use the same Foot profile and the existing 900 raw horizontal units/second normal
preview speed. Fixed source triangle, camera, input and elapsed time are measured
in private QA. Changes do not upgrade story/runtime availability or coordinates.

Some fast poses penetrate the old idle-derived display floor. Extended fast clips
cache a per-frame display-origin correction from posed bounds, clamping only
negative ground penetration. Raw animation/bones/root values remain intact; source
airborne phases remain above the floor. This is a presentation correction, not a
procedural gait. Existing world leader ground treatment remains unchanged.

No frame blending, IK, cross-character retarget, invented animation or physical
foot-lock simulation is claimed. Residual foot sliding on uneven source surfaces
and the original discrete frame cadence remain preview limitations. Cait Sith's
strong original hop is retained rather than made into a humanoid gait.

Private evidence: source-bindings.json, locomotion/poses.json, before/final pose
logs, nine-source-run.png, individual run screenshots and browser video under
output/v2_5/. No model/animation/screenshot payload is tracked or distributed.

## Explorer movement and interpretation (v1.9)

Three different claims must remain separate: **source geometry movement**,
**static terrain compatibility**, and **original runtime behavior**. Explorer
implements the first two within the limits below; runtimeClaim always stays
false. It does not load saves, execute EV scripts, own/board vehicles, simulate
story conditions, battles, fields, NPCs or original physics.

### Authoritative state

State records mapId, movement profile, actual visual model ID, source triangle,
barycentric position, native X/Z, raw interpolated height, heading, speed/movement
state, clip index, airborne state and relative preview altitude. Air travel can
have a null underlying triangle/height where the surface is unresolved; it does
not claim a ground anchor. MAP binary raw Y is the signed raw height; native Z is
not model-local bone Z. Display axes and exaggeration never determine movement. Ground display position uses the same barycentric weights on projected source corners, so the model rests on the rendered triangular facet rather than hovering above its spherical chord; this does not alter authoritative X/Z or raw height.

### Surface walker

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

### Air and native previews

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

### Controls and camera

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

## Map transitions

The analyzer reuses the shared EV decoder and bounded world-event analysis.
Constant propagation, branch reachability, scheduled calls, return, widening,
cycle/state/instruction/depth guards remain bounded. No story or save state is
executed. Map-specific placement bounds are explicit; engine chunk headers
retain the classic 36-column addressing convention. Native positions use the
documented map-specific offset and exact source MAP trigger components.

| From | To | Source/destination anchor | Transform | Evidence / conditions |
|---|---|---|---|---|
| WM0 | WM2 | Both runtime-dependent | Reference native-engine offset | Classic model 13, terrain 3 and button edge; dispatcher/save restoration |
| WM2 | WM0 | Both runtime-dependent | Reference native-engine offset | Same controls; additional EXIT_UNDERWATER opcode path retained |
| FIELD | WM3 | Both unresolved | Link only | Dispatcher snowfield world-entry range ≥0x3c; no source field spatial anchor inferred |
| WM3 | FIELD | 25 anchored trigger-component records | Link only | Constant ENTER_FIELD destinations; runtime branch conditions retained |
| WM2 | FIELD | 2 anchored, 5 unanchored records | Link only | Field ID/table evidence; dynamic positions remain unresolved |

The full local inventory also retains WM0 field exits. A world-to-field exit is
not automatically a field-to-world re-entry or a paired global transform.
Native field exit destinations include internal maplist identity; names do not
drive coordinate inference. No nearest triangle or visually guessed pair is
created. The 25 WM3 records lead to `move_s`, `gaiafoot` and `hyou12` identities.
They are not 25 unique locations or proof of an Overworld-to-Glacier affine map.

The two explicit surface/undersea reference links and one actual WM2 opcode
site have no fixed source point; they appear in the evidence list, never as
invented markers. `Open linked map` changes the Viewer map. A resolved target
point would focus the native camera; unknown points remain null. `Return to
Overworld` is Viewer navigation, not a simulation of gameplay exit conditions.
Markers are only created for spatially anchored native records. There is no
reliable direct WM0-to-WM3 marker in this release.

Each record retains map identities, anchor kinds, native position or null,
lineage, call/function/word offset, opcode, raw arguments, field identity,
condition categories, evidence and runtime availability `not_simulated`.
The JSON is local-generated and ignored; only the analyzer/schema/tests/docs
are distributed. Current Steam2026 runtime equivalence remains NOT VERIFIED.
