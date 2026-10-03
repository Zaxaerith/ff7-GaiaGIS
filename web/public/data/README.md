# Local Gaia Web data

Generated from Stage 1 Geographic outputs with `python -B scripts/build_web_assets.py` from the project root.

`gaia-mesh.bin` and `gaia-meta.json` are local visualization products, ignored by Git. They contain game-derived geometry, not raw MAP/LGP assets. Public redistribution must be reviewed separately; GPL source licensing does not license this data.

See `docs/web-data-format.md`. The Viewer loads these static files once; it never reads GeoPackage or the FF7 installation. Use an HTTP dev/preview server, not file://.

Optional locations: `python -B scripts/build_poi_assets.py --source 'YOUR_FF7_INSTALLATION'` generates private `gaia-poi.json`. Use **Load Locations** after opening the existing two V1 files. This game-derived coordinate dataset is ignored and excluded from public builds. Schema/provenance: `docs/v1.1/poi-data.md`.
