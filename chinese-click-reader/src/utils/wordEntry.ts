import type { DictionaryEntry, Segment } from '../types'; import { getPinyin } from './pinyin';
export const UNKNOWN_MEANING='Meaning not found yet.';
export function entryForSegment(segment:Segment):DictionaryEntry{return segment.entry??{chinese:segment.text,pinyin:getPinyin(segment.text),meaning:UNKNOWN_MEANING,difficultyLabel:'Unknown'}}
