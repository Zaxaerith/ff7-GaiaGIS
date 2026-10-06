// SPDX-License-Identifier: GPL-3.0-only
import type {ExplorerModel} from '../data/explorer';
/** Reviewed own-field-loader bindings; not a bone-count or third-clip heuristic. */
export const ownLocomotion={
 barret:{hrc:'acgd.hrc',clips:['adcb.a','adcc.a','adcd.a'],bones:21},
 aerith:{hrc:'auff.hrc',clips:['avbf.a','avca.a','avcb.a'],bones:23},
 'red-xiii':{hrc:'adda.hrc',clips:['aeae.a','aeaf.a','aeba.a'],bones:29},
 yuffie:{hrc:'abjb.hrc',clips:['acfb.a','acfc.a','acfd.a'],bones:24},
 'cait-sith':{hrc:'aebc.hrc',clips:['aeha.a','aehb.a','aehc.a'],bones:28},
 vincent:{hrc:'aehd.hrc',clips:['afdf.a','afea.a','afeb.a'],bones:25},
} as const;
export function locomotion(model:ExplorerModel,moving:boolean,fast=false){
 if(!moving)return {clip:0,rate:1,kind:'idle'};
 const binding=ownLocomotion[model.id as keyof typeof ownLocomotion];
 if(binding&&model.sourceKind==='extended_field'&&model.hrc===binding.hrc&&model.bone_count===binding.bones&&binding.clips.every((n,i)=>model.clips[i]?.name===n))return {clip:2,rate:model.clips[2].frame_count/15*(fast?2:1),kind:'own_source_run_preview'};
 return {clip:model.animation_identity==='stationary_0_moving_1'?1:0,rate:fast&&['cloud','tifa','cid'].includes(model.id)?2:1,kind:'existing_binding'};
}
