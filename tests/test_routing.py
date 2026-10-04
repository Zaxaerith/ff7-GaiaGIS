# SPDX-License-Identifier: GPL-3.0-only
from pathlib import Path
from types import SimpleNamespace as N
import hashlib,math,struct,sys,unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from gaiagis.routing import build_graph,serialize_graph,components,route_state,ROUTE_PROFILES,distance,sphere_area
from gaiagis.reconstruction import Mapping,SphereConfig

def mesh(points,faces,section=0,mid=0,terrain=0):
    triangles=[N(indices=f,triangle_id=i,ff7_terrain_type=terrain,script=0) for i,f in enumerate(faces)]
    return N(section_id=section,mesh_id=mid,triangles=triangles,position=lambda i:points[i])
def world(*meshes,failures=()):return N(map_id=0,failures=failures,extent=(100,100),base_meshes=list(meshes))
def square():return mesh([(10,10,0),(20,10,0),(20,20,0),(10,20,0)],[(0,1,2),(0,2,3)])

class RoutingTests(unittest.TestCase):
    def test_exact_edge_connects_and_distance_uses_v1_raw_centroid(self):
        nodes,adj,stats=build_graph(world(square()));self.assertEqual(stats['edges'],1)
        mapping=Mapping(100,100,SphereConfig())
        p=mapping.game_to_geographic(50/3,40/3,0)[:2]
        self.assertEqual(nodes[0]['center'],p)
        self.assertEqual(adj[0][1],distance(nodes[0]['center'],nodes[1]['center']))
    def test_shared_vertex_alone_does_not_connect(self):
        m=mesh([(10,10,0),(20,10,0),(20,20,0),(30,30,0),(40,30,0)],[(0,1,2),(2,3,4)])
        self.assertEqual(build_graph(world(m))[2]['edges'],0)
    def test_stacked_heights_remain_separate(self):
        a=square();b=mesh([(10,10,1),(20,10,1),(20,20,1)],[(0,1,2)],mid=1)
        nodes,adj,_=build_graph(world(a,b));self.assertEqual(adj[2],{})
    def test_east_west_edges_wrap_exactly(self):
        a=mesh([(0,20,7),(0,40,7),(10,30,7)],[(0,1,2)])
        b=mesh([(100,20,7),(100,40,7),(90,30,7)],[(0,1,2)],mid=1)
        nodes,adj,stats=build_graph(world(a,b));self.assertEqual(stats['seam_edges'],1);self.assertIn(1,adj[0])
    def test_north_south_cut_is_preserved(self):
        a=mesh([(20,0,0),(40,0,0),(30,10,0)],[(0,1,2)])
        b=mesh([(20,100,0),(40,100,0),(30,90,0)],[(0,1,2)],mid=1)
        self.assertEqual(build_graph(world(a,b))[2]['edges'],0)
    def test_nearly_shared_edges_do_not_connect(self):
        a=square();b=mesh([(10.001,10,0),(20,20,0),(30,10,0)],[(0,1,2)],mid=1)
        self.assertEqual(build_graph(world(a,b))[1][2],{})
    def test_duplicate_faces_excluded_without_repair(self):
        a=square();a.triangles.append(N(indices=(2,1,0),triangle_id=2,ff7_terrain_type=0,script=0))
        nodes,adj,s=build_graph(world(a));self.assertEqual(s['duplicate_faces'],2);self.assertTrue(all(not row for row in adj))
    def test_nonmanifold_shared_edge_excluded(self):
        a=mesh([(10,10,0),(20,20,0),(20,10,0),(10,20,0),(15,30,0)],[(0,1,2),(1,0,3),(0,1,4)])
        self.assertEqual(build_graph(world(a))[2]['non_manifold_edges'],1)
    def test_collapsed_edges_reported(self):
        a=mesh([(10,10,0),(10,10,0),(20,20,0)],[(0,1,2)])
        self.assertEqual(build_graph(world(a))[2]['collapsed_edges'],1)
    def test_incomplete_and_nonwm0_are_rejected(self):
        with self.assertRaises(ValueError):build_graph(world(square(),failures=['bad']))
        w=world(square());w.map_id=2
        with self.assertRaises(ValueError):build_graph(w)
    def test_profile_coverage_highwind_excluded(self):
        self.assertEqual(len(ROUTE_PROFILES),9)
        with self.assertRaises(ValueError):route_state('highwind-landing',0)
        for profile in ROUTE_PROFILES:
            for terrain in range(32):self.assertIn(route_state(profile,terrain),('allowed','blocked','conditional','unknown'))
    def test_bridge_and_back_entrance_conservative(self):
        for terrain in (13,14,30):
            for p in ROUTE_PROFILES:self.assertNotEqual(route_state(p,terrain),'allowed')
    def test_invalid_terrain_rejected(self):
        for terrain in (-1,32,0.5):
            with self.assertRaises(ValueError):route_state('foot',terrain)
    def test_components_reject_blocked_endpoints(self):
        nodes,adj,_=build_graph(world(square()));nodes[1]['terrain']=3
        labels,rows=components(nodes,adj,'foot');self.assertEqual(labels,[0,-1]);self.assertEqual(rows[0]['triangles'],1)
    def test_conditional_is_opt_in(self):
        nodes,adj,_=build_graph(world(square()));nodes[1]['terrain']=13
        self.assertEqual(components(nodes,adj,'foot')[0],[0,-1])
        self.assertEqual(components(nodes,adj,'foot',True)[0],[0,0])
    def test_component_area_aggregates_reference_area(self):
        nodes,adj,_=build_graph(world(square()));labels,rows=components(nodes,adj,'foot')
        self.assertEqual(rows[0]['reference_area_m2'],sum(n['area'] for n in nodes));self.assertEqual(labels,[0,0])
    def test_deterministic_order_and_binary(self):
        a=square();b=mesh([(30,10,0),(40,10,0),(40,20,0)],[(0,1,2)],mid=1)
        n,g,s=build_graph(world(b,a));nn,gg,ss=build_graph(world(a,b))
        self.assertEqual((n,g,s),(nn,gg,ss));blob=serialize_graph(n,g,'12'*32)
        self.assertEqual(blob,serialize_graph(nn,gg,'12'*32));self.assertEqual(blob[:8],b'GAIARTG\0')
        self.assertEqual(struct.unpack_from('<I',blob,36)[0],len(blob));self.assertEqual(blob[64:96],bytes.fromhex('12'*32))
    def test_reference_distance_short_arc_and_area(self):
        self.assertLess(distance((179,0),(-179,0)),250000)
        self.assertAlmostEqual(sphere_area([(0,0),(90,0),(0,90)],1),math.pi/2)
        self.assertEqual(distance((0,0),(0,0)),0)

if __name__=='__main__':unittest.main()
