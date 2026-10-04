// SPDX-License-Identifier: GPL-3.0-only
import {DoubleSide,MeshBasicMaterial} from 'three';
import {addVisibilityMask} from './visibility';
// Material policy is separate from datasets/analysis. A future texture material
// can be introduced here without changing source geometry or analysis colors.
export function createSurfaceMaterial(depth?:{value:number}){const material=new MeshBasicMaterial({vertexColors:true,side:DoubleSide,transparent:true,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});addVisibilityMask(material,depth);return material;}
