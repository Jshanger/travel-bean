import { useEffect, useMemo, useState } from 'react';
import type {
  ClickedWordHistoryItem,
  DictionaryEntry,
  DifficultyLabel,
  SavedText,
  SavedWord,
  Segment,
} from '../types';
import { segmentChinese } from '../utils/segmentChinese';
import { lookupDictionaryEntry } from '../utils/cedict';
import { entryForSegment } from '../utils/wordEntry';
import { buildSegmentRanges, segmentIndexAtCharacter } from '../utils/speech';
import { wordBelongsToText } from '../utils/wordSources';
import { TextInputPanel } from '../components/TextInputPanel';
import { ClickableText } from '../components/ClickableText';
import { WordDetailPanel } from '../components/WordDetailPanel';
import { MobileWordSheet } from '../components/MobileWordSheet';
import { ClickedHistory } from '../components/ClickedHistory';
import { PassageAudioControls } from '../components/PassageAudioControls';
import { usePassageSpeech } from '../hooks/usePassageSpeech';
import { useSpeechSettings } from '../hooks/useSpeechSettings';

function defaultTitle(text: string) {
  const chinese = [...text].filter((char) => /[\u3400-\u9fff]/.test(char)).slice(0, 12).join('');
  return chinese || text.trim().slice(0, 15) || 'Untitled Chinese text';
}

interface ReaderPageProps {
  initialText?: SavedText;
  onConsumeInitial: () => void;
  words: SavedWord[];
  history: ClickedWordHistoryItem[];
  dictionaryStatus: 'loading' | 'ready' | 'error';
  onSaveWord: (word: SavedWord) => void;
  onSaveText: (text: SavedText) => void;
  onAddHistory: (item: ClickedWordHistoryItem) => void;
  onClearHistory: () => void;
}

