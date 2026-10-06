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

## Validation and limits

File and resulting centralized state are bounded to **4 MiB UTF-8**.
Maximum 32 layers, 500 features, 20,000 total vertices, 512 per feature. Metadata
and style limits match [user features](user-features.md). Numeric NaN/Infinity,
out-of-domain vertices, duplicate IDs, missing layer membership, malicious style
values, wrong types and unknown nested fields are rejected.

Only simple polygons fitting an open hemisphere are accepted. Repeated vertices,
antipodal edges, self intersections, nonadjacent touching and degenerate area are
rejected. Holes and multipolygons are not silently flattened. Antimeridian-crossing
simple rings and reversed winding remain valid. Reference-sphere results are
computed from the frozen Gaia geographic mapping, never GeoJSON assumptions.

Import appends and rekeys every imported layer/feature, preserving existing local
identities. It validates the full merged state before commit; a bad/oversized import
does not partially replace existing features. External navigation relationships
(bookmarks/tours) are not included in this envelope. Error status appears in My
Layers. Export validates and writes only these user fields, through an explicit
download; no network request or automatic upload is used.

Future native GIS export can be implemented through a local Python/QGIS exporter
that supplies Gaia custom CRS metadata. GeoPackage/GeoJSON export is deferred;
no geometry is labeled EPSG:4326.
