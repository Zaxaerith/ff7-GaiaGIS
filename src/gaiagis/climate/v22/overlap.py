# SPDX-License-Identifier: GPL-3.0-only
"""Read-only walkmesh inventory and three pointwise exposed-surface hypotheses.

Original triangles retain identity. Clipped fragments are diagnostic products.
Threshold 1e-6 raw square units rejects floating intersection edge noise;
height equality tolerance 1e-6 raw units; cliff-like gradient cutoff 4.
"""
from collections import Counter,defaultdict
from pathlib import Path
import numpy as np
import shapely
from shapely import Polygon,STRtree
from ..geography import load_source
from ..grid import Grid
from ..v21.rasterization import clip,triangle_moments,mappings
from .surface_raster import aggregate
from ...map_reader import parse_map
from ...safety import SOURCE_ROOT
from .common import ROOT,OUT,V21,target,write_json,write_csv,read
AREA_TOL=1e-6
HEIGHT_TOL=1e-6
CLASS_NAMES=['exact_duplicate','same_xy_different_height','bridge_like','tunnel_like','cliff_vertical_like','gameplay_alternate_hypothesis','unknown']

def labels(a,b,footprint_equal,delta,terrain,region,script,affine):
    result=[];same_height=np.max(abs(delta))<=HEIGHT_TOL
    if footprint_equal and same_height:result.append('exact_duplicate')
    if footprint_equal and not same_height:result.append('same_xy_different_height')
    if terrain[a] in (13,14) or terrain[b] in (13,14):result.append('bridge_like')
    if terrain[a]==15 or terrain[b]==15:result.append('tunnel_like')
    if terrain[a]==12 or terrain[b]==12 or max(np.linalg.norm(affine[a,:2]),np.linalg.norm(affine[b,:2]))>=4:result.append('cliff_vertical_like')
    if footprint_equal and (terrain[a]!=terrain[b] or region[a]!=region[b] or script[a]!=script[b]):result.append('gameplay_alternate_hypothesis')
    return result or ['unknown']

def polygon_parts(geometry):
    if geometry.is_empty:return []
    if geometry.geom_type=='Polygon':return [geometry]
    if geometry.geom_type in ('MultiPolygon','GeometryCollection'):
        return [p for child in geometry.geoms for p in polygon_parts(child)]
    return []

def winning_part(q,affine_a,affine_b,policy,index_a,index_b,terrain_a,terrain_b):
    """Part where B beats A; total ordering prevents double selection at ties."""
    if policy=='natural_priority':
        priority_a=int(terrain_a not in (13,14,15));priority_b=int(terrain_b not in (13,14,15))
        if priority_a!=priority_b:return q if priority_b>priority_a else Polygon()
    difference=affine_b-affine_a
    if policy=='lowest':difference=-difference
    points=np.asarray(q.exterior.coords)[:-1];value=points@difference[:2]+difference[2]
    if np.max(abs(value))<=HEIGHT_TOL:return q if index_b<index_a else Polygon()
    embedded=np.column_stack([points,value]);cut=clip(embedded,2,0,True)
    return Polygon(cut[:,:2]) if len(cut)>=3 else Polygon()

def select_surfaces(polys,affine,pairs,terrain,policy):
    removals=defaultdict(list)
    for a,b,q in pairs:
        for i,j in [(a,b),(b,a)]:
            part=winning_part(q,affine[i],affine[j],policy,i,j,terrain[i],terrain[j])
            if part.area>AREA_TOL:removals[i].append(part)
    selected={i:poly.difference(shapely.union_all(removals[i])) for i,poly in enumerate(polys) if i in removals}
    return selected

