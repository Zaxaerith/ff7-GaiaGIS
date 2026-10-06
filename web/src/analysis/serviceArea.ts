// SPDX-License-Identifier: GPL-3.0-only
import type {RoutingData,Endpoint} from '../data/routing';
export const serviceProfiles=['foot','buggy','tiny-bronco','chocobo-yellow','chocobo-green','chocobo-blue','chocobo-black','chocobo-gold'];
class Queue {a:[number,number][]=[];push(v:[number,number]){let i=this.a.length;this.a.push(v);while(i){const p=(i-1)>>1;if(this.a[p][0]<v[0]||this.a[p][0]===v[0]&&this.a[p][1]<=v[1])break;this.a[i]=this.a[p];i=p;}this.a[i]=v;}pop(){const v=this.a[0],last=this.a.pop()!;if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1][0]<this.a[c][0])c++;if(last[0]<=this.a[c][0])break;this.a[i]=this.a[c];i=c;}this.a[i]=last;}return v;}}
/** Existing eligibility labels and edge weights; no new graph, time model or raster. */
export function serviceArea(g:RoutingData,labels:Int32Array,starts:Endpoint[],threshold:number){
 if(!Number.isFinite(threshold)||threshold<0||threshold>40_000_000||labels.length!==g.count)throw Error('Invalid service threshold');const begin=performance.now(),cost=new Float64Array(g.count).fill(Infinity),flags=new Uint8Array(g.count),q=new Queue();let visited=0,components=new Set<number>();
 for(const s of starts){if(!Number.isInteger(s.node)||s.node<0||s.node>=g.count||labels[s.node]<0)continue;if(cost[s.node]!==0){cost[s.node]=0;q.push([0,s.node]);}}
 while(q.a.length){const [d,a]=q.pop();if(d!==cost[a])continue;if(d>threshold)break;flags[a]=1;visited++;components.add(labels[a]);for(let i=g.offsets[a];i<g.offsets[a+1];i++){const b=g.neighbors[i],next=d+g.weights[i];if(labels[b]>=0&&next<=threshold&&next<cost[b]){cost[b]=next;q.push([next,b]);}}}
 return {flags,visited,components:components.size,threshold,elapsedMs:performance.now()-begin};
}
