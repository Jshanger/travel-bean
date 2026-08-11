import type { DictionaryEntry, Segment } from '../types';
import {
  lookupCuratedDictionaryEntry,
  lookupDictionaryEntry,
  lookupExtendedDictionaryEntry,
  lookupHsk4DictionaryEntry,
} from './cedict';
import { maxHsk4WordLength } from '../data/hsk4Dictionary';
import { recognizeChineseName } from './chineseNames';
import { getPinyin } from './pinyin';

const chineseCharacter = /[\u3400-\u9fff]/;
// OCR, PDF extraction, and copied text frequently insert horizontal or
// invisible spacing between every Han character (for example `教 授`). That
// spacing is typographic noise, not a Chinese word boundary. Remove it before
// dictionary segmentation, but preserve newlines so lesson paragraphs remain
// intact.
const spacingBetweenChineseCharacters = /([\u3400-\u9fff])[ \t\u00a0\u200b\u200c\u200d\u3000\ufeff]+(?=[\u3400-\u9fff])/g;
const knownOcrWordCorrections = new Map([
  // 羡 is occasionally reduced to its visually similar upper component 美,
  // while handwritten 慕 can be misread as 兼. Neither result is a standard
  // word, so these corrections do not steal valid Chinese vocabulary.
  ['美慕', '羡慕'],
  ['美兼', '羡慕'],
  ['美菜', '羡慕'],
  ['美莫', '羡慕'],
  // The left side of 妻 often disappears in low-contrast textbook scans.
  // Restrict this repair to the common phrase 好妻子 so an actual surname 娄
  // is never changed in ordinary text.
  ['好娄子', '好妻子'],
  // In scans, the 目 radical and 艮 component in 眼 are sometimes mistaken
  // for the visually similar parts of 服. 服中 is not an HSK word; 眼中 is
  // the common phrase used in learner texts.
  ['服中', '眼中'],
]);
const maxExtendedDictionaryWordLength = 4;
const markedUsage = /^(?:old variant|variant of|archaic|dated|dialect|\((?:slang|dialect|archaic|dated|literary|Internet slang)\b)/i;
const subjectPronouns = ['我们', '你们', '他们', '她们', '它们', '我', '你', '他', '她', '它'];
const commonPredicateStarts = new Set([...`去来是有在想要会能看听说谈问吃喝买卖做学写读走坐住爱喜欢觉得知道给和跟与把被`]);

type Lookup = (chinese: string) => DictionaryEntry | undefined;
type RememberedDictionary = Map<string, DictionaryEntry>;

const nativeChineseSegmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('zh-CN', { granularity: 'word' })
  : undefined;

function longestEntry(
  text: string,
  index: number,
  lookup: Lookup,
  accept: (entry: DictionaryEntry) => boolean = () => true,
  maximumLength = maxExtendedDictionaryWordLength,
) {
  for (let length = Math.min(maximumLength, text.length - index); length > 1; length -= 1) {
    const entry = lookup(text.slice(index, index + length));
    if (entry && accept(entry)) return entry;
  }
  return undefined;
}

function hasKnownDecomposition(chinese: string) {
  for (let split = 1; split < chinese.length; split += 1) {
    if (lookupDictionaryEntry(chinese.slice(0, split)) && lookupDictionaryEntry(chinese.slice(split))) return true;
  }
  return false;
}

function isPronounPredicatePhrase(chinese: string) {
  const pronoun = subjectPronouns.find((candidate) => chinese.startsWith(candidate));
  if (!pronoun || pronoun.length === chinese.length) return false;
  return commonPredicateStarts.has(chinese[pronoun.length]);
}

function isProductivePredicateObjectPhrase(chinese: string) {
  if (chinese.length <= 2 || !commonPredicateStarts.has(chinese[0])) return false;
  return Boolean(lookupDictionaryEntry(chinese.slice(1)));
}

function shouldUseExtendedEntry(entry: DictionaryEntry, text: string, index: number, followingCharacter?: string) {
  // Broad dictionaries also contain productive verb+noun phrases such as
  // 看情况. For a learner reader, the useful lexical units are 看 + 情况,
  // especially when the noun is one of our curated compounds.
  if (isProductivePredicateObjectPhrase(entry.chinese)) return false;

  if (!hasKnownDecomposition(entry.chinese)) return true;

  const marked = markedUsage.test(entry.meaning.trim());
  const grammaticalPhrase = isPronounPredicatePhrase(entry.chinese);
  if (!marked && !grammaticalPhrase) return true;

  const end = index + entry.chinese.length;
  const nextCharacter = text[end] ?? followingCharacter;
  const standaloneExclamation = end === text.length && (nextCharacter === '!' || nextCharacter === '！');
  return marked && standaloneExclamation;
}

function nativeWordsByStart(text: string) {
  const words = new Map<number, string>();
  if (!nativeChineseSegmenter) return words;
  for (const item of nativeChineseSegmenter.segment(text)) {
    if (item.isWordLike) words.set(item.index, item.segment);
  }
  return words;
}

const ordinalNumbers: Record<string, string> = {
  一: 'first', 二: 'second', 两: 'second', 三: 'third', 四: 'fourth', 五: 'fifth',
  六: 'sixth', 七: 'seventh', 八: 'eighth', 九: 'ninth', 十: 'tenth',
};
const ordinalUnits: Record<string, string> = {
  月: 'month', 天: 'day', 年: 'year', 周: 'week', 星期: 'week', 次: 'time',
  课: 'lesson', 章: 'chapter', 页: 'page', 名: 'place', 位: 'person', 件: 'item', 本: 'volume',
};
const cardinalNumbers: Record<string, string> = {
  一: 'one', 二: 'two', 两: 'two', 三: 'three', 四: 'four', 五: 'five',
  六: 'six', 七: 'seven', 八: 'eight', 九: 'nine', 十: 'ten',
};
const cardinalUnits: Record<string, string> = {
  个: '', 年: 'year', 月: 'month', 天: 'day', 周: 'week', 次: 'time',
  本: 'volume', 件: 'item', 位: 'person', 岁: 'year old',
};

function recognizeOrdinalPhrase(text: string, index: number): DictionaryEntry | undefined {
  const match = text.slice(index).match(/^第([零〇一二两三四五六七八九十百千万0-9]+)(?:个)?(星期|月|天|年|周|次|课|章|页|名|位|件|本)/);
  if (!match) return undefined;
  const chinese = match[0];
  const ordinal = ordinalNumbers[match[1]] ?? `number ${match[1]}`;
  const unit = ordinalUnits[match[2]] ?? match[2];
  return {
    chinese,
    pinyin: getPinyin(chinese),
    meaning: `${ordinal} ${unit}`,
    partOfSpeech: 'ordinal phrase',
    difficultyLabel: 'HSK-style',
  };
}

function recognizeCardinalPhrase(text: string, index: number): DictionaryEntry | undefined {
  const match = text.slice(index).match(/^([一二两三四五六七八九十0-9]+)(个|年|月|天|周|次|本|件|位|岁)/);
  if (!match) return undefined;
  const number = cardinalNumbers[match[1]] ?? match[1];
  const unit = cardinalUnits[match[2]];
  const plural = unit && number !== 'one' && !unit.endsWith('old') ? `${unit}s` : unit;
  return {
    chinese: match[0],
    pinyin: getPinyin(match[0]),
    meaning: unit ? `${number} ${plural}` : `${number}; a/an`,
    partOfSpeech: 'quantity phrase',
    difficultyLabel: 'HSK-style',
  };
}

const possessivePronouns: Record<string, string> = {
  我们: 'our', 你们: 'your', 他们: 'their', 她们: 'their',
  我: 'my', 你: 'your', 他: 'his', 她: 'her', 它: 'its',
};
const familyTerms: Record<string, string> = {
  爸爸: 'dad', 妈妈: 'mom', 哥哥: 'older brother', 姐姐: 'older sister',
  弟弟: 'younger brother', 妹妹: 'younger sister', 丈夫: 'husband', 妻子: 'wife',
  女儿: 'daughter', 儿子: 'son', 孩子: 'child', 爸: 'dad', 妈: 'mom', 哥: 'older brother', 姐: 'older sister',
};

function recognizePossessiveFamilyPhrase(text: string, index: number): DictionaryEntry | undefined {
  const pronoun = Object.keys(possessivePronouns).find((candidate) => text.startsWith(candidate, index));
  if (!pronoun) return undefined;
  const family = Object.keys(familyTerms).find((candidate) => text.startsWith(candidate, index + pronoun.length));
  if (!family) return undefined;
  const chinese = `${pronoun}${family}`;
  return {
    chinese,
    pinyin: getPinyin(chinese),
    meaning: `${possessivePronouns[pronoun]} ${familyTerms[family]}`,
    partOfSpeech: 'possessive family phrase',
    difficultyLabel: 'HSK-style',
  };
}

function recognizeHowAdjectivePhrase(text: string, index: number): DictionaryEntry | undefined {
  if (text[index] !== '多') return undefined;
  for (const adjectiveLength of [2, 1]) {
    const adjectiveText = text.slice(index + 1, index + 1 + adjectiveLength);
    const adjective = lookupDictionaryEntry(adjectiveText);
    const following = text[index + 1 + adjectiveLength];
    if (!adjective?.partOfSpeech?.includes('adjective') || (following && !/[了啊呀！!？?。]/.test(following))) continue;
    return {
      chinese: `多${adjectiveText}`,
      pinyin: getPinyin(`多${adjectiveText}`),
      meaning: `how ${adjective.meaning.split(';')[0].replace(/^to be\s+/, '')}`,
      partOfSpeech: 'exclamatory adjective phrase',
      difficultyLabel: adjective.difficultyLabel,
    };
  }
  return undefined;
}

const everyNouns: Record<string, string> = {
  人: 'person', 孩子: 'child', 学生: 'student', 朋友: 'friend', 问题: 'question',
  公司: 'company', 家庭: 'family', 月: 'month', 星期: 'week', 故事: 'story',
  机会: 'opportunity', 地方: 'place', 国家: 'country', 工作: 'job', 事情: 'thing',
  东西: 'thing', 名字: 'name', 书: 'book', 课: 'lesson',
};
const everyTimeUnits: Record<string, string> = {
  星期: 'week', 天: 'day', 月: 'month', 年: 'year', 周: 'week', 次: 'time',
};

function recognizeEveryPhrase(text: string, index: number): DictionaryEntry | undefined {
  if (text[index] !== '每') return undefined;
  const remainder = text.slice(index);
  const direct = remainder.match(/^每(?:一)?(星期|天|月|年|周|次)/);
  if (direct) {
    return {
      chinese: direct[0],
      pinyin: getPinyin(direct[0]),
      meaning: `every ${everyTimeUnits[direct[1]]}`,
      partOfSpeech: 'universal time phrase',
      difficultyLabel: 'HSK-style',
    };
  }

  const noun = Object.keys(everyNouns).find((candidate) =>
    ['个', '位', '本', '件'].some((classifier) => remainder.startsWith(`每${classifier}${candidate}`))
  );
  if (!noun) return undefined;
  const classifier = ['个', '位', '本', '件'].find((candidate) => remainder.startsWith(`每${candidate}${noun}`))!;
  const chinese = `每${classifier}${noun}`;
  const meaning = noun === '人' ? 'everyone; every person' : `every ${everyNouns[noun]}`;
  return {
    chinese,
    pinyin: getPinyin(chinese),
    meaning,
    partOfSpeech: 'universal quantifier phrase',
    difficultyLabel: 'HSK-style',
  };
}

function segmentChineseRun(
  text: string,
  followingCharacter?: string,
  remembered = new Map<string, DictionaryEntry>(),
  maxRememberedWordLength = 0,
): Segment[] {
  const result: Segment[] = [];
  const nativeWords = nativeWordsByStart(text);
  let index = 0;

  while (index < text.length) {
    // 1. Compare learner-curated entries with the complete official HSK 1-4
    // vocabulary. The longer real word wins (火车站 over 火车), while curated
    // definitions win ties because their learner glosses are cleaner.
    const rememberedEntry = maxRememberedWordLength > 1
      ? longestEntry(text, index, (word) => remembered.get(word), () => true, maxRememberedWordLength)
      : undefined;
    const ordinalEntry = recognizeOrdinalPhrase(text, index);
    const cardinalEntry = recognizeCardinalPhrase(text, index);
    const familyEntry = recognizePossessiveFamilyPhrase(text, index);
    const howAdjectiveEntry = recognizeHowAdjectivePhrase(text, index);
    const everyEntry = recognizeEveryPhrase(text, index);
    const curatedEntry = longestEntry(text, index, lookupCuratedDictionaryEntry);
    const hskEntry = longestEntry(
      text,
      index,
      lookupHsk4DictionaryEntry,
      () => true,
      maxHsk4WordLength,
    );
    let entry = hskEntry && (!curatedEntry || hskEntry.chinese.length > curatedEntry.chinese.length)
      ? hskEntry
      : curatedEntry ?? hskEntry;
    if (rememberedEntry && (!entry || rememberedEntry.chinese.length >= entry.chinese.length)) {
      entry = rememberedEntry;
    }
    if (ordinalEntry && (!entry || ordinalEntry.chinese.length > entry.chinese.length)) {
      entry = ordinalEntry;
    }
    for (const grammarEntry of [familyEntry, howAdjectiveEntry, everyEntry, cardinalEntry]) {
      if (grammarEntry && (!entry || grammarEntry.chinese.length > entry.chinese.length)) entry = grammarEntry;
    }

    // 2. Known compounds must win over heuristic surname matching. Otherwise
    // ordinary words such as 幸福 and 安静 are misread as people's names.
    // The broad dictionary fills coverage, but marked slang/archaic senses
    // cannot override an ordinary compositional reading without clear context.
    if (!entry) {
      const nativeWord = nativeWords.get(index);
      const nextNativeWord = nativeWord?.length === 1 ? nativeWords.get(index + 1) : undefined;
      const possibleTitle = recognizeChineseName(text, index);
      // Broad dictionaries contain uncommon overlapping compounds such as
      // 月工. In 一个月工资 that greedy match consumed 工 and left 资 alone.
      // Respect the browser's Chinese boundary when it exposes a stronger
      // known word immediately after one character, except for an explicitly
      // recognized surname-and-title unit such as 高老师.
      if (
        nativeWord?.length === 1
        && nextNativeWord
        && nextNativeWord.length > 1
        && lookupDictionaryEntry(nextNativeWord)
        && possibleTitle?.partOfSpeech !== 'person with title'
      ) {
        entry = lookupDictionaryEntry(nativeWord);
      }
      const nativeEntry = nativeWord && nativeWord.length > 1
        ? lookupExtendedDictionaryEntry(nativeWord)
        : undefined;
      if (nativeEntry && shouldUseExtendedEntry(nativeEntry, text, index, followingCharacter)) {
        entry = nativeEntry;
      }
    }
    if (!entry) {
      entry = longestEntry(
        text,
        index,
        lookupExtendedDictionaryEntry,
        (candidate) => shouldUseExtendedEntry(candidate, text, index, followingCharacter),
      );
    }

    // 3. Only infer an unlisted name after real multi-character words fail.
    if (!entry) {
      const possibleName = recognizeChineseName(text, index);
      // Some common verbs are also surnames (for example 谈). Do not let the
      // name heuristic turn a normal verb + known object into a person's name.
      if (possibleName && !isProductivePredicateObjectPhrase(possibleName.chinese)) entry = possibleName;
    }

    // 4. A known single character is safer than inventing a combined phrase.
    if (!entry) entry = lookupDictionaryEntry(text[index]);

    const matchedText = entry?.chinese ?? text[index];
    result.push({ text: matchedText, isChinese: true, entry });
    index += matchedText.length;
  }

  return result;
}

export function segmentChinese(input: string, rememberedEntries: DictionaryEntry[] = []): Segment[] {
  let normalizedInput = input.replace(spacingBetweenChineseCharacters, '$1');
  for (const [misread, correction] of knownOcrWordCorrections) {
    normalizedInput = normalizedInput.replaceAll(misread, correction);
  }
  const remembered: RememberedDictionary = new Map(
    rememberedEntries
      .filter((entry) => entry.chinese.length > 1)
      .map((entry) => [entry.chinese, entry]),
  );
  const maxRememberedWordLength = remembered.size
    ? Math.max(...[...remembered.keys()].map((word) => word.length))
    : 0;
  const result: Segment[] = [];
  let index = 0;

  while (index < normalizedInput.length) {
    if (chineseCharacter.test(normalizedInput[index])) {
      let end = index + 1;
      while (end < normalizedInput.length && chineseCharacter.test(normalizedInput[end])) end += 1;
      result.push(...segmentChineseRun(
        normalizedInput.slice(index, end),
        normalizedInput[end],
        remembered,
        maxRememberedWordLength,
      ));
      index = end;
    } else {
      let end = index + 1;
      while (end < normalizedInput.length && !chineseCharacter.test(normalizedInput[end])) end += 1;
      result.push({ text: normalizedInput.slice(index, end), isChinese: false });
      index = end;
    }
  }

  return result;
}
