# GaiaGIS v2.7 local candidate validation

Baseline main/origin/main: `0ad45d6d309b76abc2291f21c3cc9c9e04e2fea3`.
v2.7 is committed locally only. No v2.7 push/tag/Release/Pages is authorized.

## Historical publication repaired

| Version | Annotated tag target | Published code-only Release |
|---|---|---|
| v2.5.0 | eceeb41408657b274b372c3dda73afb06ab7ac62 | [Release](https://github.com/Zaxaerith/ff7-GaiaGIS/releases/tag/v2.5.0) |
| v2.6.0 | 0ad45d6d309b76abc2291f21c3cc9c9e04e2fea3 | [Release](https://github.com/Zaxaerith/ff7-GaiaGIS/releases/tag/v2.6.0) |

Both are Published, not Draft/prerelease, with zero binary attachments.
Historical successful Web CI runs: 37453713948 and 37467077680. Automatic source
ZIPs were downloaded/inspected: no private Python tests, save or game asset files.
v2.4 tag remains `79f9fe8b79eec5458f89b606f5d2cc553680b221`; no old Release changed.

Pages is now v2.6: [successful run 37573186301](https://github.com/Zaxaerith/ff7-GaiaGIS/actions/runs/37573186301),
exact v2.6 SHA. A first tag-ref deploy was rejected by the existing main-only
environment policy; deployment was retried on main without changing protection.
[Public Pages](https://zaxaerith.github.io/ff7-GaiaGIS/) was checked for source-only
startup, authored Atlas/search offline after initial loading, no fake Fly,
320px containment and five locales. No automatic external requests occurred.

## Save Explorer

- Classic PC / Steam 2013 compatible 65,109-byte container, 15 independent slots.
- Header/length/CRC/bounds/empty/corrupt/unsupported-slot validation; no repair.
- Party, levels, HP/MP, Gil, time, module/location, disc and raw progress verified
  against documented offsets. Unsupported glyphs and unlock/story meanings
  remain Unknown/Unverified; vehicle/Chocobo visibility masks are raw only.
- Four real private files: ten populated CRC-valid slots and fifty empty slots;
  all populated slots are field saves. All four hashes unchanged.
- Verified classic-PC WM0 packing/axis/grid conversion; synthetic world slots
  exercised marker/Fly, exact surface Explorer placement and Player→Kalm route.
  Field/unknown/WM2/WM3 get raw records only. No real world-module live-position
  comparison was possible with the provided saves; no such runtime claim is made.
- Atlas Save Context appears/removes correctly; no story inference or spoiler
  change. Explorer preview does not modify save state.
- Clear/reimport/late asynchronous reads/reload/session ownership covered.
  Save localStorage persistence = 0; ShareState save/private-coordinate leaks = 0.
- No arbitrary-file HTTP endpoint, telemetry, save upload or Steam Cloud access.

## Executed tests

Python private non-climate suite: **304 passed**, zero skipped/errors/failures;
real read-only game inputs enabled; climate tests executed = 0. `tests/` remains
present, ignored and untracked. Web: **833 passed / 5 explicit optional skips**,
29 files. Normal build, release build and public release audit: PASS.

| Browser suite | Passed |
|---|---:|
| Save import/slots/privacy/world binding/projections/Explorer/route/mobile/public | 65 / 65 |
| User Mapping desktop/mobile/projections/public | 127 / 127 |
| User overlap/Compare/layer/gesture controls | 20 / 20 |
| 500-feature performance/containment | 12 / 12 |
| Spatial Analysis / nine-character Explorer locomotion | 114 / 114 |
| App Shell / workspace / native maps / layout | 103 / 103 |
| Navigation & Discovery | 70 / 70 |
| Atlas | 48 / 48 |
| Atlas fallback | 10 / 10 |
| Frozen EXE compiled Viewer local/public User Mapping smoke | 21 / 21 |
| Four real saves / Atlas Save Context / frozen native resources / Pages / locales | 36 / 36 |
| **Total** | **626 / 626** |

All reported checks passed without page errors, shader errors or automatic
external requests. Desktop, 390px and 320px have bounded docks/Inspector and no
horizontal overflow. Thirteen projections, Globe, Compare, routing/profile,
terrain/encounter/slope/aspect/service analyses, Atlas, User Mapping, workspace
fallback, native WM2/WM3 and Explorer regressions pass. Five locales have
**894 keys each**; save UI labels are translated.

## Windows candidate

Clean PyInstaller 6.22.3 / CPython 3.14.7 x64 build: PASS. Package audit: 113
files and 195 embedded Python modules inspected, zero prohibited files or
private paths. Python, PyInstaller, Tcl, Tk and OpenSSL license texts plus
corresponding authored source are included. ZIP/checksum are generated under
ignored `output/distribution`; final exact commit/size/SHA256 are recorded in
the delivery receipt after the commit build, avoiding a self-referential hash.

Fresh extracted ZIP / workspace-local profile+TEMP / System32-only PATH smoke:
**13 / 13**. Bundled Python and Tk runtime launch; cold workspace has 15 assets
including textures, Explorer and WM2/WM3. Loaded runtime DLLs come only from
the package or Windows, with no external Python/Node/QGIS dependency. Cold
generation observed around 28 seconds, warm HTTP readiness around 1.2 seconds
on this machine; these are observations, not hardware-independent guarantees.

Fourteen generated payloads are byte-identical to development output. Geometry
metadata differs only in honest SQLite transport provenance. The initial
compiled-Viewer smoke found its old GeoPackage-only provenance requirement;
the validator now accepts the explicit SQLite transport while retaining all
frozen V1 geometry fingerprints and parameters. Ambiguous/unknown transport
provenance is rejected and covered by Web tests.

Isolation is **process/environment isolation, not a fresh Windows VM**. Native
Tk runtime was exercised; interactive folder selection and clean-OS reputation
behavior remain manual acceptance checks. The candidate is unsigned. No
unperformed VM test or signature is claimed. See [distribution](distribution.md).

## Safety and disposition

- Twelve inspected FF7 input hashes unchanged: **FF7 source modified = NO**.
- Four user save hashes unchanged: **save modified = NO**.
- Proprietary assets distributed/added = **0**; public derived dataset = **NO**.
- Private-coordinate ShareState leaks = **0**; new public private paths = **0**.
- Frozen config/CRS/research/climate roots unchanged; no v2.8 or new climate work.
- All local output/cache/profile writes remain inside the workspace.
- Local main commit and clean working tree are confirmed in the final receipt.
- **v2.7 local RC = YES**, pending human acceptance; independent clean-OS and
  real world-module Steam runtime checks remain explicitly unverified.
