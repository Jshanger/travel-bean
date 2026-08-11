import { useCallback } from 'react';
import { prepareMandarinUtterance } from '../utils/speech';
import { useSpeechSettings } from './useSpeechSettings';

export function useSpeech() {
  const {
    supported,
    selectedVoice,
    rate,
    chineseVoiceAvailable,
  } = useSpeechSettings();

  const speak = useCallback((text: string) => {
    if (!supported) return;
    window.dispatchEvent(new Event('ccr-word-speech-start'));
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(prepareMandarinUtterance(text, { rate, voice: selectedVoice }));
  }, [rate, selectedVoice, supported]);

  return {
    speak,
    supported,
    chineseVoiceAvailable,
  };
}