export function ReaderPage({
  initialText,
  onConsumeInitial,
  words,
  history,
  dictionaryStatus,
  onSaveWord,
  onSaveText,
  onAddHistory,
  onClearHistory,
}: ReaderPageProps) {
  const [text, setText] = useState(initialText?.originalText ?? '');
  const [converted, setConverted] = useState(initialText?.originalText ?? '');
  const [sourceTextId, setSourceTextId] = useState(initialText?.id);
  const [sourceTextCreatedAt, setSourceTextCreatedAt] = useState(initialText?.createdAt);
  const [sourceTextTitle, setSourceTextTitle] = useState(initialText?.title);
  const [selected, setSelected] = useState<DictionaryEntry>();
  const [selectedIndex, setSelectedIndex] = useState<number>();
  const [difficulty, setDifficulty] = useState<DifficultyLabel>();
  const [saveOpen, setSaveOpen] = useState(false);
  const [title, setTitle] = useState('');
  // Saved/imported vocabulary is also the learner's persistent segmentation
  // memory. Once they confirm a compound, future lessons keep it together.
  const segments = useMemo(() => segmentChinese(converted, words), [converted, dictionaryStatus, words]);
  const readingText = useMemo(() => segments.map((segment) => segment.text).join(''), [segments]);
  const ranges = useMemo(() => buildSegmentRanges(segments), [segments]);
  const chineseRangeStarts = useMemo(
    () => ranges.filter((range) => range.isChinese).map((range) => range.start),
    [ranges],
  );
  const saved = useMemo(() => new Set(words.map((word) => word.chinese)), [words]);
  const savedToLesson = useMemo(() => new Set(
    sourceTextId
      ? words.filter((word) => wordBelongsToText(word, sourceTextId)).map((word) => word.chinese)
      : [],
  ), [sourceTextId, words]);
  const passage = usePassageSpeech();
  const speechSettings = useSpeechSettings();

  const speakingIndex = useMemo(
    () => segmentIndexAtCharacter(ranges, passage.activeCharIndex),
    [ranges, passage.activeCharIndex],
  );
  const playbackEntry = speakingIndex === undefined ? undefined : entryForSegment(segments[speakingIndex]);
  const displayedEntry = playbackEntry ?? selected;
  const displayedDifficulty = playbackEntry?.difficultyLabel ?? difficulty;

  useEffect(() => {
    if (!initialText) return;
    passage.stop();
    setText(initialText.originalText);
    setConverted(initialText.originalText);
    setSourceTextId(initialText.id);
    setSourceTextCreatedAt(initialText.createdAt);
    setSourceTextTitle(initialText.title);
    setSelected(undefined);
    setSelectedIndex(undefined);
    onConsumeInitial();
  }, [initialText]);

  useEffect(() => {
    if (dictionaryStatus !== 'ready') return;
    setSelectedIndex(undefined);
    if (selected) {
      const refreshed = lookupDictionaryEntry(selected.chinese);
      if (refreshed) {
        setSelected(refreshed);
        setDifficulty(refreshed.difficultyLabel);
      }
    }
  }, [dictionaryStatus]);

  const openEntry = (entry: DictionaryEntry, record = true, index?: number) => {
    setSelected(entry);
    setDifficulty(entry.difficultyLabel);
    setSelectedIndex(index);
    if (record) {
      onAddHistory({
        id: crypto.randomUUID(),
        chinese: entry.chinese,
        pinyin: entry.pinyin,
        meaning: entry.meaning,
        clickedAt: new Date().toISOString(),
        sourceTextId,
      });
    }
  };

  const choose = (segment: Segment, index: number) => {
    passage.stop();
    openEntry(entryForSegment(segment), true, index);
  };

  const openHistory = (item: ClickedWordHistoryItem) => {
    passage.stop();
    openEntry(lookupDictionaryEntry(item.chinese) ?? {
      chinese: item.chinese,
      pinyin: item.pinyin,
      meaning: item.meaning,
      difficultyLabel: 'Unknown',
    }, false);
  };

  const createSavedWord = (
    entry: DictionaryEntry,
    meaning = entry.meaning,
    userEditedMeaning = false,
  ): SavedWord => {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      chinese: entry.chinese,
      pinyin: entry.pinyin,
      meaning,
      originalMeaning: userEditedMeaning ? entry.meaning : undefined,
      userEditedMeaning,
      exampleSentence: entry.exampleSentence,
      difficultyLabel: entry.difficultyLabel,
      sourceTextId,
      sourceTextIds: sourceTextId ? [sourceTextId] : undefined,
      createdAt: now,
      updatedAt: now,
    };
  };

  const saveWord = (meaning: string, userEditedMeaning: boolean) => {
    if (displayedEntry) onSaveWord(createSavedWord(displayedEntry, meaning, userEditedMeaning));
  };
  const saveInline = (segment: Segment) => onSaveWord(createSavedWord(entryForSegment(segment)));

  const beginSave = () => {
    setTitle(sourceTextTitle ?? '');
    setSaveOpen(true);
  };
  const confirmSave = () => {
    if (!converted) return;
    const now = new Date().toISOString();
    const id = sourceTextId ?? crypto.randomUUID();
    const savedTitle = title.trim() || sourceTextTitle || defaultTitle(converted);
    const createdAt = sourceTextCreatedAt ?? now;
    onSaveText({
      id,
      title: savedTitle,
      originalText: converted,
      createdAt,
      updatedAt: now,
    });
    setSourceTextId(id);
    setSourceTextCreatedAt(createdAt);
    setSourceTextTitle(savedTitle);
    setSaveOpen(false);
  };

  const changeText = (value: string) => {
    passage.stop();
    setText(value);
  };
  const convert = () => {
    passage.stop();
    const sameLesson = Boolean(sourceTextId && text === converted);
    setConverted(text);
    if (!sameLesson) {
      setSourceTextId(crypto.randomUUID());
      setSourceTextCreatedAt(undefined);
      setSourceTextTitle(undefined);
    }
    setSelected(undefined);
    setSelectedIndex(undefined);
  };
  const clear = () => {
    passage.stop();
    setText('');
    setConverted('');
    setSourceTextId(undefined);
    setSourceTextCreatedAt(undefined);
    setSourceTextTitle(undefined);
    setSelected(undefined);
    setSelectedIndex(undefined);
    setDifficulty(undefined);
    setSaveOpen(false);
    setTitle('');
    window.requestAnimationFrame(() => document.getElementById('lesson-text-input')?.focus());
  };
  const playPassage = () => {
    setSelectedIndex(undefined);
    // Speak the normalized text represented by the rendered segments. OCR can
    // insert spaces between every Han character; using the raw import here made
    // speech positions diverge from the visible word offsets.
    passage.play(readingText, chineseRangeStarts);
  };
  const togglePassagePlayback = () => {
    if (passage.status === 'playing') passage.pause();
    else if (passage.status === 'paused') passage.resume();
  };

  return <>
    <div className="hero">
      <div>
        <span className="pill">READ REAL CHINESE</span>
        <h1>Turn everyday Chinese into<br/><em>your next lesson.</em></h1>
        <p>Paste a message, article, or listing. Tap any word to hear it, understand it, and remember it.</p>
      </div>
      <div className="lesson-orbit"><span>听</span><b>读</b><i>学</i></div>
    </div>

    <TextInputPanel value={text} onChange={changeText} onConvert={convert} onClear={clear}/>

    {converted && <>
      <section className="lesson-shell">
        <div className="card result lesson-card">
          <div className="lesson-toolbar">
            <div><span className="step">2</span><div><h2>Your reading lesson</h2><p>Hover or tap a word for a quick gloss</p></div></div>
            <div className="lesson-toolbar-actions">
              <button
                className="new-lesson-button"
                onClick={clear}
                title="Start a blank lesson. Your saved copy stays in Saved texts."
              >＋ New lesson</button>
              <button className="save-text-button" onClick={beginSave}>♡ <span>Save lesson</span></button>
            </div>
          </div>
          <div className="lesson-meta">
            <span>中文阅读</span><i/><span>{segments.filter((segment) => segment.isChinese).length} word units</span>
            <span className={`dictionary-state ${dictionaryStatus}`} aria-live="polite">
              {dictionaryStatus === 'loading' ? 'Loading full dictionary…' : dictionaryStatus === 'ready' ? '190,000+ entries ready' : 'Full dictionary unavailable — refresh to retry'}
            </span>
          </div>
          <PassageAudioControls
            status={passage.status}
            supported={passage.supported}
            voices={speechSettings.voices}
            voiceURI={speechSettings.voiceURI}
            selectedVoice={speechSettings.selectedVoice}
            chineseVoiceAvailable={speechSettings.chineseVoiceAvailable}
            rate={speechSettings.rate}
            activeEntry={playbackEntry}
            trackingMode={passage.trackingMode}
            onVoiceChange={speechSettings.setVoiceURI}
            onRateChange={speechSettings.setRate}
            onPreview={speechSettings.previewVoice}
            onUseSmoothestVoice={speechSettings.useSmoothestVoice}
            onPlay={playPassage}
            onPause={passage.pause}
            onResume={passage.resume}
            onStop={passage.stop}
          />
          <ClickableText
            segments={segments}
            selectedIndex={selectedIndex}
            speakingIndex={speakingIndex}
            speechPaused={passage.status === 'paused'}
            guidedPlaybackActive={passage.status === 'playing' || passage.status === 'paused'}
            onPlaybackToggle={togglePassagePlayback}
            onSelect={choose}
            onCloseInline={() => setSelectedIndex(undefined)}
            onSave={saveInline}
            saved={saved}
            savedToLesson={savedToLesson}
          />
          <div className="legend">
            <span><i/> Clickable word</span>
            <span><i className="green"/> Saved word</span>
            <span><i className="amber"/> Spoken word</span>
            <span className="lesson-tip">Tip: listen, repeat, then save</span>
          </div>
        </div>
        <div className="desktop-detail">
          <WordDetailPanel
            entry={displayedEntry}
            difficulty={displayedDifficulty}
            isSaved={displayedEntry ? saved.has(displayedEntry.chinese) : false}
            isSavedToLesson={displayedEntry ? savedToLesson.has(displayedEntry.chinese) : false}
            onSave={saveWord}
          />
        </div>
      </section>

      <ClickedHistory items={history} onOpen={openHistory} onClear={onClearHistory}/>
      <MobileWordSheet
        entry={selected}
        difficulty={difficulty}
        isSaved={selected ? saved.has(selected.chinese) : false}
        isSavedToLesson={selected ? savedToLesson.has(selected.chinese) : false}
        onSave={saveWord}
        onClose={() => { setSelected(undefined); setSelectedIndex(undefined); }}
      />
    </>}

    {saveOpen && <div className="modal-backdrop" onClick={() => setSaveOpen(false)}>
      <div className="save-dialog card" onClick={(event) => event.stopPropagation()}>
        <span className="dialog-icon">文</span>
        <div><div className="eyebrow">SAVE TO YOUR LIBRARY</div><h2>Name this lesson</h2><p>Give it a title you’ll recognize later.</p></div>
        <label>Title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') confirmSave(); }} placeholder={defaultTitle(converted)}/></label>
        <small>Leave blank to use “{defaultTitle(converted)}”</small>
        <div className="dialog-actions"><button className="ghost" onClick={() => setSaveOpen(false)}>Cancel</button><button className="primary" onClick={confirmSave}>Save text</button></div>
      </div>
    </div>}
  </>;
}
