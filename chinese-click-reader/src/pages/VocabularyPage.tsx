import { useMemo, useRef, useState } from 'react';
import type { SavedText, SavedWord } from '../types';
import { exportCsv, exportJson } from '../utils/exportCsv';
import { parseVocabularyJson } from '../utils/importVocabulary';
import { filterVocabulary, type VocabularyFilter } from '../utils/filterVocabulary';
import { groupVocabularyByLesson } from '../utils/lessonVocabulary';
import { useSpeech } from '../hooks/useSpeech';

interface VocabularyPageProps {
  words: SavedWord[];
  texts: SavedText[];
  onDelete: (id: string) => void;
  onImport: (words: SavedWord[]) => void;
}

export function VocabularyPage({ words, texts, onDelete, onImport }: VocabularyPageProps) {
  const [filter, setFilter] = useState<VocabularyFilter>('all');
  const [message, setMessage] = useState('');
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(() => new Set());
  const [studyDeck, setStudyDeck] = useState<string[]>([]);
  const [studyPosition, setStudyPosition] = useState(0);
  const [studyRevealed, setStudyRevealed] = useState(false);
  const [studyKnown, setStudyKnown] = useState<Set<string>>(() => new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const { speak, chineseVoiceAvailable } = useSpeech();
  const filtered = useMemo(() => filterVocabulary(words, filter), [words, filter]);
  const allLessonGroups = useMemo(() => groupVocabularyByLesson(texts, words), [texts, words]);
  const lessonGroups = useMemo(() => groupVocabularyByLesson(texts, filtered), [texts, filtered]);
  const lessonWordCount = useMemo(
    () => new Set(lessonGroups.flatMap((group) => group.words.map((word) => word.id))).size,
    [lessonGroups],
  );
  const studyWordId = studyDeck[studyPosition]?.replace(/:repeat$/, '');
  const studyWord = words.find((word) => word.id === studyWordId);
  const studyComplete = studyDeck.length > 0 && studyPosition >= studyDeck.length;

  const startStudy = () => {
    setStudyDeck(filtered.map((word) => word.id));
    setStudyPosition(0);
    setStudyRevealed(false);
    setStudyKnown(new Set());
  };

  const answerStudy = (known: boolean) => {
    if (!studyWord) return;
    if (known) {
      setStudyKnown((current) => new Set(current).add(studyWord.id));
    } else {
      // Put missed words back once so the learner sees them again during the
      // same short review without turning the session into an endless loop.
      setStudyDeck((current) => current.includes(`${studyWord.id}:repeat`)
        ? current
        : [...current, `${studyWord.id}:repeat`]);
    }
    setStudyPosition((current) => current + 1);
    setStudyRevealed(false);
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const imported = parseVocabularyJson(await file.text());
      onImport(imported);
      setMessage(`Imported ${imported.length} word${imported.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not import that file.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const toggleLesson = (id: string) => {
    setExpandedLessons((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return <main className="page">
    <div className="page-title vocab-title">
      <div>
        <span className="pill">YOUR COLLECTION</span>
        <h1>Saved vocabulary</h1>
        <p>Review everything together or revisit words from a specific saved lesson.</p>
      </div>
      <div className="export-actions">
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          onChange={(event) => importFile(event.target.files?.[0])}
        />
        <button className="ghost" onClick={() => inputRef.current?.click()}>↑ Import JSON</button>
        {words.length > 0 && <>
          <button className="ghost" onClick={() => exportJson(words)}>↓ JSON</button>
          <button className="primary" onClick={() => exportCsv(words)}>↓ CSV</button>
        </>}
      </div>
    </div>

    {message && <div className="import-message">{message}<button onClick={() => setMessage('')}>×</button></div>}

    <div className="filter-bar" role="group" aria-label="Vocabulary filter">
      <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All words <span>{words.length}</span></button>
      <button className={filter === 'today' ? 'active' : ''} onClick={() => setFilter('today')}>Saved today</button>
      <button className={filter === 'unknown' ? 'active' : ''} onClick={() => setFilter('unknown')}>Unknown meanings</button>
    </div>

    {words.length > 0 && <section className="study-panel card" aria-label="Saved vocabulary study mode">
      {!studyDeck.length ? <div className="study-intro">
        <span>忆</span>
        <div><span className="eyebrow">ACTIVE RECALL</span><h2>Learn your marked words</h2><p>Test yourself before revealing pinyin and English. Missed words return once at the end.</p></div>
        <button className="primary" onClick={startStudy} disabled={!filtered.length}>Study {filtered.length} word{filtered.length === 1 ? '' : 's'}</button>
      </div> : studyComplete ? <div className="study-complete">
        <span>✓</span><div><span className="eyebrow">REVIEW COMPLETE</span><h2>{studyKnown.size} word{studyKnown.size === 1 ? '' : 's'} remembered</h2><p>Run the deck again tomorrow to strengthen long-term recall.</p></div>
        <button className="primary" onClick={startStudy}>Study again</button>
        <button className="ghost" onClick={() => setStudyDeck([])}>Close</button>
      </div> : studyWord && <div className="study-session">
        <div className="study-progress"><span>Card {studyPosition + 1} of {studyDeck.length}</span><i><b style={{ width: `${((studyPosition + 1) / studyDeck.length) * 100}%` }}/></i></div>
        <div className="study-prompt">
          <span className="study-hanzi">{studyWord.chinese}</span>
          <button className="audio-small" onClick={() => speak(studyWord.chinese)} aria-label={`Pronounce ${studyWord.chinese}`}>♪</button>
          {studyRevealed ? <div className="study-answer">
            <b>{studyWord.pinyin}</b>
            <p>{studyWord.meaning}</p>
            {studyWord.exampleSentence && <small>{studyWord.exampleSentence}</small>}
          </div> : <p className="study-question">Say the meaning aloud before you reveal it.</p>}
        </div>
        <div className="study-actions">
          {!studyRevealed ? <button className="primary" onClick={() => setStudyRevealed(true)}>Reveal answer</button> : <>
            <button className="ghost" onClick={() => answerStudy(false)}>Again</button>
            <button className="primary" onClick={() => answerStudy(true)}>I knew it</button>
          </>}
          <button className="study-exit" onClick={() => setStudyDeck([])}>End review</button>
        </div>
      </div>}
    </section>}

    {allLessonGroups.length > 0 && <section className="vocabulary-section lesson-vocabulary-section" aria-labelledby="lesson-vocabulary-heading">
      <div className="vocabulary-section-heading">
        <div>
          <span className="eyebrow">BY SAVED TEXT</span>
          <h2 id="lesson-vocabulary-heading">Lesson vocabulary</h2>
          <p>Words grouped under the lesson where you saved them.</p>
        </div>
        <b>{lessonWordCount}</b>
      </div>

      {lessonGroups.length > 0 ? <div className="lesson-vocabulary-grid">{lessonGroups.map(({ text, words: lessonWords }) => {
        const expanded = expandedLessons.has(text.id);
        const visibleWords = expanded ? lessonWords : lessonWords.slice(0, 4);
        const remaining = lessonWords.length - visibleWords.length;
        const listId = `vocabulary-lesson-${text.id}`;

        return <article className="card vocabulary-lesson-card" key={text.id} aria-label={`Vocabulary saved from ${text.title}`}>
          <div className="vocabulary-lesson-head">
            <div>
              <span>文</span>
              <div><h3>{text.title}</h3><small>{text.originalText.slice(0, 38)}{text.originalText.length > 38 ? '…' : ''}</small></div>
            </div>
            <b>{lessonWords.length}</b>
          </div>

          <div className="lesson-vocab-list" id={listId}>
            {visibleWords.map((word) => <div className="lesson-vocab-row" key={`${text.id}-${word.id}`}>
              <span className="lesson-vocab-hanzi">{word.chinese}</span>
              <div className="lesson-vocab-copy"><b>{word.pinyin}</b><small>{word.meaning}</small></div>
              <button className="audio-small" onClick={() => speak(word.chinese)} aria-label={`Pronounce ${word.chinese}`}>♪</button>
            </div>)}
          </div>

          {lessonWords.length > 4 && <button
            className="lesson-vocab-more"
            onClick={() => toggleLesson(text.id)}
            aria-expanded={expanded}
            aria-controls={listId}
          >{expanded ? 'Show fewer' : `Show ${remaining} more`}</button>}
        </article>;
      })}</div> : <div className="card lesson-filter-empty">
        <span>词</span>
        <div><h3>No lesson words match this filter</h3><p>Try another vocabulary filter to see your saved lesson words.</p></div>
      </div>}
    </section>}

    <section className="vocabulary-section all-vocabulary-section" aria-labelledby="all-vocabulary-heading">
      <div className="vocabulary-section-heading compact">
        <div>
          <span className="eyebrow">MASTER LIST</span>
          <h2 id="all-vocabulary-heading">All saved words</h2>
          <p>Every saved word together, including words saved outside a lesson.</p>
        </div>
        <b>{filtered.length}</b>
      </div>

      {filtered.length > 0 ? <div className="card table-wrap">
        <table>
          <thead><tr><th>Word</th><th>Pinyin</th><th>English meaning</th><th>Level</th><th>Saved</th><th/></tr></thead>
          <tbody>{filtered.map((word) => <tr key={word.id}>
            <td><div className="word-with-audio"><span className="table-hanzi">{word.chinese}</span><button className="audio-small" onClick={() => speak(word.chinese)} aria-label={`Pronounce ${word.chinese}`}>♪</button></div></td>
            <td className="table-pinyin">{word.pinyin}</td>
            <td>{word.meaning}{word.userEditedMeaning && <span className="user-edited">Edited</span>}</td>
            <td><span className={`difficulty ${word.difficultyLabel.toLowerCase().replace('-', '')}`}>{word.difficultyLabel}</span></td>
            <td>{new Date(word.createdAt).toLocaleDateString()}</td>
            <td><button className="icon-danger" aria-label={`Delete ${word.chinese}`} onClick={() => onDelete(word.id)}>×</button></td>
          </tr>)}</tbody>
        </table>
      </div> : <div className="card empty">
        <div>词</div>
        <h2>{words.length ? 'No words match this filter' : 'Your word list is empty'}</h2>
        <p>{words.length ? 'Try another vocabulary filter.' : 'Click a word in the Reader and save it to start your collection.'}</p>
      </div>}
    </section>

    {chineseVoiceAvailable === false && words.length > 0 && <p className="voice-note table-note">Chinese voice not available on this device.</p>}
  </main>;
}