def inventory(source):
    raw=source['raw'];ids=source['ids'];scripts=[]
    path=SOURCE_ROOT/'ff7/workingdir/data/wm/wm0.map';wm=parse_map(path,0)
    if wm.failures:raise RuntimeError('Source MAP parse failure')
    entries=[(m,t) for m in wm.base_meshes for t in m.triangles]
    if len(entries)!=len(raw):raise ValueError('Base lineage count differs')
    for i,(m,t) in enumerate(entries):
        if tuple(ids[i,:4])!=(0,m.section_id,m.mesh_id,t.triangle_id) or not np.array_equal(raw[i],np.array([m.position(k) for k in t.indices])):raise ValueError('Original binary / frozen V1 lineage mismatch')
        scripts.append(t.script)
    scripts=np.array(scripts);mapping=mappings()[0];grid=Grid(2.5);_,affine=triangle_moments(raw,mapping,source['width'],source['height'],grid.radius)
    polys=np.array([Polygon(p[:,:2]) for p in raw],dtype=object);valid=np.array([p.area>AREA_TOL for p in polys]);indices=np.where(valid)[0];tree=STRtree(polys[valid]);pairs=[];rows=[];tags=defaultdict(set);counts=Counter();areas=Counter()
    for start in range(0,len(indices),5000):
        subset=indices[start:start+5000];hits=tree.query(polys[subset],predicate='intersects');a=subset[hits[0]];b=indices[hits[1]];keep=a<b;a=a[keep];b=b[keep]
        qs=shapely.intersection(polys[a],polys[b]);positive=shapely.area(qs)>AREA_TOL
        for ia,ib,q in zip(a[positive],b[positive],qs[positive]):
            ia=int(ia);ib=int(ib)
            for part in polygon_parts(q):
                if part.area<=AREA_TOL:continue
                points=np.asarray(part.exterior.coords)[:-1];delta=points@(affine[ia,:2]-affine[ib,:2])+affine[ia,2]-affine[ib,2]
                categories=labels(ia,ib,polys[ia].equals(polys[ib]),delta,ids[:,4],ids[:,5],scripts,affine)
                pairs.append((ia,ib,part));tags[ia].update(categories);tags[ib].update(categories)
                for label in categories:counts[label]+=1;areas[label]+=part.area
                row={'source_file':str(path),'a_index':ia,'b_index':ib,'xy_overlap_raw_area':part.area,'height_delta_min_raw':float(delta.min()),'height_delta_max_raw':float(delta.max()),'classes':';'.join(categories)}
                for prefix,index in [('a',ia),('b',ib)]:
                    for name,val in zip(['map_id','section','mesh','triangle','terrain','region'],ids[index]):row[prefix+'_'+name]=int(val)
                    row[prefix+'_script']=int(scripts[index])
                rows.append(row)
        print('Overlap inventory',start,len(pairs),flush=True)
    collapsed=np.where(~valid)[0]
    # Vertical/zero-XY records are explicit, distinct from positive-area pairs.
    write_csv(OUT/'overlap/overlap_classes.csv',rows)
    summary={'triangles':len(raw),'positive_overlap_pairs':len(pairs),'affected_triangles':len(tags),'zero_xy_area_triangles':len(collapsed),'multi_label_pair_counts':{name:counts[name] for name in CLASS_NAMES},'multi_label_pair_area_raw2':{name:areas[name] for name in CLASS_NAMES},'overlap_union_raw_area':float(shapely.union_all([q for _,_,q in pairs]).area),'positive_area_tolerance_raw2':AREA_TOL,'source_union_raw_area':float(shapely.union_all(polys[valid]).area),'rectangle_raw_area':source['width']*source['height'],'alternatives_63_68_included':False,'semantics':'Labels are hypotheses; engine actor selection is state/vehicle/history dependent, not globally highest/lowest.'}
    write_json(OUT/'overlap/inventory.json',summary)
    write_json(OUT/'overlap/semantic_audit.json',{'overlap_pairs':len(rows),'pairs_same_height_on_overlap':sum(max(abs(r['height_delta_min_raw']),abs(r['height_delta_max_raw']))<HEIGHT_TOL for r in rows),'pairs_crossing_height_planes':sum(r['height_delta_min_raw']<-HEIGHT_TOL and r['height_delta_max_raw']>HEIGHT_TOL for r in rows),'pairs_terrain_different':sum(r['a_terrain']!=r['b_terrain'] for r in rows),'pairs_region_different':sum(r['a_region']!=r['b_region'] for r in rows),'pairs_script_different':sum(r['a_script']!=r['b_script'] for r in rows),'pairs_different_mesh':sum((r['a_section'],r['a_mesh'])!=(r['b_section'],r['b_mesh']) for r in rows),'maximum_abs_height_separation_raw':max(max(abs(r['height_delta_min_raw']),abs(r['height_delta_max_raw'])) for r in rows)})
    return polys,affine,pairs,tags,collapsed,scripts,path

def fragment_source(source,polys,selected,affine):
    raw=[];ids=[];areas=[];original_indices=[]
    for i in range(len(polys)):
        if polys[i].area<=AREA_TOL:continue
        geometry=selected.get(i)
        if geometry is None:
            raw.append(source['raw'][i]);ids.append(source['ids'][i]);areas.append(source['area_v1'][i]);original_indices.append(i);continue
        pieces=shapely.constrained_delaunay_triangles(geometry)
        if abs(pieces.area-geometry.area)>max(AREA_TOL,geometry.area*1e-10):raise RuntimeError('Fragment triangulation area mismatch')
        for triangle in pieces.geoms:
            xy=np.asarray(triangle.exterior.coords)[:-1]
            if len(xy)!=3:raise RuntimeError('Non-triangular fragment')
            z=xy@affine[i,:2]+affine[i,2];raw.append(np.column_stack([xy,z]));ids.append(source['ids'][i]);areas.append(source['area_v1'][i]*triangle.area/polys[i].area);original_indices.append(i)
    return {**source,'raw':np.array(raw),'ids':np.array(ids),'area_v1':np.array(areas),'original_indices':np.array(original_indices)}

