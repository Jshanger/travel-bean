import type { SavedText, SavedWord } from '../types';
import { wordBelongsToText } from './wordSources';

export interface LessonVocabularyGroup {
  text: SavedText;
  words: SavedWord[];
}

export function groupVocabularyByLesson(texts: SavedText[], words: SavedWord[]): LessonVocabularyGroup[] {
  return texts
    .map((text) => ({
      text,
      words: words.filter((word) => wordBelongsToText(word, text.id)),
    }))
    .filter((group) => group.words.length > 0);
}
