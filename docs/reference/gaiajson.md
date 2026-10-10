# GaiaJSON v1

GaiaJSON is an explicitly requested local exchange of user-authored features.
Suggested filename: `my-layers.gaiagis.json`. It is **NOT GeoJSON / NOT WGS84**.
No workspace pack, FF7 asset, screenshot, private filesystem path, generic
AppState, source triangle or routing node is accepted.

## Envelope

```json
{
  "schema": "gaiagis-user-features",
  "version": 1,
  "coordinateSpace": "GaiaGame",
  "mapId": "wm0",
  "layers": [],
  "features": []
}
```

All fields are required. Unknown fields, unsupported version, coordinate space or
map are rejected. The empty example is valid and contains no generated data.

`layers` contains objects with exactly `id`, `name`, `visible`, `opacity`, `order`.
IDs and order values must be unique. Orders are integer 0–31; opacity is finite
0–1. Features must refer to an existing layer ID.

Each feature contains exactly:

- `id`, `layerId`, `geometryType` (`Point`, `Polyline`, `Polygon`)
- `geometry`: `{mapId: "wm0", coordinateSpace: "GaiaGame", vertices: [...]}`
- `name`, `note`, `tags`
- `style`: `{color: "#RRGGBB", pointSize: ..., fillOpacity: ...}`
- `createdAt`, `updatedAt`: finite Unix milliseconds, modified ≥ created

Vertices have exactly `game_east` and `game_north`, both finite numbers.
East is periodic original X, `[0, 294912)`; north is `229376 - original Z`,
`[0, 229376]`. There is no height or EPSG identifier. Point has one vertex,
Polyline at least two, Polygon at least three with implicit closure.


## GeoPackage / QGIS exchange

The existing GDAL exporter owns the optional `gaiagis user-gis` CLI:

```text
python -m gaiagis user-gis to-gpkg --input my-layers.gaiagis.json --output output/dev/current/my-layers.gpkg
python -m gaiagis user-gis from-gpkg --input output/dev/current/my-layers.gpkg --output output/dev/current/edited.gaiagis.json
```

Run with an existing GDAL-enabled Python, such as QGIS's `bin/python-qgis.bat`
(in place of `python`). The portable Viewer does not bundle QGIS/GDAL. No game
installation is needed for this exchange. Inputs are read-only; outputs must
remain in the workspace and existing files are never overwritten.

Open `user_points`, `user_lines`, and `user_polygons` in QGIS, edit vertices or
supported attributes, save edits, then convert back. These are **raw GaiaGame
engineering coordinates**, X = game_east, Y = game_north, in raw game units.
They are neither physical metres nor EPSG:4326; do not reproject or assign an
Earth CRS. The explicit custom CRS is stored using GDAL's
[GeoPackage WKT extension](https://gdal.org/en/stable/drivers/vector/gpkg.html).
QGIS globe/ellipsoid measurements are inappropriate; use GaiaGIS's reference
sphere measurements after import. Raw planar lines across the periodic seam
can appear long (or locally self-crossing for a spherical ring) in QGIS; exchange deliberately preserves their vertices, not a
projection-specific display split.

`gaia_exchange` declares `gaiagis-user-gpkg`, version 1, WM0 / GaiaGame.
`user_layers` retains ID, name, visibility, opacity and `order_index`, including
empty layers. Each geometry table stores stable `id`, `layer_id`, name, note,
`tags_json` (JSON string array), color, point_size, fill_opacity, created_at and
updated_at (Unix milliseconds). `feature_order` retains GaiaJSON array order.
Clearing note or tags_json to NULL in QGIS means an empty note or tag list. Other required attributes cannot be NULL. Database `fid` is not the stable identity. For a new QGIS feature, let QGIS assign
FID, supply a new unique `id`, a valid layer ID and all required attributes;
leave feature_order NULL to append it, or supply a unique order 0–499.
Polygon closure is explicit in GPKG and implicit in GaiaJSON; vertex order is
retained. Holes, multipart, Z/M, foreign domains, changed CRS, duplicate IDs,
unknown attribute columns, corrupt/non-finite or out-of-bounds coordinates are
rejected, without partial output. QGIS-generated extra tables must be removed
from an exchange copy rather than silently discarded. Limits remain 32 layers,
500 features, 512 vertices per feature, 20,000 total vertices and 4 MiB GaiaJSON;
GPKG input is additionally capped at 64 MiB. The browser still applies its
existing spherical polygon validation; validation uses the existing V1 mapping and spherical simple-ring domain without changing exported coordinates, and is not a claim of
world-map reachability or geographic precision.

## Browser Merge / Update

Import first opens a preview, with Cancel focused. **Merge** retains the previous
new-copy behavior: new layer and feature IDs, existing data untouched.
**Update** matches stable IDs, adds missing identities, and flags changed rows.
Every conflict defaults to keeping the local row. Check a row to accept all its
incoming values, including geometry/style/notes. Existing layer order stays
local; new layers append in incoming order. Missing incoming features/layers
never delete local data. Identical imports are idempotent in Update mode.
Changes to local mapping or the browser-origin storage record (including another tab) invalidate the preview; reload before importing again.
Apply is one validated storage transaction; rejected limits or geometry do not
partly alter the map. Storage quota failure retains the established in-memory
fallback. This is explicit conflict resolution, not automatic three-way merging.
Nothing is uploaded or added to ShareState.
