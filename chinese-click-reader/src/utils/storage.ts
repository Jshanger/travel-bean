import type { ClickedWordHistoryItem, DifficultyLabel, SavedText, SavedWord } from '../types';
import { lookupCuratedDictionaryEntry, lookupDictionaryEntry } from './cedict';
import {
  getCurrentLocalProfile,
  LEGACY_ANONYMOUS_STORAGE_KEYS,
  readProfileData,
  writeProfileData,
} from './localAccounts';
import { UNKNOWN_MEANING } from './wordEntry';
import { getWordSourceTextIds, mergeSavedWord } from './wordSources';

function readLegacy<T>(key: string): T[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [];
  }
}

function normalizeWord(word: Partial<SavedWord> & Pick<SavedWord, 'chinese' | 'pinyin'>): SavedWord {
  const now = word.createdAt ?? new Date().toISOString();
  const curatedEntry = lookupCuratedDictionaryEntry(word.chinese);
  const dictionaryEntry = curatedEntry ?? lookupDictionaryEntry(word.chinese);
  const userEditedMeaning = word.userEditedMeaning ?? false;
  const labels: DifficultyLabel[] = ['Common', 'HSK-style', 'Unknown'];
  const storedDifficulty = labels.includes(word.difficultyLabel as DifficultyLabel)
    ? word.difficultyLabel as DifficultyLabel
    : undefined;
  const difficultyLabel = curatedEntry?.difficultyLabel
    ?? storedDifficulty
    ?? dictionaryEntry?.difficultyLabel
    ?? 'Unknown';
  const storedMeaning = typeof word.meaning === 'string' ? word.meaning.trim() : '';
  const meaning = userEditedMeaning && storedMeaning
    ? storedMeaning
    : curatedEntry?.meaning
      ?? (storedMeaning && storedMeaning !== UNKNOWN_MEANING
        ? storedMeaning
        : dictionaryEntry?.meaning ?? UNKNOWN_MEANING);
  const sourceTextIds = getWordSourceTextIds(word);

  return {
    id: word.id ?? crypto.randomUUID(),
    chinese: word.chinese,
    pinyin: curatedEntry?.pinyin ?? word.pinyin,
    meaning,
    originalMeaning: word.originalMeaning,
    userEditedMeaning,
    exampleSentence: word.exampleSentence ?? dictionaryEntry?.exampleSentence,
    difficultyLabel,
    sourceTextId: word.sourceTextId ?? sourceTextIds[0],
    sourceTextIds: sourceTextIds.length ? sourceTextIds : undefined,
    createdAt: now,
    updatedAt: word.updatedAt ?? now,
  };
}

function normalizeWords(items: SavedWord[]): SavedWord[] {
  const normalized: SavedWord[] = [];
  for (const item of items) {
    const word = normalizeWord(item);
    const existingIndex = normalized.findIndex((candidate) => candidate.chinese === word.chinese);
    if (existingIndex >= 0) normalized[existingIndex] = mergeSavedWord(normalized[existingIndex], word);
    else normalized.push(word);
  }
  return normalized;
}

export interface ReaderStorage {
  words: () => SavedWord[];
  texts: () => SavedText[];
  history: () => ClickedWordHistoryItem[];
  setWords: (items: SavedWord[]) => void;
  setTexts: (items: SavedText[]) => void;
  setHistory: (items: ClickedWordHistoryItem[]) => void;
}

export function createProfileStorage(profileId: string): ReaderStorage {
  return {
    words: () => normalizeWords(readProfileData<SavedWord>(profileId, 'words')),
    texts: () => readProfileData<SavedText>(profileId, 'texts'),
    history: () => readProfileData<ClickedWordHistoryItem>(profileId, 'history'),
    setWords: (items) => writeProfileData(profileId, 'words', items),
    setTexts: (items) => writeProfileData(profileId, 'texts', items),
    setHistory: (items) => writeProfileData(profileId, 'history', items),
  };
}

function currentStorage(): ReaderStorage | undefined {
  const profile = getCurrentLocalProfile();
  return profile ? createProfileStorage(profile.id) : undefined;
}

// Compatibility facade used by import normalization and older tests. The App
// itself uses createProfileStorage(profileId) so profile switching cannot leak
// stale data between workspaces.
export const storage = {
  words: () => currentStorage()?.words()
    ?? normalizeWords(readLegacy<SavedWord>(LEGACY_ANONYMOUS_STORAGE_KEYS.words)),
  texts: () => currentStorage()?.texts()
    ?? readLegacy<SavedText>(LEGACY_ANONYMOUS_STORAGE_KEYS.texts),
  history: () => currentStorage()?.history()
    ?? readLegacy<ClickedWordHistoryItem>(LEGACY_ANONYMOUS_STORAGE_KEYS.history),
  setWords: (items: SavedWord[]) => {
    const active = currentStorage();
    if (active) active.setWords(items);
    else localStorage.setItem(LEGACY_ANONYMOUS_STORAGE_KEYS.words, JSON.stringify(items));
  },
  setTexts: (items: SavedText[]) => {
    const active = currentStorage();
    if (active) active.setTexts(items);
    else localStorage.setItem(LEGACY_ANONYMOUS_STORAGE_KEYS.texts, JSON.stringify(items));
  },
  setHistory: (items: ClickedWordHistoryItem[]) => {
    const active = currentStorage();
    if (active) active.setHistory(items);
    else localStorage.setItem(LEGACY_ANONYMOUS_STORAGE_KEYS.history, JSON.stringify(items));
  },
  normalizeWord,
};
