// SPDX-License-Identifier: GPL-3.0-only
import type {MapId} from '../data/nativeMaps';
import type {ProjectionId} from '../projections/Projection';
import {defaultOpacities} from './layers';
import type {LayerId} from './layers';

export type AssetId='geometry'|'locations'|'encounters'|'events'|'routing'|'textures'|'WM2'|'WM3'|'textures-WM2'|'textures-WM3'|'transitions'|'explorer'|'presentation'|'atlas';
export type DataStatus='missing'|'optional'|'loading'|'loaded'|'incompatible'|'corrupt'|'legacy'|'unsupported';
export interface AssetState {status:DataStatus;bytes:number;version?:number;reason?:string;sourceHashes?:Record<string,string>;}
export type SelectionKind='triangle'|'location'|'entrance'|'encounter'|'event'|'transition'|'route'|'measurement'|'explorer'|'atlas'|'user-feature'|'save';
export interface Selection {kind:SelectionKind;id:string;mapId:MapId;geographicPoint?:[number,number,number];}
export type PanelId='explore'|'layers'|'analysis'|'map'|'view'|'data';
export interface PreferenceState {panel:PanelId;language:'en'|'zh-CN'|'zh-TW'|'ja'|'ko';graticule:string;surfaceStyle:'terrain'|'region'|'texture';layerOpacity?:Record<LayerId,number>;}
export interface AppState {
 localWorkspace:'none'|'loading'|'loaded'|'error';
 data:{assets:Partial<Record<AssetId,AssetState>>;generation:number;};
 map:{id:MapId;coordinateSpace:'GaiaGeographic'|'WM2Native'|'WM3Native';};
 view:{projection:ProjectionId;native:'3d'|'topdown';compare:boolean;};
 selection:Selection|null;
 analysis:{tool:'none'|'routing'|'measurement'|'distortion'|'compare';};
 explorer:{phase:'idle'|'placing'|'active';};
 preferences:PreferenceState;
}
export function initialState():AppState{return {localWorkspace:'none',data:{assets:{},generation:0},map:{id:'WM0',coordinateSpace:'GaiaGeographic'},view:{projection:'globe',native:'3d',compare:false},selection:null,analysis:{tool:'none'},explorer:{phase:'idle'},preferences:{panel:'explore',language:'en',graticule:'auto',surfaceStyle:'terrain'}};}
export type Action=
 |{type:'asset';id:AssetId;asset:AssetState}
 |{type:'reset-data'}
 |{type:'local-workspace';phase:AppState['localWorkspace']}
 |{type:'map';id:MapId}
 |{type:'view';view:Partial<AppState['view']>}
 |{type:'select';selection:Selection|null}
 |{type:'analysis';tool:AppState['analysis']['tool']}
 |{type:'explorer';phase:AppState['explorer']['phase']}
 |{type:'panel';panel:PanelId}
 |{type:'preference';preferences:Partial<PreferenceState>};
