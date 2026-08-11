import type { DictionaryEntry } from '../types';
import type { PassageStatus, PassageTrackingMode } from '../hooks/usePassageSpeech';
import { isLikelySmoothVoice, MAX_SPEECH_RATE, MIN_SPEECH_RATE } from '../utils/speech';

interface PassageAudioControlsProps {
  status: PassageStatus;
  supported: boolean;
  voices: SpeechSynthesisVoice[];
  voiceURI: string;
  selectedVoice?: SpeechSynthesisVoice;
  chineseVoiceAvailable: boolean | null;
  rate: number;
  activeEntry?: DictionaryEntry;
  trackingMode?: PassageTrackingMode;
  onVoiceChange: (voiceURI: string) => void;
  onRateChange: (rate: number) => void;
  onPreview: () => void;
  onUseSmoothestVoice: () => void;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function PassageAudioControls({
  status,
  supported,
  voices,
  voiceURI,
  selectedVoice,
  chineseVoiceAvailable,
  rate,
  activeEntry,
  trackingMode,
  onVoiceChange,
  onRateChange,
  onPreview,
  onUseSmoothestVoice,
  onPlay,
  onPause,
  onResume,
  onStop,
}: PassageAudioControlsProps) {
  const voiceLocked = status !== 'idle';
  const rateLocked = status === 'paused';
  const voiceIsSmooth = isLikelySmoothVoice(selectedVoice);
  const smoothVoiceAvailable = voices.some(isLikelySmoothVoice);
  const smootherVoiceAvailable = Boolean(
    voiceURI
    && selectedVoice
    && voices[0]
    && voices[0].voiceURI !== selectedVoice.voiceURI,
  );
  const isAppleDevice = typeof navigator !== 'undefined'
    && /Mac|iPhone|iPad/i.test(`${navigator.platform} ${navigator.userAgent}`);
  const playerMessage = status === 'playing'
    ? 'Following the spoken word…'
    : status === 'paused'
      ? 'Passage paused'
      : 'Starts immediately with your best available Mandarin voice';

  return <div className={`passage-player ${status}`}>
    <div className="passage-player-top">
      <div className="passage-audio-label">
        <span>{status === 'playing' ? '◉' : status === 'paused' ? 'Ⅱ' : '♪'}</span>
        <div>
          <b>Instant guided Mandarin playback</b>
          <small>{playerMessage}</small>
        </div>
      </div>
      <div className="passage-controls">
        {status === 'idle' && <button onClick={onPlay} disabled={!supported}>▶ <span>Play</span></button>}
        {status === 'playing' && <button onClick={onPause}>Ⅱ <span>Pause</span></button>}
        {status === 'paused' && <button onClick={onResume}>▶ <span>Resume</span></button>}
        <button onClick={onStop} disabled={status === 'idle'}>■ <span>Stop</span></button>
      </div>
    </div>

    <div className="speech-settings">
      <label className="voice-control">
        <span>Mandarin voice</span>
        <select
          aria-label="Mandarin voice"
          value={voiceURI}
          onChange={(event) => onVoiceChange(event.target.value)}
          disabled={!supported || voiceLocked}
        >
          <option value="">Smoothest available (automatic){voices[0] ? ` — ${voices[0].name}` : ''}</option>
          {voices.map((voice) => <option value={voice.voiceURI} key={voice.voiceURI}>
            {voice.name} · {voice.lang}
            {isLikelySmoothVoice(voice) ? ' · Higher quality' : ''}
            {voice.localService ? ' · On device' : ' · May use network'}
          </option>)}
        </select>
      </label>

      <div className="rate-control">
        <span>Reading speed <output>{rate.toFixed(2)}×</output></span>
        <div>
          <button
            type="button"
            className="speed-step"
            aria-label="Slower playback"
            onClick={(event) => { event.preventDefault(); onRateChange(rate - 0.05); }}
            disabled={!supported || rateLocked || rate <= MIN_SPEECH_RATE}
          >−</button>
          <input
            aria-label="Reading speed"
            type="range"
            min={MIN_SPEECH_RATE}
            max={MAX_SPEECH_RATE}
            step="0.05"
            value={rate}
            onInput={(event) => onRateChange(Number(event.currentTarget.value))}
            disabled={!supported || rateLocked}
          />
          <button
            type="button"
            className="speed-step"
            aria-label="Faster playback"
            onClick={(event) => { event.preventDefault(); onRateChange(rate + 0.05); }}
            disabled={!supported || rateLocked || rate >= MAX_SPEECH_RATE}
          >+</button>
        </div>
        <button
          type="button"
          className="natural-rate"
          onClick={() => onRateChange(1)}
          disabled={!supported || rateLocked || rate === 1}
        >Use natural 1.00× pace</button>
      </div>

      <div className="voice-actions">
        <button className="voice-preview" onClick={onPreview} disabled={!supported || voiceLocked}>♪ Preview voice</button>
        {smootherVoiceAvailable && <button className="smoothest-voice" onClick={onUseSmoothestVoice} disabled={!supported || voiceLocked}>✦ Use smoothest voice</button>}
      </div>
    </div>

    {activeEntry && <div className="now-reading" aria-label={`Now reading ${activeEntry.chinese}`}>
      <small>NOW READING</small>
      <b>{activeEntry.chinese}</b>
      <span>{activeEntry.pinyin}</span>
      <p>{activeEntry.meaning}</p>
    </div>}

    {trackingMode === 'phrase' && status !== 'idle' && <p className="tracking-note">Smooth phrase playback with word-by-word guidance.</p>}
    {chineseVoiceAvailable === false && <p className="voice-note passage-voice-note">Chinese voice not available on this device.</p>}
    {rate < 0.8 && status === 'idle' && <p className="voice-quality-note">Very slow study speed stretches the voice and can sound less natural. Try 0.95–1.00× for smoother speech.</p>}
    {chineseVoiceAvailable && !voiceIsSmooth && status === 'idle' && <p className="voice-quality-note">
      {smoothVoiceAvailable
        ? 'A smoother Mandarin voice is available. Choose “Smoothest available” or use the button above.'
        : <>Only a standard Mandarin voice is installed. Install an Enhanced or Premium Mandarin voice in your device settings, then reload.{isAppleDevice && <> <a href="https://support.apple.com/guide/mac-help/change-the-voice-your-mac-uses-to-speak-text-mchlp2290/mac" target="_blank" rel="noreferrer">Apple voice setup</a></>}</>}
    </p>}
    {voiceLocked && <p className="settings-lock-note">Speed can be changed while playing. Stop playback to change the voice.</p>}
  </div>;
}
