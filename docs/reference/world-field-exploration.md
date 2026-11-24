# World–Field integrated exploration

Open **Exploration journey → World–Field exploration** on WM0. Choose the
origin, one destination entrance, a target Field and a Gateway limit of 0–3.
The fold uses the Journey profile and conditional-terrain toggle. The
entrance picker spells out Default or Alternative and shows the destination
Field and Triangle. A saved result in the active Journey pane can supply
the ordered stops. To request a specific local endpoint, choose Triangle or
LINE and enter its original decimal Triangle ID or Section 1 instruction offset.

## Source and search contracts

The final station is restricted to triggers of the selected entrance before
the shared-component test and routing call. The actual ending CSR node must
resolve to one of that entrance's original `(section, mesh, triangle)` records.
A completed Journey can be reused after checking its scenario, source and
Workspace generation, station endpoints and ordered CSR witnesses. Its routes
remain subject to the same entrance lock. The Field stage verifies
ENTER_FIELD, FIELD.TBL scenario and row, Field/maplist identity, and the exact
Walkmesh Triangle and XY. The displayed Z is interpolated locally.

The existing Gateway search visits `(Field, actual Arrival Triangle)` in
transfer-depth order. For a Triangle or static LINE, a matching Field state
must also supply a directed Access path from that Arrival. The same search
can continue to another Arrival, including one that returns to the target
Field. Zero transfers evaluates only the entrance scene. A LINE additionally
uses the source-bound Interaction reader and exact 3D surface-contact check.
All contact Triangles remain in the evidence, with the clean witness chosen
by fewest hops, then lowest original Triangle ID. A mismatched Access witness
is unavailable evidence. Geometry or resource uncertainty is distinct from an
exhausted search with known sources.

The query caps states at 512, decoded scenes at 128, Gateway checks at 1,536
and metered geometry or Access work at 500,000. The UI yields between batches
and cancels obsolete requests. When a valid branch goes beyond the selected
transfer limit or the work budget expires, the result is **limited**.

## Reviewing a result

- **World route** redraws the recorded CSR witnesses with the existing route
  lease and displays their graph weight on the reference sphere.
- **Entrance transfer** opens the source-validated arrival in FieldLocal.
- **Gateway legs** display their original source segment, contact candidates,
  directed Access witness and target Arrival. Access slot and Section 5 offsets
  are visible in the Inspector.
- **Final local target** opens the final Arrival and the optional verified
  Triangle or LINE witness. Dialogue, Conditional Evidence and gameplay records
  remain available in the existing Field tools.

Returning to World restores the Viewer context. Browsing a completed witness
uses the session result, and Workspace/source replacement clears stale results.
An unavailable Field source still allows inspection of the solved world route.
If Interaction is absent, Field and Triangle queries remain available.

All successful results are static. WM0 reference-sphere weights, Field Access
hops and Gateway counts are reported separately. Runtime access, reciprocal
world exits, and event locations remain outside the source chain.

For the underlying contracts, see [Routing](routing.md), [Field Gateway Network](field-gateway-network.md), and [Coordinate spaces](coordinate-spaces.md).
