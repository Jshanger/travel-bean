import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hooks = vi.hoisted(() => ({
  stateIndex: 0,
  stateOverrides: new Map<number, unknown>(),
  setters: [] as Array<ReturnType<typeof vi.fn>>,
  effects: [] as Array<() => void | (() => void)>,
}));

const extraction = vi.hoisted(() => ({
  extractDocumentText: vi.fn(),
}));

// DocumentImport's drag handlers can be exercised as plain element props in the
// Node test environment. The real React element shape is kept; only stateful
// hooks are made deterministic for these interaction tests.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useRef: <T,>(initial: T) => ({ current: initial }),
    useCallback: <T extends (...args: never[]) => unknown>(callback: T) => callback,
    useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
    useState: <T,>(initial: T) => {
      const index = hooks.stateIndex++;
      const setter = vi.fn();
      hooks.setters.push(setter);
      return [hooks.stateOverrides.has(index) ? hooks.stateOverrides.get(index) : initial, setter];
    },
  };
});

vi.mock('../utils/extractDocumentText', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/extractDocumentText')>();
  return { ...actual, extractDocumentText: extraction.extractDocumentText };
});

import { clipboardImageFiles, DocumentImport } from './DocumentImport';

interface ElementProps {
  children?: ReactNode;
  [key: string]: unknown;
}

interface DropEventStub {
  dataTransfer: {
    types: string[];
    files: File[];
    dropEffect: string;
  };
  preventDefault: ReturnType<typeof vi.fn>;
  stopPropagation: ReturnType<typeof vi.fn>;
}

function elements(node: ReactNode): ReactElement<ElementProps>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<ElementProps>(node)) return [];
  return [node, ...elements(node.props.children)];
}

function renderImporter(overrides: Map<number, unknown> = new Map(), onExtracted = vi.fn()) {
  hooks.stateIndex = 0;
  hooks.stateOverrides = overrides;
  hooks.setters.length = 0;
  hooks.effects.length = 0;
  return DocumentImport({ onExtracted }) as ReactElement<ElementProps>;
}