def run():
    source=load_source(ROOT);polys,affine,pairs,tags,collapsed,scripts,path=inventory(source)
    # Proposals are written only AFTER the actual overlap inventory.
    write_json(OUT/'overlap/policy_design.json',{'policies':['highest','lowest','natural_priority'],'basis':read(OUT/'overlap/inventory.json'),'natural_priority':'Prefer non-bridge/non-tunnel terrain, then highest; deterministic source-lineage tie break','status':'Sensitivity hypotheses, no canon or official Gaia input selection','height_unit':'raw game unit, not metres','mapping':'Existing V1 only, no latitude search'})
    grid=Grid(2.5);mapping=mappings()[0];reports=[];summaries=[];fields_by_policy={};union=read(OUT/'overlap/inventory.json')['source_union_raw_area'];ids=source['ids']
    for policy in ['highest','lowest','natural_priority']:
        selected=select_surfaces(polys,affine,pairs,ids[:,4],policy);visible_area=sum(selected.get(i,p).area for i,p in enumerate(polys) if p.area>AREA_TOL)
        if abs(visible_area-union)>max(AREA_TOL,union*1e-10):raise RuntimeError('Selected surfaces fail union area conservation')
        for i,poly in enumerate(polys):
            retained=selected.get(i,poly).area if poly.area>AREA_TOL else 0.;excluded=max(0,poly.area-retained)
            if i not in tags and poly.area>AREA_TOL:continue
            reports.append({'policy':policy,'source_file':str(path),'map_id':int(ids[i,0]),'section':int(ids[i,1]),'mesh':int(ids[i,2]),'triangle':int(ids[i,3]),'terrain':int(ids[i,4]),'region':int(ids[i,5]),'script':int(scripts[i]),'raw_xy_area':poly.area,'retained_raw_xy_area':retained,'excluded_raw_xy_area':excluded,'retained_fraction':retained/poly.area if poly.area else 0.,'classes':';'.join(sorted(tags[i])) if i in tags else 'cliff_vertical_like_zero_xy_area'})
        fragmented=fragment_source(source,polys,selected,affine);fields,audit=aggregate(fragmented,mapping,grid);fields_by_policy[policy]=fields
        np.savez_compressed(target(OUT/f'overlap/{policy}_raster.npz'),**fields);write_json(OUT/f'overlap/{policy}_audit.json',audit)
        summaries.append({'policy':policy,'selected_xy_area_raw2':float(visible_area),'source_union_xy_area_raw2':union,'union_conservation_relative_error':float(abs(visible_area-union)/union),'fragments':len(fragmented['raw']),'land_fraction_global':grid.mean(fields['land_fraction']),'mean_elevation_land_raw':float(np.sum(fields['mean_elevation_land_raw']*fields['land_fraction']*grid.area)/np.sum(fields['land_fraction']*grid.area)),'unknown_fraction_global':grid.mean(fields['unknown_fraction']),'maximum_cover_ratio':audit['maximum_net_cover_ratio'],'additive_relative_error':audit['maximum_additive_relative_error']})
        print('Surface policy',policy,summaries[-1],flush=True)
    write_csv(OUT/'overlap/surface_selection_report.csv',reports);write_csv(OUT/'overlap/policy_summary.csv',summaries)
    comparison=[];baseline=dict(np.load(V21/'rasterization/v1_baseline.npz'));fields_by_policy['v21_additive_normalized']=baseline
    for a,b in [('highest','lowest'),('highest','natural_priority'),('highest','v21_additive_normalized'),('lowest','v21_additive_normalized')]:
        fa=fields_by_policy[a];fb=fields_by_policy[b]
        for terrain in range(32):
            difference=fa['terrain_fraction'][terrain]-fb['terrain_fraction'][terrain]
            comparison.append({'policy_a':a,'policy_b':b,'terrain':terrain,'terrain_global_fraction_delta':grid.mean(difference),'terrain_local_max_abs_delta':float(abs(difference).max()),'land_global_fraction_delta':grid.mean(fa['land_fraction']-fb['land_fraction']),'land_local_max_abs_delta':float(abs(fa['land_fraction']-fb['land_fraction']).max()),'height_area_mean_global_delta_raw':grid.mean(fa['mean_elevation_raw']-fb['mean_elevation_raw']),'height_area_mean_local_max_abs_delta_raw':float(abs(fa['mean_elevation_raw']-fb['mean_elevation_raw']).max()),'height_conditional_land_local_max_abs_delta_raw':float(abs(fa['mean_elevation_land_raw']-fb['mean_elevation_land_raw']).max())})
    write_csv(OUT/'overlap/policy_comparison.csv',comparison)
    write_json(OUT/'overlap/lineage_scope.json',{'report_rows':'Every overlap-affected or zero-XY original triangle for each policy. Unaffected triangles are fully retained with original V1 lineage.','source_triangles_unmodified':True,'vector_output_unmodified':True,'selection_is_not_a_gameplay_collision_rule':True})
