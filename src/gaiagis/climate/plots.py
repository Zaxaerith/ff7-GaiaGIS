# SPDX-License-Identifier: GPL-3.0-only
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
def figures(output,source,mapping,grid,fields,records):
    output.mkdir(parents=True,exist_ok=True)
    plt.rcParams.update({'font.family':'DejaVu Sans','figure.dpi':140,'axes.titlesize':10,'font.size':9})
    fig,axes=plt.subplots(2,1,figsize=(12,9),layout='constrained')
    palette={3:'#366b93',26:'#366b93',6:'#4e8faa',0:'#80a968',1:'#376a47',2:'#99836f',8:'#d9c084',10:'#e4eaeb',7:'#678e7b',25:'#376a47'}
    colors=[palette.get(int(t),'#9b927d') for t in source['ids'][:,4]]
    for ax,name in zip(axes,['V1 - geometric inverse Mercator','V2 - Level A provisional climate reconstruction']):
        points=source['geo'][:,:,:2].copy()
        if name.startswith('V2'):points[:,:,1]=mapping(source['raw'][:,:,1]/source['height'])
        ax.add_collection(PolyCollection(points,facecolors=colors,edgecolors='none',rasterized=True));ax.set_facecolor('#366b93')
        ax.set(xlim=(-180,180),ylim=(-90,90),title=name,xlabel='Longitude (unchanged from V1)',ylabel='Latitude')
        ax.set_xticks(np.arange(-180,181,60));ax.set_yticks(np.arange(-90,91,30));ax.grid(alpha=.25)
    fig.savefig(output/'v1-v2-terrain.png');plt.close(fig)
    fig,axes=plt.subplots(3,2,figsize=(12,11),layout='constrained')
    for ax,(key,title,cmap) in zip(axes.flat,[('annual_temperature','Annual temperature (C)','coolwarm'),('annual_precipitation','Annual precipitation (mm)','YlGnBu'),('aridity_index','P / potential evaporation','BrBG'),('snow_fraction','Land snow persistence (month fraction)','Blues'),('koppen_class','Koppen-Geiger-like codes (see metadata)','tab20'),('land_fraction','Fractional land boundary','terrain')]):
        data=fields[key];image=ax.pcolormesh(grid.lon_edges,grid.lat_edges,data,cmap=cmap,shading='flat',vmax=3 if key=='aridity_index' else None)
        ax.set(xlim=(-180,180),ylim=(-90,90),title=title);fig.colorbar(image,ax=ax,shrink=.7);ax.set_xticks(np.arange(-180,181,90));ax.set_yticks([-60,0,60])
    fig.suptitle('Gaia V2 - fast model diagnostics, GCM validation pending');fig.savefig(output/'climate-fields.png');plt.close(fig)
    fig,axes=plt.subplots(1,2,figsize=(12,4.5),layout='constrained')
    u=np.linspace(0,1,600);from .latitude import v1_latitude
    axes[0].plot(u,v1_latitude(u,mapping.aspect),label='V1 geometric',color='#84909a');axes[0].plot(u,mapping(u),label=mapping.name,color='#267863');axes[0].set(xlabel='Normalized game_north',ylabel='Latitude (deg)',title='Global strictly monotone latitude mapping');axes[0].legend();axes[0].grid(alpha=.2)
    axes[1].scatter([r['latitude_rms_delta_deg'] for r in records],[r['climate_consistency'] for r in records],c=[r['objective'] for r in records],cmap='viridis_r',s=25)
    axes[1].set(xlabel='RMS departure from V1 (deg)',ylabel='Soft environmental consistency',title='Geometry / climate trade-off (Level A only)');axes[1].grid(alpha=.2)
    fig.savefig(output/'latitude-pareto.png');plt.close(fig)
