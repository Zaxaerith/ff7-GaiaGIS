# Local Gaia Web data

Generated from Stage 1 Geographic outputs with `python -B scripts/build_web_assets.py` from the project root.

`gaia-mesh.bin` and `gaia-meta.json` are local visualization products, ignored by Git. They contain game-derived geometry, not raw MAP/LGP assets. Public redistribution must be reviewed separately; GPL source licensing does not license this data.

See `docs/web-data-format.md`. The Viewer loads these static files once; it never reads GeoPackage or the FF7 installation. Use an HTTP dev/preview server, not file://.
