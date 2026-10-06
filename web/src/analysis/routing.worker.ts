// SPDX-License-Identifier: GPL-3.0-only
import {parseRouting,connectedComponents,findRoute} from '../data/routing';
import type {RoutingData,Endpoint} from '../data/routing';
import {serviceArea,serviceProfiles} from './serviceArea';
let graph:RoutingData;const cache=new Map<string,ReturnType<typeof connectedComponents>>();
self.onmessage=({data})=>{const {request,kind}=data;try{if(kind==='init'){graph=parseRouting(data.buffer);cache.clear();self.postMessage({request,result:true});return;}if(kind==='service'&&!serviceProfiles.includes(data.mode))throw Error('Unsupported WM0 service profile');const key=`${data.mode}:${data.conditional}`;let components=cache.get(key);if(!components){components=connectedComponents(graph,data.mode,data.conditional);cache.set(key,components);}const result=kind==='service'?serviceArea(graph,components.labels,data.starts,data.threshold):kind==='components'?components:findRoute(graph,components.labels,data.starts as Endpoint[],data.targets as Endpoint[]);self.postMessage({request,result});}catch(error){self.postMessage({request,error:String(error)});}};
