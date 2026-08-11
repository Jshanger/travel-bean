import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chunkChinesePassageWithOffsets,
  prepareMandarinUtterance,
  preferredMandarinVoice,
} from './speech';
import { buildSynchronizedSpeechUnits } from './guidedPlayback';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('speech playback contracts', () => {
  it('keeps a normal multi-sentence phrase in one utterance for continuous prosody', () => {
    const passage = '你好。今天天气很好！我们一起去散步吧？';

    expect(chunkChinesePassageWithOffsets(passage)).toEqual([{
      text: passage,
      start: 0,
      end: passage.length,
    }]);
  });

  it('preserves contiguous source offsets when a passage requires several utterances', () => {
    const passage = [
      '这是第一段自然中文，用来测试连续朗读。',
      '这是第二段自然中文，也应该保持完整。',
      '最后一句不能丢失。',
    ].join('');
    const chunks = chunkChinesePassageWithOffsets(passage, 24);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map(({ text }) => text).join('')).toBe(passage);
    chunks.forEach((chunk, index) => {
      expect(passage.slice(chunk.start, chunk.end)).toBe(chunk.text);
      if (index > 0) expect(chunk.start).toBe(chunks[index - 1].end);
    });
  });

  it('uses the chosen voice and its language for generated Mandarin utterances', () => {
    class MockSpeechSynthesisUtterance {
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;

      constructor(public text: string) {}
    }
    vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance);
    const selected = {
      lang: 'cmn-Hans-CN',
      name: 'Natural Mandarin',
      voiceURI: 'natural-mandarin',
    } as SpeechSynthesisVoice;

    const utterance = prepareMandarinUtterance('我们一起学习中文。', {
      rate: 1,
      voice: selected,
    });

    expect(utterance.voice).toBe(selected);
    expect(utterance.lang).toBe('cmn-Hans-CN');
    expect(utterance.rate).toBe(1);
  });

  it('falls back to the best available voice when a saved voice is unavailable', () => {
    const smoothest = {
      lang: 'zh-CN',
      name: 'Natural Mandarin',
      voiceURI: 'natural-mandarin',
    } as SpeechSynthesisVoice;
    const standard = {
      lang: 'zh-CN',
      name: 'Standard Mandarin',
      voiceURI: 'standard-mandarin',
    } as SpeechSynthesisVoice;

    expect(preferredMandarinVoice([smoothest, standard], 'missing-voice')).toBe(smoothest);
    expect(preferredMandarinVoice([], 'missing-voice')).toBeUndefined();
  });

  it('creates rate-independent utterance start markers for every displayed word', () => {
    const units = buildSynchronizedSpeechUnits('不用羡慕别人。', [0, 2, 4]);
    expect(units.flatMap(({ wordStarts }) => wordStarts)).toEqual([0, 2, 4]);
    expect(units.map(({ text }) => text)).toEqual(['不用羡慕别人。']);
  });
});
