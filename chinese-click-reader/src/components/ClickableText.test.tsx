import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SpeechSettingsProvider } from '../hooks/useSpeechSettings';
import type { Segment } from '../types';
import { ClickableText } from './ClickableText';

const situation: Segment = {
  text: '情况',
  isChinese: true,
  entry: {
    chinese: '情况',
    pinyin: 'qíngkuàng',
    meaning: 'circumstances; situation; condition',
    difficultyLabel: 'Common',
  },
};

const good: Segment = {
  text: '很好',
  isChinese: true,
  entry: {
    chinese: '很好',
    pinyin: 'hěn hǎo',
    meaning: 'very good',
    difficultyLabel: 'Common',
  },
};

describe('guided word information', () => {
  it('renders the active word pinyin and meaning directly beneath its characters', () => {
    const html = renderToStaticMarkup(
      <SpeechSettingsProvider>
        <ClickableText
          segments={[situation, good]}
          selectedIndex={0}
          speakingIndex={0}
          guidedPlaybackActive
          onPlaybackToggle={() => undefined}
          onSelect={() => undefined}
          onCloseInline={() => undefined}
          onSave={() => undefined}
          saved={new Set()}
          savedToLesson={new Set()}
        />
      </SpeechSettingsProvider>,
    );

    expect(html).toContain('guided-reading');
    expect(html).toContain('playback-playing');
    expect(html).toContain('Tap passage to pause');
    expect(html).toContain('Chinese passage playing. Tap to pause playback.');
    expect(html).toContain('guided-inline-info');
    expect(html).toContain('qíngkuàng');
    expect(html).toContain('circumstances');
    expect(html).toContain('aria-describedby="guided-word-0"');
    expect(html).not.toContain('inline-gloss');

    const activeWord = html.indexOf('speech-active');
    const localInformation = html.indexOf('id="guided-word-0"');
    const followingWord = html.indexOf('class="word-unit', activeWord + 1);
    expect(activeWord).toBeGreaterThanOrEqual(0);
    expect(localInformation).toBeGreaterThan(activeWord);
    expect(localInformation).toBeLessThan(followingWord);
    expect(html).not.toContain('data-positioned');
  });

  it('shows the resume affordance while passage speech is paused', () => {
    const html = renderToStaticMarkup(
      <SpeechSettingsProvider>
        <ClickableText
          segments={[situation]}
          speakingIndex={0}
          speechPaused
          guidedPlaybackActive
          onPlaybackToggle={() => undefined}
          onSelect={() => undefined}
          onCloseInline={() => undefined}
          onSave={() => undefined}
          saved={new Set()}
          savedToLesson={new Set()}
        />
      </SpeechSettingsProvider>,
    );

    expect(html).toContain('playback-paused');
    expect(html).toContain('Paused · tap passage to resume');
    expect(html).toContain('Chinese passage paused. Tap to resume playback.');
  });

  it('keeps the current word and its information visible while playback is paused', () => {
    const html = renderToStaticMarkup(
      <SpeechSettingsProvider>
        <ClickableText
          segments={[situation]}
          speakingIndex={0}
          speechPaused
          guidedPlaybackActive
          onPlaybackToggle={() => undefined}
          onSelect={() => undefined}
          onCloseInline={() => undefined}
          onSave={() => undefined}
          saved={new Set()}
          savedToLesson={new Set()}
        />
      </SpeechSettingsProvider>,
    );

    expect(html).toContain('speech-active');
    expect(html).toContain('speech-paused');
    expect(html).toContain('guided-inline-info');
    expect(html).toContain('aria-current="true"');
  });
});
