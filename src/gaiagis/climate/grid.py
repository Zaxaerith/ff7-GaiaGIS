# SPDX-License-Identifier: GPL-3.0-only
import numpy as np
from scipy import sparse
from scipy.spatial import cKDTree
class Grid:
    def __init__(self,degrees=5.0,radius=6371008.8):
        self.ny=round(180/degrees);self.nx=2*self.ny;self.radius=radius
        self.lat_edges=np.linspace(-90,90,self.ny+1);self.lon_edges=np.linspace(-180,180,self.nx+1)
        self.lat=(self.lat_edges[:-1]+self.lat_edges[1:])/2;self.lon=(self.lon_edges[:-1]+self.lon_edges[1:])/2
        self.xe=np.sin(np.deg2rad(self.lat_edges));self.x=np.sin(np.deg2rad(self.lat));self.dx=np.diff(self.xe)
        self.dlambda=2*np.pi/self.nx
        self.area=np.broadcast_to((self.dx*radius**2*self.dlambda)[:,None],(self.ny,self.nx)).copy()
    def mean(self,field):return float(np.sum(field*self.area)/np.sum(self.area))
    def indices(self,longitude,latitude):
        return np.clip(np.searchsorted(self.lat_edges,latitude,side='right')-1,0,self.ny-1),np.clip(np.searchsorted(self.lon_edges,longitude,side='right')-1,0,self.nx-1)
    def diffusion(self,meridional,zonal):
        rows=[];cols=[];values=[]
        def edge(a,b,conductance,wa,wb):
            rows.extend([a,a,b,b]);cols.extend([a,b,b,a]);values.extend([-conductance/wa,conductance/wa,-conductance/wb,conductance/wb])
        for j in range(self.ny):
            for i in range(self.nx):
                a=j*self.nx+i;b=j*self.nx+(i+1)%self.nx
                edge(a,b,zonal/(1-self.x[j]**2)/self.dlambda**2,1,1)
                if j<self.ny-1:edge(a,a+self.nx,meridional*(1-self.xe[j+1]**2)/(self.x[j+1]-self.x[j]),self.dx[j],self.dx[j+1])
        return sparse.coo_matrix((values,(rows,cols)),shape=(self.nx*self.ny,)*2).tocsc()
    def coast_distance(self,land):
        phi,lam=np.meshgrid(np.deg2rad(self.lat),np.deg2rad(self.lon),indexing='ij')
        xyz=np.stack([np.cos(phi)*np.cos(lam),np.cos(phi)*np.sin(lam),np.sin(phi)],axis=-1).reshape(-1,3)
        ocean=land.ravel()<0.5
        if not ocean.any():return np.full_like(land,np.pi*self.radius)
        chord=cKDTree(xyz[ocean]).query(xyz)[0]
        return (2*self.radius*np.arcsin(np.clip(chord/2,0,1))).reshape(land.shape)
