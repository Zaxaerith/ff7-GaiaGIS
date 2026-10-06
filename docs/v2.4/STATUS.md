# GaiaGIS v2.4 durable status — App Shell, UI Unification & Workspace UX

Updated 2026-10-06 (Asia/Hong_Kong).

## Authority and scope

- Repository + source + this document are the durable authority.
- Published baseline: GaiaGIS v2.3.0, d60c8794b4d3cf62f3831a6f821a29f5b380cd31.
- Local main initially clean; author Zaxaerith. Local development and commit only; no publication authorized.
- P0: reproduce and fix mixed styling, viewport containment and Workspace UX.
- P1: unify Analysis containers, loading/empty states and existing route form structure.
- No new analysis algorithm, tour expansion, reconstruction, climate research or v2.5.
- Every project write/cache/profile/output stays inside this workspace. FF7 inputs read-only.
- Generated assets and screenshots stay ignored; public delivery source-only.

## Initial findings

- presentation.css is imported before viewer.css; legacy selectors and independent component palettes remain.
- Integrated docks use fixed coordinates while WM0/native containers separately reserve space, with conflicting mobile breakpoints.
- Inspector has no independent collapse control. Desktop close button is hidden.
- Data panel shows a flat asset list and generic import failure; folder picker guidance does not distinguish generated workspace from raw game inputs.
- Launcher canonical default is output/local-workspace; root local-workspace is a historical manual/build output, not the launcher default.
- Local status currently avoids every filesystem path; any additive workspace-path field must remain private-only and never expose the installation path or enter user storage/share/diagnostics.

## Validation plan

- Capture baseline desktop and small-screen metrics/screenshots before changing UI.
- Unified FF7 default and explicit Scientific mode; verify both docks, long forms/cards and modal containment.
- Desktop / 390px / 320px; Globe / Mercator / WM2 / WM3 / Explorer.
- Public source-only, automatic local workspace, valid/manual/missing/corrupt/raw-FF7 folder import.
- Web tests/build/release audit and non-climate Python checks; original source hashes before/after.
- Record evidence and final validation, local commit, clean tree, stop.

## Completion checkpoint

- P0/P1 completed: unified scoped theme tokens, shared WM0/native dock slots,
  independent desktop collapse and bounded compact drawers, internal scroll.
- Workspace connection card, private local path display, canonical output/local-workspace
  help, validated manual preflight and readable optional/core failure states implemented.
- Existing Analysis endpoints/results grouped and source-only empty state added.
- Python 304 passed; Web 638 passed / 5 optional skips; Browser 231/231
  (103 shell/workspace + 70 navigation + 48 Atlas + 10 fallback).
- Desktop/short/compact/390/320, both themes, five locales, Globe/Mercator/native/Explorer,
  automatic/manual/public workflows passed. Release build/audit pass.
- 12 FF7 inputs unchanged; no private assets/dataset/upload/public path leakage.
- No new analysis algorithms or P2 capability expansion.
- app-shell.md, workspace-ux.md and validation.md document the final behavior.
- Final local commit followed by clean status; exact SHA is Git HEAD and final handoff.
- No push/tag/Release/Pages. Stop here; wait for user acceptance. No v2.5.
