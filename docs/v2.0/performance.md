# v2.0 performance validation

Measurements are local loopback Chromium, headless, 1440×1000 CSS pixels, Node 24,
with the same machine and existing local FF7-derived workspace. They are sanity
observations, not device-independent targets. No private assets or screenshots
are shipped. Source-only startup uses production builds; full-workspace rendering
uses the local development build, so these two timing categories are not comparable.

## Startup and loading

Five fresh browser contexts were measured for each source-only production build.
The baseline is v1.9.0 commit `0cc34e7839dc9372f9f1f0f1945a3226ff8abda6`, rebuilt
from its public source. Startup ends when the data-loading UI is available.

| Observation | v1.9 | v2.0 |
|---|---:|---:|
| Median source-only startup | 162.8 ms | 134.8 ms |
| Initially requested JavaScript, encoded transfer | 239,112 bytes | 90,097 bytes |

GaiaViewer, NativeViewer and ExplorerController are lazy modules. Three.js is not
requested before geometry is loaded in the code-only build. Source-only readiness
therefore does not imply a rendered map or a complete dataset. There is no eager
WM2/WM3 renderer or Explorer model decode.

| Operation | Observed elapsed time |
|---|---:|
| Full 13-file workspace, 19,124,791 bytes | 2369.7 ms |
| WM0 legacy two-file production chooser | 535.6 ms |
| Projection change, all 13 views, reduced motion | 20.8–226.9 ms |
| Midgar→Kalm route worker query | 27.9 ms |
| Explorer v2 decode/shared-surface preparation | 778.1 ms |
| Verified entrance→Explorer active | 198.1 ms |
| WM0→WM2 native canvas ready | 82.8 ms |
| Projection comparison enabled | 200.5 ms |

Production full-workspace workflows also passed; their load was approximately
2710 ms. Timings include asynchronous browser work,
local file reads and codec/source checks. Query timing excludes component setup.
Original WM0 texture UV preparation was about 420 ms in this sample: it remains an
existing CPU-heavy step, not a claim of zero loading jank or universal sub-frame work.

## Ownership and draw calls

| State | Draw calls | Renderer geometry/texture counts |
|---|---:|---|
| WM0 overview | 3 | 2 / 1 |
| Projection comparison | 3 + 3 in second context | Each context owns its GPU uploads |
| Comparison closed | 3 + 0 | Secondary context disposed |
| Explorer with original model | 21 | 20 / 4 |
| Explorer exited | 3 | 2 / 1; model geometry/texture byte counters return to 0 |
| WM2 native overview | 1 | 1 / 1 |

Headless sampled Explorer FPS reached 240 and native WM2 about 221. These values
are not a promised interactive frame rate, animation timing, or verified original
engine behavior. Existing animation remains 30 fps preview; walker-step diagnostics
were approximately 0.1 ms in the measured frame.

JavaScript heap samples ranged roughly 182–216 MB. GC was not forced; heap snapshots
are not proof of complete leak freedom. Explicit close/exit/reload owners, generation
guards, worker termination, listener unsubscription and geometry/material/texture
disposal were tested. WM0 source attributes remain in one owner; comparisons borrow
source data and allocate projected buffers only while active. Native decoded buffers
are reused, while ImageBitmap/atlas GPU uploads are owned per renderer/context.

Explorer v2 removes 9,006,340 bytes from the real pack (9,857,900→851,560 bytes,
91.36%). It borrows loaded coordinates/attributes and retains an adjacency array,
not another 56-byte-per-triangle surface. Legacy v1 remains accepted. All 160,821
source triangles' recovered positions, attributes and neighbors match v1 exactly.

The local performance run observed zero non-GET and zero external requests.
Private files remain browser-local. Detailed diagnostics, screenshots, benchmark
scripts and generated packs are ignored under `output/`; public code-only build
and source audits are described in [validation](validation.md).
