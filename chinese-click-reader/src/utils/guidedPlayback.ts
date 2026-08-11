export const AUTO_SCROLL_COOLDOWN_MS = 800;

interface VerticalBounds {
  top: number;
  bottom: number;
}

export function snapCharacterToWordStart(offsets: number[], characterIndex: number) {
  if (!offsets.length) return characterIndex;
  if (characterIndex <= offsets[0]) return offsets[0];

  let low = 0;
  let high = offsets.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (offsets[middle] <= characterIndex) low = middle + 1;
    else high = middle - 1;
  }
  return offsets[Math.max(0, high)];
}

export interface SynchronizedSpeechUnit {
  text: string;
  start: number;
  wordStarts: number[];
}

export function buildSynchronizedSpeechUnits(text: string, wordOffsets: number[]): SynchronizedSpeechUnit[] {
  if (!text.trim()) return [];
  const starts = [...new Set(wordOffsets)]
    .filter((offset) => Number.isInteger(offset) && offset >= 0 && offset < text.length)
    .sort((a, b) => a - b);
  if (!starts.length) return [{ text, start: 0, wordStarts: [0] }];

  const words = starts.map((wordStart, index) => ({
    text: text.slice(index === 0 ? 0 : wordStart, starts[index + 1] ?? text.length),
    wordStart,
    speechStart: index === 0 ? 0 : wordStart,
  }));
  const units: SynchronizedSpeechUnit[] = [];
  let current: SynchronizedSpeechUnit | undefined;

  for (const word of words) {
    current ??= { text: '', start: word.speechStart, wordStarts: [] };
    current.text += word.text;
    current.wordStarts.push(word.wordStart);
    const naturalBreak = /[，。！？；：,!?;:\n]\s*$/.test(word.text);
    // Keep ordinary clauses in one utterance for natural Mandarin prosody.
    // The safety limits only split unusually long punctuation-free text.
    if (naturalBreak || current.wordStarts.length >= 8 || current.text.length >= 24) {
      units.push(current);
      current = undefined;
    }
  }
  if (current) units.push(current);
  return units;
}

export function activeWordNeedsScroll(
  bounds: VerticalBounds,
  viewportHeight: number,
  stickyHeaderBottom = 96,
) {
  const safeViewportHeight = Math.max(1, viewportHeight);
  const upperComfortEdge = Math.max(stickyHeaderBottom + 24, safeViewportHeight * 0.2);
  const lowerComfortEdge = Math.max(upperComfortEdge + 80, safeViewportHeight * 0.78);
  return bounds.top < upperComfortEdge || bounds.bottom > lowerComfortEdge;
}

export function clampGuidedInfoCenter(
  desiredCenter: number,
  infoWidth: number,
  containerWidth: number,
  gutter = 8,
) {
  const halfWidth = Math.max(0, infoWidth) / 2;
  const minimum = gutter + halfWidth;
  const maximum = Math.max(minimum, containerWidth - gutter - halfWidth);
  return Math.min(maximum, Math.max(minimum, desiredCenter));
}
