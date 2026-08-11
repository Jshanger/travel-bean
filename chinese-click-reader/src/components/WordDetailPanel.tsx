import { useEffect, useState } from 'react';
import type { DictionaryEntry, DifficultyLabel } from '../types';
import { useSpeech } from '../hooks/useSpeech';

interface WordDetailPanelProps {
  entry?: DictionaryEntry;
  difficulty?: DifficultyLabel;
  isSaved: boolean;
  isSavedToLesson: boolean;
  onSave: (meaning: string, userEdited: boolean) => void;
  onClose?: () => void;
}

export function WordDetailPanel({
  entry,
  difficulty,
  isSaved,
  isSavedToLesson,
  onSave,
  onClose,
}: WordDetailPanelProps) {
  const [meaning, setMeaning] = useState(entry?.meaning ?? '');
  const { speak, supported, chineseVoiceAvailable } = useSpeech();
  useEffect(() => setMeaning(entry?.meaning ?? ''), [entry]);

  if (!entry) return <aside className="detail card desktop-detail">
    <div className="empty-detail"><div className="empty-icon">字</div><h3>Choose a word</h3><p>Tap any highlighted word in the lesson to explore its pronunciation and meaning.</p></div>
  </aside>;

  const edited = meaning.trim() !== entry.meaning.trim();
  const saveLabel = isSavedToLesson
    ? '✓ Saved to this lesson'
    : isSaved
      ? '＋ Add to this lesson'
      : '＋ Save word';

  return <aside className="detail card word-panel" aria-label={`Details for ${entry.chinese}`}>
    {onClose && <button className="sheet-close" onClick={onClose} aria-label="Close word details">×</button>}
    <div className="detail-top"><div><div className="eyebrow">WORD DETAILS</div><div className="hanzi">{entry.chinese}</div><div className="pinyin">{entry.pinyin}</div></div><button className="audio-main" onClick={() => speak(entry.chinese)} disabled={!supported} aria-label={`Pronounce ${entry.chinese}`}>♪<small>Listen</small></button></div>
    <span className={`difficulty ${(difficulty ?? 'Unknown').toLowerCase().replace('-', '')}`}>{difficulty ?? 'Unknown'}</span>
    <label className="meaning-label">English meaning<textarea className="meaning-input" value={meaning} onChange={(event) => setMeaning(event.target.value)} rows={3}/></label>
    {edited && <span className="edited-note">Your edited meaning will be saved</span>}
    {entry.partOfSpeech && <span className="tag">{entry.partOfSpeech}</span>}
    {entry.exampleSentence && <div className="example"><small>EXAMPLE SENTENCE</small><p>{entry.exampleSentence}</p></div>}
    {chineseVoiceAvailable === false && <p className="voice-note">Chinese voice not available on this device.</p>}
    <button
      className={`primary full ${isSavedToLesson ? 'done' : ''}`}
      onClick={() => onSave(meaning.trim() || entry.meaning, edited)}
      disabled={isSavedToLesson}
    >{saveLabel}</button>
  </aside>;
}
