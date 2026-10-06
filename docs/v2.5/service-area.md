# Network service area by path distance

Input: existing verified origin entrance triangle(s), movement profile, conditional
policy and threshold in reference-sphere path metres. UI accepts km (default 100;
50/100/250/500 km are useful inspection values). No travel time or isochrone is
claimed. Source entrance candidates are the same multi-candidate origin used by
the existing route owner; their initial graph cost is zero.

A bounded single-source/multi-origin-candidate Dijkstra request runs inside the
existing routing worker over its already initialized CSR graph and unchanged edge
weights. Existing connected-component eligibility labels enforce Allowed-only;
Include conditional uses the identical routing policy. No graph rebuild/copy,
raster buffer, routing-weight change or runtime simulation is introduced.

Supported profiles: Foot, Buggy, Tiny Bronco, Yellow, Green, Blue, Black and Gold
Chocobo. Highwind flight and native WM2 Submarine are deliberately excluded.
The result highlights source triangles whose graph node/center cost is within
the threshold, not a precise continuous polygon boundary within those triangles.
Disconnected components remain excluded. Conditional reachability is not a runtime
availability guarantee.

Results provide reachable node/triangle count, component count, threshold, profile,
conditional policy and elapsed worker ms. A Uint8 flag per source triangle feeds
the existing renderer; cost arrays and queue are request scratch, not retained user
state. Async revision guards reject obsolete results after input/map/data changes.
Registered layer opacity, reset and legend are reused. Threshold clipping,
disconnection, conditional rules and multiple profiles have synthetic coverage.
