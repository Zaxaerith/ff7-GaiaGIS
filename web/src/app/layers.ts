// SPDX-License-Identifier: GPL-3.0-only
import type {AppState,AssetId} from './state';
export const layerDefinitions=[
 {id:'slope',label:'sp25.slope',defaultOpacity:1,defaultVisibility:false,control:'spatial-slope'},
 {id:'aspect',label:'sp25.aspect',defaultOpacity:1,defaultVisibility:false,control:'spatial-aspect'},
 {id:'service-area',label:'sp25.service',defaultOpacity:1,defaultVisibility:false,control:'spatial-service-area'},
 {id:'terrain',label:'nav23.terrain',defaultOpacity:1,defaultVisibility:true,control:'terrain'},
 {id:'encounters',label:'ui.encounters',defaultOpacity:1,defaultVisibility:false,control:'color-layer'},
 {id:'traversal',label:'ui.traversal',defaultOpacity:1,defaultVisibility:false,control:'color-layer'},
 {id:'reachability',label:'routing.reachable',defaultOpacity:1,defaultVisibility:false,control:'show-reachable'},
 {id:'events',label:'ui.events',defaultOpacity:1,defaultVisibility:false,control:'events-toggle'},
 {id:'atlas',label:'atlas.title',defaultOpacity:1,defaultVisibility:false,control:'atlas-places'},
 {id:'distortion',label:'analysis.projection',defaultOpacity:1,defaultVisibility:false,control:'show-tissot'},
 {id:'routes',label:'routing.title',defaultOpacity:1,defaultVisibility:false,control:'find-route'},
] as const;
export type LayerId=typeof layerDefinitions[number]['id'];
export const layerIds=layerDefinitions.map(l=>l.id);
export const defaultOpacities=()=>Object.fromEntries(layerDefinitions.map(l=>[l.id,l.defaultOpacity])) as Record<LayerId,number>;
export const visibilityDefinitions=[...layerDefinitions,{id:'secrets',control:'atlas-secrets',defaultVisibility:false},{id:'collectibles',control:'atlas-collectibles',defaultVisibility:false}] as const;
export type VisibilityId=typeof visibilityDefinitions[number]['id'];
export const visibilityIds=visibilityDefinitions.map(l=>l.id);
export const defaultVisibility=()=>Object.fromEntries(visibilityDefinitions.map(l=>[l.id,l.defaultVisibility])) as Record<VisibilityId,boolean>;
/** Opacity is presentation capability, resolved through existing asset authority. */
export function layerAvailable(id:LayerId,state:Readonly<AppState>){const required:AssetId=id==='encounters'?'encounters':id==='events'?'events':id==='atlas'?'locations':id==='routes'||id==='reachability'||id==='service-area'?'routing':'geometry';return state.map.id==='WM0'&&state.explorer.phase==='idle'&&state.data.assets.geometry?.status==='loaded'&&state.data.assets[required]?.status==='loaded';}
