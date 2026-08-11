import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PassageAudioControls } from './PassageAudioControls';

interface TestElementProps {
  children?: ReactNode;
  onClick?: () => void;
}

type PassageControlsProps = Parameters<typeof PassageAudioControls>[0];

function textContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (!isValidElement<TestElementProps>(node)) return '';
  return textContent(node.props.children);
}

function buttons(node: ReactNode): ReactElement<TestElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement<TestElementProps>(node)) return [];
  const descendants = buttons(node.props.children);
  return node.type === 'button' ? [node, ...descendants] : descendants;
}

function controls(status: PassageControlsProps['status'], callbacks: {
  onPlay?: () => void;
  onPause?: () => void;
  onResume?: () => void;
} = {}, overrides: Partial<PassageControlsProps> = {}) {
  const base: PassageControlsProps = {
    status,
    supported: true,
    voices: [],
    voiceURI: '',
    chineseVoiceAvailable: null,
    rate: 0.95,
    onVoiceChange: () => undefined,
    onRateChange: () => undefined,
    onPreview: () => undefined,
    onUseSmoothestVoice: () => undefined,
    onPlay: callbacks.onPlay ?? (() => undefined),
    onPause: callbacks.onPause ?? (() => undefined),
    onResume: callbacks.onResume ?? (() => undefined),
    onStop: () => undefined,
  };
  return PassageAudioControls({ ...base, ...overrides, status });
}

describe('passage playback controls', () => {
  it('wires the visible pause action to speech pause while reading', () => {
    const onPause = vi.fn();
    const tree = controls('playing', { onPause });
    const pause = buttons(tree).find((button) => textContent(button).includes('Pause'));

    expect(pause).toBeDefined();
    pause?.props.onClick?.();
    expect(onPause).toHaveBeenCalledOnce();
    expect(renderToStaticMarkup(tree)).toContain('Following the spoken word');
  });

  it('wires the visible resume action to speech resume without restarting', () => {
    const onResume = vi.fn();
    const tree = controls('paused', { onResume });
    const resume = buttons(tree).find((button) => textContent(button).includes('Resume'));

    expect(resume).toBeDefined();
    resume?.props.onClick?.();
    expect(onResume).toHaveBeenCalledOnce();
    expect(renderToStaticMarkup(tree)).toContain('Passage paused');
  });

  it('presents playback as immediate and has no model-loading state', () => {
    const html = renderToStaticMarkup(controls('idle'));

    expect(html).toContain('Instant guided Mandarin playback');
    expect(html).toContain('Starts immediately');
    expect(html).not.toContain('Kokoro');
    expect(html).not.toContain('Preparing');
  });

  it('describes boundary-confirmed tracking instead of estimated timing', () => {
    const html = renderToStaticMarkup(controls('playing', {}, { trackingMode: 'phrase' }));

    expect(html).toContain('Smooth phrase playback');
    expect(html).not.toContain('estimating');
  });

  it('keeps the speed control available during playback while locking voice changes', () => {
    const tree = controls('playing');
    const html = renderToStaticMarkup(tree);

    expect(html).toContain('Speed can be changed while playing');
    expect(html).not.toContain('aria-label="Reading speed" disabled');
    expect(html).toContain('aria-label="Mandarin voice" disabled');
  });
});
