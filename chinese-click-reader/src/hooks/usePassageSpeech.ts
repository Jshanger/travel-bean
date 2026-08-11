import { useCallback, useEffect, useRef, useState } from 'react';
import { prepareMandarinUtterance } from '../utils/speech';
import { buildSynchronizedSpeechUnits, snapCharacterToWordStart } from '../utils/guidedPlayback';
import { useSpeechSettings } from './useSpeechSettings';

export type PassageStatus = 'idle' | 'playing' | 'paused';
export type PassageTrackingMode = 'phrase';

const FALLBACK_MS_PER_CHARACTER = 255;

export function usePassageSpeech() {
  const { supported, rate, selectedVoice } = useSpeechSettings();
  const [status, setStatus] = useState<PassageStatus>('idle');
  const [activeCharIndex, setActiveCharIndex] = useState<number>();
  const [trackingMode, setTrackingMode] = useState<PassageTrackingMode>();
  const sessionRef = useRef(0);
  const statusRef = useRef<PassageStatus>('idle');
  const pausedRef = useRef(false);
  const rateRef = useRef(rate);
  const voiceRef = useRef(selectedVoice);
  const highlightOffsetsRef = useRef<number[]>([]);
  const activeHighlightRef = useRef<number | undefined>(undefined);
  const highlightFrameRef = useRef<number | undefined>(undefined);
  const pendingCharacterRef = useRef<number | undefined>(undefined);
  const phraseTimersRef = useRef<number[]>([]);
  const queuedUtterancesRef = useRef<SpeechSynthesisUtterance[]>([]);
  const currentTextRef = useRef('');
  const previousRateRef = useRef(rate);

  // Keep the click handler synchronized with the latest controls even when a
  // learner presses Play immediately after dragging the speed slider.
  rateRef.current = rate;
  voiceRef.current = selectedVoice;

  const updateStatus = useCallback((next: PassageStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const cancelPendingHighlight = useCallback(() => {
    if (highlightFrameRef.current !== undefined) window.cancelAnimationFrame(highlightFrameRef.current);
    highlightFrameRef.current = undefined;
    pendingCharacterRef.current = undefined;
  }, []);

  const clearPhraseTimers = useCallback(() => {
    phraseTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    phraseTimersRef.current = [];
  }, []);

  const scheduleActiveCharacter = useCallback((rawIndex: number) => {
    const snappedIndex = snapCharacterToWordStart(highlightOffsetsRef.current, Math.max(0, rawIndex));
    if (activeHighlightRef.current !== undefined && snappedIndex < activeHighlightRef.current) return;
    if (snappedIndex === activeHighlightRef.current || snappedIndex === pendingCharacterRef.current) return;
    pendingCharacterRef.current = snappedIndex;
    if (highlightFrameRef.current !== undefined) return;
    highlightFrameRef.current = window.requestAnimationFrame(() => {
      highlightFrameRef.current = undefined;
      const pendingCharacter = pendingCharacterRef.current;
      pendingCharacterRef.current = undefined;
      // Some browsers emit one final boundary after pausing. Keep the visual
      // marker still until playback has actually resumed.
      if (pausedRef.current || pendingCharacter === undefined) return;
      if (pendingCharacter === activeHighlightRef.current) return;
      activeHighlightRef.current = pendingCharacter;
      setActiveCharIndex(pendingCharacter);
    });
  }, []);

  const resetVisualTracking = useCallback(() => {
    cancelPendingHighlight();
    activeHighlightRef.current = undefined;
    setActiveCharIndex(undefined);
    setTrackingMode(undefined);
  }, [cancelPendingHighlight]);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    clearPhraseTimers();
    queuedUtterancesRef.current = [];
    pausedRef.current = false;
    if (supported) {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
    }
    resetVisualTracking();
    updateStatus('idle');
  }, [clearPhraseTimers, resetVisualTracking, supported, updateStatus]);

  const finish = useCallback((session: number) => {
    if (session !== sessionRef.current) return;
    clearPhraseTimers();
    queuedUtterancesRef.current = [];
    pausedRef.current = false;
    resetVisualTracking();
    updateStatus('idle');
  }, [clearPhraseTimers, resetVisualTracking, updateStatus]);

  const fail = useCallback((session: number) => {
    if (session !== sessionRef.current) return;
    sessionRef.current += 1;
    clearPhraseTimers();
    queuedUtterancesRef.current = [];
    pausedRef.current = false;
    if (supported) {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
    }
    resetVisualTracking();
    updateStatus('idle');
  }, [clearPhraseTimers, resetVisualTracking, supported, updateStatus]);

  const playPassage = useCallback((text: string, session: number, baseOffset = 0) => {
    const localOffsets = highlightOffsetsRef.current
      .filter((offset) => offset >= baseOffset)
      .map((offset) => offset - baseOffset);
    const units = buildSynchronizedSpeechUnits(text, localOffsets);
    if (!units.length) {
      finish(session);
      return;
    }
    let completedUnits = 0;

    const utterances = units.map((unit) => {
      const playbackRate = rateRef.current;
      const utterance = prepareMandarinUtterance(unit.text, {
        rate: playbackRate,
        voice: voiceRef.current,
      });

      utterance.onstart = () => {
        if (session !== sessionRef.current) return;
        clearPhraseTimers();
        scheduleActiveCharacter(baseOffset + unit.wordStarts[0]);
        // Short phrase groups keep the voice continuous. On voices without
        // boundary callbacks, local word timers reset at every phrase, so any
        // timing error cannot accumulate across the passage.
        for (const wordStart of unit.wordStarts.slice(1)) {
          const localCharacterDistance = wordStart - unit.wordStarts[0];
          phraseTimersRef.current.push(window.setTimeout(
            () => scheduleActiveCharacter(baseOffset + wordStart),
            (localCharacterDistance * FALLBACK_MS_PER_CHARACTER) / playbackRate,
          ));
        }
        setTrackingMode('phrase');
      };

      utterance.onboundary = (event) => {
        if (session !== sessionRef.current || pausedRef.current) return;
        scheduleActiveCharacter(baseOffset + unit.start + event.charIndex);
      };

      utterance.onend = () => {
        if (session !== sessionRef.current) return;
        clearPhraseTimers();
        completedUnits += 1;
        if (completedUnits === units.length) finish(session);
      };
      utterance.onerror = () => fail(session);
      return utterance;
    });

    queuedUtterancesRef.current = utterances;
    setTrackingMode(undefined);
    updateStatus('playing');
    // Queue the complete sentence up front. Browsers can transition directly
    // between queued units, which avoids the gaps caused by enqueueing the next
    // word only after the previous word's onend callback.
    for (const utterance of utterances) {
      if (session !== sessionRef.current) break;
      window.speechSynthesis.speak(utterance);
    }
  }, [clearPhraseTimers, fail, finish, scheduleActiveCharacter, updateStatus]);

  const play = useCallback((text: string, highlightOffsets: number[] = []) => {
    if (!supported || !text.trim()) return;

    sessionRef.current += 1;
    queuedUtterancesRef.current = [];
    pausedRef.current = false;
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
    resetVisualTracking();

    const session = sessionRef.current;
    currentTextRef.current = text;
    highlightOffsetsRef.current = [...new Set(highlightOffsets)]
      .filter((offset) => Number.isFinite(offset) && offset >= 0)
      .sort((a, b) => a - b);
    playPassage(text, session);
  }, [playPassage, resetVisualTracking, supported]);

  const pause = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    pausedRef.current = true;
    clearPhraseTimers();
    cancelPendingHighlight();
    window.speechSynthesis.pause();
    updateStatus('paused');
  }, [cancelPendingHighlight, clearPhraseTimers, updateStatus]);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    pausedRef.current = false;
    window.speechSynthesis.resume();
    updateStatus('playing');
  }, [updateStatus]);

  useEffect(() => {
    const wordStarted = () => stop();
    window.addEventListener('ccr-word-speech-start', wordStarted);
    return () => window.removeEventListener('ccr-word-speech-start', wordStarted);
  }, [stop]);

  useEffect(() => {
    if (previousRateRef.current === rate) return;
    previousRateRef.current = rate;
    rateRef.current = rate;
    if (statusRef.current !== 'playing' || !currentTextRef.current) return;

    const restartOffset = activeHighlightRef.current ?? 0;
    sessionRef.current += 1;
    clearPhraseTimers();
    queuedUtterancesRef.current = [];
    window.speechSynthesis.cancel();
    const session = sessionRef.current;
    playPassage(currentTextRef.current.slice(restartOffset), session, restartOffset);
  }, [clearPhraseTimers, playPassage, rate]);

  useEffect(() => () => {
    sessionRef.current += 1;
    clearPhraseTimers();
    queuedUtterancesRef.current = [];
    if (supported) window.speechSynthesis.cancel();
  }, [clearPhraseTimers, supported]);

  return { supported, status, activeCharIndex, trackingMode, play, pause, resume, stop };
}
