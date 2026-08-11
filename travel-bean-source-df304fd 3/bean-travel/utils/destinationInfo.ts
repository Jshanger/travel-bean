import { WORLD_COUNTRIES } from '@/constants/worldCountries';

const FACTS: Record<string, string> = {
  France: 'Museums, wine regions, alpine towns, Riviera coastlines and cafe culture.',
  Italy: 'Ancient cities, coast drives, espresso bars, pasta regions and Renaissance art.',
  Japan: 'Temples, neon districts, mountain villages, ramen alleys and seasonal gardens.',
  Thailand: 'Island beaches, night markets, temples, street food and jungle escapes.',
  Spain: 'Tapas streets, beach towns, festivals, architecture and late-night plazas.',
  Portugal: 'Tile-lined streets, surf towns, wine valleys, seafood and golden viewpoints.',
  Greece: 'Island hopping, ancient ruins, blue coves and long Mediterranean dinners.',
  Mexico: 'Mayan ruins, beach towns, markets, cenotes and colorful food culture.',
  Morocco: 'Medinas, desert camps, riads, mountain roads and spice-filled souks.',
  Australia: 'Coastal cities, reefs, road trips, national parks and wildlife encounters.',
  USA: 'National parks, iconic cities, road trips, music scenes and regional food.',
  'United States': 'National parks, iconic cities, road trips, music scenes and regional food.',
  Indonesia: 'Islands, temples, surf breaks, volcano hikes and tropical food.',
  Turkey: 'Bazaar streets, coastline ruins, tea culture, mosques and dramatic landscapes.',
  Brazil: 'Beaches, rainforest, samba cities, waterfalls and colorful neighborhoods.',
  Vietnam: 'Lantern towns, limestone bays, coffee culture, rice terraces and street food.',
  Canada: 'Mountain lakes, cozy cities, scenic rail routes, forests and winter escapes.',
  'South Korea': 'Design cafes, palaces, night markets, mountain trails and fast city energy.',
  'South Africa': 'Coastal drives, wine regions, mountain views, wildlife and layered cities.',
  'New Zealand': 'Fjords, alpine towns, lake roads, adventure sports and dramatic hikes.',
  Iceland: 'Waterfalls, hot springs, black-sand beaches, glaciers and northern lights.',
};

const PALETTES = [
  ['#2500FF', '#18BBD4'],
  ['#542CF4', '#FF7B8E'],
  ['#1EC8A5', '#49B8FF'],
  ['#FF8A5B', '#FFC857'],
  ['#7C3AED', '#22D3EE'],
] as const;

export function inferCountryFromLocation(location?: string) {
  if (!location) return '';
  const lower = location.toLowerCase();
  const match = [...WORLD_COUNTRIES]
    .sort((a, b) => b.length - a.length)
    .find(country => lower.includes(country.toLowerCase()));
  return match ?? '';
}

export function getDestinationInfo(country?: string, fallbackLocation?: string) {
  const resolved = country || inferCountryFromLocation(fallbackLocation);
  const seed = (resolved || fallbackLocation || 'travel')
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return {
    country: resolved,
    fact: resolved
      ? FACTS[resolved] ?? `${resolved} is ready for a future trip: save cafes, landmarks, neighborhoods and local tips here.`
      : 'Pick a country to unlock map details, travel context and a richer planning card.',
    palette: PALETTES[seed % PALETTES.length],
  };
}
