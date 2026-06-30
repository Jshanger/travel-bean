export interface Coords {
  latitude: number;
  longitude: number;
}

export interface PlaceCoordinateInput {
  name?: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

const CITY_COORDS: Record<string, Coords> = {
  // Europe
  'Lisbon': { latitude: 38.7169, longitude: -9.1399 },
  'Porto': { latitude: 41.1579, longitude: -8.6291 },
  'Madrid': { latitude: 40.4168, longitude: -3.7038 },
  'Barcelona': { latitude: 41.3851, longitude: 2.1734 },
  'Paris': { latitude: 48.8566, longitude: 2.3522 },
  'London': { latitude: 51.5074, longitude: -0.1278 },
  'Amsterdam': { latitude: 52.3676, longitude: 4.9041 },
  'Berlin': { latitude: 52.5200, longitude: 13.4050 },
  'Rome': { latitude: 41.9028, longitude: 12.4964 },
  'Milan': { latitude: 45.4642, longitude: 9.1900 },
  'Florence': { latitude: 43.7696, longitude: 11.2558 },
  'Venice': { latitude: 45.4408, longitude: 12.3155 },
  'Prague': { latitude: 50.0755, longitude: 14.4378 },
  'Vienna': { latitude: 48.2082, longitude: 16.3738 },
  'Budapest': { latitude: 47.4979, longitude: 19.0402 },
  'Athens': { latitude: 37.9838, longitude: 23.7275 },
  'Santorini': { latitude: 36.3932, longitude: 25.4615 },
  'Copenhagen': { latitude: 55.6761, longitude: 12.5683 },
  'Stockholm': { latitude: 59.3293, longitude: 18.0686 },
  'Oslo': { latitude: 59.9139, longitude: 10.7522 },
  'Helsinki': { latitude: 60.1699, longitude: 24.9384 },
  'Reykjavik': { latitude: 64.1466, longitude: -21.9426 },
  'Dubrovnik': { latitude: 42.6507, longitude: 18.0944 },
  'Bruges': { latitude: 51.2093, longitude: 3.2247 },
  'Zurich': { latitude: 47.3769, longitude: 8.5417 },
  'Geneva': { latitude: 46.2044, longitude: 6.1432 },
  'Edinburgh': { latitude: 55.9533, longitude: -3.1883 },
  // Asia
  'Tokyo': { latitude: 35.6762, longitude: 139.6503 },
  'Osaka': { latitude: 34.6937, longitude: 135.5023 },
  'Kyoto': { latitude: 35.0116, longitude: 135.7681 },
  'Hiroshima': { latitude: 34.3853, longitude: 132.4553 },
  'Ulaanbaatar': { latitude: 47.8864, longitude: 106.9057 },
  'Shanghai': { latitude: 31.2304, longitude: 121.4737 },
  'Beijing': { latitude: 39.9042, longitude: 116.4074 },
  'Chengdu': { latitude: 30.5728, longitude: 104.0668 },
  'Hong Kong': { latitude: 22.3193, longitude: 114.1694 },
  'Taipei': { latitude: 25.0330, longitude: 121.5654 },
  'Seoul': { latitude: 37.5665, longitude: 126.9780 },
  'Busan': { latitude: 35.1796, longitude: 129.0756 },
  'Singapore': { latitude: 1.3521, longitude: 103.8198 },
  'Bangkok': { latitude: 13.7563, longitude: 100.5018 },
  'Chiang Mai': { latitude: 18.7883, longitude: 98.9853 },
  'Phuket': { latitude: 7.9519, longitude: 98.3381 },
  'Bali': { latitude: -8.3405, longitude: 115.0920 },
  'Ubud': { latitude: -8.5069, longitude: 115.2625 },
  'Denpasar': { latitude: -8.6705, longitude: 115.2126 },
  'Yogyakarta': { latitude: -7.7956, longitude: 110.3695 },
  'Hanoi': { latitude: 21.0285, longitude: 105.8542 },
  'Ho Chi Minh City': { latitude: 10.8231, longitude: 106.6297 },
  'Hoi An': { latitude: 15.8800, longitude: 108.3380 },
  'Colombo': { latitude: 6.9271, longitude: 79.8612 },
  'Kathmandu': { latitude: 27.7172, longitude: 85.3240 },
  'Mumbai': { latitude: 19.0760, longitude: 72.8777 },
  'Delhi': { latitude: 28.6139, longitude: 77.2090 },
  'Jaipur': { latitude: 26.9124, longitude: 75.7873 },
  'Goa': { latitude: 15.2993, longitude: 74.1240 },
  'Maldives': { latitude: 3.2028, longitude: 73.2207 },
  // Middle East
  'Dubai': { latitude: 25.2048, longitude: 55.2708 },
  'Abu Dhabi': { latitude: 24.4539, longitude: 54.3773 },
  'Istanbul': { latitude: 41.0082, longitude: 28.9784 },
  'Cappadocia': { latitude: 38.6431, longitude: 34.8307 },
  'Petra': { latitude: 30.3285, longitude: 35.4444 },
  'Marrakech': { latitude: 31.6295, longitude: -7.9811 },
  // Africa
  'Cape Town': { latitude: -33.9249, longitude: 18.4241 },
  'Johannesburg': { latitude: -26.2041, longitude: 28.0473 },
  'Nairobi': { latitude: -1.2921, longitude: 36.8219 },
  'Cairo': { latitude: 30.0444, longitude: 31.2357 },
  'Zanzibar': { latitude: -6.1659, longitude: 39.2026 },
  // Americas
  'New York': { latitude: 40.7128, longitude: -74.0060 },
  'Los Angeles': { latitude: 34.0522, longitude: -118.2437 },
  'San Francisco': { latitude: 37.7749, longitude: -122.4194 },
  'Chicago': { latitude: 41.8781, longitude: -87.6298 },
  'Miami': { latitude: 25.7617, longitude: -80.1918 },
  'New Orleans': { latitude: 29.9511, longitude: -90.0715 },
  'Las Vegas': { latitude: 36.1699, longitude: -115.1398 },
  'Mexico City': { latitude: 19.4326, longitude: -99.1332 },
  'Cancun': { latitude: 21.1619, longitude: -86.8515 },
  'Havana': { latitude: 23.1136, longitude: -82.3666 },
  'Bogota': { latitude: 4.7110, longitude: -74.0721 },
  'Lima': { latitude: -12.0464, longitude: -77.0428 },
  'Cusco': { latitude: -13.5170, longitude: -71.9785 },
  'Buenos Aires': { latitude: -34.6037, longitude: -58.3816 },
  'Rio de Janeiro': { latitude: -22.9068, longitude: -43.1729 },
  'Sao Paulo': { latitude: -23.5505, longitude: -46.6333 },
  'Santiago': { latitude: -33.4489, longitude: -70.6693 },
  'Toronto': { latitude: 43.6532, longitude: -79.3832 },
  'Vancouver': { latitude: 49.2827, longitude: -123.1207 },
  'Montreal': { latitude: 45.5017, longitude: -73.5673 },
  // Oceania
  'Sydney': { latitude: -33.8688, longitude: 151.2093 },
  'Melbourne': { latitude: -37.8136, longitude: 144.9631 },
  'Auckland': { latitude: -36.8485, longitude: 174.7633 },
  'Queenstown': { latitude: -45.0312, longitude: 168.6626 },
};

const COUNTRY_COORDS: Record<string, Coords> = {
  'Argentina': { latitude: -38.4161, longitude: -63.6167 },
  'Australia': { latitude: -25.2744, longitude: 133.7751 },
  'Austria': { latitude: 47.5162, longitude: 14.5501 },
  'Belgium': { latitude: 50.5039, longitude: 4.4699 },
  'Brazil': { latitude: -14.2350, longitude: -51.9253 },
  'Canada': { latitude: 56.1304, longitude: -106.3468 },
  'Chile': { latitude: -35.6751, longitude: -71.5430 },
  'China': { latitude: 35.8617, longitude: 104.1954 },
  'Croatia': { latitude: 45.1000, longitude: 15.2000 },
  'Czech Republic': { latitude: 49.8175, longitude: 15.4730 },
  'Czechia': { latitude: 49.8175, longitude: 15.4730 },
  'Denmark': { latitude: 56.2639, longitude: 9.5018 },
  'Egypt': { latitude: 26.8206, longitude: 30.8025 },
  'Finland': { latitude: 61.9241, longitude: 25.7482 },
  'France': { latitude: 46.2276, longitude: 2.2137 },
  'Germany': { latitude: 51.1657, longitude: 10.4515 },
  'Greece': { latitude: 39.0742, longitude: 21.8243 },
  'Hungary': { latitude: 47.1625, longitude: 19.5033 },
  'Iceland': { latitude: 64.9631, longitude: -19.0208 },
  'India': { latitude: 20.5937, longitude: 78.9629 },
  'Indonesia': { latitude: -0.7893, longitude: 113.9213 },
  'Ireland': { latitude: 53.1424, longitude: -7.6921 },
  'Italy': { latitude: 41.8719, longitude: 12.5674 },
  'Japan': { latitude: 36.2048, longitude: 138.2529 },
  'Mexico': { latitude: 23.6345, longitude: -102.5528 },
  'Morocco': { latitude: 31.7917, longitude: -7.0926 },
  'Netherlands': { latitude: 52.1326, longitude: 5.2913 },
  'New Zealand': { latitude: -40.9006, longitude: 174.8860 },
  'Norway': { latitude: 60.4720, longitude: 8.4689 },
  'Peru': { latitude: -9.1900, longitude: -75.0152 },
  'Portugal': { latitude: 39.3999, longitude: -8.2245 },
  'Singapore': { latitude: 1.3521, longitude: 103.8198 },
  'South Africa': { latitude: -30.5595, longitude: 22.9375 },
  'South Korea': { latitude: 35.9078, longitude: 127.7669 },
  'Spain': { latitude: 40.4637, longitude: -3.7492 },
  'Sweden': { latitude: 60.1282, longitude: 18.6435 },
  'Switzerland': { latitude: 46.8182, longitude: 8.2275 },
  'Thailand': { latitude: 15.8700, longitude: 100.9925 },
  'Turkey': { latitude: 38.9637, longitude: 35.2433 },
  'United Arab Emirates': { latitude: 23.4241, longitude: 53.8478 },
  'United Kingdom': { latitude: 55.3781, longitude: -3.4360 },
  'UK': { latitude: 55.3781, longitude: -3.4360 },
  'United States': { latitude: 37.0902, longitude: -95.7129 },
  'USA': { latitude: 37.0902, longitude: -95.7129 },
  'Vietnam': { latitude: 14.0583, longitude: 108.2772 },
};

function normalizeLocation(value?: string) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ') ?? '';
}

