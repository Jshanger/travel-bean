import type { DictionaryEntry } from '../types';
import { dictionaryMap } from '../data/dictionary';
import { hsk4MeaningMap } from '../data/hsk4Dictionary';
import { getPinyin } from './pinyin';

type CompactDictionary = Record<string, string>;

let extendedDictionary: CompactDictionary | undefined;
let dictionaryLoad: Promise<number> | undefined;

const referenceOnlyMeaning = /^(erhua form|variant|old variant|archaic variant|see(?: also)?)\s+(?:of\s+)?([\u3400-\u9fff]+)/i;

function cleanDictionaryGloss(meaning: string) {
  return meaning
    .replace(/\[\w+(?:\s+\w+)*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function resolveLearnerMeaning(chinese: string, rawMeaning: string, seen = new Set<string>()): string {
  const cleaned = cleanDictionaryGloss(rawMeaning);
  const reference = cleaned.match(referenceOnlyMeaning);
  if (!reference || seen.has(chinese)) return cleaned;

  const target = reference[2];
  const targetRaw = dictionaryMap.get(target)?.meaning
    ?? hsk4MeaningMap.get(target)
    ?? extendedDictionary?.[target];
  if (!targetRaw) return cleaned;

  const nextSeen = new Set(seen).add(chinese);
  const targetMeaning = resolveLearnerMeaning(target, targetRaw, nextSeen);
  const note = reference[1].toLowerCase().startsWith('erhua')
    ? `colloquial erhua form of ${target}`
    : `${reference[1].toLowerCase()} of ${target}`;
  return `${targetMeaning} (${note})`;
}

function isCompactDictionary(value: unknown): value is CompactDictionary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const sample = (value as CompactDictionary)['情况'];
  return typeof sample === 'string' && sample.length > 0;
}

/** Load the bundled CC-CEDICT data once. No network API is used. */
export function loadExtendedDictionary(): Promise<number> {
  if (extendedDictionary) return Promise.resolve(Object.keys(extendedDictionary).length);
  if (dictionaryLoad) return dictionaryLoad;

  const dictionaryUrl = `${import.meta.env.BASE_URL}cedict-compact.json`;
  dictionaryLoad = fetch(dictionaryUrl)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Dictionary request failed (${response.status}).`);
      const parsed: unknown = await response.json();
      if (!isCompactDictionary(parsed)) throw new Error('Dictionary data is invalid.');
      extendedDictionary = parsed;
      return Object.keys(parsed).length;
    })
    .catch((error) => {
      dictionaryLoad = undefined;
      throw error;
    });

  return dictionaryLoad;
}

export function lookupCuratedDictionaryEntry(chinese: string): DictionaryEntry | undefined {
  return dictionaryMap.get(chinese);
}

/** Official cumulative HSK 1-4 vocabulary, bundled for immediate offline use. */
export function lookupHsk4DictionaryEntry(chinese: string): DictionaryEntry | undefined {
  const rawMeaning = hsk4MeaningMap.get(chinese);
  if (!rawMeaning) return undefined;

  return {
    chinese,
    pinyin: getPinyin(chinese),
    meaning: resolveLearnerMeaning(chinese, rawMeaning),
    difficultyLabel: 'HSK-style',
  };
}

export function lookupExtendedDictionaryEntry(chinese: string): DictionaryEntry | undefined {
  const rawMeaning = extendedDictionary?.[chinese];
  if (!rawMeaning) return undefined;

  return {
    chinese,
    pinyin: getPinyin(chinese),
    meaning: resolveLearnerMeaning(chinese, rawMeaning),
    // CC-CEDICT does not provide HSK levels, so do not invent one.
    difficultyLabel: 'Unknown',
  };
}

export function lookupDictionaryEntry(chinese: string): DictionaryEntry | undefined {
  return lookupCuratedDictionaryEntry(chinese)
    ?? lookupHsk4DictionaryEntry(chinese)
    ?? lookupExtendedDictionaryEntry(chinese);
}
