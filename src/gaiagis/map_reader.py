from dataclasses import dataclass
from pathlib import Path
import struct
from .constants import SECTION_SIZE, MESHES_PER_SECTION, MESH_SIDE, MESH_UNITS, LAYOUTS, ALTERNATIVES
from .lzss import decompress, FormatError

@dataclass(frozen=True, slots=True)
class Vertex:
    raw_x: int
    raw_y: int
    raw_z: int
    padding: int

@dataclass(frozen=True, slots=True)
class Triangle:
    triangle_id: int
    indices: tuple[int, int, int]
    terrain_script_byte: int
    uv: tuple[tuple[int, int], ...]
    raw_ids: int

    @property
    def ff7_terrain_type(self): return self.terrain_script_byte & 31
    @property
    def script(self): return self.terrain_script_byte >> 5
    @property
    def region(self): return (self.raw_ids >> 9) & 31
    @property
    def texture(self): return self.raw_ids & 511
    @property
    def is_chocobo(self): return bool(self.raw_ids & 0x8000)
    @property
    def unknown_bit14(self): return (self.raw_ids >> 14) & 1

@dataclass(slots=True)
class Mesh:
    map_id: int
    source_file: str
    section_id: int
    mesh_id: int
    offset: int
    compressed_size: int
    decoded_size: int
    vertices: list[Vertex]
    normals: list[Vertex]
    triangles: list[Triangle]
    base_section_id: int | None

    @property
    def is_base(self): return self.section_id < LAYOUTS[self.map_id][0] * LAYOUTS[self.map_id][1]
    @property
    def cell(self):
        if self.base_section_id is None:
            raise FormatError("Unknown alternative section placement")
        sx = LAYOUTS[self.map_id][0]
        return (self.base_section_id % sx * MESH_SIDE + self.mesh_id % MESH_SIDE,
                self.base_section_id // sx * MESH_SIDE + self.mesh_id // MESH_SIDE)

    def position(self, index: int) -> tuple[int, int, int]:
        """game_east, game_north, game_height; raw_y retained without sign flip."""
        v = self.vertices[index]
        col, row = self.cell
        return col * MESH_UNITS + v.raw_x, row * MESH_UNITS + v.raw_z, v.raw_y

    def lineage(self, t: Triangle):
        return dict(source_file=self.source_file, map_id=self.map_id, section_id=self.section_id,
                    mesh_id=self.mesh_id, triangle_id=t.triangle_id)

def decode_mesh(data: bytes) -> tuple[list[Triangle], list[Vertex], list[Vertex]]:
    if len(data) < 4:
        raise FormatError("Mesh header truncated")
    nt, nv = struct.unpack_from("<HH", data)
    expected = 4 + nt * 12 + nv * 16
    if len(data) != expected:
        raise FormatError(f"Mesh decoded length {len(data)} != header-derived {expected}")
    if nv > 256:
        raise FormatError("Vertex count exceeds byte-index address space")
    triangles = []
    for i in range(nt):
        values = struct.unpack_from("<10BH", data, 4 + i * 12)
        if any(j >= nv for j in values[:3]):
            raise FormatError(f"Triangle {i}: vertex reference outside table of {nv}")
        triangles.append(Triangle(i, values[:3], values[3],
                                  tuple(zip(values[4:10:2], values[5:10:2])), values[10]))
    start = 4 + nt * 12
    vectors = [Vertex(*struct.unpack_from("<hhhH", data, start + i * 8)) for i in range(nv * 2)]
    return triangles, vectors[:nv], vectors[nv:]

@dataclass
class WorldMap:
    map_id: int
    path: Path
    section_count: int
    meshes: list[Mesh]
    failures: list[dict]
    unknown_sections: list[int]

    @property
    def base_meshes(self): return [m for m in self.meshes if m.is_base]
    @property
    def extent(self):
        sx, sy = LAYOUTS[self.map_id]
        return sx * 4 * MESH_UNITS, sy * 4 * MESH_UNITS

def parse_map(path: Path, map_id: int) -> WorldMap:
    if map_id not in LAYOUTS:
        raise FormatError(f"No placement profile for map {map_id}")
    data = path.read_bytes()  # read-only source API
    if not data or len(data) % SECTION_SIZE:
        raise FormatError("MAP size must be a positive multiple of SECTION_SIZE")
    sections = len(data) // SECTION_SIZE
    base_count = LAYOUTS[map_id][0] * LAYOUTS[map_id][1]
    meshes, failures, unknown = [], [], []
    for s in range(sections):
        block = data[s * SECTION_SIZE:(s + 1) * SECTION_SIZE]
        offsets = struct.unpack_from("<16I", block)
        placement = s if s < base_count else ALTERNATIVES.get(s) if map_id == 0 else None
        if placement is None:
            unknown.append(s)
        spans = []
        for m, off in enumerate(offsets):
            try:
                if off < 64 or off % 4 or off + 4 > SECTION_SIZE:
                    raise FormatError(f"Invalid mesh offset {off}")
                length = struct.unpack_from("<I", block, off)[0]
                if not length or off + 4 + length > SECTION_SIZE:
                    raise FormatError("Compressed mesh exceeds section")
                end = off + 4 + length
                if any(off < b and end > a for a, b in spans):
                    raise FormatError("Overlapping compressed mesh records")
                spans.append((off, end))
                decoded = decompress(block[off + 4:end])
                triangles, vertices, normals = decode_mesh(decoded)
                meshes.append(Mesh(map_id, str(path), s, m, off, length, len(decoded),
                                   vertices, normals, triangles, placement))
            except FormatError as exc:
                failures.append(dict(section_id=s, mesh_id=m, error=str(exc)))
    return WorldMap(map_id, path, sections, meshes, failures, unknown)
