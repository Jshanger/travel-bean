import { PlaceSuggestion, searchPlaces } from '@/constants/placesDb';
import { PlaceCategory } from '@/types';

export type ProviderPlaceSuggestion = PlaceSuggestion & {
  id?: string;
  city?: string;
  provider: 'mapbox' | 'google' | 'local';
  address?: string;
  category?: PlaceCategory;
};

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

function categoryFromText(text: string): PlaceCategory {
  const value = text.toLowerCase();
  if (/(coffee|cafe|café|espresso|roaster)/.test(value)) return 'coffee_shop';
  if (/(restaurant|diner|bistro|ramen|food|bar|market)/.test(value)) return 'restaurant';
  if (/(hotel|hostel|riad|resort|inn)/.test(value)) return 'hotel';
  if (/(park|beach|mount|lake|waterfall|garden|trail|nature)/.test(value)) return 'nature';
  if (/(museum|temple|palace|tower|landmark|monument|gallery)/.test(value)) return 'landmark';
  return 'city';
}

function normalizeCountry(context: Array<{ id?: string; text?: string }> | undefined, fallback = '') {
  return context?.find(item => item.id?.startsWith('country'))?.text ?? fallback;
}

function normalizeCity(context: Array<{ id?: string; text?: string }> | undefined) {
  return context?.find(item => item.id?.startsWith('place') || item.id?.startsWith('locality'))?.text;
}

async function searchMapbox(query: string, country?: string): Promise<ProviderPlaceSuggestion[]> {
  if (!MAPBOX_TOKEN) return [];
  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    autocomplete: 'true',
    limit: '8',
    language: 'en',
    types: 'poi,place,locality,neighborhood,address',
  });
  const fullQuery = country ? `${query} ${country}` : query;
  const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fullQuery)}.json?${params.toString()}`);
  if (!res.ok) throw new Error(`Mapbox search failed (${res.status})`);
  const json = await res.json();
  return (json.features ?? []).map((feature: any): ProviderPlaceSuggestion => {
    const [longitude, latitude] = feature.center ?? [];
    const countryName = normalizeCountry(feature.context, country);
    const cityName = normalizeCity(feature.context);
    return {
      id: feature.id,
      name: feature.text ?? feature.place_name?.split(',')[0] ?? query,
      region: cityName,
      city: cityName,
      country: countryName || 'Unknown',
      latitude,
      longitude,
      provider: 'mapbox',
      address: feature.place_name,
      category: categoryFromText(`${feature.place_type?.join(' ')} ${feature.text ?? ''} ${feature.properties?.category ?? ''}`),
    };
  }).filter((item: ProviderPlaceSuggestion) => item.latitude != null && item.longitude != null);
}

async function searchGoogle(query: string, country?: string): Promise<ProviderPlaceSuggestion[]> {
  if (!GOOGLE_KEY) return [];
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.addressComponents',
    },
    body: JSON.stringify({
      textQuery: country ? `${query} ${country}` : query,
      languageCode: 'en',
      maxResultCount: 8,
    }),
  });
  if (!res.ok) throw new Error(`Google Places search failed (${res.status})`);
  const json = await res.json();
  return (json.places ?? []).map((place: any): ProviderPlaceSuggestion => {
    const components = place.addressComponents ?? [];
    const countryName = components.find((item: any) => item.types?.includes('country'))?.longText ?? country ?? 'Unknown';
    const cityName = components.find((item: any) =>
      item.types?.includes('locality') || item.types?.includes('administrative_area_level_2'),
    )?.longText;
    return {
      id: place.id,
      name: place.displayName?.text ?? query,
      region: cityName,
      city: cityName,
      country: countryName,
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
      provider: 'google',
      address: place.formattedAddress,
      category: categoryFromText((place.types ?? []).join(' ')),
    };
  }).filter((item: ProviderPlaceSuggestion) => item.latitude != null && item.longitude != null);
}

export async function searchPredictivePlaces(query: string, country?: string): Promise<ProviderPlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const local = searchPlaces(trimmed).map((item): ProviderPlaceSuggestion => ({
    ...item,
    provider: 'local',
    category: categoryFromText(item.name),
  }));

  try {
    const providerResults = MAPBOX_TOKEN
      ? await searchMapbox(trimmed, country)
      : await searchGoogle(trimmed, country);
    const seen = new Set<string>();
    return [...providerResults, ...local].filter(item => {
      const key = `${item.name}-${item.country}-${Math.round((item.latitude ?? 0) * 100)}-${Math.round((item.longitude ?? 0) * 100)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 8);
  } catch (error) {
    console.warn('Predictive place search fell back to local database', error);
    return local.slice(0, 8);
  }
}

export function hasPredictivePlaceProvider() {
  return Boolean(MAPBOX_TOKEN || GOOGLE_KEY);
}
