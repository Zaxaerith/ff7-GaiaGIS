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
