import math
import numpy as np

EARTH_R_KM = 6371.0


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (math.sin(d_lat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(d_lng / 2) ** 2)
    return 2 * EARTH_R_KM * math.asin(math.sqrt(a))


def build_distance_matrix(points: list[tuple[float, float]]) -> np.ndarray:
    """points[0] is depot, points[1..] are customer stops.
    Returns symmetric matrix of haversine distances in km.
    """
    n = len(points)
    lats = np.array([p[0] for p in points])
    lngs = np.array([p[1] for p in points])
    lat_r = np.radians(lats)
    lng_r = np.radians(lngs)

    dlat = lat_r[:, None] - lat_r[None, :]
    dlng = lng_r[:, None] - lng_r[None, :]
    a = (np.sin(dlat / 2) ** 2
         + np.cos(lat_r[:, None]) * np.cos(lat_r[None, :]) * np.sin(dlng / 2) ** 2)
    a = np.clip(a, 0.0, 1.0)
    d = 2 * EARTH_R_KM * np.arcsin(np.sqrt(a))
    np.fill_diagonal(d, 0.0)
    return d.astype(np.float64)


def minutes_to_hhmm(minutes: float) -> str:
    h = int(minutes // 60) % 24
    m = int(round(minutes)) % 60
    return f"{h:02d}:{m:02d}"
