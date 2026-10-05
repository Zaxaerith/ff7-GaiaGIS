# Atlas spatial binding and evidence

Position authority remains the validated POI pipeline. Atlas never geocodes prose, measures a Wiki map, chooses a nearest triangle, interpolates a missing point or translates native map positions into global coordinates.

For `location`, find the existing Location by ID, then its primary Entrance. Require matching parent identity, `derived_from_entry_trigger`, representative triangle membership in trigger triangles and recorded script calls. The largest source trigger triangle centroid remains the existing POI representative, unchanged. Label it entrance_level / existing_entrance, never an exact interior site. Atlas markers and route/measurement/Explorer actions reuse that Entrance. No new coordinate constants are serialized.

For `parent_location`, require the existing parent; emit parent_place / parent_only, no Entrance ID or marker. For `field_parent`, also verify every field name belongs to the parent; emit field_only / field_link, no Entrance ID or marker. Cards offer only Fly to parent place. The user's mental model is explicit: this action visits a known entrance of the parent, not the reward's position. There is no independent collectible dot.

Unknown identities remain unresolved. Non-spatial knowledge remains non_spatial. Missing POI allows knowledge/search but no context position. Browser pack validation rederives every binding from validated POI and requires matching source hashes. Related entrance/transition IDs are lineage/context references, not new navigation coordinates. Native map switch hides Atlas markers and clears incompatible selection/context through the established lifecycle.

Actual generated precision counts: exact_source 0; verified_anchor 0; entrance_level 34; parent_place 12; field_only 6; non_spatial 0; unresolved 6. 34/34 existing named Locations are covered; exclusions 0. The four cave rewards and Sage Enemy Skill/Temple Black Materia are field-only. Round Island and eleven reward groups are parent-place. All six unresolved records have marker=false and no location/entrance point. Collectibles layer marks only known parent places with visible discoveries, not chest positions.

Deterministic Atlas-only declutter suppresses overlapping anchors within 32 screen pixels in stable entity order. It is recalculated each frame as the camera/projection changes. Atlas markers morph through the existing 13-view pipeline and disappear in Explorer/native views. Declutter does not alter existing locations, events, geometry or projection mathematics.

Synthetic tests reject coordinates in public requests, unsourced facts, missing coverage, field mismatch, fake precision/markers, mismatched source hashes and changed entrance identities. Actual source tests verify the 34 entrance bindings. Screenshots and generated packs are private ignored artifacts.
