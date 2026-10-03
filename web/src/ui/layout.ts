// SPDX-License-Identifier: GPL-3.0-only
export function mountLayout(root:HTMLElement) {
  root.innerHTML=`
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">G</span><div><h1>Gaia<span>GIS</span></h1><p>V1 GEOMETRIC GAIA · FINAL FANTASY VII</p></div></div>
      <div class="projection-control"><label for="projection">Projection</label><select id="projection" aria-label="Projection"><option value="globe">Globe</option><option value="equirectangular">Equirectangular</option><option value="mercator">Mercator</option><option value="mollweide">Mollweide</option><option value="orthographic">Orthographic</option></select></div>
      <span class="local-badge">LOCAL DATASET</span><button id="mobile-display" class="mobile-only" aria-expanded="false">Display</button>
    </header>
    <main class="workspace">
      <aside class="controls panel" aria-label="Display controls"><div class="panel-heading"><h2>Display</h2><span>01</span></div>
        <label class="field-label" for="color-layer">Color layer</label><select id="color-layer"><option value="terrain">FF7 gameplay terrain</option><option value="region">FF7 regions</option></select>
        <label class="field-label" for="region-focus">Go to region</label><select id="region-focus"><option value="">Choose a region…</option></select>
        <p id="region-note" class="control-note">Approximate geometric centers, not field entrances.</p>
        <section class="locations-controls" aria-label="Named locations">
          <label class="field-label" for="location-search">Search locations</label>
          <input id="location-search" type="search" placeholder="Midgar, field name…" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="location-results" aria-expanded="false"/>
          <div id="location-results" role="listbox" aria-label="Location search results"></div>
          <label class="field-label" for="location-filter">Location category</label><select id="location-filter"><option value="all">All locations</option><option value="settlements">Settlements</option><option value="dungeons">Dungeons / caves / temples</option><option value="landmarks">Landmarks / facilities / entrances</option></select>
          <label class="switch-row"><span>Locations</span><input id="locations-toggle" type="checkbox" checked/></label>
          <label class="switch-row"><span>Labels <small>major locations</small></span><input id="location-labels" type="checkbox" checked/></label>
          <button id="load-locations">Load Locations</button><p id="location-status" class="control-note" role="status">Locations unavailable · optional local file</p>
        </section>
        <label class="switch-row"><span>Gameplay terrain</span><input id="terrain" type="checkbox" checked/></label>
        <label class="switch-row"><span>Triangle grid</span><input id="triangle-grid" type="checkbox"/></label>
        <label class="switch-row"><span>经纬网 <small>30° · Graticule</small></span><input id="graticule" type="checkbox" checked/></label>
        <label class="switch-row"><span>Globe depth</span><input id="globe-depth" type="checkbox" checked/></label>
        <label class="switch-row"><span>Distinguish polar caps</span><input id="cap-distinction" type="checkbox"/></label>
        <div class="divider"></div>
        <label class="switch-row"><span>Auto rotate</span><input id="auto-rotate" type="checkbox"/></label>
        <button id="reset-view" class="reset-button">↺ &nbsp; Reset view</button>
        <details class="legend" open><summary id="legend-title">FF7 gameplay terrain</summary><div id="terrain-legend"></div><p>Original gameplay attributes.<br/>Synthetic ocean has no FF7 IDs.</p></details>
        <div class="model-note"><span class="eyebrow">CANONICAL RECONSTRUCTION</span><p>V1 Geometric Gaia.<br/>Original world polygons.<br/>Synthetic ocean poles.</p><span id="dataset-count">Loading…</span></div>
      </aside>
      <section id="viewport" class="viewport" aria-label="Gaia viewport">
        <div id="loading" class="loading" role="status"><span class="loader"></span><h2 id="loading-title">V1 Geometric Gaia</h2><p id="loading-text">Loading local Gaia dataset…</p><div class="loading-actions" hidden><button id="open-local-data">Open local V1 files</button><button id="retry-viewer">Retry viewer</button><button id="loading-help">Setup / help</button></div></div>
        <div class="view-caption"><span id="mode-label">SPHERICAL VIEW</span><h2 id="projection-name">Globe</h2><p id="interaction-hint">Drag to orbit · Scroll to zoom · Tap to inspect</p></div>
        <div id="graticule-labels" class="graticule-labels" aria-hidden="true"></div>
        <div class="navigation-tools" aria-label="地图方向与经纬网">
          <button id="north-up" class="compass-button" aria-label="北向上，回到当前经度的赤道视角" title="北向上 · 保留当前经度与缩放"><span class="compass-north">北 N</span><span id="compass-needle" class="compass-needle" aria-hidden="true">▲</span><span class="compass-south">S</span></button>
          <button id="toggle-graticule" class="grid-button" aria-pressed="true" title="30° 经纬网 · 金色：赤道 · 青色：0° 经线"><span aria-hidden="true">⊞</span> 经纬网</button>
        </div>
        <div id="view-center" class="view-center" title="使用 Stage 1 重建的 Gaia 经纬度与南北方向"></div>
        <div class="zoom-controls"><button id="zoom-in" aria-label="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out">−</button></div>
        <div id="transition-label" class="transition-label" hidden>Visual transition · not a map projection</div>
      </section>
      <aside id="info-panel" class="info panel" aria-label="Selected feature"><div class="panel-heading"><h2 id="inspector-title">Triangle inspector</h2><button id="clear-selection" aria-label="Clear selection">×</button></div>
        <div id="selection-empty" class="selection-empty"><span class="selection-symbol" aria-hidden="true">△</span><h3>Explore the source geometry</h3><p>Click or tap a triangle to see its original terrain, region and FF7 lineage.</p></div>
        <div id="selection-details" hidden></div>
        <div class="inspector-note"><span class="eyebrow">REFERENCE SPHERE</span><strong id="radius">6,371,008.8 m</strong><p>Radius and height scale are assumptions.<br/>Web precision ≠ canonical GIS precision.</p></div>
      </aside>
    </main>
    <footer><span class="status-dot"></span><span id="view-status">Preparing viewer</span><span id="coordinates"></span><button id="about-button">About / help</button><span class="footer-right"><span id="fps">— FPS</span><span class="footer-disclaimer">Independent fan / technical project · Not affiliated with Square Enix</span></span></footer>
    <input id="local-dataset-files" type="file" accept=".json,.bin" multiple hidden aria-label="Local V1 metadata and mesh files"/>
    <input id="local-poi-file" type="file" accept=".json" hidden aria-label="Local locations file"/>
    <dialog id="about-dialog" aria-labelledby="about-title">
      <div class="dialog-heading"><h2 id="about-title">GaiaGIS · V1 Geometric Gaia</h2><button id="close-about" aria-label="Close About">×</button></div>
      <p class="version-badge">WEB VIEWER 1.1 · CANONICAL V1</p>
      <p>Explore FF7's original world polygons through GaiaGIS's geometric reconstruction. The five projections are views of the same V1 dataset.</p>
      <h3>Open your own local dataset</h3>
      <p>Select <code>gaia-meta.json</code> and <code>gaia-mesh.bin</code> together, generated locally with GaiaGIS. Files stay in your browser and are never uploaded. The source-only release contains no game-derived map data.</p>
      <button id="choose-local-data">Choose both V1 files</button><p id="local-data-status" role="status"></p>
      <p>Optional named locations: generate <code>gaia-poi.json</code> with <code>python -B scripts/build_poi_assets.py --source "YOUR_FF7_INSTALLATION"</code>, then use <strong>Load Locations</strong> in Display. Coordinates stay local. Entrances describe conditional triggers, not current story availability.</p>
      <details><summary>Local generation</summary><pre>python -B scripts/build_gaia.py --source "YOUR_FF7_INSTALLATION"
python -B scripts/build_web_assets.py</pre><p>Run from the project root using your existing Python/QGIS setup. Your game installation is read-only. Full setup instructions are included in the repository README.</p></details>
      <h3>Controls</h3><p>Drag to orbit or pan; scroll or pinch to zoom. Click/tap a triangle for FF7 lineage. Regions navigate to approximate area-weighted spherical centers; broad sea regions may have diffuse centers.</p>
      <p>Focus the map with Tab: arrow keys move the view, +/− zoom, N points north, Home resets, Escape clears selection. Reduced-motion preferences disable projection morphing.</p>
      <h3>Reconstruction assumptions</h3><p>V1 is GaiaGIS's canonical reconstruction, not official FF7 geography. Radius, height scale and geographic orientation are reconstruction assumptions. Polar ocean caps are synthetic and have no FF7 lineage. Gameplay terrain is not GIS land cover.</p>
      <h3>Climate research · Experimental / Inconclusive</h3><p>V2/V2.1/V2.2 research is concluded and preserved. It did not establish a physically robust replacement for V1. No climate warp is selectable or included in this viewer.</p>
      <h3>Code, data and notices</h3><p>GPL-3.0-only applies to GaiaGIS original code. Three.js retains its MIT license; other dependencies retain their own licenses. Game-derived geometry distribution is a separate, unresolved matter. GaiaGIS is independent and not endorsed by Square Enix.</p><a href="${import.meta.env.BASE_URL}THREE-LICENSE.txt" target="_blank" rel="noopener">Three.js license notice</a>
    </dialog>`;
}
