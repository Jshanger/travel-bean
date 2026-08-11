export type DifficultyLabel = 'Common' | 'HSK-style' | 'Unknown';
export interface DictionaryEntry { chinese: string; pinyin: string; meaning: string; partOfSpeech?: string; exampleSentence?: string; difficultyLabel: DifficultyLabel }
export interface Segment { text: string; isChinese: boolean; entry?: DictionaryEntry }
export interface SavedWord { id: string; chinese: string; pinyin: string; meaning: string; originalMeaning?: string; userEditedMeaning: boolean; exampleSentence?: string; difficultyLabel: DifficultyLabel; sourceTextId?: string; sourceTextIds?: string[]; createdAt: string; updatedAt: string }
export interface SavedText { id: string; title: string; originalText: string; createdAt: string; updatedAt: string }
export interface ClickedWordHistoryItem { id: string; chinese: string; pinyin: string; meaning: string; clickedAt: string; sourceTextId?: string }
export type View = 'reader' | 'texts' | 'vocabulary';
