"""Format constants: see docs/research/world-map.md for evidence and limitations."""
SECTION_SIZE = 0xB800
MESHES_PER_SECTION = 16
MESH_SIDE = 4
MESH_UNITS = 0x2000
TRIANGLE_BYTES = 12
VECTOR_BYTES = 8
# MAP has no grid header. These are externally documented placement profiles,
# checked against section counts, extents and adjacency, not inferred from size.
LAYOUTS = {0: (9, 7), 2: (3, 4), 3: (2, 2)}
ALTERNATIVES = dict(zip(range(63, 69), (50, 41, 42, 60, 47, 48)))
TERRAIN_NAMES = dict(enumerate((
    "Grass", "Forest", "Mountain", "Sea", "River Crossing", "River", "Water",
    "Swamp", "Desert", "Wasteland", "Snow", "Riverside", "Cliff", "Corel Bridge",
    "Wutai Bridge", "Underwater Tunnel", "Hill Side", "Beach", "Sub Pen", "Canyon",
    "Mountain Pass", "Unknown", "Waterfall", "Unused", "Gold Saucer Desert",
    "Jungle", "Sea (2)", "Northern Cave", "Gold Saucer Desert Border", "Bridgehead",
    "Back Entrance", "Unused")))
REGION_NAMES = dict(enumerate((
    "Midgar Area", "Grasslands Area", "Junon Area", "Corel Area", "Gold Saucer Area",
    "Gongaga Area", "Cosmo Area", "Nibel Area", "Rocket Launch Pad Area", "Wutai Area",
    "Woodlands Area", "Icicle Area", "Mideel Area", "North Corel Area", "Cactus Island",
    "Goblin Island", "Round Island", "Sea", "Bottom of the Sea", "Glacier")))
OCEAN_TYPES = frozenset((3, 6, 26))  # Probe classification, not GIS land cover.
KNOWN = {
    "wm0.map": (3250176, "43E72295212311FCEC3A513051A96CA4475185A72211EBC3A5E4F89A50ECA78C"),
    "wm2.map": (565248, "404FF95D3E9A5F0D740C4E672B215012FF47FE9F0A6646B4BA8159C425BFAB02"),
    "wm3.map": (188416, "70A7F728DE6DF2756A1674DCDBE52C6B0CFB85D6F5BD02C5D14BD83DD119ACD3"),
    "world_us.lgp": (3114259, "975C74126D1C68AA74C38B9F1D602B06F3A27A91D0019EAE351334237F474B7C"),
}
