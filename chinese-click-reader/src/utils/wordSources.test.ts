import { describe, expect, it } from 'vitest';
import type { SavedWord } from '../types';
import { storage } from './storage';
import {
  getWordSourceTextIds,
  mergeSavedWord,
  unlinkWordFromText,
  wordBelongsToText,
} from './wordSources';

const baseWord = (overrides: Partial<SavedWord> = {}): SavedWord => ({
  id: 'word-1',
  chinese: '幸福',
  pinyin: 'xìngfú',
  meaning: 'happiness; happy; blessed',
  userEditedMeaning: false,
  difficultyLabel: 'HSK-style',
  createdAt: '2026-07-31T10:00:00.000Z',
  updatedAt: '2026-07-31T10:00:00.000Z',
  ...overrides,
});

describe('saved word lesson membership', () => {
  it('migrates a legacy sourceTextId into the multi-lesson collection', () => {
    const normalized = storage.normalizeWord(baseWord({
      sourceTextId: 'lesson-a',
      sourceTextIds: ['lesson-b', 'lesson-a', ''],
    }));

    expect(getWordSourceTextIds(normalized)).toEqual(['lesson-b', 'lesson-a']);
    expect(normalized.sourceTextIds).toEqual(['lesson-b', 'lesson-a']);
  });

  it('keeps one aggregate word while linking it to several lessons', () => {
    const existing = baseWord({ sourceTextId: 'lesson-a', sourceTextIds: ['lesson-a'] });
    const incoming = baseWord({
      id: 'new-word-id',
      sourceTextId: 'lesson-b',
      sourceTextIds: ['lesson-b'],
      updatedAt: '2026-07-31T11:00:00.000Z',
    });
    const merged = mergeSavedWord(existing, incoming);

    expect(merged.id).toBe('word-1');
    expect(merged.createdAt).toBe(existing.createdAt);
    expect(getWordSourceTextIds(merged)).toEqual(['lesson-a', 'lesson-b']);
    expect(wordBelongsToText(merged, 'lesson-a')).toBe(true);
    expect(wordBelongsToText(merged, 'lesson-b')).toBe(true);
  });

  it('does not let an automatic save erase a learner-edited meaning', () => {
    const existing = baseWord({
      meaning: 'a happy life',
      originalMeaning: 'happiness; happy; blessed',
      userEditedMeaning: true,
      sourceTextIds: ['lesson-a'],
    });
    const incoming = baseWord({
      id: 'automatic-save',
      sourceTextId: 'lesson-b',
      sourceTextIds: ['lesson-b'],
    });
    const merged = mergeSavedWord(existing, incoming);

    expect(merged.meaning).toBe('a happy life');
    expect(merged.userEditedMeaning).toBe(true);
    expect(getWordSourceTextIds(merged)).toEqual(['lesson-a', 'lesson-b']);
  });

  it('unlinks a deleted lesson without deleting the aggregate word', () => {
    const linked = baseWord({
      sourceTextId: 'lesson-a',
      sourceTextIds: ['lesson-a', 'lesson-b'],
    });
    const remaining = unlinkWordFromText(linked, 'lesson-a');

    expect(remaining.chinese).toBe('幸福');
    expect(getWordSourceTextIds(remaining)).toEqual(['lesson-b']);
    expect(remaining.sourceTextId).toBe('lesson-b');
  });
});
