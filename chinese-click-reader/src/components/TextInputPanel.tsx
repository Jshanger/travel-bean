import { DocumentImport } from './DocumentImport';

export const SAMPLE = '我对这家店的体验很好。为什么王静说自己有努力的方向？';

export function TextInputPanel({
  value,
  onChange,
  onConvert,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onConvert: () => void;
  onClear: () => void;
}) {
  return <section className="card input-card">
    <div className="section-head">
      <div><span className="step">1</span><h2>Paste or import Chinese text</h2></div>
      <span>{value.length} characters</span>
    </div>
    <textarea
      id="lesson-text-input"
      aria-label="Chinese lesson text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Paste a message, article, listing, or textbook passage here…"
    />
    <DocumentImport onExtracted={onChange}/>
    <div className="actions">
      <button className="ghost" onClick={() => onChange(SAMPLE)}>✦ Sample text</button>
      <button className="ghost" onClick={onClear}>Clear</button>
      <button className="primary" onClick={onConvert} disabled={!value.trim()}>
        Convert to clickable text <span>→</span>
      </button>
    </div>
  </section>;
}
