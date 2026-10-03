"""Analytic reconstruction, independent of GDAL/QGIS and game rendering scales."""
from dataclasses import dataclass
import math
from pathlib import Path
import tomllib

@dataclass(frozen=True)
class SphereConfig:
    radius_m: float = 6371008.8
    vertical_scale_m_per_raw_unit: float = 1.0
    flip_latitude: bool = False
    method: str = "inverse_mercator"
    enabled: bool = True
    ring_count: int = 8
    antimeridian_game_east: float = 0.0
    mercator_max_latitude_deg: float = 85.0511287798066
    orthographic_longitude_deg: float = 0.0
    orthographic_latitude_deg: float = 0.0
    flatten: bool = False

    def __post_init__(self):
        for key, value in self.__dict__.items():
            if isinstance(value, float) and not math.isfinite(value):
                raise ValueError(f"Non-finite configuration: {key}")
        if self.radius_m <= 0 or self.method != "inverse_mercator":
            raise ValueError("Positive radius and inverse_mercator method required")
        if not isinstance(self.ring_count, int) or self.ring_count < 1:
            raise ValueError("Polar ring_count must be a positive integer")
        if not 0 < self.mercator_max_latitude_deg < 90:
            raise ValueError("Mercator clipping latitude must be between 0 and 90 degrees")
        if not -90 <= self.orthographic_latitude_deg <= 90:
            raise ValueError("Invalid orthographic center latitude")

def read_config(path: Path, **overrides) -> SphereConfig:
    with path.open("rb") as stream:
        document = tomllib.load(stream)
    allowed = {"gaia", "mapping", "polar_caps", "longitude", "projections"}
    if set(document) - allowed:
        raise ValueError(f"Unknown configuration sections: {set(document)-allowed}")
    values = {}
    for section in document.values():
        for key, value in section.items():
            if key in values or key not in SphereConfig.__dataclass_fields__:
                raise ValueError(f"Unknown or repeated configuration key: {key}")
            values[key] = value
    values.update({k: v for k, v in overrides.items() if v is not None})
    return SphereConfig(**values)

def wrap_longitude(lon: float) -> float:
    return (lon + 180.0) % 360.0 - 180.0

class Mapping:
    def __init__(self, width: float, height: float, config: SphereConfig):
        if width <= 0 or height <= 0:
            raise ValueError("Positive game extents required")
        self.width, self.height, self.config = width, height, config
        self.raw_radius = width / (2 * math.pi)
        self.phi_max = math.degrees(math.atan(math.sinh(height / (2*self.raw_radius))))

    def game_to_geographic(self, east, north, height):
        # Preserve the two sides of the longitude cut at -180/+180.
        relative = east - self.config.antimeridian_game_east
        if not 0 <= relative <= self.width:
            relative %= self.width
        lon = 360 * (relative / self.width - 0.5)
        lat = math.degrees(math.atan(math.sinh((self.height/2 - north)/self.raw_radius)))
        if self.config.flip_latitude:
            lat = -lat
        altitude = 0.0 if self.config.flatten else height*self.config.vertical_scale_m_per_raw_unit
        if self.config.radius_m + altitude <= 0:
            raise ValueError("Height places a vertex at or below the sphere center")
        return lon, lat, altitude

    def geographic_to_game(self, lon, lat, altitude):
        if not -90 < lat < 90:
            raise ValueError("Poles have no finite inverse-Mercator game coordinate")
        phi = math.radians(-lat if self.config.flip_latitude else lat)
        east = self.width*(lon/360+0.5) + self.config.antimeridian_game_east
        north = self.height/2 - self.raw_radius*math.asinh(math.tan(phi))
        scale = self.config.vertical_scale_m_per_raw_unit
        if self.config.flatten or scale == 0:
            raise ValueError("Flattened/zero-scale heights are not invertible")
        return east, north, altitude/scale

    def geographic_to_cartesian(self, lon, lat, altitude=0):
        lam, phi = math.radians(lon), math.radians(lat)
        r = self.config.radius_m + altitude
        return r*math.cos(phi)*math.cos(lam), r*math.cos(phi)*math.sin(lam), r*math.sin(phi)

