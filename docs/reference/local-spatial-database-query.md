# Local Spatial Database Query

GaiaGIS v5.18 optionally serves one existing FieldLocal GeoPackage v3. Open **Data & Settings → Local Spatial Database Query** to inspect status, submit a query and page through its JSON results. The panel labels the actual GET path, HTTP status, returned row count and request round-trip time.

## Start from an existing Workspace

Run from the source checkout with the Python package on its import path. A first source build uses the project's existing Web dependencies.

```powershell
$env:PYTHONPATH = (Resolve-Path src).Path
python -m gaiagis local --serve-existing --workspace output/local-workspace --field-db output/exports/fieldlocal/example-v3.gpkg --port 5180
```

Replace the example filename with a previously exported and validated FieldLocal v3 file. Supply `--no-open` to start only the server. `--serve-existing` checks the existing Manifest and assets under the Workspace lease, and refuses a pending Field CFG transaction. The original game directory is unnecessary. Omit `--field-db` to serve the usual Viewer and report `not_configured`. The portable launcher GUI keeps its existing launch behavior. The query demonstration is a source CLI workflow. SQLite reads the export with Python's standard library and needs neither a GDAL connection nor the Field evidence generator.

## Browser, server and relational layout

The browser sends a same-origin HTTP GET to Python's existing `ThreadingHTTPServer` over TCP/IP loopback. Python validates the route and parameters, binds values to the fixed SQLite query and returns JSON. The browser renders those rows as text in the scrollable table. The same process provides the Viewer, Workspace transport and query API. Public Pages remain a static build and do not probe loopback.

`script_events` uses original Section 1 instruction offsets. Its optional Gameplay and Dialogue details join on `instruction_offset`. Each control relationship uses a raw root, IF offset, successor and target offset. Its target joins back to the event. One event may appear under multiple valid roots. A relationship row and a deduplicated event count have different meanings.

| GET path under `/__gaiagis_local__/db/` | Parameters |
| --- | --- |
| `status` | None. Returns availability, schema, Field identity, table/layer counts, source validation and channel status. |
| `events` | Optional `kind` (MESSAGE, ASK, STITM, SMTRA, BATTLE, REQ, REQSW, REQEW) and `instruction_offset`. |
| `controls` | Required `if_offset`. Optional `grade` (standard, strong, core; default core). |

Both result endpoints accept `limit` (1–50, default 20) and the zero-based row `offset` (0–10,000, default 0). Instruction offsets are decimal 0–65,535. A successful page carries `fieldId`, `queryType`, `status`, `coverage`, `rows`, `total`, `limit`, `offset` and `hasMore`. An optional joined value remains JSON `null`. `coverage: partial` limits the count to available channels. A conditional analysis with an incomplete state returns a named unavailable/limited/cancelled/not-run error.

```powershell
curl.exe -H "X-GaiaGIS-DB: 1" "http://127.0.0.1:5180/__gaiagis_local__/db/status"
curl.exe -H "X-GaiaGIS-DB: 1" "http://127.0.0.1:5180/__gaiagis_local__/db/controls?if_offset=0&grade=core&limit=1&offset=0"
```

The runtime JOIN aliases columns for JSON and binds all four values. The count uses the same JOIN and filter without pagination.

```sql
SELECT c.root_offset AS rootOffset, c.if_offset AS ifOffset, c.successor,
       c.target_offset AS targetOffset, e.kind,
       c.is_standard AS isStandard, c.is_strong AS isStrong, c.is_core AS isCore
FROM conditional_controls AS c
JOIN script_events AS e ON e.instruction_offset = c.target_offset
WHERE c.if_offset = :if_offset
  AND ((:grade = 'standard' AND c.is_standard = 1)
    OR (:grade = 'strong' AND c.is_strong = 1)
    OR (:grade = 'core' AND c.is_core = 1))
ORDER BY c.root_offset, c.successor, c.target_offset
LIMIT :limit OFFSET :offset;
```

## Read-only and source boundaries

The configured ordinary `.gpkg` is restricted to `output/exports/fieldlocal` and 128 MB. Startup checks schema and natural keys, integrity and foreign keys, exported Field and Section identities, asset digests and the original Manifest digest. The trusted input is a prior GaiaGIS export selected by the user. Source hashes alone do not independently prove arbitrary external evidence.

The query connection uses SQLite URI `mode=ro`, `query_only=ON` and `trusted_schema=OFF`. The service checks file identity, bytes and journal state before and after result queries. A detected database change revokes the binding until restart. Run with a normally closed database and stop the service before replacing or opening it for editing. The file is outside the HTTP asset allowlist. Control checks enforce bounded parameters, four simultaneous database requests, a 500 ms SQLite query budget and a 256 KiB JSON limit.

Database GETs require `X-GaiaGIS-DB: 1`, the actual loopback authority and a matching Origin when one is present. Clearly cross-origin Fetch Metadata is refused. There is no CORS grant. A manual Workspace replacement clears the panel's binding and pending results. The service returns original IDs and static evidence only. FieldLocal units remain local to one Field, and control relations make no claims about in-game execution.
