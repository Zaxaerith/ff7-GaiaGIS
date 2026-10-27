// SPDX-License-Identifier: GPL-3.0-only
import type {PanelId} from './state';

/** Presentation groups only: the original six panels retain their owners/state. */
export const playerAreas=['world','guide','gis','settings'] as const;
export type PlayerArea=typeof playerAreas[number];
export const areaPanels:Record<PlayerArea,readonly PanelId[]>={world:['explore','map','analysis'],guide:['explore','layers'],gis:['analysis','map','view','layers'],settings:['data','view']};
export const areaStart:Record<PlayerArea,PanelId>={world:'explore',guide:'explore',gis:'analysis',settings:'data'};
export function panelArea(panel:PanelId):PlayerArea{return panel==='explore'?'guide':panel==='data'?'settings':'gis';}
export function menuIndex(key:string,current:number,length:number){
 if(key==='Home')return 0;if(key==='End')return length-1;
 if(key==='ArrowRight'||key==='ArrowDown')return (current+1+length)%length;
 if(key==='ArrowLeft'||key==='ArrowUp')return (current-1+length)%length;
 return null;
}
