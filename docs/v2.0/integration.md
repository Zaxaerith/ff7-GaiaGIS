# Integrated interaction contract

Primary controls live in one six-section sidebar/drawer: Explore, Layers,
Analysis, Map, View and Data. Selection uses one secondary Inspector container,
with established context renderers for source triangles, verified locations/
entrances, events and map transitions. Routing/measurement results are keyboard-selectable Inspector contexts; Explorer
keeps its detailed source state in the minimal tool panel and restores the previous
selection on exit. State carries identities and intent, not result copies.

Search defaults to verified locations and now includes entrance identities and
map transitions. Name/alias/internal-field ranking remains simple normalized
exact/prefix/substring matching. Transition selection retains source/target
identity; opening its target map does not imply a known transform. Context actions
reuse existing fly-to, routing endpoints, spherical measurement and entrance
placement, preserving source provenance and no-guessing policy.

Map changes exit Explorer, clear old selection, suspend WM0 global analysis and
dispose the prior native renderer. View changes reproject the same WM0 identities.
Breadcrumbs always distinguish Gaia geographic versus WM2Native/WM3Native space.
Explorer suppresses unrelated GIS controls and keeps a persistent Exit HUD.
Mobile drawers close on selection and Explorer activation; controls remain touch
accessible. Comparison uses the established stacked mobile layout.

Onboarding explains code-only data loading, local generation and privacy. Safe
language/projection/grid/style/panel preferences persist locally. Invalid or
currently unsupported preference values are ignored; texture style waits for
valid textures. Local-storage failure does not block loading. Keyboard tab
navigation, focus return, existing reduced-motion behavior and five locales are
retained. No additional game simulation or projection formula is introduced.

Validated workflows are search/Inspector→measure/route→Equal Earth/Mercator
comparison→Globe→verified-entrance Explorer→exit; source transition→WM2 original
textures/Submarine preview→WM0; Tissot/distortion→spherical area→original texture;
and touch selection/measurement/Explorer/stacked comparison at 390 and 320 CSS pixels.
Actual results and limitations are recorded in [validation](validation.md).
