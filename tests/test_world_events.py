# SPDX-License-Identifier: GPL-3.0-only
import json,os,struct,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'src'))
from gaiagis.ev import decode_ev,basic_blocks
from gaiagis.world_events import analyze_ev,extract_events,point_coordinates,reachable_calls,build_events,containing_surface
from gaiagis.map_reader import Mesh,Vertex,Triangle,WorldMap
from gaiagis.lzss import FormatError

def ev(*functions):
    table=bytearray(struct.pack('<HH',0,0)+struct.pack('<HH',65535,0)*255);words=[0x203]
    for i,(header,code) in enumerate(functions,1):struct.pack_into('<HH',table,i*4,header,len(words));words.extend(code)
    return bytes(table)+struct.pack('<'+'H'*len(words),*words)

def world(script=3):
    m=Mesh(0,'synthetic.map',0,0,64,1,1,[Vertex(0,0,0,0),Vertex(12,12,0,0),Vertex(0,0,12,0)],[],[Triangle(0,(0,1,2),script<<5,((0,0),)*3,0)],0)
    return WorldMap(0,Path('synthetic.map'),63,[m],[],[])

def fields():return {(1,0):dict(field_id=1,field_name='synthetic'),(1,1):dict(field_id=2,field_name='variant')}

class WorldEventTests(unittest.TestCase):
    def test_shared_decoder_operand_is_not_opcode(self):
        a=analyze_ev(ev((0x8000,[0x110,0x317,0x203])));self.assertFalse(a['observations'])
    def test_invalid_call_table(self):
        with self.assertRaises(FormatError):decode_ev(bytes(1023))
    def test_instruction_boundary(self):
        with self.assertRaises(FormatError):analyze_ev(ev((0,[0x200,4,0x110,1,0x203])))
    def test_branch_outside_interval(self):
        with self.assertRaises(FormatError):analyze_ev(ev((0,[0x200,100,0x203])))
    def test_blocks(self):
        fs,code=decode_ev(ev((0,[0x110,0,0x201,7,0x203,0x203,0x203])))
        self.assertGreater(len(set(basic_blocks(fs[0],code[1]).values())),1)
    def test_literal_arithmetic_field(self):
        a=analyze_ev(ev((0x8000,[0x110,2,0x110,1,0x41,0x110,0,0x318,0x203])))
        self.assertEqual(a['observations'][0]['raw_arguments'],[1,0])
    def test_constant_false_branch_not_followed(self):
        a=analyze_ev(ev((0,[0x110,0,0x201,8,0x110,42,0x317,0x203])))
        self.assertFalse(a['observations'])
    def test_conditional_battle_symbolic_memory(self):
        a=analyze_ev(ev((0,[0x114,6,0x201,8,0x110,42,0x317,0x203])))
        self.assertEqual(a['observations'][0]['raw_arguments'],[42]);self.assertIn('savemap-dependent',a['observations'][0]['condition_kind'])
    def test_dynamic_arguments_not_guessed(self):
        a=analyze_ev(ev((0x8000,[0x118,8,0x110,0,0x318,0x203])))
        es,u=extract_events(a,world(),fields());self.assertEqual(es[0]['field_id'],None);self.assertTrue(any(x['reason']=='dynamic_or_unknown_field_destination' for x in u))
    def test_call_target_model_and_system(self):
        a=analyze_ev(ev((0,[0x110,2,0x204,0x110,65535,0x205,0x203]),(0x4200,[0x203]),(1,[0x203])))
        self.assertEqual({e['callee'] for e in a['call_graph']},{0x4200,1})
    def test_scheduled_calls_do_not_transfer_literal_stack(self):
        a=analyze_ev(ev((0,[0x110,1,0x110,65535,0x205,0x110,0,0x318,0x203]),(1,[0x203])))
        self.assertEqual(a['observations'][0]['raw_arguments'],[None,0])
    def test_call_chain_trigger_and_raw_battle(self):
        a=analyze_ev(ev((0x8000,[0x110,65535,0x205,0x203]),(1,[0x110,65535,0x206,0x203]),(2,[0x110,555,0x317,0x203])))
        es,_=extract_events(a,world(),fields());battle=next(e for e in es if e['event_type']=='scripted_battle')
        self.assertEqual(battle['battle_id'],555);self.assertEqual(battle['trigger_triangle_ids'],[0]);self.assertNotIn('enemy',battle)
    def test_cycle_protection(self):
        a=analyze_ev(ev((0,[0x110,65535,0x204,0x203])));self.assertEqual(a['cyclic_functions'],[0]);self.assertEqual(reachable_calls(0,a['call_graph']),{0})
    def test_cfg_loop_guard(self):
        a=analyze_ev(ev((0,[0x110,1,0x200,1])),max_states=1)
        self.assertTrue(any(u['reason']=='analysis_guard' for u in a['unresolved']))
    def test_loop_abstract_join_converges(self):
        a=analyze_ev(ev((0,[0x110,1,0x200,1])))
        self.assertFalse(a['unresolved']);self.assertLess(a['visited_instructions'],10)
    def test_instruction_guard(self):
        a=analyze_ev(ev((0,[0x110,1,0x317,0x203])),max_instructions=1);self.assertTrue(a['unresolved'])
    def test_model_constant_position(self):
        a=analyze_ev(ev((0x4100,[0x110,0,0x110,0,0x308,0x110,2,0x110,3,0x309,0x203])))
        es,u=extract_events(a,world(),fields());self.assertFalse(u);self.assertEqual(es[0]['model_id'],1);self.assertEqual((es[0]['game_x'],es[0]['game_north']),(2,3));self.assertEqual(es[0]['height'],2)
    def test_partial_position_has_no_spatial_anchor(self):
        a=analyze_ev(ev((0x4100,[0x110,2,0x110,3,0x309,0x203])));self.assertFalse(a['observations'])
    def test_dynamic_mesh_position_not_guessed(self):
        a=analyze_ev(ev((0x4100,[0x118,0,0x110,0,0x308,0x110,2,0x110,3,0x309,0x203])));self.assertFalse(a['observations'])
    def test_wait_invalidates_entity_position(self):
        a=analyze_ev(ev((0x4100,[0x110,0,0x110,0,0x308,0x306,0x110,2,0x110,3,0x309,0x203])));self.assertFalse(a['observations'])
    def test_unknown_opcode_poison_stack(self):
        a=analyze_ev(ev((0,[0x110,1,0x1c,0x110,0,0x318,0x203])));self.assertEqual(a['observations'][0]['raw_arguments'],[None,0])
    def test_point_mesh_local_conversion(self):
        self.assertEqual(point_coordinates((35,27),(8191,8191)),(294911,229375));self.assertIsNone(point_coordinates((36,0),(0,0)))
    def test_lighting_point_not_automatically_event(self):
        a=analyze_ev(ev((0,[0x110,1,0x110,0,0x310,0x110,0,0x110,0,0x311,0x110,1,0x110,2,0x312,0x203])));self.assertFalse(a['observations'])
    def test_non_spatial_battle_unresolved(self):
        a=analyze_ev(ev((0,[0x110,42,0x317,0x203])));es,u=extract_events(a,world(),fields());self.assertFalse(es);self.assertEqual(u[0]['reason'],'non_spatial_or_runtime_anchor')
    def test_multiple_destinations_keep_scenarios(self):
        a=analyze_ev(ev((0x8000,[0x110,1,0x110,0,0x318,0x110,1,0x110,1,0x318,0x203])))
        es,_=extract_events(a,world(),fields());self.assertEqual({e['field_id'] for e in es if e['event_type']=='dynamic_entrance'},{1,2})
    def test_surface_point_not_nearest_guess(self):
        mesh=world().meshes[0];self.assertEqual(containing_surface(mesh,100,100),(None,None))
    def test_overlapping_surfaces_do_not_guess_height(self):
        mesh=world().meshes[0];mesh.vertices.extend([Vertex(v.raw_x,v.raw_y+10,v.raw_z,0) for v in list(mesh.vertices)])
        t=mesh.triangles[0];mesh.triangles.append(Triangle(1,tuple(i+3 for i in t.indices),t.terrain_script_byte,t.uv,t.raw_ids))
        self.assertEqual(containing_surface(mesh,2,3),(None,None))
    def test_dedup_and_determinism(self):
        data=ev((0x8000,[0x110,1,0x110,0,0x318,0x203]));a=analyze_ev(data)
        self.assertEqual(extract_events(a,world(),fields()),extract_events(analyze_ev(data),world(),fields()))
        es,_=extract_events(a,world(),fields());self.assertEqual(len({e['id'] for e in es}),len(es))
    def test_output_boundary(self):
        with self.assertRaises(ValueError):build_events(ROOT,Path(r'D:\SteamLibrary\gaia-events.json'))

@unittest.skipUnless(os.environ.get('GAIAGIS_SOURCE_ROOT'),'Local FF7 dataset required')
class EventsIntegrationTests(unittest.TestCase):
    def test_real_source_determinism_and_provenance(self):
        p=ROOT/'output/v1_4/test-events.json';a=build_events(Path(os.environ['GAIAGIS_SOURCE_ROOT']),p);before=p.read_bytes();build_events(Path(os.environ['GAIAGIS_SOURCE_ROOT']),p);self.assertEqual(before,p.read_bytes())
        self.assertTrue(a['events']);self.assertTrue(a['unresolved']);self.assertEqual(a['extraction']['functions'][0]['kind'],0)
        cave=[e for e in a['events'] if e['anchor_function']==9];self.assertTrue(cave);self.assertTrue(all(e['field_name']=='las0_1' for e in cave))
        self.assertTrue(any(e['model_id']==14 and e['anchor_kind']=='script_model_position' for e in a['events']))
        for e in a['events']:self.assertEqual(e['runtime_availability'],'not_simulated');self.assertNotIn('estimated_by_visual_inspection',e.values())

if __name__=='__main__':unittest.main()
