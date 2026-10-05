# v2.0 architecture audit

Baseline: published v1.9.0, `0cc34e7839dc9372f9f1f0f1945a3226ff8abda6`.
This audit precedes implementation. Research, source topology, mapping and climate
are frozen; this is application integration, not a replacement rendering stack.

## Observed architecture

`main.ts` owns WM0 construction and layout replacement. UI modules own optional
dataset adoption, DOM controls and feature state. `mountMultimap` separately owns
native decoded maps, raw texture buffers and the active native renderer.
Explorer is a long-lived document controller with its own mode and restoration
snapshot. Routing has its own worker and request guard. Comparison has a second
WebGL context and shares source data but owns its GPU uploads. Existing codecs
already validate checksums, lineage and schema; keep them authoritative.

## Pain points

- No explicit application-level map/view/selection state or capability registry.
- Each optional input has separate status and loading workflow.
- Global document events and mutable `activeExplorer` couple lifecycle boundaries.
- WM0 layout is replaced on reload while native/Explorer objects outlive it.
- Multiple fixed panels obscure the scene, particularly at mobile widths.
- Native switching disposes/recreates its renderer and texture upload; ownership
  must remain explicit rather than adding another cache of decoded assets.
- Explorer v1 repeats 9,005,976 bytes of source surface geometry/adjacency.
- Main bundle is about 869kB, with eager Explorer/native imports.
- Selection is implicitly encoded in Inspector DOM attributes and feature callbacks.

## Minimal migration plan

1. Introduce typed slice state, dataset status and pure capability/feature registry.
2. Add local file/folder workspace discovery and manifest checks. Route adoption
   through existing codecs and public load ports; optional failures are isolated.
3. Add a modular incremental CLI that calls existing exporters, with deterministic
   relative-name manifest and explicit dependencies. No private path in manifest.
4. Investigate shared source surfaces before Explorer v2: verify every reconstructed
   raw integer and adjacency against v1 on real data. If precision is insufficient,
   retain v1 and report that instead of silently changing walker semantics.
5. Introduce one primary panel with six sections, onboarding, unified diagnostics,
   selection header, context actions and native breadcrumb. Preserve existing IDs
   for compatibility and regression coverage; features keep their renderer logic.
6. Unify cleanup/load cancellation and reduce expensive eager code only where
   startup measurements support it. Preserve atlas ownership per WebGL context.
7. Verify existing and new integration workflows, all locales, keyboard/mobile,
   source-only production and before/after source fingerprints. Version and local
   commit follow successful gates; no remote publication in this task.

## Evidence boundaries

WM2/WM3 remain native spaces, transition destinations can be unresolved, animation
is preview30fps and Steam2026 runtime equivalence is NOT VERIFIED. Static terrain
compatibility is not global runtime reachability. No save/VM/field/battle research
is added by this migration.
