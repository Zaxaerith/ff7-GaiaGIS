// SPDX-License-Identifier: GPL-3.0-only
import {t} from '../i18n';
export function mountLayout(root:HTMLElement) {
  root.innerHTML=`
    <header class="topbar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">G</span><div><h1>Gaia<span>GIS</span></h1><p>V1 GEOMETRIC GAIA · FINAL FANTASY VII</p></div></div>
      <div class="projection-control"><label for="projection">${t('ui.projection')}</label><select id="projection" aria-label="${t('ui.projection')}"><option value="globe">Globe</option><option value="equirectangular">Equirectangular</option><option value="mercator">Mercator</option><option value="mollweide">Mollweide</option><option value="orthographic">Orthographic</option></select></div>
      <span class="local-badge">${t('ui.local')}</span><button id="mobile-display" class="mobile-only" aria-expanded="false">${t('ui.display')}</button>
    </header>
    <main class="workspace">
      <aside class="controls panel" aria-label="${t('ui.displayControls')}"><div class="panel-heading"><h2>${t('ui.display')}</h2><span>01</span></div>
        <label class="field-label" for="color-layer">${t('ui.color')}</label><select id="color-layer"><option value="terrain">${t('ui.terrain')}</option><option value="region">${t('ui.regions')}</option><option value="traversal">${t('ui.traversal')}</option><option value="encounter" disabled>${t('ui.encounters')}</option><option value="encounter-rate" disabled>${t('ui.rate')}</option></select>
        <section id="traversal-controls" hidden aria-label="${t('ui.traversalProfile')}"><label class="field-label" for="movement-mode">${t('ui.movement')}</label><select id="movement-mode"></select><p class="control-note">${t('ui.staticNote')}</p></section>
        <button id="load-encounters">${t('ui.loadEncounters')}</button><p id="encounter-status" class="control-note" role="status">${t('ui.encountersUnavailable')}</p>
        <label class="switch-row"><span>${t('ui.tracks')}</span><input id="chocobo-tracks" type="checkbox"/></label>
        <p id="tracks-legend" class="control-note" hidden><span class="tracks-swatch"></span>${t('ui.tracksNote')}</p>
        <label class="field-label" for="region-focus">${t('ui.goRegion')}</label><select id="region-focus"><option value="">${t('ui.chooseRegion')}</option></select>
        <p id="region-note" class="control-note">${t('ui.regionNote')}</p>
        <section class="locations-controls" aria-label="${t('ui.namedLocations')}">
          <label class="field-label" for="location-search">${t('ui.search')}</label>
          <input id="location-search" type="search" placeholder="${t('ui.searchPlaceholder')}" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="location-results" aria-expanded="false"/>
          <div id="location-results" role="listbox" aria-label="${t('ui.searchResults')}"></div>
          <label class="field-label" for="location-filter">${t('ui.category')}</label><select id="location-filter"><option value="all">${t('ui.allLocations')}</option><option value="settlements">${t('ui.settlements')}</option><option value="dungeons">${t('ui.dungeons')}</option><option value="landmarks">${t('ui.landmarks')}</option></select>
          <label class="switch-row"><span>${t('ui.locations')}</span><input id="locations-toggle" type="checkbox" checked/></label>
          <label class="switch-row"><span>${t('ui.labels')} <small>${t('ui.major')}</small></span><input id="location-labels" type="checkbox" checked/></label>
          <button id="load-locations">${t('ui.loadLocations')}</button><p id="location-status" class="control-note" role="status">${t('ui.locationsUnavailable')}</p>
        </section>
        <section class="event-controls" aria-label="${t('ui.events')}">
          <label class="switch-row"><span>${t('ui.events')}</span><input id="events-toggle" type="checkbox" disabled/></label>
          <label class="field-label" for="event-filter">${t('ui.eventCategory')}</label><select id="event-filter" disabled><option value="all">${t('ui.allEvents')}</option><option value="entrances">${t('ui.entrances')}</option><option value="battles">${t('ui.battles')}</option><option value="objects">${t('ui.objects')}</option><option value="vehicle">${t('ui.vehicle')}</option><option value="other">${t('ui.otherEvents')}</option></select>
          <select id="event-list" aria-label="${t('ui.goWorldEvent')}" disabled><option value="">${t('ui.goEvent')}</option></select>
          <button id="load-events">${t('ui.loadEvents')}</button><p id="event-status" class="control-note" role="status">${t('ui.eventsUnavailable')}</p>
          <label class="switch-row"><span>${t('ui.scriptTriggers')}</span><input id="script-triggers" type="checkbox"/></label>
          <p class="control-note">${t('ui.triggerNote')}</p>
        </section>
        <label class="switch-row"><span>${t('ui.gameTerrain')}</span><input id="terrain" type="checkbox" checked/></label>
        <label class="switch-row"><span>${t('ui.grid')}</span><input id="triangle-grid" type="checkbox"/></label>
        <label class="switch-row"><span>${t('ui.graticule')}</span><input id="graticule" type="checkbox" checked/></label>
        <label class="switch-row"><span>${t('ui.depth')}</span><input id="globe-depth" type="checkbox" checked/></label>
        <label class="switch-row"><span>${t('ui.caps')}</span><input id="cap-distinction" type="checkbox"/></label>
        <div class="divider"></div>
        <label class="switch-row"><span>${t('ui.rotate')}</span><input id="auto-rotate" type="checkbox"/></label>
        <button id="reset-view" class="reset-button">↺ &nbsp; ${t('ui.reset')}</button>
        <details class="legend" open><summary id="legend-title">${t('ui.terrain')}</summary><div id="terrain-legend"></div><p>${t('ui.attributeNote')}<br/>${t('ui.syntheticNote')}</p></details>
        <div class="model-note"><span class="eyebrow">${t('ui.canonical')}</span><p>V1 Geometric Gaia.<br/>${t('ui.originalPolygons')}<br/>${t('ui.syntheticPoles')}</p><span id="dataset-count">${t('ui.loading')}</span></div>
      </aside>
      <section id="viewport" class="viewport" aria-label="${t('ui.viewport')}">
        <div id="loading" class="loading" role="status"><span class="loader"></span><h2 id="loading-title">V1 Geometric Gaia</h2><p id="loading-text">${t('ui.loadingData')}</p><div class="loading-actions" hidden><button id="open-local-data">${t('ui.openFiles')}</button><button id="retry-viewer">${t('ui.retry')}</button><button id="loading-help">${t('ui.help')}</button></div></div>
        <div class="view-caption"><span id="mode-label">${t('ui.spherical')}</span><h2 id="projection-name">Globe</h2><p id="interaction-hint">${t('ui.orbitHint')}</p></div>
        <div id="graticule-labels" class="graticule-labels" aria-hidden="true"></div>
        <div class="navigation-tools" aria-label="${t('ui.directions')}">
          <button id="north-up" class="compass-button" aria-label="${t('ui.northUp')}" title="${t('ui.northUp')}"><span class="compass-north">${t('ui.north')}</span><span id="compass-needle" class="compass-needle" aria-hidden="true">▲</span><span class="compass-south">S</span></button>
          <button id="toggle-graticule" class="grid-button" aria-pressed="true" title="${t('ui.graticuleHint')}"><span aria-hidden="true">⊞</span> ${t('ui.graticule')}</button>
        </div>
        <div id="view-center" class="view-center" title="${t('ui.centerReference')}"></div>
        <div class="zoom-controls"><button id="zoom-in" aria-label="${t('ui.zoomIn')}">+</button><button id="zoom-out" aria-label="${t('ui.zoomOut')}">−</button></div>
        <div id="transition-label" class="transition-label" hidden>${t('ui.transition')}</div>
      </section>
      <aside id="info-panel" class="info panel" aria-label="${t('ui.selected')}"><div class="panel-heading"><h2 id="inspector-title">${t('ui.triangleInspector')}</h2><button id="clear-selection" aria-label="${t('ui.clearSelection')}">×</button></div>
        <div id="selection-empty" class="selection-empty"><span class="selection-symbol" aria-hidden="true">△</span><h3>${t('ui.explore')}</h3><p>${t('ui.exploreNote')}</p></div>
        <div id="selection-details" hidden></div>
        <div class="inspector-note"><span class="eyebrow">${t('ui.sphere')}</span><strong id="radius">6,371,008.8 m</strong><p>${t('ui.assumptions')}<br/>${t('ui.precision')}</p></div>
      </aside>
    </main>
    <footer><span class="status-dot"></span><span id="view-status">${t('ui.preparing')}</span><span id="coordinates"></span><button id="about-button">${t('ui.about')}</button><span class="footer-right"><span id="fps">— FPS</span><span class="footer-disclaimer">${t('ui.disclaimer')}</span></span></footer>
    <input id="local-dataset-files" type="file" accept=".json,.bin" multiple hidden aria-label="${t('ui.filesAria')}"/>
    <input id="local-poi-file" type="file" accept=".json" hidden aria-label="${t('ui.poiAria')}"/>
    <input id="local-encounters-file" type="file" accept=".json" hidden aria-label="${t('ui.encAria')}"/>
    <input id="local-events-file" type="file" accept=".json" hidden aria-label="${t('ui.eventsAria')}"/>
    <dialog id="about-dialog" aria-labelledby="about-title">
      <div class="dialog-heading"><h2 id="about-title">GaiaGIS · V1 Geometric Gaia</h2><button id="close-about" aria-label="${t('ui.closeAbout')}">×</button></div>
      <p class="version-badge">WEB VIEWER ${import.meta.env.VITE_GAIA_VERSION} · V1</p>
      <p>${t('help.intro')}</p><h3>${t('ui.openFiles')}</h3><p>${t('help.local')}</p>
      <button id="choose-local-data">${t('ui.chooseFiles')}</button><p id="local-data-status" role="status"></p>
      <p>${t('help.optional')}</p><p>${t('help.rules')}</p><p>${t('help.routing')}</p>
      <details><summary>${t('ui.localGeneration')}</summary><pre>python -m gaiagis local --source "YOUR_FF7_INSTALLATION"

python -m gaiagis build-workspace --source "YOUR_FF7_INSTALLATION" --output output/local-workspace</pre><p>${t('help.environment')}</p></details>
      <h3>${t('ui.controls')}</h3><p>${t('help.controls')}</p>
      <h3>${t('ui.reconstruction')}</h3><p>${t('help.assumptions')}</p>
      <h3>${t('ui.climate')}</h3><p>${t('help.climate')}</p>
      <h3>${t('ui.notices')}</h3><p>${t('help.license')}</p><a href="${import.meta.env.BASE_URL}THREE-LICENSE.txt" target="_blank" rel="noopener">${t('ui.threeLicense')}</a>
    </dialog>`;
}
