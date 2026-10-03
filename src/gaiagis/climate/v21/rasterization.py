# SPDX-License-Identifier: GPL-3.0-only
"""Own raw-polygon clipping and spherical area quadrature, no first-hit owner.

True nonlinear latitude Jacobian integrated by eight-point Gauss quadrature
on horizontal polygon strips. Height affine within each FF7 triangle.
Projected overlap contributions are additive and explicitly audited before
physical fractions are locally normalized; no claim of a single-cover TIN.
"""
import hashlib,json
import numpy as np
from .common import OUT,ROOT,write_json,target,raster,digest
from ..geography import load_source,remap_raw
from ..latitude import LatitudeMapping
NODES,WEIGHTS=np.polynomial.legendre.leggauss(8)
def clip(poly,axis,bound,keep_above):
    if len(poly)==0:return poly
    result=[];previous=poly[-1];inside=(previous[axis]>=bound) if keep_above else (previous[axis]<=bound)
    for p in poly:
        now=(p[axis]>=bound) if keep_above else (p[axis]<=bound)
        if now!=inside:
            fraction=(bound-previous[axis])/(p[axis]-previous[axis]);result.append(previous+fraction*(p-previous))
        if now:result.append(p)
        previous=p;inside=now
    return np.array(result).reshape(-1,poly.shape[1])
def planar_area(poly):
    if len(poly)<3:return 0.
    return .5*abs(np.dot(poly[:,0],np.roll(poly[:,1],1))-np.dot(poly[:,1],np.roll(poly[:,0],1)))
def moments(poly,mapping,width,height,radius,affine=None):
    if len(poly)<3:return np.zeros(3)
    edges=np.r_[poly[:,1],mapping.u*height];edges=np.unique(edges[(edges>=poly[:,1].min())&(edges<=poly[:,1].max())])
    out=np.zeros(3)
    for bottom,top in zip(edges[:-1],edges[1:]):
        if top-bottom<1e-8:continue
        ys=(top+bottom)/2+NODES*(top-bottom)/2;cross=[]
        mid=(top+bottom)/2
        for a,b in zip(poly,np.roll(poly,-1,axis=0)):
            if min(a[1],b[1])<mid<max(a[1],b[1]):cross.append(a[0]+(ys-a[1])*(b[0]-a[0])/(b[1]-a[1]))
        if len(cross)<2:continue
        xs=np.array(cross);left=xs.min(axis=0);right=xs.max(axis=0);span=right-left
        lat=mapping(ys/height);jac=radius**2*(2*np.pi/width)*(-np.cos(np.deg2rad(lat))*np.pi/180*mapping.derivative(ys/height)/height)
        weights=WEIGHTS*(top-bottom)/2*jac*span;out[0]+=weights.sum()
        if affine is not None:
            ax,ay,bias=affine;mean=ax*(right+left)/2+ay*ys+bias
            out[1]+=np.sum(weights*mean);out[2]+=np.sum(weights*(mean**2+ax**2*span**2/12))
    return out
def triangle_moments(raw,mapping,width,height,radius):
    """Vectorized quadrature for full triangles; scalar path remains an oracle."""
    raw=np.asarray(raw,float);n=len(raw);order=np.argsort(raw[:,:,1],axis=1);p=np.take_along_axis(raw,order[:,:,None],axis=1)
    matrix=np.concatenate([raw[:,:,:2],np.ones((n,3,1))],axis=2);valid=np.abs(np.linalg.det(matrix))>1e-8
    affine=np.zeros((n,3));affine[valid]=np.linalg.solve(matrix[valid],raw[valid,:,2,None]).squeeze(-1)
    result=np.zeros((n,3))
    for a,b,lo,hi in [(p[:,0],p[:,1],p[:,0,1],p[:,1,1]),(p[:,1],p[:,2],p[:,1,1],p[:,2,1])]:
        ys=(lo+hi)[:,None]/2+(hi-lo)[:,None]/2*NODES
        def cross(v1,v2):
            dy=v2[:,1]-v1[:,1];slope=np.divide(v2[:,0]-v1[:,0],dy,out=np.zeros(n),where=dy!=0)
            return v1[:,0,None]+(ys-v1[:,1,None])*slope[:,None]
        x1=cross(p[:,0],p[:,2]);x2=cross(a,b);span=np.abs(x1-x2);mid=(x1+x2)/2
        phi=mapping(ys/height);jac=radius**2*2*np.pi/width*(-np.cos(np.deg2rad(phi))*np.pi/180*mapping.derivative(ys/height)/height)
        weight=WEIGHTS*(hi-lo)[:,None]/2*jac*span
        z=affine[:,0,None]*mid+affine[:,1,None]*ys+affine[:,2,None]
        result[:,0]+=weight.sum(axis=1);result[:,1]+=(weight*z).sum(axis=1);result[:,2]+=(weight*(z*z+affine[:,0,None]**2*span*span/12)).sum(axis=1)
    # PCHIP derivative changes polynomial at anchors; split those triangles
    # using the original scalar integration, never integrate across a kink.
    cross_anchor=np.any((mapping.u[None,:]*height>p[:,0,1,None])&(mapping.u[None,:]*height<p[:,2,1,None]),axis=1)
    for index in np.where(cross_anchor&valid)[0]:result[index]=moments(raw[index,:,:2],mapping,width,height,radius,affine[index])
    return result,affine
