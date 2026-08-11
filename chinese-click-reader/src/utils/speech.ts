import type { Segment } from '../types';

export const DEFAULT_SPEECH_RATE = 1;
export const MIN_SPEECH_RATE = 0.6;
export const MAX_SPEECH_RATE = 1.6;
export const SPEECH_RATE_STORAGE_KEY = 'ccr:speech-rate';
export const SPEECH_VOICE_STORAGE_KEY = 'ccr:speech-voice-uri';

const naturalVoicePattern = /enhanced|premium|natural|neural|online.{0,16}natural|xiaoxiao|xiaoyi|yunxi|yunyang|xiaohan|xiaomeng/i;
const roboticVoicePattern = /compact|espeak|festival/i;
const preferredProviderPattern = /google.*(?:mandarin|普通话|中文)|microsoft.*online/i;

type VoiceCandidate = Pick<SpeechSynthesisVoice, 'lang' | 'name' | 'default'>
  & Partial<Pick<SpeechSynthesisVoice, 'voiceURI' | 'localService'>>;

export interface SpeechChunk {
  text: string;
  start: number;
  end: number;
}

export interface SegmentRange {
  index: number;
  start: number;
  end: number;
  isChinese: boolean;
}

function normalizedLanguage(language: string) {
  return language.trim().replaceAll('_', '-').toLowerCase();
}

export function isMandarinVoice(voice: Pick<SpeechSynthesisVoice, 'lang'>) {
  const language = normalizedLanguage(voice.lang);
  if (/^yue(?:-|$)/.test(language) || /^zh(?:-hant)?-(?:hk|mo)$/.test(language)) return false;
  return /^(?:zh|cmn)(?:-|$)/.test(language);
}

function mandarinLanguageScore(languageValue: string) {
  const language = normalizedLanguage(languageValue);
  if (/^(?:zh|cmn)(?:-hans)?-cn$/.test(language)) return 120;
  if (/^(?:zh|cmn)(?:-hans)?-sg$/.test(language)) return 105;
  if (/^(?:zh|cmn)(?:-hant)?-tw$/.test(language)) return 85;
  if (/^cmn(?:-|$)/.test(language)) return 75;
  return /^zh(?:-|$)/.test(language) ? 60 : 0;
}

function voiceDescription(voice: Pick<SpeechSynthesisVoice, 'name'> & Partial<Pick<SpeechSynthesisVoice, 'voiceURI'>>) {
  return `${voice.name} ${voice.voiceURI ?? ''}`;
}

export function scoreMandarinVoice(voice: VoiceCandidate) {
  if (!isMandarinVoice(voice)) return 0;
  const description = voiceDescription(voice);
  let score = mandarinLanguageScore(voice.lang);
  if (naturalVoicePattern.test(description)) score += 200;
  else if (preferredProviderPattern.test(description)) score += 100;
  if (roboticVoicePattern.test(description)) score -= 300;
  if (voice.default) score += 2;
  if (voice.localService) score += 1;
  return score;
}

export function isLikelyNaturalVoice(voice?: Pick<SpeechSynthesisVoice, 'name'> & Partial<Pick<SpeechSynthesisVoice, 'voiceURI'>>) {
  return Boolean(voice && naturalVoicePattern.test(voiceDescription(voice)));
}

export function isLikelySmoothVoice(voice?: Pick<SpeechSynthesisVoice, 'name'> & Partial<Pick<SpeechSynthesisVoice, 'voiceURI'>>) {
  if (!voice) return false;
  const description = voiceDescription(voice);
  return naturalVoicePattern.test(description) || preferredProviderPattern.test(description);
}

export function getMandarinVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices()
    .filter(isMandarinVoice)
    .sort((a, b) => scoreMandarinVoice(b) - scoreMandarinVoice(a));
}

export function preferredMandarinVoice(voices = getMandarinVoices(), preferredVoiceURI?: string) {
  if (preferredVoiceURI) {
    const selected = voices.find((voice) => voice.voiceURI === preferredVoiceURI);
    if (selected) return selected;
  }
  return voices[0];
}

