import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import tesseractWorkerUrl from 'tesseract.js/dist/worker.min.js?url';

export type ImportKind = 'image' | 'pdf' | 'docx' | 'text' | 'unsupported';
export interface ExtractionResult { text: string; warnings: string[] }
type Progress = (message: string, progress: number) => void;

export function getImportKind(file: Pick<File, 'name' | 'type'>): ImportKind {
  const name = file.name.toLowerCase();
  if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/.test(name)) return 'image';
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) return 'docx';
  if (file.type.startsWith('text/') || /\.(txt|md)$/.test(name)) return 'text';
  return 'unsupported';
}

async function makeOcrWorker(onProgress: Progress) {
  const { createWorker, OEM } = await import('tesseract.js');
  const ocrBaseUrl = `${import.meta.env.BASE_URL}ocr`;
  return createWorker('chi_sim', OEM.LSTM_ONLY, {
    workerPath: tesseractWorkerUrl,
    corePath: `${ocrBaseUrl}/core`,
    langPath: `${ocrBaseUrl}/lang`,
    gzip: true,
    logger: event => onProgress(event.status, Math.round(event.progress * 100)),
  });
}

async function ocrImage(image: File | HTMLCanvasElement, onProgress: Progress) {
  const worker = await makeOcrWorker(onProgress);
  try {
    const result = await worker.recognize(image);
    return result.data.text.trim();
  } finally {
    await worker.terminate();
  }
}

async function extractPdf(file: File, onProgress: Progress): Promise<ExtractionResult> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pageLimit = Math.min(pdf.numPages, 20);
  const warnings: string[] = [];
  if (pdf.numPages > pageLimit) warnings.push(`Only the first ${pageLimit} of ${pdf.numPages} pages were imported.`);
  const pageTexts: string[] = [];
  let ocrWorker: Awaited<ReturnType<typeof makeOcrWorker>> | undefined;

  try {
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber++) {
      onProgress(`Reading PDF page ${pageNumber} of ${pageLimit}`, Math.round((pageNumber - 1) / pageLimit * 100));
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const embedded = content.items
        .map(item => 'str' in item ? `${item.str}${item.hasEOL ? '\n' : ' '}` : '')
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
      if (embedded.length >= 8) {
        pageTexts.push(embedded);
        continue;
      }

      ocrWorker ??= await makeOcrWorker((message, progress) => onProgress(`Page ${pageNumber}: ${message}`, progress));
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not create an OCR canvas.');
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      const result = await ocrWorker.recognize(canvas);
      pageTexts.push(result.data.text.trim());
    }
  } finally {
    await ocrWorker?.terminate();
    await pdf.cleanup();
  }
  onProgress('PDF text ready', 100);
  return { text: pageTexts.filter(Boolean).join('\n\n'), warnings };
}

export async function extractDocumentText(file: File, onProgress: Progress = () => {}): Promise<ExtractionResult> {
  const kind = getImportKind(file);
  onProgress('Opening file', 2);
  if (kind === 'image') return { text: await ocrImage(file, onProgress), warnings: [] };
  if (kind === 'pdf') return extractPdf(file, onProgress);
  if (kind === 'docx') {
    onProgress('Reading Word document', 30);
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    onProgress('Document text ready', 100);
    return { text: result.value.trim(), warnings: result.messages.map(message => message.message) };
  }
  if (kind === 'text') {
    onProgress('Reading text file', 80);
    return { text: (await file.text()).trim(), warnings: [] };
  }
  throw new Error('Choose an image, PDF, DOCX, TXT, or Markdown file.');
}