function dragEvent(types = ['Files'], files: File[] = []): DropEventStub {
  return {
    dataTransfer: { types, files, dropEffect: 'none' },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
}

beforeEach(() => {
  hooks.stateIndex = 0;
  hooks.stateOverrides.clear();
  hooks.setters.length = 0;
  hooks.effects.length = 0;
  extraction.extractDocumentText.mockReset();
  extraction.extractDocumentText.mockImplementation(async (file: File) => ({
    text: `Extracted from ${file.name}`,
    warnings: [],
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('document drag and drop', () => {
  it('advertises the complete supported file set and accessible picker controls', () => {
    const tree = renderImporter();
    const descendants = elements(tree);
    const inputs = descendants.filter((element) => element.type === 'input');
    const buttons = descendants.filter((element) => element.type === 'button');

    expect(tree.props['aria-label']).toBe('Paste, drag and drop Chinese documents or screenshots');
    expect(tree.props['aria-busy']).toBe(false);
    expect(inputs).toHaveLength(2);
    expect(inputs.map((input) => input.props.accept)).toEqual([
      'image/png,image/jpeg,image/webp,image/bmp',
      'application/pdf,.pdf,.docx,text/plain,.txt,.md',
    ]);
    expect(inputs.every((input) => input.props.multiple === true)).toBe(true);
    expect(buttons.map((button) => String(button.props.children))).toEqual([
      '▧ Screenshot / photo',
      '▤ Document',
    ]);
  });

  it('extracts only image files from clipboard items', () => {
    const screenshot = new File(['image'], 'clipboard.png', { type: 'image/png' });
    const document = new File(['pdf'], 'clipboard.pdf', { type: 'application/pdf' });
    const clipboard = {
      items: [
        { kind: 'string', type: 'text/plain', getAsFile: () => null },
        { kind: 'file', type: document.type, getAsFile: () => document },
        { kind: 'file', type: screenshot.type, getAsFile: () => screenshot },
      ],
      files: [screenshot, document],
    } as unknown as DataTransfer;

    expect(clipboardImageFiles(clipboard)).toEqual([screenshot]);
  });

  it('runs a pasted screenshot through the same local OCR extractor', async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('window', { addEventListener, removeEventListener });
    const onExtracted = vi.fn();
    renderImporter(new Map(), onExtracted);
    hooks.effects.forEach((effect) => effect());
    const pasteHandler = addEventListener.mock.calls.find(([type]) => type === 'paste')?.[1] as ((event: ClipboardEvent) => void) | undefined;
    const screenshot = new File(['image'], 'pasted-screen.png', { type: 'image/png' });
    const preventDefault = vi.fn();

    pasteHandler?.({
      clipboardData: {
        items: [{ kind: 'file', type: screenshot.type, getAsFile: () => screenshot }],
        files: [screenshot],
      },
      preventDefault,
    } as unknown as ClipboardEvent);

    await vi.waitFor(() => expect(onExtracted).toHaveBeenCalledWith('Extracted from pasted-screen.png'));
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(extraction.extractDocumentText).toHaveBeenCalledWith(screenshot, expect.any(Function));
  });

  it('exposes extraction progress through a polite live region', () => {
    // useState order: busy, dragging, message, progress.
    const tree = renderImporter(new Map<number, unknown>([[0, true], [2, 'Reading PDF page 2 of 4']]));
    const status = elements(tree).find((element) => element.props['aria-live'] === 'polite');
    const buttons = elements(tree).filter((element) => element.type === 'button');

    expect(tree.props['aria-busy']).toBe(true);
    expect(status).toBeDefined();
    expect(buttons.every((button) => button.props.disabled === true)).toBe(true);
  });

  it('claims file dragover and drop events so the browser cannot navigate to a dropped file', () => {
    const tree = renderImporter();
    const over = dragEvent();
    const drop = dragEvent();

    (tree.props.onDragOver as (event: DropEventStub) => void)(over);
    (tree.props.onDrop as (event: DropEventStub) => void)(drop);

    expect(over.preventDefault).toHaveBeenCalledOnce();
    expect(over.stopPropagation).toHaveBeenCalledOnce();
    expect(over.dataTransfer.dropEffect).toBe('copy');
    expect(drop.preventDefault).toHaveBeenCalledOnce();
    expect(drop.stopPropagation).toHaveBeenCalledOnce();
  });

  it('sends dropped screenshots, PDFs, DOCX, and text files through the local extractor', async () => {
    const onExtracted = vi.fn();
    const tree = renderImporter(new Map(), onExtracted);
    const files = [
      new File(['image'], 'wechat.png', { type: 'image/png' }),
      new File(['pdf'], 'lesson.pdf', { type: 'application/pdf' }),
      new File(['docx'], 'worksheet.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      new File(['text'], 'notes.txt', { type: 'text/plain' }),
    ];

    (tree.props.onDrop as (event: DropEventStub) => void)(dragEvent(['Files'], files));

    await vi.waitFor(() => expect(onExtracted).toHaveBeenCalledOnce());
    expect(extraction.extractDocumentText.mock.calls.map(([file]) => (file as File).name)).toEqual([
      'wechat.png',
      'lesson.pdf',
      'worksheet.docx',
      'notes.txt',
    ]);
    expect(onExtracted).toHaveBeenCalledWith([
      'Extracted from wechat.png',
      'Extracted from lesson.pdf',
      'Extracted from worksheet.docx',
      'Extracted from notes.txt',
    ].join('\n\n'));
  });

  it('keeps the drop target active while nested children emit dragleave', () => {
    const tree = renderImporter();
    const enter = tree.props.onDragEnter as (event: DropEventStub) => void;
    const leave = tree.props.onDragLeave as (event: DropEventStub) => void;
    const draggingSetter = hooks.setters[1];

    enter(dragEvent());
    enter(dragEvent());
    leave(dragEvent());
    expect(draggingSetter).not.toHaveBeenCalledWith(false);

    leave(dragEvent());
    expect(draggingSetter).toHaveBeenLastCalledWith(false);
  });

  it('does not interfere with ordinary text or link drags', () => {
    const tree = renderImporter();
    const event = dragEvent(['text/plain']);

    (tree.props.onDragOver as (event: DropEventStub) => void)(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(event.dataTransfer.dropEffect).toBe('none');
  });
});
