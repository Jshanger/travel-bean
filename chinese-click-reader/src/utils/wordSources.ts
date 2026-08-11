import type { SavedWord } from '../types';

type WordSources = Pick<SavedWord, 'sourceTextId' | 'sourceTextIds'>;

export function getWordSourceTextIds(word: WordSources) {
  const candidates = [
    ...(Array.isArray(word.sourceTextIds) ? word.sourceTextIds : []),
    word.sourceTextId,
  ];
  return [...new Set(candidates.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())))];
}

export function wordBelongsToText(word: WordSources, textId: string) {
  return getWordSourceTextIds(word).includes(textId);
}

export function mergeSavedWord(existing: SavedWord, incoming: SavedWord): SavedWord {
  const sourceTextIds = [...new Set([
    ...getWordSourceTextIds(existing),
    ...getWordSourceTextIds(incoming),
  ])];
  const preserveLearnerMeaning = existing.userEditedMeaning && !incoming.userEditedMeaning;

  return {
    ...incoming,
    id: existing.id,
    createdAt: existing.createdAt,
    meaning: preserveLearnerMeaning ? existing.meaning : incoming.meaning,
    originalMeaning: preserveLearnerMeaning ? existing.originalMeaning : incoming.originalMeaning,
    userEditedMeaning: preserveLearnerMeaning || incoming.userEditedMeaning,
    sourceTextId: incoming.sourceTextId ?? existing.sourceTextId ?? sourceTextIds[0],
    sourceTextIds: sourceTextIds.length ? sourceTextIds : undefined,
  };
}

export function unlinkWordFromText(word: SavedWord, textId: string): SavedWord {
  const sourceTextIds = getWordSourceTextIds(word).filter((id) => id !== textId);
  const primarySource = word.sourceTextId && word.sourceTextId !== textId
    ? word.sourceTextId
    : sourceTextIds[0];

  return {
    ...word,
    sourceTextId: primarySource,
    sourceTextIds: sourceTextIds.length ? sourceTextIds : undefined,
  };
}
