import type { DictionaryEntry, DifficultyLabel } from '../types';
import { WordDetailPanel } from './WordDetailPanel';

interface MobileWordSheetProps {
  entry?: DictionaryEntry;
  difficulty?: DifficultyLabel;
  isSaved: boolean;
  isSavedToLesson: boolean;
  onSave: (meaning: string, edited: boolean) => void;
  onClose: () => void;
}

export function MobileWordSheet({
  entry,
  difficulty,
  isSaved,
  isSavedToLesson,
  onSave,
  onClose,
}: MobileWordSheetProps) {
  if (!entry) return null;
  return <div className="sheet-backdrop" onClick={onClose}>
    <div className="mobile-sheet" onClick={(event) => event.stopPropagation()}>
      <div className="sheet-handle"/>
      <WordDetailPanel
        entry={entry}
        difficulty={difficulty}
        isSaved={isSaved}
        isSavedToLesson={isSavedToLesson}
        onSave={onSave}
        onClose={onClose}
      />
    </div>
  </div>;
}
