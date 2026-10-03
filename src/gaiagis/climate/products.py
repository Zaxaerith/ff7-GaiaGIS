# SPDX-License-Identifier: GPL-3.0-only
"""V2-only NetCDF, rasters and lineage-preserving vector products."""
import json
import numpy as np
from scipy.io import netcdf_file
from ..safety import output_path
from ..reconstruction import split_antimeridian
from .classification import CLASSES
UNITS={'monthly_temperature':'degree_Celsius','annual_temperature':'degree_Celsius','temperature_seasonality':'K',
       'monthly_precipitation':'mm','annual_precipitation':'mm year-1','monthly_pet':'mm','monthly_evaporation':'mm',
       'monthly_column_water':'kg m-2','monthly_insolation':'W m-2','annual_insolation':'W m-2','insolation_seasonality':'W m-2',
       'prevailing_wind_u':'m s-1','prevailing_wind_v':'m s-1','elevation':'m','coast_distance':'m','precipitation_deficit':'mm year-1','snow_season_months':'month'}
def netcdf(path,grid,fields,metadata):
    path=output_path(path)
    with netcdf_file(path,'w',version=2) as nc:
        nc.Conventions='CF-1.10';nc.title='Gaia V2 physically constrained reconstruction - Level A, GCM pending'
        nc.history=json.dumps(metadata,default=lambda value:value.item(),ensure_ascii=True)
        for name,size in [('time',12),('lat',grid.ny),('lon',grid.nx),('bounds',2)]:nc.createDimension(name,size)
        lat=nc.createVariable('lat','d',('lat',));lat[:]=grid.lat;lat.units='degrees_north';lat.standard_name='latitude';lat.bounds='lat_bounds'
        lon=nc.createVariable('lon','d',('lon',));lon[:]=grid.lon;lon.units='degrees_east';lon.standard_name='longitude';lon.bounds='lon_bounds'
        nc.createVariable('lat_bounds','d',('lat','bounds'))[:]=np.column_stack([grid.lat_edges[:-1],grid.lat_edges[1:]])
        nc.createVariable('lon_bounds','d',('lon','bounds'))[:]=np.column_stack([grid.lon_edges[:-1],grid.lon_edges[1:]])
        orbital_days=metadata.get('orbital_days',365.2422)
        time=nc.createVariable('time','d',('time',));time[:]=(np.arange(12)+.5)*orbital_days/12
        time.units='days since 0001-01-01';time.calendar='none';time.bounds='time_bounds';time.long_name='Twelve equal-duration model months, circular orbit'
        nc.createVariable('time_bounds','d',('time','bounds'))[:]=np.column_stack([np.arange(12),np.arange(1,13)])*orbital_days/12
        crs=nc.createVariable('gaia_crs','i',());crs[...]=0;crs.grid_mapping_name='latitude_longitude';crs.earth_radius=grid.radius;crs.longitude_of_prime_meridian=0.
        area=nc.createVariable('cell_area','d',('lat','lon'));area[:]=grid.area;area.units='m2';area.standard_name='cell_area'
        for name,data in fields.items():
            data=np.asarray(data);dims=('time','lat','lon') if data.ndim==3 else ('lat','lon')
            v=nc.createVariable(name,'i' if data.dtype.kind in 'biu' else 'f',dims);v[:]=data;v.units=UNITS.get(name,'1');v.grid_mapping='gaia_crs';v.cell_measures='area: cell_area'
            if name=='koppen_class':v.flag_values=np.arange(len(CLASSES),dtype=np.int32);v.flag_meanings=' '.join(CLASSES);v.long_name='Koppen-Geiger-like, Peel 2007 criteria with documented tie conventions'
            if name in ['snow_fraction','snow_season_months']:v.comment='Snow-bucket persistence on land component; zero on pure ocean; not sea ice or glacier dynamics'
        nc.flush()
def raster_products(directory,root,grid,fields):
    from osgeo import gdal
    wkt=(root/'crs/gaia_geographic.wkt').read_text(encoding='utf-8')
    mapping={'temperature_annual':'annual_temperature','precipitation_annual':'annual_precipitation','snow_fraction':'snow_fraction','aridity':'aridity_index','koppen':'koppen_class','elevation':'elevation','land_fraction':'land_fraction','coast_distance':'coast_distance'}
    driver=gdal.GetDriverByName('GTiff')
    for name,key in mapping.items():
        path=output_path(directory/f'{name}.tif');data=fields[key]
        ds=driver.Create(str(path),grid.nx,grid.ny,1,gdal.GDT_Int16 if key=='koppen_class' else gdal.GDT_Float32,options=['COMPRESS=DEFLATE','TILED=YES'])
        ds.SetGeoTransform((-180,360/grid.nx,0,90,0,-180/grid.ny));ds.SetProjection(wkt)
        ds.SetMetadata({'RECONSTRUCTION':'Physically constrained Level A; GCM pending','GRID_RESOLUTION_DEGREES':str(180/grid.ny),'SAMPLING':'cell average or diagnostic on climate grid, not triangle-scale climatology'})
        band=ds.GetRasterBand(1);band.WriteArray(data[::-1]);band.SetDescription(key);band.SetUnitType(UNITS.get(key,'1'));ds.FlushCache();ds=None
    ds=driver.Create(str(output_path(directory/'prevailing_wind.tif')),grid.nx,grid.ny,2,gdal.GDT_Float32,options=['COMPRESS=DEFLATE'])
    ds.SetGeoTransform((-180,360/grid.nx,0,90,0,-180/grid.ny));ds.SetProjection(wkt)
    for k,name in enumerate(['prevailing_wind_u','prevailing_wind_v'],1):band=ds.GetRasterBand(k);band.WriteArray(fields[name].mean(axis=0)[::-1]);band.SetDescription(name);band.SetUnitType('m s-1')
    ds.FlushCache();ds=None
