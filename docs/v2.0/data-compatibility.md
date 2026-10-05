# Dataset compatibility

Compatibility follows bytes, schemas, lineage and hashes; it is not inferred
from Steam AppID or merely a directory name. Discovery supports the existing
classic/2013-style, Steam2026 and extracted layouts with explicit case handling.
Core parsers remain common across resolved datasets.

## Transport policy

WM0 metadata/mesh, POI, encounters, events, routing, textures, native maps and
transitions retain their existing version1 transports. Their established codecs
continue to validate lengths, fields, references and source fingerprints. The
workspace manifest is an additional version1 envelope, not a transport rewrite.

Explorer accepts **version1 and version2**. Version1 embeds three source surfaces
and retains the previous decoder/walker path. Version2 embeds model/animation/
texture data and three map bindings, without surface records. `bindSurface`
requires exact map/source/count/extent agreement with loaded owners. A pack cannot
silently borrow another map or source. The same checksum, model, part, clip,
texture and bounds validation applies to both versions.

Version2's shared surface reconstructs WM0 source integer corners only when the
inverse V1 result is within0.125raw units of an integer. It rejects rather than
silently rounding incompatible geometry. Native coordinates already preserve
source integers. Exact endpoint/height adjacency retains E/W periodic WM0
matching, excludes the N/S cut, and conservatively rejects degenerate, duplicate
or non-manifold faces. No new route or walker semantics are introduced.

The real integration test compares all 160,821 triangles' positions, attributes
and three neighbor slots against version1: zero differences. Maximum observed
WM0 inverse corner errors were about 0.0154 raw north units, with no integer mismatch.
The source binary geometry is not recreated in a second 56-byte-per-face table.
Only adjacency and existing spatial indexing are retained by the borrowed owner.

## Graceful degradation

Missing optional data is normal. Locations, encounters, events, routing and
textures have their own load inputs and error status. Directory/multi-file loading
shares these same adoption paths. Bad optional data does not replace the mesh.
Workspace replacement resets source-bound native/Explorer caches; serialized
adoption and generation guards prevent an obsolete load from winning.

WM2/WM3 never receive WM0 global measurement/routing capabilities. Explorer may
preview their native surfaces, but original movement/collision and2026runtime
equivalence remain NOT VERIFIED. Legacy loading does not elevate evidence claims.
The public build contains no real manifest or game-derived pack of either version.
