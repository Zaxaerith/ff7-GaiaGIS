"""Hypothetical climate probes, not a geographic transform or canonical CRS."""
from collections import defaultdict
from .analysis import area_centroid
from .constants import OCEAN_TYPES

def probe_orientation(world):
    _,height=world.extent
    # C intentionally trades meridional shape fidelity for climate placement.
    # These anchors are hypotheses, not facts about Gaia's latitude.
    anchors=((0,80),(80000,60),(150000,20),(185000,0),(height,-35))
    def candidate_c(y):
        for (a,la),(b,lb) in zip(anchors,anchors[1:]):
            if y<=b: return la+(lb-la)*(y-a)/(b-a)
        return anchors[-1][1]
    candidates=[dict(id='A',north_direction='decreasing game_north',proposed_equator=height/2,
                     hypothesis='uniform full-range diagnostic',formula='90 - 180*n/H'),
                dict(id='B',north_direction='increasing game_north',proposed_equator=height/2,
                     hypothesis='reversed uniform control',formula='-90 + 180*n/H'),
                dict(id='C',north_direction='decreasing game_north',proposed_equator=185000,
                     hypothesis='asymmetric climate-oriented diagnostic with synthetic caps deferred',
                     anchors=anchors)]
    samples=defaultdict(list)
    for mesh in world.base_meshes:
        for triangle in mesh.triangles:
            area,centroid=area_centroid([mesh.position(i) for i in triangle.indices])
            if not area: continue
            labels=[]
            if triangle.ff7_terrain_type in (7,8,10,25,27): labels.append(f'terrain_{triangle.ff7_terrain_type}')
            if triangle.region in (5,11,12,14,16): labels.append(f'region_{triangle.region}')
            if triangle.ff7_terrain_type not in OCEAN_TYPES: labels.append('non_ocean_all')
            for label in labels: samples[label].append((centroid[1],area))
    functions=(lambda y:90-180*y/height,lambda y:-90+180*y/height,candidate_c)
    for candidate,fn in zip(candidates,functions):
        candidate['evidence']={}
        for label,values in samples.items():
            total=sum(w for y,w in values)
            latitudes=[(fn(y),w) for y,w in values]
            candidate['evidence'][label]=dict(mean_hypothetical_latitude=sum(v*w for v,w in latitudes)/total,
                fraction_abs_lat_ge50=sum(w for v,w in latitudes if abs(v)>=50)/total,
                fraction_abs_lat_gt30=sum(w for v,w in latitudes if abs(v)>30)/total)
    return dict(status='Reconstructed research candidates only; no latitude layer, CRS, globe or caps generated',
                units='Hypothetical degrees used only to compare candidates',
                climate_thresholds='50 and 30 degrees are heuristic diagnostics, not FF7 canon',candidates=candidates)
