import { describe, expect, it } from 'vitest';
import type { SavedText, SavedWord } from '../types';
import { groupVocabularyByLesson } from './lessonVocabulary';

const dates = {
  createdAt: '2026-07-31T09:00:00.000Z',
  updatedAt: '2026-07-31T09:00:00.000Z',
};

const texts: SavedText[] = [
  { id: 'lesson-one', title: 'Lesson one', originalText: '情况很好。', ...dates },
  { id: 'lesson-two', title: 'Lesson two', originalText: '今天很幸福。', ...dates },
];

function word(id: string, source: Partial<Pick<SavedWord, 'sourceTextId' | 'sourceTextIds'>> = {}): SavedWord {
  return {
    id,
    chinese: id,
    pinyin: 'test',
    meaning: 'test',
    userEditedMeaning: false,
    difficultyLabel: 'Common',
    ...dates,
    ...source,
  };
}

describe('groupVocabularyByLesson', () => {
  it('supports legacy sourceTextId and multi-lesson sourceTextIds', () => {
    const legacyWord = word('legacy', { sourceTextId: 'lesson-one' });
    const multiLessonWord = word('multi', { sourceTextIds: ['lesson-one', 'lesson-two'] });

    const groups = groupVocabularyByLesson(texts, [legacyWord, multiLessonWord]);

    expect(groups.map((group) => group.text.id)).toEqual(['lesson-one', 'lesson-two']);
    expect(groups[0].words.map(({ id }) => id)).toEqual(['legacy', 'multi']);
    expect(groups[1].words.map(({ id }) => id)).toEqual(['multi']);
  });

  it('does not create lesson groups for global or stale associations', () => {
    const groups = groupVocabularyByLesson(texts, [
      word('global'),
      word('stale', { sourceTextId: 'deleted-lesson' }),
    ]);

    expect(groups).toEqual([]);
  });
});