def unwrap_polygon(points):
    """Choose short longitudinal edges; never use this for a >180-degree feature."""
    if not points:
        return []
    result = [tuple(points[0])]
    for lon, lat, z in points[1:]:
        lon += 360*round((result[-1][0]-lon)/360)
        result.append((lon, lat, z))
    if max(p[0] for p in result)-min(p[0] for p in result) > 180+1e-9:
        raise ValueError("Feature spans more than half the sphere; subdivide before export")
    return result

def clip_axis(points, axis, limit, keep_above):
    """Sutherland-Hodgman with interpolated Z, including degenerate source faces."""
    if not points:
        return []
    if all(p[axis]>=limit if keep_above else p[axis]<=limit for p in points):
        return list(points)
    result = []
    a = points[-1]
    a_in = a[axis] >= limit if keep_above else a[axis] <= limit
    for b in points:
        b_in = b[axis] >= limit if keep_above else b[axis] <= limit
        if a_in != b_in:
            fraction = (limit-a[axis])/(b[axis]-a[axis])
            p = tuple(a[i]+fraction*(b[i]-a[i]) for i in range(3))
            result.append(tuple(limit if i == axis else p[i] for i in range(3)))
        if b_in:
            result.append(tuple(b))
        a, a_in = b, b_in
    # Remove adjacent identical corners introduced by clipping, not source faces.
    cleaned = []
    for p in result:
        if not cleaned or p != cleaned[-1]:
            cleaned.append(p)
    if len(cleaned)>1 and cleaned[0]==cleaned[-1]:
        cleaned.pop()
    return cleaned

def split_antimeridian(points):
    unwrapped = unwrap_polygon(points)
    if not unwrapped:
        return []
    lo, hi = min(p[0] for p in unwrapped), max(p[0] for p in unwrapped)
    first = math.floor((lo+180)/360)
    last = math.floor((hi+180-1e-10)/360)
    last = max(first, last)
    parts = []
    for cycle in range(first, last+1):
        part = clip_axis(unwrapped,0,-180+cycle*360,True)
        part = clip_axis(part,0,180+cycle*360,False)
        if len(part)>=3:
            parts.append([(lon-cycle*360,lat,z) for lon,lat,z in part])
    # Original collapsed triangles still carry lineage and are exported unchanged.
    if not parts and hi-lo <= 180 and len(unwrapped)>=3:
        parts = [[(lon-first*360,lat,z) for lon,lat,z in unwrapped]]
    return parts

def visibility(point, lon0, lat0):
    lon, lat = map(math.radians,point[:2])
    lon0, lat0 = math.radians(lon0), math.radians(lat0)
    return math.sin(lat0)*math.sin(lat)+math.cos(lat0)*math.cos(lat)*math.cos(lon-lon0)

def clip_horizon(points, lon0=0, lat0=0):
    """Clip small geographic cells to the orthographic visible hemisphere.

    Edges follow the exported lon/lat polygon's linear interpolation. Crossings
    use bisection; inserted points lie on the spherical horizon. This is display
    clipping, not a modification of source triangle connectivity.
    """
    if not points:
        return []
    def signed(p):
        value = visibility(p,lon0,lat0)
        return 0.0 if abs(value)<1e-14 else value
    result = []
    a = points[-1]
    va = signed(a)
    for b in points:
        vb = signed(b)
        if (va>=0) != (vb>=0):
            if va==0 or vb==0:
                result.append(tuple(a if va==0 else b))
                if vb>=0:
                    result.append(tuple(b))
                a,va = b,vb
                continue
            lo, hi = 0.0, 1.0
            for _ in range(54):
                t = (lo+hi)/2
                p = tuple(a[i]+t*(b[i]-a[i]) for i in range(3))
                if (visibility(p,lon0,lat0)>=0) == (va>=0):
                    lo = t
                else:
                    hi = t
            t = (lo+hi)/2
            result.append(tuple(a[i]+t*(b[i]-a[i]) for i in range(3)))
        if vb>=0:
            result.append(tuple(b))
        a, va = b, vb
    return result if len(result)>=3 else []
