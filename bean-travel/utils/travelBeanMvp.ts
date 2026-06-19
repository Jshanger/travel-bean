import type { BeanPhoto, PlaceCategory, PromptResponse, VisitedPlace } from '@/types';
import type { QuotePlacement, QuoteSourceType } from './quoteLibrary';

export type BeanLayout =
  | 'Scrapbook Story'
  | 'Polaroid Stack'
  | 'Postcard Stack'
  | 'Classic Postcard'
  | 'Postcard Mosaic'
  | 'Editorial Grid'
  | 'Film Strip'
  | 'Wander Journal'
  | 'Airmail Border'
  | 'Vintage Stamp Card'
  | 'Large Letter Travel'
  | 'Boarding Pass'
  | 'Gallery Postcard'
  | 'Sunset Postcard'
  | 'This Is Postcard'
  | 'Wish You Were Here'
  | 'Snapshots Postcard'
  | 'City Cover'
  | 'Black City Postcard'
  | 'Any City Mosaic'
  | 'Seek Travel'
  | 'Mountain Postcard'
  | 'Temple Heritage'
  | 'Break Postcard'
  | 'Food Trip'
  | 'Destination Sidebar'
  | 'Greetings Grid'
  | 'Masthead Postcard'
  | 'Pinned Snapshot'
  | 'Sunset Poster'
  | 'Passport Board'
  | 'Color Pop Tiles'
  | 'Dream Glow';
export type BeanMood = 'Cozy' | 'Playful' | 'Dreamy' | 'Minimal';

export const FREE_PHOTO_LIMIT = 8;
export const PREMIUM_PHOTO_LIMIT = 8;

export function photoLimitForPremium(isPremium: boolean) {
  return isPremium ? PREMIUM_PHOTO_LIMIT : FREE_PHOTO_LIMIT;
}

export interface TravelBeanDraft {
  place: string;
  country: string;
  date: string;
  layout: BeanLayout;
  mood: BeanMood;
  photos: BeanPhoto[];
  responses: PromptResponse[];
  hasWatermark?: boolean;
  exportQuality?: 'standard' | 'hd';
  selectedQuoteText?: string | null;
  selectedQuoteAuthor?: string | null;
  quoteSourceType?: QuoteSourceType;
  quotePlacement?: QuotePlacement;
  isPremiumQuoteStyle?: boolean;
}

