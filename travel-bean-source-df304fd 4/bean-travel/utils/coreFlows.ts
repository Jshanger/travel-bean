import type { BookingStatus, ItineraryItem, PlaceCategory, PromptResponse, TimeBlock, VisitedPlace } from '@/types';

export interface TravelBeanDraftInput {
  name: string;
  country: string;
  city?: string;
  category?: PlaceCategory;
  dateVisited?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  moodTags?: string[];
  promptResponses?: PromptResponse[];
}

export interface JourneyTemplateInput {
  dayStops: readonly (readonly string[])[];
  plan: readonly string[];
}

export interface StoryEntryInput {
  photoId: string;
  prompt: string;
  response?: string;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function serializeTravelBeanNotes(base: string, moods: string[], responses: PromptResponse[]) {
  const answered = responses.filter(r => r.response.trim());
  return [
    base.trim(),
    moods.length ? `Mood: ${moods.join(', ')}` : '',
    answered.length
      ? ['Reflections:', ...answered.map(r => `• ${r.prompt} ${r.response.trim()}`)].join('\n')
      : '',
  ].filter(Boolean).join('\n\n');
}

export function createTravelBeanDraft(input: TravelBeanDraftInput): Omit<VisitedPlace, 'id' | 'createdAt'> {
  const name = input.name.trim();
  const country = input.country.trim();
  if (!name) throw new Error('Place needs a name');
  if (!country) throw new Error('Place needs a country');
  return {
    name,
    country,
    city: input.city?.trim() || undefined,
    category: input.category ?? 'landmark',
    dateVisited: input.dateVisited ?? '',
    notes: serializeTravelBeanNotes(input.notes ?? '', input.moodTags ?? [], input.promptResponses ?? []),
    latitude: input.latitude,
    longitude: input.longitude,
    moodTags: input.moodTags ?? [],
    promptResponses: input.promptResponses ?? [],
  };
}

export function createStoryEntries(entries: StoryEntryInput[]) {
  return entries.map((entry, index) => ({
    id: uid(`story-entry-${index + 1}`),
    photoId: entry.photoId,
    prompt: entry.prompt,
    response: entry.response?.trim() ?? '',
  }));
}

const TIME_FOR_STOP: TimeBlock[] = ['Morning', 'Afternoon', 'Evening'];
const DEFAULT_BOOKING: BookingStatus = 'Not Booked';

export function buildJourneyTemplateItinerary(template: JourneyTemplateInput): Array<Omit<ItineraryItem, 'id' | 'votes' | 'comments'>> {
  return template.dayStops.flatMap((stops, dayIndex) =>
    stops.map((stop, stopIndex) => ({
      day: dayIndex + 1,
      timeBlock: TIME_FOR_STOP[stopIndex] ?? 'Afternoon',
      title: stop,
      location: stop,
      travelTime: stopIndex === 0 ? '' : '20-45 min',
      notes: template.plan[dayIndex] ?? '',
      bookingStatus: DEFAULT_BOOKING,
      budget: '',
    })),
  );
}
