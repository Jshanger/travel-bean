import { useEffect, useRef, useState } from 'react';
import type { Segment } from '../types';
import { entryForSegment } from '../utils/wordEntry';
import {
  activeWordNeedsScroll,
  AUTO_SCROLL_COOLDOWN_MS,
} from '../utils/guidedPlayback';
import { useSpeech } from '../hooks/useSpeech';

interface ClickableTextProps {
  segments: Segment[];
  selectedIndex?: number;
  speakingIndex?: number;
  speechPaused?: boolean;
  guidedPlaybackActive: boolean;
  onPlaybackToggle: () => void;
  onSelect: (segment: Segment, index: number) => void;
  onCloseInline: () => void;
  onSave: (segment: Segment) => void;
  saved: Set<string>;
  savedToLesson: Set<string>;
}

export function ClickableText({
  segments,
  selectedIndex,
  speakingIndex,
  speechPaused,
  guidedPlaybackActive,
  onPlaybackToggle,
  onSelect,
  onCloseInline,
  onSave,
  saved,
  savedToLesson,
}: ClickableTextProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number>();
  const readingRef = useRef<HTMLDivElement>(null);
  const wordButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lastAutoScrollRef = useRef(0);
  const pointerPlaybackHandledRef = useRef(false);
  const { speak } = useSpeech();

  useEffect(() => {
    if (selectedIndex === undefined) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const selectedWord = readingRef.current?.querySelector(`[data-word-index="${selectedIndex}"]`);
      if (!selectedWord?.contains(target)) onCloseInline();
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [selectedIndex, onCloseInline]);

  useEffect(() => {
    if (guidedPlaybackActive) setHoveredIndex(undefined);
  }, [guidedPlaybackActive]);

  useEffect(() => {
    if (speakingIndex === undefined || speechPaused) return;
    const activeButton = wordButtonRefs.current[speakingIndex];
    if (!activeButton) return;

    const frame = window.requestAnimationFrame(() => {
      const bounds = activeButton.getBoundingClientRect();
      if (!activeWordNeedsScroll(bounds, window.innerHeight)) return;
      const now = Date.now();
      if (now - lastAutoScrollRef.current < AUTO_SCROLL_COOLDOWN_MS) return;
      lastAutoScrollRef.current = now;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      activeButton.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'center',
        inline: 'nearest',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [speakingIndex, speechPaused]);

  return <div
    ref={readingRef}
    className={`reading ${guidedPlaybackActive ? `guided-reading playback-${speechPaused ? 'paused' : 'playing'}` : ''}`}
    aria-label={guidedPlaybackActive
      ? speechPaused
        ? 'Chinese passage paused. Tap to resume playback.'
        : 'Chinese passage playing. Tap to pause playback.'
      : 'Clickable Chinese text'}
    onPointerDownCapture={(event) => {
      if (!guidedPlaybackActive) return;
      if (event.button !== 0) return;
      pointerPlaybackHandledRef.current = true;
      event.stopPropagation();
      onPlaybackToggle();
    }}
    onPointerCancelCapture={() => { pointerPlaybackHandledRef.current = false; }}
    onClickCapture={(event) => {
      if (!guidedPlaybackActive) return;
      event.stopPropagation();
      if (pointerPlaybackHandledRef.current) {
        pointerPlaybackHandledRef.current = false;
        return;
      }
      pointerPlaybackHandledRef.current = false;
      onPlaybackToggle();
    }}
  >
    {guidedPlaybackActive && <span className="tap-playback-hint" aria-live="polite">
      {speechPaused ? '▶ Paused · tap passage to resume' : 'Ⅱ Tap passage to pause'}
    </span>}
    {segments.map((segment, index) => {
      if (!segment.isChinese) return <span key={index}>{segment.text}</span>;
      const entry = entryForSegment(segment);
      const speaking = speakingIndex === index;
      const open = !guidedPlaybackActive && (selectedIndex === index || hoveredIndex === index);
      const guidedId = `guided-word-${index}`;
      const detailsId = `word-details-${index}`;
      const speakingMeaning = speaking
        ? entry.meaning.split(/\s*[;/]\s*/)[0]?.trim() || 'Meaning unavailable'
        : '';
      return <span
        className={`word-unit ${open ? 'gloss-open' : ''} ${speaking ? 'speech-active' : ''}`}
        key={index}
        data-word-index={index}
        onMouseEnter={() => { if (!guidedPlaybackActive) setHoveredIndex(index); }}
        onMouseLeave={() => setHoveredIndex(undefined)}
      >
        <button
          ref={(element) => { wordButtonRefs.current[index] = element; }}
          className={`word ${selectedIndex === index ? 'selected' : ''} ${saved.has(segment.text) ? 'saved' : ''} ${speaking ? 'speaking' : ''} ${speaking && speechPaused ? 'speech-paused' : ''}`}
          aria-current={speaking ? 'true' : undefined}
          aria-describedby={speaking ? guidedId : undefined}
          aria-expanded={open || undefined}
          aria-controls={open ? detailsId : undefined}
          onClick={() => onSelect(segment, index)}
        >
          {segment.text}
        </button>
        {guidedPlaybackActive && speaking && <span
          id={guidedId}
          className="guided-inline-info"
          role="note"
        >
          <span className="guided-inline-pinyin">{entry.pinyin || 'Pinyin unavailable'}</span>
          <span className="guided-inline-meaning" title={entry.meaning}>{speakingMeaning}</span>
        </span>}
        {open && <span id={detailsId} className="inline-gloss" role="dialog" aria-label={`Word details for ${entry.chinese}`}>
          <b>{entry.chinese}</b>
          <span className="inline-pinyin">{entry.pinyin}</span>
          <span className="inline-meaning">{entry.meaning}</span>
          <span className={`difficulty ${entry.difficultyLabel.toLowerCase().replace('-', '')}`}>{entry.difficultyLabel}</span>
          <span className="inline-actions">
            <button onClick={(event) => { event.stopPropagation(); speak(entry.chinese); }} aria-label={`Pronounce ${entry.chinese}`}>♪ Audio</button>
            <button
              className={savedToLesson.has(entry.chinese) ? 'saved-action' : ''}
              disabled={savedToLesson.has(entry.chinese)}
              onClick={(event) => { event.stopPropagation(); onSave(segment); }}
            >
              {savedToLesson.has(entry.chinese)
                ? '✓ In lesson'
                : saved.has(entry.chinese)
                  ? '+ Add to lesson'
                  : '+ Save'}
            </button>
          </span>
        </span>}
      </span>;
    })}
  </div>;
}
