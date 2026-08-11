import type { SavedWord } from '../types';
export type VocabularyFilter='all'|'today'|'unknown';
export function filterVocabulary(words:SavedWord[],filter:VocabularyFilter,now=new Date()){return words.filter(word=>filter==='all'||(filter==='today'&&new Date(word.createdAt).toDateString()===now.toDateString())||(filter==='unknown'&&!word.userEditedMeaning&&(!word.meaning.trim()||word.meaning==='Meaning not found yet.')))}
