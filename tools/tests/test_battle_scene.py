# SPDX-License-Identifier: GPL-3.0-only
import gzip
from pathlib import Path
import struct
import tempfile
import unittest

from gaiagis.battle_scene import (scene_records, western_name, parse_battle_resources,
                                 _kernel_chunks, _kernel2_chunks, _names)
from gaiagis.lzss import FormatError


def text(value):
    return bytes(ord(c)-32 for c in value) + b'\xff'


def scene(enemy_id=21, hp=1234, name='Test enemy'):
    raw = bytearray(b'\xff' * 7808)
    struct.pack_into('<3H', raw, 0, enemy_id, 65535, 65535)
    raw[0x298:0x2b8] = text(name).ljust(32, b'\xff')
    raw[0x2b8] = 17
    struct.pack_into('<H', raw, 0x298+156, 25)
    struct.pack_into('<I', raw, 0x298+164, hp)
    struct.pack_into('<H', raw, 0x118, enemy_id)
    struct.pack_into('<H', raw, 0x128, enemy_id)
    return bytes(raw)


def archive(*raw_scenes):
    compressed = [gzip.compress(raw, mtime=0) for raw in raw_scenes]
    pointers = []
    payload = bytearray()
    for data in compressed:
        pointers.append((64+len(payload))//4)
        payload.extend(data)
        payload.extend(b'\xff' * (-len(payload) % 4))
    header = struct.pack('<16I', *pointers, *([0xffffffff]*(16-len(pointers))))
    return (header+payload).ljust(8192, b'\xff')


class BattleSceneTests(unittest.TestCase):
    def test_scene_formation_and_enemy_id_evidence(self):
        result = scene_records(archive(scene()))
        self.assertEqual(result['sceneSlots'], 1)
        self.assertEqual(result['scenes'][0]['id'], 0)
        self.assertEqual(result['scenes'][0]['enemyIds'], [21])
        enemy = result['enemies'][0]
        self.assertEqual((enemy['id'],enemy['sceneId'],enemy['slot']), (21,0,0))
        self.assertEqual((enemy['name'],enemy['level'],enemy['hp'],enemy['mp']), ('Test enemy',17,1234,25))
        self.assertEqual(result['formations'][0]['enemyIds'], [21,21])
        self.assertEqual(result['formations'][0]['battleId'], 0)
        self.assertEqual(result['formations'][1]['status'], 'empty')
        self.assertNotIn('position', enemy)
        self.assertNotIn('boss', enemy)

    def test_same_enemy_id_in_different_scenes_is_not_merged(self):
        result = scene_records(archive(scene(hp=100),scene(hp=200)))
        self.assertEqual([(e['id'],e['sceneId'],e['hp']) for e in result['enemies']],[(21,0,100),(21,1,200)])
        self.assertEqual(result['formations'][4]['battleId'], 4)

    def test_unknown_enemy_reference_is_explicit(self):
        raw = bytearray(scene())
        struct.pack_into('<H', raw, 0x118, 999)
        result = scene_records(archive(raw))
        self.assertEqual(result['formations'][0]['status'], 'unresolved_enemy')
        self.assertEqual(result['formations'][0]['enemyIds'], [999,21])

    def test_unsupported_scene_size_preserves_scene_slot(self):
        result = scene_records(archive(b'bad scene',scene()))
        self.assertEqual(result['sceneSlots'],2)
        self.assertEqual(result['failures'][0]['id'],0)
        self.assertEqual(result['scenes'][0]['id'],1)
        self.assertEqual(result['formations'][0]['id'],4)

    def test_invalid_pointer_order_and_unterminated_table_rejected(self):
        for edit in [lambda b:struct.pack_into('<I',b,0,15),
                     lambda b:struct.pack_into('<I',b,4,16),
                     lambda b:struct.pack_into('<I',b,8,20)]:
            raw=bytearray(archive(scene()));edit(raw)
            with self.assertRaises(FormatError):scene_records(raw)
        with self.assertRaises(FormatError):scene_records(b'bad')

    def test_invalid_compressed_tail_is_not_silently_accepted(self):
        raw=bytearray(archive(scene()));raw[-1]=0
        result=scene_records(raw)
        self.assertEqual(len(result['scenes']),0)
        self.assertEqual(len(result['failures']),1)

    def test_missing_inputs_are_unavailable(self):
        result=parse_battle_resources(None)
        self.assertEqual(result['sources'],{})
        self.assertEqual(result['coverage']['sceneStatus'],'unavailable')
        self.assertEqual(result['coverage']['namesStatus'],'unavailable')

    def test_resource_hash_and_size_are_actual_without_paths(self):
        with tempfile.TemporaryDirectory(dir=Path.cwd()/'.cache') as directory:
            path=Path(directory)/'scene.bin';path.write_bytes(archive(scene()))
            result=parse_battle_resources(path)
        self.assertEqual(len(result['sources']['scene.bin']),64)
        self.assertNotIn('path',str(result))

    def test_name_offsets_and_backrefs_are_bounded(self):
        data=struct.pack('<2H',4,8)+text('AAA')+text('B')
        self.assertEqual([r['name'] for r in _names(data,2)],['AAA','B'])
        with self.assertRaises(FormatError):_names(b'\x04\x00\x01\x00AAAA\xff',2)
        with self.assertRaises(FormatError):_names(b'\x02\x00\xf9\x00\xff',1)
        self.assertEqual(western_name(text('HP'))[0],'HP')
        self.assertEqual(western_name(b'\xe8\xff'),('[E8]','partial'))

    def test_kernel_chunks_are_length_checked(self):
        raw=text('A');encoded=gzip.compress(raw,mtime=0)
        source=struct.pack('<3H',len(encoded),len(raw),0)+encoded
        self.assertEqual(_kernel_chunks(source),[raw])
        with self.assertRaises(FormatError):_kernel_chunks(source[:-1])
        with self.assertRaises(FormatError):_kernel2_chunks(b'bad')


if __name__=='__main__':
    unittest.main()