def aggregate(source,mapping,grid,ocean_ids=(3,6,26)):
    shape=(grid.ny,grid.nx);terrain_area=np.zeros((32,*shape));fixed_area=np.zeros_like(terrain_area)
    first=np.zeros(shape);second=np.zeros(shape);minimum=np.full(shape,np.inf);maximum=np.full(shape,-np.inf)
    polygon=np.zeros(32);collapsed=0;w=source['width'];h=source['height'];xedges=np.linspace(0,w,grid.nx+1)
    # Increasing game_north -> decreasing latitude. Reverse row index later.
    yedges=np.array([0 if phi>=mapping(0) else h if phi<=mapping(1) else mapping.inverse(phi)*h for phi in grid.lat_edges[::-1]])
    full,affines=triangle_moments(source['raw'],mapping,w,h,grid.radius)
    for index,corners in enumerate(source['raw']):
        poly=corners[:,:2];rawarea=planar_area(poly)
        if rawarea<1e-8:collapsed+=1;continue
        terrain=int(source['ids'][index,4]);land=terrain not in ocean_ids
        affine=affines[index] if land else None
        whole_area=full[index,0];polygon[terrain]+=whole_area
        ix0=max(0,np.searchsorted(xedges,poly[:,0].min(),side='right')-1);ix1=min(grid.nx,np.searchsorted(xedges,poly[:,0].max(),side='left')+1)
        iy0=max(0,np.searchsorted(yedges,poly[:,1].min(),side='right')-1);iy1=min(grid.ny,np.searchsorted(yedges,poly[:,1].max(),side='left')+1)
        for jj in range(iy0,iy1):
            if yedges[jj+1]<=yedges[jj]:continue
            strip=clip(clip(poly,1,yedges[jj],True),1,yedges[jj+1],False)
            for i in range(ix0,ix1):
                piece=clip(clip(strip,0,xedges[i],True),0,xedges[i+1],False)
                if len(piece)<3 or planar_area(piece)<1e-8:continue
                j=grid.ny-1-jj;area=whole_area if np.array_equal(piece,poly) else moments(piece,mapping,w,h,grid.radius)[0];terrain_area[terrain,j,i]+=area
                fixed_area[terrain,j,i]+=source['area_v1'][index]*planar_area(piece)/rawarea
                if land:
                    # Climate elevation uses max(raw height,0); retain negative
                    # raw height in source, never edit V1 geometry.
                    points=piece@affine[:2]+affine[2];minval=max(0,float(points.min()));maxval=max(0,float(points.max()))
                    positive=piece
                    if minval==0 and np.any(points<0):
                        # Clip arbitrary affine half-plane by embedding height.
                        p3=np.column_stack([piece,points]);positive=clip(p3,2,0,True)[:,:2] if len(p3) else piece
                    _,m1,m2=full[index] if np.array_equal(positive,poly) and np.all(corners[:,2]>=0) else moments(positive,mapping,w,h,grid.radius,affine)
                    first[j,i]+=m1;second[j,i]+=m2;minimum[j,i]=min(minimum[j,i],minval);maximum[j,i]=max(maximum[j,i],maxval)
        if index%25000==0:print('Area aggregation',mapping.name,index,flush=True)
    # Unmapped latitude is explicitly synthetic ocean, not an FF7 triangle.
    cap_area=grid.area*(1-np.maximum(0,np.minimum(grid.xe[1:],np.sin(np.deg2rad(mapping(0))))-np.maximum(grid.xe[:-1],np.sin(np.deg2rad(mapping(1)))))/grid.dx)[:,None]
    covered=terrain_area.sum(axis=0);expected=grid.area-cap_area
    missing=np.maximum(expected-covered,0);denominator=covered+cap_area+missing
    terrain=terrain_area/denominator;terrain[3]+=cap_area/denominator
    is_land=np.array([i not in ocean_ids for i in range(32)]);landarea=terrain_area[is_land].sum(axis=0);land=landarea/denominator
    mean=first/np.maximum(landarea,1);std=np.sqrt(np.maximum(second/np.maximum(landarea,1)-mean**2,0))
    minimum=np.where(np.isfinite(minimum),minimum,0);maximum=np.where(np.isfinite(maximum),maximum,0)
    fields={'land_fraction':land,'ocean_fraction':terrain[list(ocean_ids)].sum(axis=0),'unknown_fraction':missing/denominator,'mean_elevation_land_raw':mean,'mean_elevation_raw':land*mean,'min_elevation_raw':minimum,'max_elevation_raw':maximum,'elevation_std_land_raw':std,'terrain_fraction':terrain,'terrain_additive_area':terrain_area,'evidence_reference_area':fixed_area}
    raster_add=terrain_area.sum(axis=(1,2));error=np.max(abs(raster_add-polygon)/np.maximum(polygon,1))
    if error>1e-8:raise RuntimeError(f'Spherical polygon aggregation nonconservation {error}')
    physical=(terrain*grid.area).sum(axis=(1,2));physical[3]-=cap_area.sum()
    audit={'mapping':mapping.name,'source_triangles':len(source['raw']),'collapsed_horizontal_triangles':collapsed,'polygon_terrain_area_m2':polygon.tolist(),'raster_additive_terrain_area_m2':raster_add.tolist(),'physical_normalized_terrain_area_m2_excluding_caps':physical.tolist(),'maximum_additive_relative_error':float(error),
      'polygon_land_area_m2':float(polygon[is_land].sum()),'raster_additive_land_area_m2':float(raster_add[is_land].sum()),'raster_physical_land_area_m2':float(np.sum(land*grid.area)),
      'physical_land_relative_area_difference':float((np.sum(land*grid.area)-polygon[is_land].sum())/polygon[is_land].sum()),'maximum_net_cover_ratio':float(np.max(covered/np.maximum(expected,1))),
      'net_missing_area_m2':float(missing.sum()),'additive_excess_area_m2':float(np.maximum(covered-expected,0).sum()),'note':'Additive overlapping walkmesh polygon contributions conserve exactly. Locally normalized physical fractions are a separate area budget. Net coverage does not prove polygon union coverage; overlaps can hide holes. Elevation moments conditional on land; negative heights clipped only for climate.'}
    return fields,audit