export const SAMPLE_BEANS: VisitedPlace[] = [
  {
    id: 'sample-santorini',
    name: 'Santorini',
    city: 'Oia',
    country: 'Greece',
    category: 'landmark',
    dateVisited: '2024-05-05',
    createdAt: '2024-05-05T12:00:00.000Z',
    notes: 'Santorini memories. The sunsets were unreal and everything felt so peaceful. Exploring the little streets with no plan, just us.',
    moodTags: ['Cozy', 'Dreamy'],
    photos: [
      { id: 'santorini-1', imageUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=900&q=80' },
      { id: 'santorini-2', imageUrl: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?auto=format&fit=crop&w=900&q=80' },
      { id: 'santorini-3', imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80' },
    ],
  },
  {
    id: 'sample-kyoto',
    name: 'Kyoto',
    country: 'Japan',
    category: 'landmark',
    dateVisited: '2024-04-28',
    createdAt: '2024-04-28T12:00:00.000Z',
    notes: 'Lanterns, temple paths, and a slow evening walk that felt like stepping into a postcard.',
    moodTags: ['Playful'],
    photos: [
      { id: 'kyoto-1', imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=900&q=80' },
    ],
  },
  {
    id: 'sample-bali',
    name: 'Bali',
    country: 'Indonesia',
    category: 'nature',
    dateVisited: '2024-04-20',
    createdAt: '2024-04-20T12:00:00.000Z',
    notes: 'Warm air, quiet water, and breakfast after sunrise.',
    moodTags: ['Minimal'],
    photos: [
      { id: 'bali-1', imageUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=80' },
    ],
  },
  {
    id: 'sample-paris',
    name: 'Paris',
    country: 'France',
    category: 'landmark',
    dateVisited: '2024-04-12',
    createdAt: '2024-04-12T12:00:00.000Z',
    notes: 'A spring walk, tiny cafes, and the feeling of having nowhere better to be.',
    moodTags: ['Dreamy'],
    photos: [
      { id: 'paris-1', imageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80' },
    ],
  },
];

export const STORY_PROMPTS = [
  'What made this place special?',
  'What is one moment you will remember?',
  'How did this trip make you feel?',
] as const;

export const STORY_PROMPT_BANK = [
  ...STORY_PROMPTS,
  'What tiny detail do you not want to forget?',
  'What did this place smell, sound, or feel like?',
  'Who were you with, and what made it sweet?',
  'What surprised you here?',
  'What would you tell future-you about this moment?',
  'What did you find by accident?',
  'What felt different from home?',
  'What color or light do you remember most?',
  'What made you smile here?',
  'What did you eat, hear, or notice?',
  'What was the best slow moment?',
  'What would make you want to come back?',
] as const;

export function randomStoryPrompts(current: readonly string[] = [], count = 3) {
  const currentPrompts = new Set(current);
  const freshPrompts = STORY_PROMPT_BANK.filter(prompt => !currentPrompts.has(prompt));
  const source = freshPrompts.length >= count ? freshPrompts : STORY_PROMPT_BANK;

  return [...source]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

export type LayoutTier = 'free' | 'premium';

export interface LayoutConfig {
  id: string;
  name: BeanLayout;
  type: LayoutTier;
  description: string;
  previewImage?: string;
  isLocked?: boolean;
}

export const LAYOUTS: LayoutConfig[] = [
  { id: 'polaroid-stack', name: 'Polaroid Stack', type: 'free', description: 'A polished stack of travel prints with a hero memory.', isLocked: false },
  { id: 'editorial-grid', name: 'Editorial Grid', type: 'free', description: 'Magazine-style travel page with bold photo rhythm.', isLocked: false },
  { id: 'classic-postcard', name: 'Classic Postcard', type: 'free', description: 'A clean photo-first postcard with room for every memory.', isLocked: false },
  { id: 'boarding-pass', name: 'Boarding Pass', type: 'free', description: 'Ticket-inspired framing for memories that feel ready to send.', isLocked: false },
  { id: 'airmail-border', name: 'Airmail Border', type: 'free', description: 'A crisp airmail-inspired postcard frame with bold travel color.', isLocked: false },
  { id: 'film-strip', name: 'Film Strip', type: 'free', description: 'Cinematic frames for trips that feel like a movie.', isLocked: false },
  { id: 'this-is-postcard', name: 'This Is Postcard', type: 'premium', description: 'A bold destination poster with huge type over a full scenic image.', isLocked: true },
  { id: 'wish-you-were-here', name: 'Wish You Were Here', type: 'premium', description: 'A high-contrast travel montage with a centered postcard message.', isLocked: true },
  { id: 'snapshots-postcard', name: 'Snapshots Postcard', type: 'premium', description: 'An eight-photo travel postcard with a calm note panel and destination type.', isLocked: true },
  { id: 'city-cover', name: 'City Cover', type: 'premium', description: 'A moody one-photo city cover with bold destination lettering.', isLocked: true },
  { id: 'black-city-postcard', name: 'Black City Postcard', type: 'premium', description: 'A black-and-white city postcard with a brush-script place name and map-pin mark.', isLocked: true },
  { id: 'any-city-mosaic', name: 'Any City Mosaic', type: 'premium', description: 'A grayscale urban photo mosaic with bold orange city type across the center.', isLocked: true },
  { id: 'seek-travel', name: 'Seek Travel', type: 'premium', description: 'A dark editorial travel card with stacked headline copy and a framed color hero photo.', isLocked: true },
  { id: 'mountain-postcard', name: 'Mountain Postcard', type: 'premium', description: 'A clean landscape postcard with a white caption band and airy blue destination type.', isLocked: true },
  { id: 'temple-heritage', name: 'Temple Heritage', type: 'premium', description: 'A refined heritage postcard with serif destination type, temple imagery, date, and country mark.', isLocked: true },
  { id: 'break-postcard', name: 'Break Postcard', type: 'premium', description: 'A soft resort-style photo card with a loose handwritten headline across the image.', isLocked: true },
  { id: 'food-trip', name: 'Food Trip', type: 'premium', description: 'A playful culinary travel board with layered food prints, route marks, and bold cafe lettering.', isLocked: true },
  { id: 'destination-sidebar', name: 'Destination Sidebar', type: 'premium', description: 'An editorial postcard with a strong place-title sidebar and full-bleed photo.', isLocked: true },
  { id: 'greetings-grid', name: 'Greetings Grid', type: 'premium', description: 'A classic greetings-from card with a clean photo grid and center title band.', isLocked: true },
  { id: 'masthead-postcard', name: 'Masthead Postcard', type: 'premium', description: 'A refined magazine masthead above a large destination photograph.', isLocked: true },
  { id: 'pinned-snapshot', name: 'Pinned Snapshot', type: 'premium', description: 'A polished instant-photo keepsake pinned over a full-photo backdrop.', isLocked: true },
];

export const MOODS: BeanMood[] = ['Cozy', 'Playful', 'Dreamy', 'Minimal'];

export function isPremiumLayout(layout?: BeanLayout | string) {
  const normalized = layout === 'Postcard Stack' ? 'Polaroid Stack' : layout;
  return LAYOUTS.some(item => item.name === normalized && item.type === 'premium');
}

export function layoutConfigFor(layout?: BeanLayout | string) {
  const normalized = layout === 'Postcard Stack' ? 'Polaroid Stack' : layout;
  return LAYOUTS.find(item => item.name === normalized);
}

export function allBeans(saved: VisitedPlace[]) {
  return [...saved, ...SAMPLE_BEANS].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function primaryPhoto(bean: VisitedPlace) {
  return bean.photos?.[0]?.imageUrl ?? fallbackPhoto(bean.country);
}

export function fallbackPhoto(country: string) {
  const sample = SAMPLE_BEANS.find(bean => bean.country === country);
  return sample?.photos?.[0]?.imageUrl ?? SAMPLE_BEANS[0].photos![0].imageUrl;
}

export function beanTitle(bean: VisitedPlace) {
  const firstLine = bean.notes.split('\n').find(Boolean);
  const cleaned = firstLine?.replace(/^Mood: .+$/i, '').trim();
  if (!cleaned) return `${bean.name} memories`;
  const firstSentence = cleaned.match(/^.+?[.!?](?:\s|$)/)?.[0]?.trim();
  return firstSentence && firstSentence.length < cleaned.length ? firstSentence.replace(/[.!?]$/, '') : cleaned;
}

export function memoryResponses(bean: VisitedPlace) {
  if (bean.promptResponses?.length) {
    const responses = bean.promptResponses
      .map(item => item.response.trim())
      .filter(Boolean);
    if (responses.length) return responses;
  }

  return bean.notes
    .split('\n')
    .map(line => line.trim())
    .filter(line =>
      line.length > 0 &&
      !/^Summary:/i.test(line) &&
      !/^Mood:/i.test(line) &&
      !/^Layout:/i.test(line),
    )
    .map(line => line.replace(/^.+\?\s*/, '').replace(/^.+?\bmemories[.!?]?\s*/i, '').trim())
    .filter(Boolean);
}

export function journalSummary(bean: VisitedPlace) {
  const memoryText = journalMemoryText(bean);
  if (memoryText) return memoryText;

  const cleaned = bean.notes
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !/^Mood:/i.test(line) && !/^Layout:/i.test(line));
  return cleaned.slice(0, 2).join(' ') || `${bean.name} memories`;
}

export function journalMemoryText(bean: VisitedPlace) {
  const explicitSummary = explicitJournalSummary(bean.notes);
  if (explicitSummary) return explicitSummary;

  const memories = memoryResponses(bean);
  if (memories.length) return memories.join(' ');

  return '';
}

export function isUnfinishedBeanDraft(bean: VisitedPlace) {
  const metadata = bean as VisitedPlace & { beanStatus?: string; isDraft?: boolean; status?: string };
  if (metadata.isDraft === true) return true;
  if (isDraftStatus(metadata.beanStatus) || isDraftStatus(metadata.status)) return true;

  return bean.notes
    .split('\n')
    .map(line => line.trim())
    .some(line => {
      const match = line.match(/^(?:Bean status|Status|Draft):\s*(.+)$/i);
      return Boolean(match && isDraftStatus(match[1]));
    });
}

export function serializeJournalNotes(title: string, summary: string, extraNotes: string, mood?: string, layout?: string) {
  return [
    title.trim() || 'Travel memories',
    summary.trim() ? `Summary:\n${summary.trim()}` : '',
    extraNotes.trim() ? `More notes:\n${extraNotes.trim()}` : '',
    mood ? `Mood: ${mood}` : '',
    layout ? `Layout: ${layout}` : '',
  ].filter(Boolean).join('\n\n');
}

function explicitJournalSummary(notes: string) {
  return notes
    .match(/(?:^|\n)Summary:\s*\n([\s\S]*?)(?:\n\nMore notes:|\n\nMood:|\n\nLayout:|$)/i)?.[1]
    ?.trim() ?? '';
}

export function formatDate(date?: string) {
  if (!date) return 'Today';
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function makeBeanPlace(draft: TravelBeanDraft): Omit<VisitedPlace, 'id' | 'createdAt'> {
  const answered = draft.responses.filter(item => item.response.trim());
  const notes = [
    `${draft.place.trim() || 'Travel'} memories`,
    answered.map(item => `${item.prompt} ${item.response.trim()}`).join('\n'),
    `Mood: ${draft.mood}`,
    `Layout: ${draft.layout}`,
  ].filter(Boolean).join('\n\n');

  return {
    name: draft.place.trim() || 'New Bean',
    country: draft.country.trim() || 'Somewhere beautiful',
    category: 'landmark' as PlaceCategory,
    dateVisited: draft.date,
    notes,
    moodTags: [draft.mood],
    promptResponses: draft.responses,
    photos: draft.photos,
    selectedLayout: draft.layout,
    selectedMood: draft.mood,
    isPremiumLayout: isPremiumLayout(draft.layout),
    hasWatermark: draft.hasWatermark ?? true,
    exportQuality: draft.exportQuality ?? 'standard',
    selectedQuoteText: draft.selectedQuoteText ?? null,
    selectedQuoteAuthor: draft.selectedQuoteAuthor ?? null,
    quoteSourceType: draft.quoteSourceType ?? 'none',
    quotePlacement: draft.quotePlacement ?? 'none',
    isPremiumQuoteStyle: draft.isPremiumQuoteStyle ?? Boolean(draft.selectedQuoteText && draft.quotePlacement !== 'none'),
  };
}

function isDraftStatus(value?: string) {
  return /^(draft|in progress|unfinished|true)$/i.test(value?.trim() ?? '');
}
