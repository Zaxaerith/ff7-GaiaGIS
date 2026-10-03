// SPDX-License-Identifier: GPL-3.0-only
// Small shared behavior facts, not a game-derived per-triangle dataset.
import rawProfile from '../../../src/gaiagis/traversal_profiles.json';
import type {TriangleAttributes} from './mesh';

export type TraversalState='allowed'|'conditional'|'blocked'|'unknown';
export interface MovementProfile {id:string;name:string;model_id:number;mask:string;bridge_sensitive:boolean;exit_mask:string|null;departure_mask:string|null;tint:number|null;}
export const traversalProfile=rawProfile;
export const movementProfiles:readonly MovementProfile[]=rawProfile.profiles;
export const traversalPalette:Record<TraversalState,string>={allowed:'#46bca4',conditional:'#e7b755',blocked:'#bf647b',unknown:'#808b99'};
const valid=(value:number,max:number,name:string)=>{if(!Number.isInteger(value)||value<0||value>max)throw new Error(`Invalid ${name}: expected 0..${max}`);};
export function profileById(id:string){const p=movementProfiles.find(p=>p.id===id);if(!p)throw new Error(`Unknown movement profile: ${id}`);return p;}
export function maskAllows(mask:string,terrain:number){valid(terrain,31,'terrain');return !!((Number(mask)>>>terrain)&1);}
export function chocoboExitHeightCompatible(current:number,candidate:number){
  if(!Number.isSafeInteger(current)||!Number.isSafeInteger(candidate))throw new Error('Raw game heights must be integers');
  return Math.abs(candidate-current)<200;
}
export function evaluateTraversal(id:string,terrain:number|null,script=0,origin=0){
  const p=profileById(id);valid(script,7,'script');if(terrain!==null)valid(terrain,31,'terrain');
  let state:TraversalState='unknown',reason='No WM0 source terrain',evidence='runtime_unknown';
  if(!origin&&terrain!==null){
    state=maskAllows(p.mask,terrain)?'allowed':'blocked';reason='Normal static terrain mask; not reachability';evidence=rawProfile.evidence;
    if(id==='highwind-landing'){
      if(terrain===27){state='conditional';reason='Northern Cave invokes script 9; not ordinary landing';evidence='script_dependent';}
      else if(terrain===0&&script===7){state='conditional';reason='Grass permits initiation; script 7 blocks exit-state destination gate';}
    }
  }
  const departure:TraversalState=origin||terrain===null||p.departure_mask===null?'unknown':maskAllows(p.departure_mask,terrain)?'allowed':'blocked';
  return {state,reason,evidence,profile:id,scope:id==='highwind-landing'?'landing_initiation':'terrain_occupancy',terrain_compatible:id==='highwind-landing'?'unknown':state,movement_compatible:'unknown',enter_exit_compatible:'unknown',enter_exit_initiation:departure,runtime_available:'not_simulated',compatibility_profile:rawProfile.compatibility_profile};
}
export function traversalColor(id:string,a:TriangleAttributes){return traversalPalette[evaluateTraversal(id,a.terrain,a.script??0,a.origin).state];}
export interface GateContext {tint?:number;currentTerrain?:number;currentModel?:number;leaveState?:number;airborne?:boolean;flightState?:number;}
export function referenceGate(model:number,terrainInfo:number,context:GateContext={}){
  valid(terrainInfo,65535,'terrain_info');const {tint=0,currentTerrain,currentModel,leaveState=0,airborne=false,flightState=0}=context;
  valid(leaveState,2,'leave_state');if(currentTerrain!==undefined)valid(currentTerrain,31,'current terrain');
  const terrain=terrainInfo&31,script=(terrainInfo>>5)&7,bridge=currentModel===model&&(currentTerrain===13||currentTerrain===14),bit=(mask:string)=>maskAllows(mask,terrain);
  if([0,1,2].includes(model))return bit(bridge?rawProfile.bridge_mask:profileById('foot').mask);
  if(model===4||model===19){valid(tint,4,'tint');const p=movementProfiles.find(p=>p.tint===tint)!;
    return bit(bridge?rawProfile.bridge_mask:model===4||leaveState===2?profileById('chocobo-yellow').mask:p.mask)&&(leaveState!==2||script!==7);}
  if(model===5)return airborne?(leaveState===2||flightState<0?bit('0x70'):true):bit(leaveState===2?'0x20800':'0x70');
  if([3,6,13].includes(model)){
    if(leaveState===2)return bit(rawProfile.foot_exit_mask)&&script!==7;
    if(model===3)return flightState>=0||terrain===0;
    return bit(profileById(model===6?'buggy':'submarine-surface').mask);
  }
  if(model===8)return bit('0x04040008');if(model===100)return terrain===7;
  return null; // Unknown model default-success is not a supported profile.
}
