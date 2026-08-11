import { describe, expect, it } from 'vitest';
import { hsk4MeaningMap, hsk4Words, maxHsk4WordLength } from '../src/data/hsk4Dictionary';
import { lookupDictionaryEntry } from '../src/utils/cedict';
import { segmentChinese } from '../src/utils/segmentChinese';

describe('official HSK 1-4 segmentation layer', () => {
  it('bundles the complete cumulative HSK 4 vocabulary with offline meanings', () => {
    // The official PDF has 1,200 numbered entries. A few repeated surface
    // forms represent different senses, while 哪/那/这 also include 儿 forms.
    expect(hsk4Words.size).toBe(1199);
    expect(maxHsk4WordLength).toBeGreaterThanOrEqual(4);
    expect(hsk4MeaningMap.get('教授')).toBeTruthy();
    expect(hsk4MeaningMap.get('妻子')).toContain('wife');

    for (const word of hsk4Words) {
      const entry = lookupDictionaryEntry(word);
      expect(entry?.meaning.trim(), `missing meaning for ${word}`).toBeTruthy();
      expect(entry?.difficultyLabel, `wrong difficulty for ${word}`).not.toBe('Unknown');
    }
  });

  it('never splits a multi-character official HSK word into single characters', () => {
    const multiCharacterWords = [...hsk4Words].filter((word) => Array.from(word).length > 1);
    expect(multiCharacterWords.length).toBeGreaterThan(700);

    for (const word of multiCharacterWords) {
      const units = segmentChinese(word).filter((unit) => unit.isChinese);
      expect(units.map((unit) => unit.text), `incorrect segmentation for ${word}`).toEqual([word]);
    }
  });

  it('keeps every multi-character HSK word intact when surrounded by sentence context', () => {
    const misses: string[] = [];
    for (const word of [...hsk4Words].filter((candidate) => Array.from(candidate).length > 1)) {
      for (const text of [`我${word}`, `${word}了`, `我${word}了`]) {
        const units = segmentChinese(text).filter((unit) => unit.isChinese).map((unit) => unit.text);
        if (!units.some((unit) => unit.includes(word))) {
          misses.push(`${word}: ${units.join('|')}`);
          break;
        }
      }
    }
    expect(misses).toEqual([]);
  });

  it('keeps HSK words intact in sentence context without reviving false phrases', () => {
    const units = segmentChinese('王教授和妻子去看情况。').filter((unit) => unit.isChinese);
    expect(units.map((unit) => unit.text)).toEqual(['王', '教授', '和', '妻子', '去', '看', '情况']);
    expect(units.find((unit) => unit.text === '教授')?.entry?.meaning).toContain('professor');
    expect(units.find((unit) => unit.text === '妻子')?.entry?.meaning).toContain('wife');
  });
});
