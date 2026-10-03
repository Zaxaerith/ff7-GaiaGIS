# SPDX-License-Identifier: GPL-3.0-only
import numpy as np
def objective(consistency,metrics,search):
    deviation=metrics['latitude_rms_delta_deg']/10
    stretch=metrics['stretch_log_rms']
    curvature=metrics['curvature_rms']/1000
    cap=max(0,metrics['cap_area_fraction']-.02)
    return 1-consistency+search['deviation_weight']*deviation+search['stretch_weight']*stretch+search['curvature_weight']*curvature+search['cap_weight']*cap
def shortlist(mappings,records,search):
    byname={m.name:m for m in mappings};chosen=['v1_baseline'];u=np.linspace(0,1,201)
    pool=[r for r in records if r['name']!='v1_baseline']
    def add(record):
        name=record['name']
        if name in chosen:return
        if min(np.sqrt(np.mean((byname[name](u)-byname[n](u))**2)) for n in chosen)<search['shortlist_min_rms_difference_deg']:return
        chosen.append(name)
    # Trade-offs, not just near-duplicate winners.
    orders=[sorted(pool,key=lambda r:r['objective']),sorted(pool,key=lambda r:-r['climate_consistency']),
            sorted(pool,key=lambda r:r['latitude_rms_delta_deg']),sorted(pool,key=lambda r:abs(r['north_boundary_deg']+r['south_boundary_deg'])),
            sorted(pool,key=lambda r:-abs(r['north_boundary_deg']+r['south_boundary_deg']))]
    for order in orders:
        for record in order:
            before=len(chosen);add(record)
            if len(chosen)>before:break
        if len(chosen)>=search['shortlist_count']:break
    for record in sorted(pool,key=lambda r:r['objective']):
        if len(chosen)>=search['shortlist_count']:break
        add(record)
    return [byname[n] for n in chosen]
def pareto(records):
    return [r['name'] for r in records if not any(s['climate_consistency']>=r['climate_consistency'] and s['latitude_rms_delta_deg']<=r['latitude_rms_delta_deg'] and (s['climate_consistency']>r['climate_consistency'] or s['latitude_rms_delta_deg']<r['latitude_rms_delta_deg']) for s in records)]