def mappings():
    import json
    entries=json.loads((ROOT/'output/climate_v2/shortlist.json').read_text())['candidates'];names=['v1_baseline','candidate_052','candidate_056','candidate_017']
    return [LatitudeMapping(e['name'],e['latitude_anchors_deg'],e['aspect'],e['name']=='v1_baseline') for name in names for e in entries if e['name']==name]
def run_rasters(grid,rebuild=False):
    from .common import config
    source=load_source(ROOT);raw=dict(np.load(ROOT/'output/climate_v2/raw_boundary_samples.npz'));comparisons=[]
    for mapping in mappings():
        path=OUT/f'rasterization/{mapping.name}.npz';auditpath=OUT/f'rasterization/{mapping.name}_audit.json'
        signature=hashlib.sha256(json.dumps({'source':digest(ROOT/'output/gis/gaia_geographic.gpkg'),'code':digest(__file__),'mapping':mapping.document(),'grid':[grid.ny,grid.nx,grid.radius]},sort_keys=True).encode()).hexdigest()
        if path.exists() and not rebuild:
            old=json.loads(auditpath.read_text())
            if old.get('signature')!=signature:raise RuntimeError('V21 raster cache signature differs or is missing; explicitly run rasters --rebuild. Never silently mix grids/versions.')
            print('Read verified V21 raster',mapping.name,flush=True);continue
        fields,audit=aggregate(source,mapping,grid);legacyland,legacyheight,_=remap_raw(raw,mapping,grid,config())
        audit['signature']=signature;audit['grid']=[grid.ny,grid.nx,grid.radius]
        audit['legacy_comparison']={'legacy_land_fraction_global':grid.mean(legacyland),'areaweighted_land_fraction_global':grid.mean(fields['land_fraction']),'land_fraction_mean_abs_difference':grid.mean(abs(legacyland-fields['land_fraction'])),
          'elevation_area_mean_abs_difference_raw':grid.mean(abs(legacyheight-fields['mean_elevation_raw'])),'maximum_land_difference':float(abs(legacyland-fields['land_fraction']).max())}
        np.savez_compressed(target(path),**fields);write_json(auditpath,audit)
        d=OUT/f'rasterization/{mapping.name}'
        for key in ['land_fraction','ocean_fraction','unknown_fraction','mean_elevation_raw','min_elevation_raw','max_elevation_raw','elevation_std_land_raw']:raster(d/f'{key}.tif',grid,fields[key],unit='raw_game_unit' if 'elevation' in key else '1')
        if mapping.name=='v1_baseline':
            raster(OUT/'areaweighted_land_fraction.tif',grid,fields['land_fraction']);raster(OUT/'areaweighted_elevation.tif',grid,fields['mean_elevation_raw'],unit='raw_game_unit')
    return source
