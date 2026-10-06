# Explorer locomotion — v2.5

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
