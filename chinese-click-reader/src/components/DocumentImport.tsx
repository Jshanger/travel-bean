import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { extractDocumentText, getImportKind } from '../utils/extractDocumentText';

const MAX_FILES_PER_IMPORT = 10;
type ImportSource = 'files' | 'clipboard';

function containsFiles(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes('Files');
}

export function clipboardImageFiles(clipboardData: DataTransfer | null) {
  if (!clipboardData) return [];
  const itemImages = Array.from(clipboardData.items ?? [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
  if (itemImages.length) return itemImages;
  return Array.from(clipboardData.files ?? []).filter((file) => file.type.startsWith('image/'));
}

export function DocumentImport({ onExtracted }: { onExtracted: (text: string) => void }) {
  const imageInput = useRef<HTMLInputElement>(null);
  const documentInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const processing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);

  const processFiles = useCallback(async (incoming: FileList | File[], source: ImportSource = 'files') => {
    const files = Array.from(incoming).slice(0, MAX_FILES_PER_IMPORT);
    if (!files.length || processing.current) return;

    const unsupported = files.find((file) => getImportKind(file) === 'unsupported');
    if (unsupported) {
      setMessage(`“${unsupported.name}” is not supported. Drop an image, PDF, DOCX, TXT, or Markdown file.`);
      setProgress(0);
      return;
    }

    processing.current = true;
    setBusy(true);
    setMessage(source === 'clipboard'
      ? 'Reading pasted screenshot locally…'
      : files.length === 1 ? `Opening ${files[0].name}…` : `Opening ${files.length} files…`);
    setProgress(1);
    try {
      const extracted: string[] = [];
      const warnings: string[] = [];

      for (const [index, file] of files.entries()) {
        const prefix = files.length > 1 ? `${index + 1} of ${files.length}: ` : '';
        const result = await extractDocumentText(file, (status, value) => {
          setMessage(`${prefix}${status}`);
          setProgress(Math.round(((index * 100) + value) / files.length));
        });
        if (!result.text.trim()) throw new Error(`No readable text was found in ${file.name}. Try a clearer image or a higher-resolution scan.`);
        extracted.push(result.text.trim());
        warnings.push(...result.warnings);
      }

      const combined = extracted.join('\n\n');
      onExtracted(combined);
      const warning = warnings.length ? ` ${warnings.join(' ')}` : '';
      const fileLabel = source === 'clipboard'
        ? files.length === 1 ? 'pasted screenshot' : `${files.length} pasted screenshots`
        : files.length === 1 ? files[0].name : `${files.length} files`;
      const limited = incoming.length > MAX_FILES_PER_IMPORT ? ` Only the first ${MAX_FILES_PER_IMPORT} files were imported.` : '';
      setMessage(`Imported ${combined.length} characters from ${fileLabel}.${warning}${limited}`);
      setProgress(100);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error || 'This file could not be read.');
      setMessage(detail);
      setProgress(0);
    } finally {
      processing.current = false;
      setBusy(false);
      if (imageInput.current) imageInput.current.value = '';
      if (documentInput.current) documentInput.current.value = '';
    }
  }, [onExtracted]);

  useEffect(() => {
    const pasteScreenshot = (event: ClipboardEvent) => {
      const images = clipboardImageFiles(event.clipboardData);
      if (!images.length || processing.current) return;
      event.preventDefault();
      void processFiles(images, 'clipboard');
    };
    window.addEventListener('paste', pasteScreenshot);
    return () => window.removeEventListener('paste', pasteScreenshot);
  }, [processFiles]);

  const beginDrag = (event: DragEvent<HTMLDivElement>) => {
    if (!containsFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    dragDepth.current += 1;
    setDragging(true);
  };

  const continueDrag = (event: DragEvent<HTMLDivElement>) => {
    if (!containsFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    event.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  };

  const endDrag = (event: DragEvent<HTMLDivElement>) => {
    if (!dragging && !containsFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const dropFiles = (event: DragEvent<HTMLDivElement>) => {
    if (!containsFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    void processFiles(event.dataTransfer.files);
  };

  return <div
    className={`document-import ${message ? 'has-status' : ''} ${dragging ? 'is-dragging' : ''} ${busy ? 'is-busy' : ''}`}
    aria-label="Paste, drag and drop Chinese documents or screenshots"
    aria-busy={busy}
    onDragEnter={beginDrag}
    onDragOver={continueDrag}
    onDragLeave={endDrag}
    onDrop={dropFiles}
  >
    <input className="sr-only" ref={imageInput} type="file" multiple accept="image/png,image/jpeg,image/webp,image/bmp" onChange={event => void processFiles(event.target.files ?? [])}/>
    <input className="sr-only" ref={documentInput} type="file" multiple accept="application/pdf,.pdf,.docx,text/plain,.txt,.md" onChange={event => void processFiles(event.target.files ?? [])}/>
    <div className="import-copy"><span>{dragging ? '↓' : '＋'}</span><div><b>{dragging ? 'Drop files to import them' : 'Paste a screenshot or drag & drop'}</b><small>Cmd+V / Ctrl+V · screenshots, PDF, DOCX, TXT, or Markdown · processed locally</small></div></div>
    <div className="import-buttons"><button className="ghost" disabled={busy} onClick={() => imageInput.current?.click()}>▧ Screenshot / photo</button><button className="ghost" disabled={busy} onClick={() => documentInput.current?.click()}>▤ Document</button></div>
    {message && <div className={`extraction-status ${busy ? 'working' : ''}`} aria-live="polite"><span>{message}</span>{busy && <div><i style={{ width: `${Math.max(4, progress)}%` }}/></div>}</div>}
  </div>;
}