export function prepareMandarinUtterance(
  text: string,
  { rate = DEFAULT_SPEECH_RATE, voice }: { rate?: number; voice?: SpeechSynthesisVoice } = {},
) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voice?.lang || 'zh-CN';
  utterance.rate = Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, rate));
  utterance.pitch = 1;
  utterance.volume = 1;
  if (voice) utterance.voice = voice;
  return utterance;
}

function sentenceRanges(text: string): SpeechChunk[] {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'sentence' });
    return [...segmenter.segment(text)].map(({ segment, index }) => ({
      text: segment,
      start: index,
      end: index + segment.length,
    }));
  }

  const ranges: SpeechChunk[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (!/[。！？!?\n]/.test(text[index])) continue;
    const end = index + 1;
    ranges.push({ text: text.slice(start, end), start, end });
    start = end;
  }
  if (start < text.length) ranges.push({ text: text.slice(start), start, end: text.length });
  return ranges;
}

function splitLongSentence(text: string, sentence: SpeechChunk, maximumLength: number) {
  const chunks: SpeechChunk[] = [];
  let start = sentence.start;

  while (sentence.end - start > maximumLength) {
    const maximumEnd = start + maximumLength;
    const minimumBreak = start + Math.max(1, Math.floor(maximumLength * 0.55));
    let end = 0;

    for (const punctuation of [/[；;\n]/, /[，,]/]) {
      for (let index = maximumEnd; index > minimumBreak; index -= 1) {
        if (punctuation.test(text[index - 1])) {
          end = index;
          break;
        }
      }
      if (end) break;
    }

    end ||= maximumEnd;
    chunks.push({ text: text.slice(start, end), start, end });
    start = end;
  }

  if (start < sentence.end) chunks.push({ text: text.slice(start, sentence.end), start, end: sentence.end });
  return chunks;
}

export function chunkChinesePassageWithOffsets(text: string, maximumLength = 180): SpeechChunk[] {
  const limit = Math.max(1, maximumLength);
  const sentences = sentenceRanges(text).flatMap((sentence) => sentence.text.length > limit
    ? splitLongSentence(text, sentence, limit)
    : [sentence]);
  const chunks: SpeechChunk[] = [];
  let current: SpeechChunk | undefined;

  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
    } else if (sentence.end - current.start <= limit) {
      current = { text: text.slice(current.start, sentence.end), start: current.start, end: sentence.end };
    } else {
      if (current.text.trim()) chunks.push(current);
      current = sentence;
    }
  }
  if (current?.text.trim()) chunks.push(current);

  return chunks;
}

export function chunkChinesePassage(text: string) {
  return chunkChinesePassageWithOffsets(text).map((chunk) => chunk.text);
}

export function buildSegmentRanges(segments: Segment[]): SegmentRange[] {
  let offset = 0;
  return segments.map((segment, index) => {
    const range = { index, start: offset, end: offset + segment.text.length, isChinese: segment.isChinese };
    offset = range.end;
    return range;
  });
}

export function segmentIndexAtCharacter(ranges: SegmentRange[], charIndex?: number) {
  if (charIndex === undefined || !Number.isFinite(charIndex)) return undefined;
  let previousIndex: number | undefined;
  for (const range of ranges) {
    if (!range.isChinese) continue;
    if (charIndex < range.start) return previousIndex ?? range.index;
    if (charIndex < range.end) return range.index;
    previousIndex = range.index;
  }
  return previousIndex;
}

export function readStoredSpeechRate() {
  if (typeof window === 'undefined') return DEFAULT_SPEECH_RATE;
  try {
    const value = Number(window.localStorage.getItem(SPEECH_RATE_STORAGE_KEY));
    return Number.isFinite(value) && value >= MIN_SPEECH_RATE && value <= MAX_SPEECH_RATE
      ? value
      : DEFAULT_SPEECH_RATE;
  } catch {
    return DEFAULT_SPEECH_RATE;
  }
}

export function readStoredVoiceURI() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(SPEECH_VOICE_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}
