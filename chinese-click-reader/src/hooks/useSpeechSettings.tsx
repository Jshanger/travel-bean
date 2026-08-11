import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  getMandarinVoices,
  MAX_SPEECH_RATE,
  MIN_SPEECH_RATE,
  preferredMandarinVoice,
  prepareMandarinUtterance,
  readStoredSpeechRate,
  readStoredVoiceURI,
  SPEECH_RATE_STORAGE_KEY,
  SPEECH_VOICE_STORAGE_KEY,
} from '../utils/speech';

interface SpeechSettingsValue {
  supported: boolean;
  systemSupported: boolean;
  voices: SpeechSynthesisVoice[];
  voiceURI: string;
  selectedVoice?: SpeechSynthesisVoice;
  rate: number;
  chineseVoiceAvailable: boolean | null;
  setVoiceURI: (voiceURI: string) => void;
  setRate: (rate: number) => void;
  previewVoice: () => void;
  useSmoothestVoice: () => void;
}

const SpeechSettingsContext = createContext<SpeechSettingsValue | undefined>(undefined);

export function SpeechSettingsProvider({ children }: { children: ReactNode }) {
  const systemSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURIState] = useState(readStoredVoiceURI);
  const [rate, setRateState] = useState(readStoredSpeechRate);
  const [voicesResolved, setVoicesResolved] = useState(false);

  const refreshVoices = useCallback((finalAttempt = false) => {
    if (!systemSupported) {
      setVoices([]);
      setVoicesResolved(true);
      return;
    }
    const next = getMandarinVoices();
    setVoices(next);
    if (next.length || finalAttempt) setVoicesResolved(true);
  }, [systemSupported]);

  useEffect(() => {
    refreshVoices();
    if (!systemSupported) return;
    const handleVoicesChanged = () => refreshVoices();
    const handlePageShow = () => refreshVoices();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshVoices();
    };
    const retries = [100, 500, 1500].map((delay, index, attempts) => window.setTimeout(
      () => refreshVoices(index === attempts.length - 1),
      delay,
    ));
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      retries.forEach((timer) => window.clearTimeout(timer));
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshVoices, systemSupported]);

  const selectedVoice = useMemo(
    () => preferredMandarinVoice(voices, voiceURI),
    [voices, voiceURI],
  );

  const setVoiceURI = useCallback((nextVoiceURI: string) => {
    setVoiceURIState(nextVoiceURI);
    try {
      if (nextVoiceURI) window.localStorage.setItem(SPEECH_VOICE_STORAGE_KEY, nextVoiceURI);
      else window.localStorage.removeItem(SPEECH_VOICE_STORAGE_KEY);
    } catch {
      // Speech preferences still work for this session when storage is blocked.
    }
  }, []);

  useEffect(() => {
    if (!voicesResolved || !voiceURI || !voices.length) return;
    if (!voices.some((voice) => voice.voiceURI === voiceURI)) setVoiceURI('');
  }, [setVoiceURI, voiceURI, voices, voicesResolved]);

  const setRate = useCallback((nextRate: number) => {
    const clamped = Math.round(
      Math.min(MAX_SPEECH_RATE, Math.max(MIN_SPEECH_RATE, nextRate)) * 100,
    ) / 100;
    setRateState(clamped);
    try {
      window.localStorage.setItem(SPEECH_RATE_STORAGE_KEY, String(clamped));
    } catch {
      // Speech preferences still work for this session when storage is blocked.
    }
  }, []);

  const previewVoice = useCallback(() => {
    if (!systemSupported) return;
    window.dispatchEvent(new Event('ccr-word-speech-start'));
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(prepareMandarinUtterance('你好，很高兴和你一起学习中文。', { rate, voice: selectedVoice }));
  }, [rate, selectedVoice, systemSupported]);

  const useSmoothestVoice = useCallback(() => {
    if (!systemSupported || !voices[0]) return;
    setVoiceURI('');
    setRate(1);
    window.dispatchEvent(new Event('ccr-word-speech-start'));
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(prepareMandarinUtterance(
      '你好，这是当前设备上最流畅的普通话语音。',
      { rate: 1, voice: voices[0] },
    ));
  }, [setRate, setVoiceURI, systemSupported, voices]);

  return <SpeechSettingsContext.Provider value={{
    supported: systemSupported,
    systemSupported,
    voices,
    voiceURI,
    selectedVoice,
    rate,
    chineseVoiceAvailable: voicesResolved ? Boolean(selectedVoice) : null,
    setVoiceURI,
    setRate,
    previewVoice,
    useSmoothestVoice,
  }}>
    {children}
  </SpeechSettingsContext.Provider>;
}

export function useSpeechSettings() {
  const value = useContext(SpeechSettingsContext);
  if (!value) throw new Error('useSpeechSettings must be used inside SpeechSettingsProvider.');
  return value;
}
