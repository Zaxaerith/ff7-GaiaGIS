# App shell and component system — v2.4

The shell owns one header/footer boundary and one dock frame. Geographic and native
views use the same CSS slots. Existing renderer ResizeObservers handle slot changes;
no camera/projection/mathematical changes are required.

- At 1100px and above, the left dock reserves 324px while open; the optional right
  Inspector reserves 316px. Both can collapse independently, returning space to the map.
- Below 1100px, docks become overlays instead of squeezing the main viewport.
- At 700px and below, drawers occupy at most 72dvh within the header/footer frame.
  Opening one drawer hides the other. Selection opens the Inspector; toolbar controls
  can reopen or collapse either panel. Escape returns focus to its toolbar button.
- Docks use min-width/min-height zero, viewport-bounded height and internal scroll.
  Long Atlas cards scroll with their Inspector, avoiding nested card scroll traps.
- Analysis endpoints and results share the same card/field treatment. Existing
  calculation IDs/owners are preserved; public mode gets a workspace-required empty state.

The final scoped app-shell stylesheet unifies legacy owners through shared palette,
background/rim, active state, spacing, type hierarchy, focus rings, buttons, cards,
dialogs, status/footer and scrollbars. Nested Inspector/Analysis owners are content
containers rather than independent windows. FF7-inspired presentation remains the
default; Scientific explicitly changes the same tokens. GIS thematic swatches retain
their semantic colors. Map markers retain transparent hit areas rather than inheriting
window-button chrome.

No new Spatial Analysis algorithm, reconstruction, cartography formula, workspace
schema, coordinate binding, routing solver or Explorer simulation is introduced.
