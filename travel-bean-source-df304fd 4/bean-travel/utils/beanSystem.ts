import { BucketItem, VisitedPlace } from '@/types';

export type BeanKind = 'Memory' | 'Place';

export interface CollectedBean {
  id: string;
  kind: BeanKind;
  title: string;
  subtitle: string;
  accent: string;
}

export const ATMOSPHERE_TAGS = ['Quiet', 'Chaotic', 'Surreal', 'Peaceful', 'Cinematic'] as const;

export function placeToBean(place: VisitedPlace): CollectedBean {
  return {
    id: `place-${place.id}`,
    kind: 'Place',
    title: place.name,
    subtitle: `${place.city || place.country} · ${pickAtmosphere(place)}`,
    accent: categoryAccent(place.category),
  };
}

export function bucketToJourneyBean(item: BucketItem): CollectedBean {
  return {
    id: `journey-${item.id}`,
    kind: 'Place',
    title: item.name,
    subtitle: `${item.location} · ${item.status}`,
    accent: '#F6C85F',
  };
}

export function buildCollectedBeans(places: VisitedPlace[], _trips: unknown[], _bucketItems: BucketItem[]): CollectedBean[] {
  const recentPlaces = [...places]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4)
    .map(placeToBean);

  const memoryBeans = [...places]
    .filter(place => place.notes.trim().length > 0)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 2)
    .map(place => ({
      id: `memory-${place.id}`,
      kind: 'Memory' as const,
      title: `${place.name} memory`,
      subtitle: place.notes,
      accent: '#8B5CF6',
    }));

  return [...memoryBeans, ...recentPlaces].slice(0, 6);
}

function categoryAccent(category: VisitedPlace['category']) {
  switch (category) {
    case 'coffee_shop': return '#8B5CF6';
    case 'restaurant': return '#C9963A';
    case 'nature': return '#5BCF9A';
    case 'hidden_spot': return '#E87A8C';
    case 'landmark': return '#6BA3C4';
    case 'hotel': return '#9B8EC4';
    default: return '#E8825A';
  }
}

function pickAtmosphere(place: VisitedPlace) {
  const text = `${place.name} ${place.notes} ${place.category}`.toLowerCase();
  if (text.includes('coffee') || text.includes('cafe') || text.includes('quiet')) return 'Quiet';
  if (text.includes('market') || text.includes('city') || text.includes('street')) return 'Chaotic';
  if (text.includes('hidden') || text.includes('surreal')) return 'Surreal';
  if (text.includes('nature') || text.includes('park') || text.includes('beach')) return 'Peaceful';
  return 'Cinematic';
}
