import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { loadExtendedDictionary } from '../src/utils/cedict';
import { segmentChinese } from '../src/utils/segmentChinese';

describe('loaded dictionary segmentation', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      '情况': 'circumstances; situation',
      '人工智能': 'artificial intelligence (AI)',
      '也': 'also; too',
      '能': 'can; to be able to',
      '我去': '(slang) what the ...!; oh my god!; that is insane!',
      '和平': 'peace',
      '暖和': 'warm; nice and warm',
      '和面': 'to knead dough',
      '安静': 'quiet; peaceful; calm',
    }))));
    await loadExtendedDictionary();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('uses the longest real compound and splits an undefined combination', () => {
    const units = segmentChinese('人工智能也能').filter((segment) => segment.isChinese);
    expect(units.map((segment) => segment.text)).toEqual(['人工智能', '也', '能']);
    expect(units.map((segment) => segment.entry?.meaning)).toEqual([
      'artificial intelligence (AI)',
      'also; too',
      'can; to be able to',
    ]);
  });

  it('uses sentence context instead of blindly choosing a slang entry', () => {
    const sentence = segmentChinese('我去逛街怎么样？').filter((segment) => segment.isChinese);
    expect(sentence.map((segment) => segment.text)).toEqual(['我', '去', '逛街', '怎么样']);
    expect(sentence.map((segment) => segment.entry?.meaning)).toEqual([
      'I; me',
      'to go',
      'to go shopping; to stroll around the shops',
      'how; what about',
    ]);

    const exclamation = segmentChinese('我去！').filter((segment) => segment.isChinese);
    expect(exclamation.map((segment) => segment.text)).toEqual(['我去']);
    expect(exclamation[0].entry?.meaning).toContain('(slang)');
  });

  it('keeps genuine 和 compounds while the standalone word stays concise', () => {
    const compounds = segmentChinese('和平，暖和，和面').filter((segment) => segment.isChinese);
    expect(compounds.map((segment) => segment.text)).toEqual(['和平', '暖和', '和面']);

    const conjunction = segmentChinese('我和朋友去逛街').filter((segment) => segment.isChinese);
    expect(conjunction.map((segment) => segment.text)).toEqual(['我', '和', '朋友', '去', '逛街']);
    expect(conjunction[1].entry).toMatchObject({ pinyin: 'hé', meaning: 'and', difficultyLabel: 'Common' });
  });

  it('prefers a known compound over a possible surname-and-given-name shape', () => {
    const entry = segmentChinese('安静').find((segment) => segment.text === '安静')?.entry;
    expect(entry).toMatchObject({ chinese: '安静', meaning: 'quiet; peaceful; calm' });
    expect(entry?.partOfSpeech).not.toBe('proper noun');
  });
});