function lookupIn(source: Record<string, Coords>, value?: string) {
  const normalized = normalizeLocation(value);
  if (!normalized) return undefined;
  const exact = Object.keys(source).find(key => normalizeLocation(key) === normalized);
  if (exact) return source[exact];
  const partial = Object.keys(source).find(key => {
    const candidate = normalizeLocation(key);
    return normalized.includes(candidate) || candidate.includes(normalized);
  });
  return partial ? source[partial] : undefined;
}

export function lookupCoords(cityName: string, countryName?: string): Coords | undefined {
  return lookupIn(CITY_COORDS, cityName)
    ?? lookupIn(COUNTRY_COORDS, cityName)
    ?? lookupIn(COUNTRY_COORDS, countryName);
}

export function resolvePlaceCoordinates(place: PlaceCoordinateInput): Coords | undefined {
  const existing = getExistingCoords(place);
  const nameCoords = lookupIn(CITY_COORDS, place.name) ?? lookupIn(COUNTRY_COORDS, place.name);
  const cityCoords = lookupIn(CITY_COORDS, place.city);
  const fallbackCoords = nameCoords ?? cityCoords ?? lookupIn(COUNTRY_COORDS, place.country);

  if (!existing) return fallbackCoords;
  if (nameCoords && distanceKm(existing, nameCoords) > 100) return nameCoords;
  if (cityCoords && distanceKm(existing, cityCoords) > 100) return cityCoords;

  return existing;
}

function getExistingCoords(place: PlaceCoordinateInput): Coords | undefined {
  if (typeof place.latitude !== 'number' || typeof place.longitude !== 'number') return undefined;
  if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return undefined;
  if (Math.abs(place.latitude) > 90 || Math.abs(place.longitude) > 180) return undefined;
  return { latitude: place.latitude, longitude: place.longitude };
}

function distanceKm(a: Coords, b: Coords) {
  const radiusKm = 6371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const haversine = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
