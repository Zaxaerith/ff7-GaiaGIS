// SPDX-License-Identifier: GPL-3.0-only
import type {PanelId} from './state';

/** Presentation groups only: the original six panels retain their owners/state. */
export const playerAreas=['world','explorer','guide','gis','settings'] as const;
export type PlayerArea=typeof playerAreas[number];
export const areaPanels:Record<PlayerArea,readonly PanelId[]>={world:['explore','map'],explorer:['explore'],guide:['explore'],gis:['analysis','map','view','layers'],settings:['data','view']};
export const areaStart:Record<PlayerArea,PanelId>={world:'explore',explorer:'explore',guide:'explore',gis:'analysis',settings:'data'};
export function panelArea(panel:PanelId):PlayerArea{return panel==='explore'?'guide':panel==='data'?'settings':'gis';}
export function menuIndex(key:string,current:number,length:number){
 if(key==='Home')return 0;if(key==='End')return length-1;
 if(key==='ArrowRight'||key==='ArrowDown')return (current+1+length)%length;
 if(key==='ArrowLeft'||key==='ArrowUp')return (current-1+length)%length;
 return null;
}

/** Both desktop and narrow layouts expose one drawer, without touching Viewer state. */
export function presentDrawer(menu:HTMLElement,inspector:HTMLElement,target:'menu'|'inspector'|null,menuButton:HTMLElement,inspectorButton:HTMLElement){
 menu.classList.toggle('open',target==='menu');inspector.classList.toggle('open',target==='inspector');
 menuButton.setAttribute('aria-expanded',String(target==='menu'));inspectorButton.setAttribute('aria-expanded',String(target==='inspector'));
}

/** Navigation and feature content occupy separate views of the same drawer. */
export function presentNavigation(root:HTMLElement,navigation:HTMLElement,content:HTMLElement,tools:HTMLElement,screen:'navigation'|'content',hasTools:boolean,globalActions?:HTMLElement){
 root.dataset.screen=screen;navigation.hidden=screen!=='navigation';content.hidden=screen!=='content';tools.hidden=screen!=='content'||!hasTools;if(globalActions)globalActions.hidden=screen!=='navigation';
}
