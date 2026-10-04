// SPDX-License-Identifier: GPL-3.0-only
import type {ProjectionId} from './Projection';
import {projections} from './index';
import type {GaiaProjection} from './Projection';
export interface ProjectionDefinition {id:ProjectionId;translationKey:string;family:'perspective'|'cylindrical'|'pseudocylindrical'|'compromise'|'azimuthal';property:'perspective'|'conformal'|'equal-area'|'compromise'|'equidistant-center'|'equidistant-meridians';supportsRotation:boolean;clip:'none'|'poles'|'hemisphere'|'antipode';introduced:string;forward:GaiaProjection['project'];bounds:GaiaProjection['bounds'];}
const definitions:[ProjectionId,ProjectionDefinition['family'],ProjectionDefinition['property'],boolean,ProjectionDefinition['clip'],string][]=[
 ['globe','perspective','perspective',true,'none','3D view'],['equirectangular','cylindrical','equidistant-meridians',false,'none','Ancient'],['mercator','cylindrical','conformal',false,'poles','1569'],['mollweide','pseudocylindrical','equal-area',false,'none','1805'],['orthographic','azimuthal','perspective',true,'hemisphere','Ancient'],
 ['equal-earth','pseudocylindrical','equal-area',false,'none','2018'],['winkel-tripel','compromise','compromise',false,'none','1921'],['robinson','pseudocylindrical','compromise',false,'none','1963'],['natural-earth','pseudocylindrical','compromise',false,'none','2008 / polynomial 2011'],['sinusoidal','pseudocylindrical','equal-area',false,'none','Classical'],['gall-peters','cylindrical','equal-area',false,'none','1855 / 1973'],['laea','azimuthal','equal-area',true,'antipode','1772'],['aeqd','azimuthal','equidistant-center',true,'antipode','Classical']];
export const projectionRegistry=Object.fromEntries(definitions.map(([id,family,property,supportsRotation,clip,introduced])=>[id,{id,translationKey:`projection.${id}`,family,property,supportsRotation,clip,introduced,forward:projections[id].project,bounds:projections[id].bounds}])) as Record<ProjectionId,ProjectionDefinition>;
export const projectionIds=definitions.map(d=>d[0]);
export const rotatesCenter=(id:ProjectionId)=>id!=='globe'&&projectionRegistry[id].supportsRotation;
