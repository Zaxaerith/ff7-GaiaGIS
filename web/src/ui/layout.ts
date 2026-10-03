// SPDX-License-Identifier: GPL-3.0-only
export function mountLayout(root:HTMLElement) {
  root.innerHTML=`
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">G</span><div><h1>Gaia<span>GIS</span></h1><p>FINAL FANTASY VII · POLYGON WORLD</p></div></div>
      <div class="projection-control"><label for="projection">Projection</label><select id="projection" aria-label="Projection"><option value="globe">Globe</option><option value="equirectangular">Equirectangular</option><option value="mercator">Mercator</option><option value="mollweide">Mollweide</option><option value="orthographic">Orthographic</option></select></div>
      <span class="local-badge">LOCAL DATASET</span><button id="mobile-display" class="mobile-only" aria-expanded="false">Display</button>
    </header>
    <main class="workspace">
      <aside class="controls panel" aria-label="Display controls"><div class="panel-heading"><h2>Display</h2><span>01</span></div>
        <label class="switch-row"><span>Gameplay terrain</span><input id="terrain" type="checkbox" checked/></label>
        <label class="switch-row"><span>Triangle grid</span><input id="triangle-grid" type="checkbox"/></label>
        <label class="switch-row"><span>经纬网 <small>30° · Graticule</small></span><input id="graticule" type="checkbox" checked/></label>
        <label class="switch-row"><span>Globe depth</span><input id="globe-depth" type="checkbox" checked/></label>
        <label class="switch-row"><span>Distinguish polar caps</span><input id="cap-distinction" type="checkbox"/></label>
        <div class="divider"></div>
        <label class="switch-row"><span>Auto rotate</span><input id="auto-rotate" type="checkbox"/></label>
        <button id="reset-view" class="reset-button">↺ &nbsp; Reset view</button>
        <details class="legend" open><summary>FF7 gameplay terrain</summary><div id="terrain-legend"></div><p>Gameplay / walkmesh classes.<br/>Synthetic ocean has no FF7 terrain ID.</p></details>
        <div class="model-note"><span class="eyebrow">THE MODEL</span><p>Original world polygons.<br/>Mathematical spherical reconstruction.<br/>Synthetic ocean poles.</p><span id="dataset-count">Loading…</span></div>
      </aside>
      <section id="viewport" class="viewport" aria-label="Gaia viewport">
        <div id="loading" class="loading" role="status"><span class="loader"></span><p id="loading-text">Loading local Gaia dataset…</p></div>
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
      <aside id="info-panel" class="info panel" aria-label="Selected triangle"><div class="panel-heading"><h2>Triangle inspector</h2><button id="clear-selection" aria-label="Clear selection">×</button></div>
        <div id="selection-empty" class="selection-empty"><span class="selection-symbol" aria-hidden="true">△</span><h3>Explore the source geometry</h3><p>Click or tap a triangle to see its original terrain, region and FF7 lineage.</p></div>
        <div id="selection-details" hidden></div>
        <div class="inspector-note"><span class="eyebrow">REFERENCE SPHERE</span><strong id="radius">6,371,008.8 m</strong><p>Radius and height scale are assumptions.<br/>Web precision ≠ canonical GIS precision.</p></div>
      </aside>
    </main>
    <footer><span class="status-dot"></span><span id="view-status">Preparing viewer</span><span id="coordinates"></span><span class="footer-right"><span id="fps">— FPS</span><span class="footer-disclaimer">Independent fan / technical project · Not affiliated with Square Enix</span></span></footer>`;
}
