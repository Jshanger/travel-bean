import type { PromptResponse, VisitedPlace } from '@/types';

export const BEAN_DATA_MARKER = '\n\n__TRAVEL_BEAN_DATA__\n';

export type PersistedBeanMetadata = {
  moodTags?: string[];
  promptResponses?: PromptResponse[];
  selectedLayout?: string;
  selectedMood?: string;
  isPremiumLayout?: boolean;
  hasWatermark?: boolean;
  exportQuality?: 'standard' | 'hd';
  selectedQuoteText?: string | null;
  selectedQuoteAuthor?: string | null;
  quoteSourceType?: 'premium_library' | 'premium_custom' | 'none';
  quotePlacement?: 'postcard_quote' | 'scrapbook_note' | 'film_subtitle' | 'elegant_overlay' | 'none';
  isPremiumQuoteStyle?: boolean;
};

export function splitPersistedBeanNotes(notes?: string | null) {
  const value = notes ?? '';
  const markerIndex = value.lastIndexOf(BEAN_DATA_MARKER);
  if (markerIndex < 0) return { notes: value, metadata: {} as PersistedBeanMetadata };

  const humanNotes = value.slice(0, markerIndex).trimEnd();
  const rawMetadata = value.slice(markerIndex + BEAN_DATA_MARKER.length).trim();
  try {
    return {
      notes: humanNotes,
      metadata: JSON.parse(rawMetadata) as PersistedBeanMetadata,
    };
  } catch {
    return { notes: value, metadata: {} as PersistedBeanMetadata };
  }
}

export function beanMetadata(bean: Partial<VisitedPlace>): PersistedBeanMetadata {
  return {
    moodTags: bean.moodTags ?? [],
    promptResponses: bean.promptResponses ?? [],
    selectedLayout: bean.selectedLayout,
    selectedMood: bean.selectedMood,
    isPremiumLayout: bean.isPremiumLayout,
    hasWatermark: bean.hasWatermark,
    exportQuality: bean.exportQuality,
    selectedQuoteText: bean.selectedQuoteText ?? null,
    selectedQuoteAuthor: bean.selectedQuoteAuthor ?? null,
    quoteSourceType: bean.quoteSourceType ?? 'none',
    quotePlacement: bean.quotePlacement ?? 'none',
    isPremiumQuoteStyle: bean.isPremiumQuoteStyle ?? false,
  };
}

export function encodePersistedBeanNotes(notes: string, bean: Partial<VisitedPlace>) {
  const cleanNotes = splitPersistedBeanNotes(notes).notes.trimEnd();
  return `${cleanNotes}${BEAN_DATA_MARKER}${JSON.stringify(beanMetadata(bean))}`;
}

export function hydratePersistedBean<T extends { notes?: string | null }>(row: T): T & PersistedBeanMetadata & { notes: string } {
  const decoded = splitPersistedBeanNotes(row.notes);
  return {
    ...row,
    ...decoded.metadata,
    notes: decoded.notes,
  };
}
