import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Segment } from '../types';
import { getImportKind } from './extractDocumentText';
import { segmentChinese } from './segmentChinese';
import {
  buildSegmentRanges,
  chunkChinesePassage,
  chunkChinesePassageWithOffsets,
  DEFAULT_SPEECH_RATE,
  getMandarinVoices,
  isLikelyNaturalVoice,
  isLikelySmoothVoice,
  isMandarinVoice,
  MAX_SPEECH_RATE,
  MIN_SPEECH_RATE,
  prepareMandarinUtterance,
  preferredMandarinVoice,
  scoreMandarinVoice,
  segmentIndexAtCharacter,
} from './speech';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('local imports and passage speech', () => {
  it('routes screenshots and supported documents to the correct local extractor', () => {
    expect(getImportKind({ name: 'wechat.png', type: 'image/png' })).toBe('image');
    expect(getImportKind({ name: 'camera-export.JPG', type: '' })).toBe('image');
    expect(getImportKind({ name: 'scan.webp', type: 'application/octet-stream' })).toBe('image');
    expect(getImportKind({ name: 'lesson.pdf', type: 'application/pdf' })).toBe('pdf');
    expect(getImportKind({ name: 'LESSON.PDF', type: '' })).toBe('pdf');
    expect(getImportKind({ name: 'notes.docx', type: '' })).toBe('docx');
    expect(getImportKind({ name: 'upload', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe('docx');
    expect(getImportKind({ name: 'menu.txt', type: 'text/plain' })).toBe('text');
    expect(getImportKind({ name: 'lesson.md', type: '' })).toBe('text');
    expect(getImportKind({ name: 'slides.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })).toBe('unsupported');
  });

  it('keeps a short passage together for smoother Mandarin prosody', () => {
    const passage = '你好。今天天气很好！我们出去吧？';
    expect(chunkChinesePassage(passage)).toEqual([passage]);
  });

  it('preserves exact source offsets when a long passage is chunked', () => {
    const passage = `${'这是一个帮助学习者练习听力的自然中文句子，'.repeat(9)}最后一句。`;
    const chunks = chunkChinesePassageWithOffsets(passage, 100);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.text).join('')).toBe(passage);
    for (const chunk of chunks) {
      expect(passage.slice(chunk.start, chunk.end)).toBe(chunk.text);
    }
  });

  it('prefers an enhanced Mandarin voice over older or compact voices', () => {
    const natural = { lang: 'zh-CN', name: 'Microsoft Xiaoxiao Online (Natural)', default: false };
    const older = { lang: 'zh-CN', name: 'Ting-Ting', default: true };
    const compact = { lang: 'zh-CN', name: 'Mandarin Compact', default: true };

    expect(scoreMandarinVoice(natural)).toBeGreaterThan(scoreMandarinVoice(older));
    expect(scoreMandarinVoice(older)).toBeGreaterThan(scoreMandarinVoice(compact));
  });

  it('treats known browser natural Mandarin providers as smoother voices', () => {
    const google = { lang: 'zh-CN', name: 'Google 普通话', default: false };
    const standard = { lang: 'zh-CN', name: 'Standard Mandarin', default: true };

    expect(isLikelySmoothVoice(google)).toBe(true);
    expect(scoreMandarinVoice(google)).toBeGreaterThan(scoreMandarinVoice(standard));
  });

  it('detects enhanced voice quality from the voice URI as well as its display name', () => {
    const enhanced = {
      lang: 'zh-CN',
      name: 'Tingting',
      voiceURI: 'com.apple.speech.synthesis.voice.tingting.premium',
      default: false,
      localService: true,
    };
    const compact = {
      lang: 'zh-CN',
      name: 'Tingting',
      voiceURI: 'com.apple.speech.synthesis.voice.tingting.compact',
      default: true,
      localService: true,
    };

    expect(isLikelyNaturalVoice(enhanced)).toBe(true);
    expect(scoreMandarinVoice(enhanced)).toBeGreaterThan(scoreMandarinVoice(compact));
  });

  it('sorts available voices so automatic playback uses the smoothest Mandarin option', () => {
    const standard = {
      lang: 'zh-CN',
      name: 'Ting-Ting',
      voiceURI: 'standard-mandarin',
      default: true,
      localService: true,
    } as SpeechSynthesisVoice;
    const enhanced = {
      lang: 'zh-CN',
      name: 'Ting-Ting',
      voiceURI: 'com.apple.speech.synthesis.voice.tingting.premium',
      default: false,
      localService: true,
    } as SpeechSynthesisVoice;
    const cantonese = {
      lang: 'yue-HK',
      name: 'Sin-Ji',
      voiceURI: 'cantonese',
      default: false,
      localService: true,
    } as SpeechSynthesisVoice;

    vi.stubGlobal('window', {
      speechSynthesis: { getVoices: () => [standard, cantonese, enhanced] },
    });

    const voices = getMandarinVoices();
    expect(voices).toEqual([enhanced, standard]);
    expect(preferredMandarinVoice(voices)).toBe(enhanced);
    expect(preferredMandarinVoice(voices, standard.voiceURI)).toBe(standard);
  });

  it('keeps Mandarin language variants while excluding Cantonese voices', () => {
    expect(isMandarinVoice({ lang: 'zh-CN' })).toBe(true);
    expect(isMandarinVoice({ lang: 'cmn-Hans-CN' })).toBe(true);
    expect(isMandarinVoice({ lang: 'zh-HK' })).toBe(false);
    expect(isMandarinVoice({ lang: 'yue-HK' })).toBe(false);
  });

  it('prefers Mainland Mandarin and defaults to a natural speaking pace', () => {
    const mainland = { lang: 'zh-CN', name: 'Standard Mandarin', default: false };
    const taiwanDefault = { lang: 'zh-TW', name: 'Standard Mandarin', default: true };

    expect(scoreMandarinVoice(mainland)).toBeGreaterThan(scoreMandarinVoice(taiwanDefault));
    expect(DEFAULT_SPEECH_RATE).toBe(1);
  });

  it('keeps normal sentences intact instead of cutting them at commas', () => {
    const first = `${'这是第一句话的一部分，'.repeat(3)}它应该完整结束。`;
    const second = `${'这是第二句话的一部分，'.repeat(3)}它也应该完整结束。`;
    const chunks = chunkChinesePassageWithOffsets(first + second, 50);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe(first);
    expect(chunks[1].text).toBe(second);
  });

  it('prepares Mandarin utterances at bounded, human-sounding rates', () => {
    class MockSpeechSynthesisUtterance {
      lang = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;

      constructor(public text: string) {}
    }
    vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance);

    const fast = prepareMandarinUtterance('我们一起学习中文。', { rate: 99 });
    const slow = prepareMandarinUtterance('慢慢读。', { rate: 0.1 });

    expect(fast.lang).toBe('zh-CN');
    expect(fast.rate).toBe(MAX_SPEECH_RATE);
    expect(fast.pitch).toBe(1);
    expect(fast.volume).toBe(1);
    expect(slow.rate).toBe(MIN_SPEECH_RATE);
  });

  it('keeps complete learner words active through punctuation pauses', () => {
    const passage = '我的情况，很好';
    const segments = segmentChinese(passage);
    const ranges = buildSegmentRanges(segments);
    const situationStart = passage.indexOf('情况');
    const comma = passage.indexOf('，');
    const goodStart = passage.indexOf('很好');

    expect(segments[segmentIndexAtCharacter(ranges, situationStart) ?? -1]?.text).toBe('情况');
    expect(segments[segmentIndexAtCharacter(ranges, situationStart + 1) ?? -1]?.text).toBe('情况');
    expect(segments[segmentIndexAtCharacter(ranges, comma) ?? -1]?.text).toBe('情况');
    expect(segments[segmentIndexAtCharacter(ranges, goodStart) ?? -1]?.text).toBe('很好');
  });

  it('uses the next Chinese word only when playback is before the first word', () => {
    const segments: Segment[] = [
      { text: ' ', isChinese: false },
      { text: '你好', isChinese: true },
      { text: ' ', isChinese: false },
      { text: '世界', isChinese: true },
    ];
    const ranges = buildSegmentRanges(segments);

    expect(segments[segmentIndexAtCharacter(ranges, 0) ?? -1]?.text).toBe('你好');
    expect(segments[segmentIndexAtCharacter(ranges, 3) ?? -1]?.text).toBe('你好');
    expect(segments[segmentIndexAtCharacter(ranges, 4) ?? -1]?.text).toBe('世界');
    expect(segmentIndexAtCharacter(ranges, Number.NaN)).toBeUndefined();
  });
});
