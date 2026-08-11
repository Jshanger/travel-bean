import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { SavedText, SavedWord } from '../types';
import { SavedTextsPage } from './SavedTextsPage';
import { VocabularyPage } from './VocabularyPage';

vi.mock('../hooks/useSpeech', () => ({
  useSpeech: () => ({
    speak: vi.fn(),
    supported: true,
    chineseVoiceAvailable: true,
  }),
}));

const lesson: SavedText = {
  id: 'lesson-hsk4-10',
  title: 'HSK4 Lesson 10 Text',
  originalText: '今天天气很好。',
  createdAt: '2026-07-31T09:00:00.000Z',
  updatedAt: '2026-07-31T09:00:00.000Z',
};

const lessonWord: SavedWord = {
  id: 'word-situation',
  chinese: '情况',
  pinyin: 'qíngkuàng',
  meaning: 'situation; circumstances',
  userEditedMeaning: false,
  difficultyLabel: 'Common',
  sourceTextId: lesson.id,
  sourceTextIds: [lesson.id],
  createdAt: '2026-07-31T10:00:00.000Z',
  updatedAt: '2026-07-31T10:00:00.000Z',
};

describe('lesson vocabulary placement', () => {
  it('keeps vocabulary rows out of the Saved Texts page', () => {
    const html = renderToStaticMarkup(<SavedTextsPage
      texts={[lesson]}
      onOpen={vi.fn()}
      onDelete={vi.fn()}
      onRename={vi.fn()}
    />);

    expect(html).toContain('HSK4 Lesson 10 Text');
    expect(html).toContain('Open lesson');
    expect(html).not.toMatch(/lesson vocabulary/i);
    expect(html).not.toContain('qíngkuàng');
    expect(html).not.toContain('situation; circumstances');
  });

  it('shows lesson-associated words under their own heading on the Vocabulary page', () => {
    const html = renderToStaticMarkup(<VocabularyPage
      texts={[lesson]}
      words={[lessonWord]}
      onDelete={vi.fn()}
      onImport={vi.fn()}
    />);

    expect(html).toMatch(/lesson vocabulary|vocabulary by lesson|saved from lessons/i);
    expect(html).toContain('HSK4 Lesson 10 Text');
    expect(html).toContain('qíngkuàng');
    expect(html).toContain('situation; circumstances');
    expect(html.indexOf('HSK4 Lesson 10 Text')).toBeLessThan(html.lastIndexOf('qíngkuàng'));
  });
});
