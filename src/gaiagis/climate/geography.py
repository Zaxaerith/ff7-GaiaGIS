# SPDX-License-Identifier: GPL-3.0-only
"""Reuse immutable V1 canonical corners; raw point raster + conservative remap."""
from contextlib import closing
from pathlib import Path
import json,sqlite3
import numpy as np
def load_source(root):
    build=json.loads((root/'output/reconstruction/build_metadata.json').read_text(encoding='utf-8'))
    path=root/'output/gis/gaia_geographic.gpkg'
    with closing(sqlite3.connect(path.as_uri()+'?mode=ro&immutable=1',uri=True)) as db:
        rows=list(db.execute('SELECT map_id,section_id,mesh_id,triangle_id,terrain_id,region_id,raw_game_corners_json,geographic_corners_json,source_vertex_indices FROM gaia_ff7_surface WHERE part_id=0 ORDER BY section_id,mesh_id,triangle_id'))
    raw=np.array([json.loads(r[6]) for r in rows]);geo=np.array([json.loads(r[7]) for r in rows])
    ids=np.array([r[:6] for r in rows],dtype=np.int32);refs=np.array([json.loads(r[8]) for r in rows],dtype=np.int32)
    lam=np.deg2rad(geo[:,:,0]);phi=np.deg2rad(geo[:,:,1]);xyz=np.stack([np.cos(phi)*np.cos(lam),np.cos(phi)*np.sin(lam),np.sin(phi)],axis=2)*build['config']['radius_m']
    area=.5*np.linalg.norm(np.cross(xyz[:,1]-xyz[:,0],xyz[:,2]-xyz[:,0]),axis=1)
    if len(raw)!=build['source_triangles']:raise ValueError('V1 source count mismatch')
    return {'raw':raw,'geo':geo,'ids':ids,'refs':refs,'area_v1':area,'width':build['width_raw'],'height':build['height_raw'],'build':build}
def rasterize_raw(source,config):
    s=config['geometry'];nx,ny=s['raw_sample_columns'],s['raw_sample_rows'];w,h=source['width'],source['height']
    terrain=np.full((ny,nx),-1,dtype=np.int16);height=np.zeros((ny,nx));owner=np.full((ny,nx),-1,dtype=np.int32)
    step_x,step_y=w/nx,h/ny;overlaps=0;collapsed=0
    for index,corners in enumerate(source['raw']):
        a,b,c=corners[:,:2];den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(den)<1e-12:collapsed+=1;continue
        x0=max(0,int(np.ceil(corners[:,0].min()/step_x-.5)));x1=min(nx,int(np.floor(corners[:,0].max()/step_x-.5))+1)
        y0=max(0,int(np.ceil(corners[:,1].min()/step_y-.5)));y1=min(ny,int(np.floor(corners[:,1].max()/step_y-.5))+1)
        if x0>=x1 or y0>=y1:continue
        x,y=np.meshgrid((np.arange(x0,x1)+.5)*step_x,(np.arange(y0,y1)+.5)*step_y)
        l1=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den
        l2=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den;l3=1-l1-l2
        inside=(l1>=-1e-10)&(l2>=-1e-10)&(l3>=-1e-10)
        target=owner[y0:y1,x0:x1];overlaps+=int(np.count_nonzero(inside&(target>=0)))
        assign=inside&(target<0);target[assign]=index
        terrain[y0:y1,x0:x1][assign]=source['ids'][index,4]
        height[y0:y1,x0:x1][assign]=(l1*corners[0,2]+l2*corners[1,2]+l3*corners[2,2])[assign]
    unknown=terrain<0;fraction=float(unknown.mean())
    if fraction>s['maximum_unknown_fraction']:raise RuntimeError(f'Raw raster uncovered fraction {fraction} exceeds explicit limit')
    land=(~np.isin(terrain,s['ocean_terrain_ids'])).astype(float);land[unknown]=s['unknown_land_fraction']
    # Ocean datum is a climate boundary assumption, never a V1 edit.
    elevation=np.maximum(height,0)*land;elevation[unknown]=0
    return {'land':land,'height_raw':elevation,'terrain':terrain,'unknown':unknown.astype(float)}, {'samples':nx*ny,'uncovered_fraction':fraction,'overlap_hits':overlaps,'collapsed_source_triangles':collapsed,'assignment':'first canonical triangle at point; overlaps recorded; unknown land=0.5 explicitly'}
def overlap_matrix(source_edges,target_edges):
    return np.maximum(0,np.minimum(target_edges[1:,None],source_edges[None,1:])-np.maximum(target_edges[:-1,None],source_edges[None,:-1]))
def remap_raw(raw,mapping,grid,config):
    ny,nx=raw['land'].shape
    # Reverse raw rows: increasing raw north means decreasing reconstructed latitude.
    sy=np.sin(np.deg2rad(mapping(np.linspace(1,0,ny+1))))
    sx=np.linspace(-np.pi,np.pi,nx+1)
    wy=overlap_matrix(sy,grid.xe)
    wx=sum(overlap_matrix(sx+shift,np.deg2rad(grid.lon_edges)) for shift in [-2*np.pi,0,2*np.pi])
    denominator=grid.dx[:,None]*grid.dlambda
    fields={key:(wy@values[::-1]@wx.T)/denominator for key,values in raw.items() if key in ['land','height_raw','unknown']}
    land=fields['land'];height=fields['height_raw']*config['geometry']['vertical_scale_m_per_raw_unit']
    source_land_area=float(np.sum(raw['land'][::-1]*np.diff(sy)[:,None])*2*np.pi/nx*grid.radius**2)
    error=abs(np.sum(land*grid.area)-source_land_area)/max(source_land_area,1)
    if error>1e-11:raise RuntimeError(f'Conservative land-area remap failed: {error}')
    return land,height,{'land_area_m2':source_land_area,'relative_remap_land_area_error':float(error),'maximum_unknown_grid_fraction':float(fields['unknown'].max()),'caps':'zero land/elevation outside actual source boundary latitudes'}
