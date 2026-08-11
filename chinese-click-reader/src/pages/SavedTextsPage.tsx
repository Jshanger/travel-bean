import { useState } from 'react';
import type { SavedText } from '../types';

interface SavedTextsPageProps {
  texts: SavedText[];
  onOpen: (text: SavedText) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

export function SavedTextsPage({ texts, onOpen, onDelete, onRename }: SavedTextsPageProps) {
  const [editing, setEditing] = useState<string>();
  const [title, setTitle] = useState('');

  const startRename = (text: SavedText) => {
    setEditing(text.id);
    setTitle(text.title);
  };
  const finish = (id: string) => {
    if (title.trim()) onRename(id, title.trim());
    setEditing(undefined);
  };

  return <main className="page">
    <div className="page-title">
      <div>
        <span className="pill">YOUR LIBRARY</span>
        <h1>Saved lessons</h1>
        <p>Return to your saved texts and continue reading whenever you like.</p>
      </div>
      <b>{texts.length}</b>
    </div>

    {texts.length ? <div className="text-grid">{texts.map((text) => <article className="card saved-text-card" key={text.id}>
      <div className="saved-text-top">
        <span>文</span>
        <small>{text.originalText.length} characters</small>
      </div>

      {editing === text.id
        ? <div className="rename-row">
          <input
            value={title}
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') finish(text.id);
              if (event.key === 'Escape') setEditing(undefined);
            }}
          />
          <button className="primary" onClick={() => finish(text.id)}>Save</button>
        </div>
        : <h3>{text.title}</h3>}

      <p>{text.originalText.slice(0, 100)}{text.originalText.length > 100 ? '…' : ''}</p>
      <div className="date-grid">
        <span>Created <b>{new Date(text.createdAt).toLocaleDateString()}</b></span>
        <span>Updated <b>{new Date(text.updatedAt).toLocaleDateString()}</b></span>
      </div>

      <div className="saved-text-actions">
        <button className="primary" onClick={() => onOpen(text)}>Open lesson →</button>
        <button className="ghost" onClick={() => startRename(text)}>Rename</button>
        <button className="icon-danger" aria-label={`Delete ${text.title}`} onClick={() => onDelete(text.id)}>×</button>
      </div>
    </article>)}</div> : <div className="card empty">
      <div>文</div>
      <h2>No saved lessons yet</h2>
      <p>Save a converted passage to keep it in your reading library.</p>
    </div>}
  </main>;
}
