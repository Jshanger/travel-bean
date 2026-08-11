import { describe, expect, it } from 'vitest';
import {
  activeWordNeedsScroll,
  buildSynchronizedSpeechUnits,
  clampGuidedInfoCenter,
  snapCharacterToWordStart,
} from './guidedPlayback';

describe('smooth guided playback helpers', () => {
  it('builds short natural phrase groups and preserves every learning-word marker', () => {
    expect(buildSynchronizedSpeechUnits('我哪能跟王老师比啊？', [0, 1, 3, 4, 7, 8])).toEqual([
      { text: '我哪能跟王老师比啊？', start: 0, wordStarts: [0, 1, 3, 4, 7, 8] },
    ]);
  });

  it('breaks on Chinese clause punctuation for natural prosody', () => {
    expect(buildSynchronizedSpeechUnits('不用羡慕别人。你也很好。', [0, 2, 4, 7, 8, 9])).toEqual([
      { text: '不用羡慕别人。', start: 0, wordStarts: [0, 2, 4] },
      { text: '你也很好。', start: 7, wordStarts: [7, 8, 9] },
    ]);
  });

  it('normalizes duplicate and unordered word starts before building speech units', () => {
    expect(buildSynchronizedSpeechUnits('你好。', [1, 0, 1, 99, -1])).toEqual([
      { text: '你好。', start: 0, wordStarts: [0, 1] },
    ]);
  });

  it('holds multi-character words until the next real word starts', () => {
    const starts = [0, 2, 3, 4, 5, 7]; // 孙月 / 和 / 我 / 去 / 看 / 情况
    expect(snapCharacterToWordStart(starts, 0)).toBe(0);
    expect(snapCharacterToWordStart(starts, 1)).toBe(0);
    expect(snapCharacterToWordStart(starts, 6)).toBe(5);
    expect(snapCharacterToWordStart(starts, 7)).toBe(7);
    expect(snapCharacterToWordStart(starts, 99)).toBe(7);
  });

  it('keeps scrolling quiet while the active word remains in a central comfort band', () => {
    expect(activeWordNeedsScroll({ top: 300, bottom: 340 }, 800)).toBe(false);
    expect(activeWordNeedsScroll({ top: 100, bottom: 140 }, 800)).toBe(true);
    expect(activeWordNeedsScroll({ top: 650, bottom: 690 }, 800)).toBe(true);
  });

  it('keeps the moving word-information badge inside the reading surface', () => {
    expect(clampGuidedInfoCenter(12, 120, 500)).toBe(68);
    expect(clampGuidedInfoCenter(250, 120, 500)).toBe(250);
    expect(clampGuidedInfoCenter(490, 120, 500)).toBe(432);
  });
});
