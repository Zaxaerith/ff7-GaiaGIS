# SPDX-License-Identifier: GPL-3.0-only
"""One global monotone latitude function; longitude is unchanged from V1."""
import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.optimize import brentq
def v1_latitude(u,aspect):return np.rad2deg(np.arctan(np.sinh((.5-np.asarray(u))*aspect*2*np.pi)))
def v1_derivative(u,aspect):return -360*aspect/np.cosh((.5-np.asarray(u))*aspect*2*np.pi)
class LatitudeMapping:
    def __init__(self,name,anchors,aspect,baseline=False):
        self.name=name;self.anchors=np.array(anchors,dtype=float);self.aspect=aspect;self.baseline=baseline
        self.u=np.linspace(0,1,len(anchors))
        if not np.all(np.diff(self.anchors)<0):raise ValueError('Latitude anchors must strictly decrease as raw game_north increases')
        if not -90<self.anchors[-1]<self.anchors[0]<90:raise ValueError('Source boundaries must exclude poles')
        self.curve=PchipInterpolator(self.u,self.anchors,extrapolate=False)
    def __call__(self,u):return v1_latitude(u,self.aspect) if self.baseline else self.curve(u)
    def derivative(self,u):return v1_derivative(u,self.aspect) if self.baseline else self.curve.derivative()(u)
    def inverse(self,latitude):
        if not self(1)<=latitude<=self(0):raise ValueError('Latitude is in synthetic ocean caps, outside FF7 interval')
        return brentq(lambda u:float(self(u))-latitude,0,1,xtol=1e-13)
    def metrics(self):
        u=np.linspace(0,1,4097);base=v1_latitude(u,self.aspect);lat=self(u);ratio=self.derivative(u)/v1_derivative(u,self.aspect)
        curvature=np.gradient(self.derivative(u),u)
        # Analytic quadratic derivative extrema within each cubic segment.
        extrema=list(self.u)
        for index in range(len(self.u)-1):
            a,b=self.curve.c[0,index],self.curve.c[1,index]
            if a!=0:
                t=-b/(3*a)
                if 0<t<self.u[index+1]-self.u[index]:extrema.append(self.u[index]+t)
        min_slope=float(np.min(-self.derivative(np.array(extrema))))
        return {'latitude_rms_delta_deg':float(np.sqrt(np.mean((lat-base)**2))),'latitude_max_delta_deg':float(np.max(np.abs(lat-base))),
                'stretch_ratio_min':float(ratio.min()),'stretch_ratio_max':float(ratio.max()),'stretch_log_rms':float(np.sqrt(np.mean(np.log(ratio)**2))) if min_slope>0 else float('inf'),
                'curvature_rms':float(np.sqrt(np.mean(curvature**2))),'curvature_max':float(np.max(np.abs(curvature))),
                'minimum_normalized_derivative':min_slope,'cap_area_fraction':float(1-(np.sin(np.deg2rad(self(0)))-np.sin(np.deg2rad(self(1))))/2),
                'north_boundary_deg':float(self(0)),'south_boundary_deg':float(self(1))}
    def validate(self,search):
        m=self.metrics()
        if m['minimum_normalized_derivative']<=0 or m['stretch_ratio_min']<search['min_stretch_ratio'] or m['stretch_ratio_max']>search['max_stretch_ratio']:raise ValueError('Derivative compression/expansion bounds exceeded')
        if not self.baseline and m['curvature_max']>search['max_curvature_per_normalized_n']:raise ValueError('Curvature bound exceeded')
        for boundary in [abs(m['north_boundary_deg']),abs(m['south_boundary_deg'])]:
            if not search['boundary_min_abs_deg']<=boundary<=search['boundary_max_abs_deg']:raise ValueError('Boundary latitude outside allowed range')
        return m
    def document(self):return {'name':self.name,'method':'inverse_mercator_v1' if self.baseline else 'strictly_decreasing_PCHIP','u':self.u.tolist(),'latitude_anchors_deg':self.anchors.tolist(),'aspect':self.aspect,'longitude':'unchanged V1','metrics':self.metrics()}
def candidates(aspect,config):
    s=config['search'];rng=np.random.default_rng(s['seed']);u=np.linspace(0,1,s['control_count']);base=v1_latitude(u,aspect)
    accepted=[LatitudeMapping('v1_baseline',base,aspect,True)];proposals=[]
    for attempt in range(s['candidate_count']*200):
        if len(accepted)>=s['candidate_count']:break
        lat=base+rng.normal(0,s['anchor_perturbation_deg'],len(base))
        lat[0]=rng.uniform(s['boundary_min_abs_deg'],s['boundary_max_abs_deg']);lat[-1]=-rng.uniform(s['boundary_min_abs_deg'],s['boundary_max_abs_deg'])
        record={'proposal':attempt,'anchors':lat.tolist()}
        try:
            mapping=LatitudeMapping(f'candidate_{len(accepted):03d}',lat,aspect);mapping.validate(s);accepted.append(mapping);record['accepted_as']=mapping.name
        except ValueError as e:record['rejection']=str(e)
        proposals.append(record)
    if len(accepted)!=s['candidate_count']:raise RuntimeError('Could not generate requested valid candidate count')
    return accepted,proposals
