// SPDX-License-Identifier: GPL-3.0-only
import {resolveBinding} from '../data/atlas';
import type {AtlasContent} from '../data/atlas';
import type {PoiDataset} from '../data/poi';
import {entranceEndpoints} from '../data/routing';
import type {RoutingData} from '../data/routing';
import type {JourneyReason,JourneyStation} from './journey';

/** Resolve stable identities only. A parent's route context never promotes a
 * reward's precision or supplies a Field reward coordinate. */
export function resolveJourneyStation(id:string,target:JourneyStation['target'],parentConfirmed:boolean,poi:PoiDataset|null,content:AtlasContent,graph:RoutingData|null):JourneyStation {
 const station:JourneyStation={id,target:{...target},locationId:null,precision:'unresolved',reason:null,endpoints:[]};
 const reject=(reason:JourneyReason)=>({...station,reason,endpoints:[]});
 let locationId:string|null=null;
 if(target.kind==='atlas'){
  const entity=content.entities.find(entity=>entity.id===target.id);if(!entity)return reject('unverified_entrance');
  const request=entity.spatialBinding;
  if(request.kind==='field_identity'){station.precision='field_only';return reject('field_only');}
  if(request.kind==='field_parent'){
   station.precision='field_only';if(!parentConfirmed)return reject('field_only');
  }else if(request.kind==='parent_location')station.precision='parent_place';
  else if(request.kind!=='location')return reject('unverified_entrance');
  locationId=request.locationId??null;
  if(!poi)return reject('workspace_missing');
  try{const binding=resolveBinding(entity,poi);if(binding.locationId!==locationId||!['entrance_level','parent_place','field_only'].includes(binding.precision))return reject('unverified_entrance');station.precision=binding.precision as JourneyStation['precision'];}
  catch{return reject('unverified_entrance');}
 }else{
  if(!poi)return reject('workspace_missing');
  if(target.kind==='location')locationId=target.id;
  else if(target.kind==='entrance')locationId=poi.entrances.find(entrance=>entrance.id===target.id)?.location_id??null;
  else return reject('invalid_plan');
  station.precision='entrance_level';
 }
 const location=poi?.locations.find(location=>location.id===locationId);
 if(!location)return reject('unverified_entrance');
 station.locationId=location.id;
 const entrances=poi!.entrances.filter(entrance=>entrance.location_id===location.id);
 // Preserve all entrance/scenario identities and all trigger records. In
 // particular, never replace this set by the primary marker's triangle.
 if(!entrances.length||entrances.length!==location.entrance_ids.length||entrances.some(entrance=>!location.entrance_ids.includes(entrance.id)||entrance.world_map!==0||entrance.source_kind!=='derived_from_entry_trigger'||!entrance.trigger_triangle_ids.length))return reject('unverified_entrance');
 if(!graph)return reject('routing_missing');
 const source=poi!.sources['wm0.map'];
 if(!source||!/^[a-f0-9]{64}$/i.test(source)||source.toLowerCase()!==graph.sourceHash.toLowerCase())return reject('source_stale');
 for(const entrance of entrances)for(const triangle of entrance.trigger_triangle_ids){
  const node=graph.lineage.get(`${entrance.section_id}/${entrance.mesh_id}/${triangle}`);
  if(node===undefined||!Number.isInteger(node)||node<0||node>=graph.count)return reject('unverified_entrance');
 }
 station.endpoints=entranceEndpoints(graph,entrances);
 return station;
}
