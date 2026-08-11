import type { DictionaryEntry, DifficultyLabel } from '../types';
export function getDifficulty(_text:string,entry?:DictionaryEntry):DifficultyLabel { return entry?.difficultyLabel??'Unknown' }