def geopackage(path,root,source,mapping,grid,fields,scores):
    from osgeo import ogr,osr
    path=output_path(path);driver=ogr.GetDriverByName('GPKG')
    if path.exists():driver.DeleteDataSource(str(path)) # This exact V2 output only.
    ds=driver.CreateDataSource(str(path));srs=osr.SpatialReference();srs.ImportFromWkt((root/'crs/gaia_geographic.wkt').read_text(encoding='utf-8'))
    layer=ds.CreateLayer('gaia_climate_v2',srs,ogr.wkbPolygon25D)
    integers=['map_id','section_id','mesh_id','triangle_id','part_id','terrain_id','region_id','climate_row','climate_column']
    real=['game_east','game_north','game_height','v1_latitude','v2_latitude','latitude_delta','annual_temperature','annual_precipitation','aridity','snow_fraction','climate_match_score','climate_grid_degrees']
    strings=['koppen_class','geometry_origin','climate_model','sampling_method','source_vertex_indices','raw_game_corners_json','v1_corners_json','v2_corners_json']
    for name in integers+real+strings:layer.CreateField(ogr.FieldDefn(name,ogr.OFTInteger if name in integers else ogr.OFTReal if name in real else ogr.OFTString))
    layer.SetMetadata({'SCIENTIFIC_STATUS':'Level A provisional recommendation, GCM validation pending','CLIMATE_GRID':'best_fast_model.nc','CLIMATE_SAMPLING':'nearest containing 2.5-degree grid cell at raw triangle centroid; no triangle-scale precision claim'})
    centers=source['raw'].mean(axis=1);lon=source['geo'][:,:,0].mean(axis=1);lat=mapping(centers[:,1]/source['height']);j,i=grid.indices(lon,lat)
    definition=layer.GetLayerDefn();written=0;layer.StartTransaction()
    for index,corners in enumerate(source['geo']):
        geo=[(float(p[0]),float(mapping(raw[1]/source['height'])),float(p[2])) for p,raw in zip(corners,source['raw'][index],strict=True)]
        for part_id,part in enumerate(split_antimeridian(geo)):
            feature=ogr.Feature(definition)
            values=dict(zip(integers[:4],map(int,source['ids'][index,:4])))
            values.update(part_id=part_id,terrain_id=int(source['ids'][index,4]),region_id=int(source['ids'][index,5]),climate_row=int(j[index]),climate_column=int(i[index]),
                          game_east=float(centers[index,0]),game_north=float(centers[index,1]),game_height=float(centers[index,2]),
                          v1_latitude=float(np.rad2deg(np.arctan(np.sinh((.5-centers[index,1]/source['height'])*source['height']/source['width']*2*np.pi)))),
                          v2_latitude=float(lat[index]),climate_grid_degrees=180/grid.ny,koppen_class=CLASSES[int(fields['koppen_class'][j[index],i[index]])],
                          geometry_origin='FF7',climate_model='Level A; GCM pending',sampling_method='containing climate cell at raw centroid',
                          source_vertex_indices=json.dumps(source['refs'][index].tolist()),raw_game_corners_json=json.dumps(source['raw'][index].tolist()),
                          v1_corners_json=json.dumps(corners.tolist()),v2_corners_json=json.dumps(geo))
            values['latitude_delta']=values['v2_latitude']-values['v1_latitude']
            for name,key in [('annual_temperature','annual_temperature'),('annual_precipitation','annual_precipitation'),('aridity','aridity_index'),('snow_fraction','snow_fraction')]:values[name]=float(fields[key][j[index],i[index]])
            if np.isfinite(scores[index]):values['climate_match_score']=float(scores[index])
            for name,value in values.items():feature.SetField(name,value)
            ring=ogr.Geometry(ogr.wkbLinearRing)
            for p in [*part,part[0]]:ring.AddPoint(*p)
            polygon=ogr.Geometry(ogr.wkbPolygon);polygon.AddGeometry(ring);feature.SetGeometry(polygon)
            if layer.CreateFeature(feature)!=0:raise RuntimeError(f'GPKG write failed at source {index}')
            written+=1
            if written%5000==0:layer.CommitTransaction();layer.StartTransaction()
    layer.CommitTransaction();ds=None
    check=ogr.Open(str(path),0);count=check.GetLayer(0).GetFeatureCount();check=None
    if count!=written:raise RuntimeError('V2 GeoPackage readback count mismatch')
    return {'source_triangles':len(source['raw']),'export_parts':written,'climate_grid_degrees':180/grid.ny,'sampling':'nearest containing climate cell; original game centroid','synthetic_caps':'climate-grid ocean boundary only; vector layer retains FF7 triangles'}