export function reduce(state:AppState,action:Action):AppState{
 switch(action.type){
 case 'local-workspace':return {...state,localWorkspace:action.phase};
 case 'asset':return {...state,data:{...state.data,assets:{...state.data.assets,[action.id]:action.asset}}};
 case 'reset-data':return {...initialState(),localWorkspace:state.localWorkspace,preferences:state.preferences,data:{assets:{},generation:state.data.generation+1}};
 case 'map':return {...state,map:{id:action.id,coordinateSpace:action.id==='WM0'?'GaiaGeographic':action.id==='WM2'?'WM2Native':'WM3Native'},selection:null,analysis:{tool:'none'},explorer:{phase:'idle'},view:{...state.view,compare:false}};
 case 'view':return {...state,view:{...state.view,...action.view}};
 case 'select':return {...state,selection:action.selection?.mapId===state.map.id?action.selection:null};
 case 'analysis':return {...state,analysis:{tool:action.tool}};
 case 'explorer':return {...state,explorer:{phase:action.phase},analysis:action.phase==='idle'?state.analysis:{tool:'none'}};
 case 'panel':return {...state,preferences:{...state.preferences,panel:action.panel}};
 case 'preference':return {...state,preferences:{...state.preferences,...action.preferences}};
 }
}
export class AppStore {
 private value=initialState();private listeners=new Set<(state:AppState)=>void>();
 get state():Readonly<AppState>{return this.value;}
 dispatch(action:Action){this.value=reduce(this.value,action);for(const listener of this.listeners)listener(this.value);}
 subscribe(listener:(state:AppState)=>void){this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
}
export const appStore=new AppStore();

export type Capability='canProjectGlobally'|'canMeasureSphere'|'canRoute'|'canExplore'|'canUseOriginalTexture'|'canShowEncounters'|'canShowTransitions'|'canShowLocations'|'canShowEvents'|'canInspectSurface';
export function capabilities(s:Readonly<AppState>):Record<Capability,boolean>{
 const ready=(id:AssetId)=>['loaded','legacy'].includes(s.data.assets[id]?.status??'missing');
 const wm0=s.map.id==='WM0',geometry=ready(s.map.id==='WM0'?'geometry':s.map.id),overview=s.explorer.phase==='idle';
 return {canProjectGlobally:wm0&&geometry&&overview,canMeasureSphere:wm0&&geometry&&overview,canRoute:wm0&&geometry&&ready('routing')&&ready('locations')&&overview,canExplore:geometry&&ready('explorer'),canUseOriginalTexture:geometry&&ready(wm0?'textures':s.map.id==='WM2'?'textures-WM2':'textures-WM3'),canShowEncounters:wm0&&geometry&&ready('encounters'),canShowTransitions:ready('transitions'),canShowLocations:wm0&&geometry&&ready('locations'),canShowEvents:wm0&&geometry&&ready('events'),canInspectSurface:geometry};
}
export interface FeatureDefinition {id:string;labelKey:string;requiredCapabilities:Capability[];requiredData:AssetId[];supportedMaps:MapId[];defaultVisibility:boolean;panel:PanelId;opacityLayers?:LayerId[];defaultOpacity?:number;}
export const features:FeatureDefinition[]=[
 {id:'slope',labelKey:'sp25.slope',requiredCapabilities:['canInspectSurface'],requiredData:['geometry'],supportedMaps:['WM0'],defaultVisibility:false,panel:'analysis',opacityLayers:['slope'],defaultOpacity:1},
 {id:'aspect',labelKey:'sp25.aspect',requiredCapabilities:['canInspectSurface'],requiredData:['geometry'],supportedMaps:['WM0'],defaultVisibility:false,panel:'analysis',opacityLayers:['aspect'],defaultOpacity:1},
 {id:'service-area',labelKey:'sp25.service',requiredCapabilities:['canRoute'],requiredData:['routing'],supportedMaps:['WM0'],defaultVisibility:false,panel:'analysis',opacityLayers:['service-area'],defaultOpacity:1},
 {id:'atlas',labelKey:'atlas.title',requiredCapabilities:[],requiredData:[],supportedMaps:['WM0'],defaultVisibility:true,panel:'explore'},
 {id:'atlas-markers',labelKey:'atlas.title',requiredCapabilities:['canShowLocations'],requiredData:['locations'],supportedMaps:['WM0'],defaultVisibility:false,panel:'layers'},
 {id:'locations',labelKey:'ui.locations',requiredCapabilities:['canShowLocations'],requiredData:['locations'],supportedMaps:['WM0'],defaultVisibility:true,panel:'explore'},
 {id:'encounters',labelKey:'ui.encounters',requiredCapabilities:['canShowEncounters'],requiredData:['encounters'],supportedMaps:['WM0'],defaultVisibility:false,panel:'layers'},
 {id:'tracks',labelKey:'ui.tracks',requiredCapabilities:['canInspectSurface'],requiredData:['geometry'],supportedMaps:['WM0'],defaultVisibility:false,panel:'layers'},
 {id:'traversal',labelKey:'ui.traversal',requiredCapabilities:['canInspectSurface'],requiredData:['geometry'],supportedMaps:['WM0'],defaultVisibility:false,panel:'layers'},
 {id:'events',labelKey:'ui.events',requiredCapabilities:['canShowEvents'],requiredData:['events'],supportedMaps:['WM0'],defaultVisibility:false,panel:'layers'},
 {id:'routing',labelKey:'routing.title',requiredCapabilities:['canRoute'],requiredData:['routing','locations'],supportedMaps:['WM0'],defaultVisibility:false,panel:'analysis'},
 {id:'transitions',labelKey:'map.transitions',requiredCapabilities:['canShowTransitions'],requiredData:['transitions'],supportedMaps:['WM0','WM2','WM3'],defaultVisibility:false,panel:'map'},
 {id:'measurement',labelKey:'analysis.measure',requiredCapabilities:['canMeasureSphere'],requiredData:['geometry'],supportedMaps:['WM0'],defaultVisibility:false,panel:'analysis'},
 {id:'distortion',labelKey:'analysis.projection',requiredCapabilities:['canProjectGlobally'],requiredData:['geometry'],supportedMaps:['WM0'],defaultVisibility:false,panel:'analysis'},
 {id:'explorer',labelKey:'explore.title',requiredCapabilities:['canExplore'],requiredData:['explorer'],supportedMaps:['WM0','WM2','WM3'],defaultVisibility:false,panel:'explore'}
];
const opacityFeatures:Record<string,LayerId[]>={'atlas-markers':['atlas'],encounters:['encounters'],traversal:['traversal'],events:['events'],routing:['reachability','routes'],distortion:['distortion']};
for(const feature of features)if(opacityFeatures[feature.id]){feature.opacityLayers=opacityFeatures[feature.id];feature.defaultOpacity=defaultOpacities()[feature.opacityLayers[0]];}
export function featureAvailable(id:string,s:Readonly<AppState>){const f=features.find(f=>f.id===id);if(!f)return false;const c=capabilities(s);return f.supportedMaps.includes(s.map.id)&&f.requiredCapabilities.every(k=>c[k]);}
