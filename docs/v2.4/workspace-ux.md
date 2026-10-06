# Workspace UX — v2.4

GaiaGIS loads generated transport packs, not raw FF7 installation files. Python
reads the installation as a read-only input and produces a private workspace.
Nothing is uploaded, and public source-only delivery includes no game assets.

## Automatic connection (recommended)

From the repository root:

```powershell
. ./scripts/use_workspace_environment.ps1
python -m gaiagis.local --source "YOUR_FF7_INSTALLATION"
```

The launcher generates or reuses **output/local-workspace**, builds the code-only
Viewer and opens the URL it prints. No manual folder selection is needed. The Data
connection card shows Automatic local workspace, connected/disconnected, manifest
validation, the actual workspace folder and individual available resources.

The launcher accepts another private directory inside project output/ via
`--workspace`; the status card then displays that actual location. A root
`local-workspace` is a possible historical/manual exporter output, not the launcher
default. Product help, user guide, CLI help, terminal output and UI agree on this.

## Manual folder or file import

Choose **Data → Open workspace folder** and select the generated folder containing
`gaia-workspace.json` and the files it lists. Do not choose the FF7 installation or
raw `wm` directory. If the browser lacks a directory picker, the directory input
is used. The individual workspace-files chooser accepts the manifest and generated
files selected together. Explicit legacy two-file/asset inputs remain available.

Manual preflight requires a manifest, validates its schema, map identities,
dependencies and checksums, and identifies missing required geometry by filename.
Rejected preflight leaves the currently connected owners and resources untouched.
Missing/corrupt optional packs are listed explicitly after successful core adoption;
the available geometry and other valid resources continue working. A selected
folder's browser-provided name is shown; browsers do not disclose its absolute path.

## What becomes available

The resource card enumerates geometry, locations, encounters, events, routing,
original WM0 textures, WM2, WM3, WM2 textures, WM3 textures, transitions, Explorer
characters, presentation audio and optional Atlas spatial bindings. Availability is
based on actual owner state, not on guessing from the directory name.

- View: original textures and presentation settings.
- Map: native WM2/WM3 and their textures.
- Explore → Explorer: loaded characters and established entrance launch workflow.
- Analysis: existing routing, measurement and cartography when their data is ready.

Public source-only mode shows disconnected/public source-only, explains generation
and manual connection, and retains authored Atlas knowledge without fabricated
spatial bindings. It never probes local endpoints or scans an installation.

## Privacy

Only the private advertised server includes `workspace_path` in its read-only status
response. Existing Host/Origin checks remain. This field identifies generated
workspace output; it never identifies the FF7 installation. The browser renders it
as text in local mode only and does not put it in storage, diagnostics or share URLs.
Manifest/pack schemas and path-free manifest response are unchanged. No upload API
or public path metadata is introduced.
