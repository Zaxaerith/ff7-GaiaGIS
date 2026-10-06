# Nearby and What's Here

Nearby resolves existing navigation owners; it does not geocode authored prose.
Only validated WM0 Location/Atlas place/Transition anchors with exact-source,
verified-anchor or entrance-level authority enter the index. Duplicate Atlas and
Location representatives at the same point are shown once per group. Entrances
remain bookmarkable but are not repeated as Nearby places.

Parent-place, field-only and unresolved rewards are excluded. Their parent place
may independently appear as an eligible place; no reward is assigned that parent's
distance or a fake exact point. Spoiler-hidden entities are removed by the existing
Atlas registry before indexing. No new locations, bindings or precision upgrades
are authored in this version.

The small index precomputes unit vectors and performs a linear scan. Great-circle
distance is `R * atan2(norm(cross(a,b)), clamp(dot(a,b),-1,1))`, with existing V1
reference radius 6,371,008.8 m. This is horizontal reference-sphere distance, not
surface terrain length, route length or a measurement of canonical FF7 geography.
Tests cover the antimeridian, poles, coincident anchors and radius exclusion.
Measured real-workspace query timings and eligible/excluded counts are recorded in
[validation](validation.md).

Explore → Nearby offers nearest results or 50/100/250/500 km radius, bounded to
20 displayed results grouped into Places, Secrets and Transitions. An Inspector
Nearby action uses that entity's verified anchor. Near view center uses the existing
resolved geographic center. What's Here arms a one-shot canvas point selection,
using the existing projection inverse or a reference-sphere ray intersection.
That transient point is never added to storage or links. Outside the inverse domain
there is no fabricated result. WM2/WM3 native maps and Explorer make Nearby
unavailable; no WM0 transformation is invented for native maps.
