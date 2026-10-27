// SPDX-License-Identifier: GPL-3.0-only
import {describe,it,expect} from 'vitest';
import {playerAreas,areaPanels,areaStart,panelArea,menuIndex} from '../src/app/shellNavigation';
describe('player menu over the original panel owners',()=>{
 it('keeps all six original panels reachable without changing their identity',()=>{expect([...new Set(playerAreas.flatMap(id=>areaPanels[id]))].sort()).toEqual(['analysis','data','explore','layers','map','view']);for(const id of playerAreas)expect(areaPanels[id]).toContain(areaStart[id]);});
 it('reuses Explore for world navigation and guides, and the existing data owner for settings',()=>{expect(areaStart.world).toBe('explore');expect(areaStart.guide).toBe('explore');expect(areaStart.settings).toBe('data');expect(areaPanels.world).toContain('analysis');expect(areaPanels.guide).toContain('layers');});
 it('routes existing panel actions to an appropriate presentation group',()=>{expect(panelArea('explore')).toBe('guide');expect(panelArea('data')).toBe('settings');for(const id of ['layers','analysis','map','view'] as const)expect(panelArea(id)).toBe('gis');});
 it('supports directional, Home/End focus with bounded wrap and native Enter/Tab',()=>{expect(menuIndex('ArrowDown',3,4)).toBe(0);expect(menuIndex('ArrowUp',0,4)).toBe(3);expect(menuIndex('ArrowRight',1,4)).toBe(2);expect(menuIndex('ArrowLeft',1,4)).toBe(0);expect(menuIndex('Home',2,4)).toBe(0);expect(menuIndex('End',0,4)).toBe(3);expect(menuIndex('Enter',0,4)).toBeNull();expect(menuIndex('Tab',0,4)).toBeNull();});
});
