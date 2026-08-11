import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import './auth.css';

export interface LocalProfileSummary {
  id: string;
  displayName: string;
  lessonCount?: number;
  wordCount?: number;
  lastUsedLabel?: string;
}

export interface LocalSignInProps {
  profiles: LocalProfileSummary[];
  onSignIn: (email: string) => void;
  onCreateProfile: (displayName: string, email: string) => void;
  busy?: boolean;
  error?: string;
}

export interface LocalProfileMenuProps {
  profile: LocalProfileSummary;
  onSwitchProfile: () => void;
  onLeaveProfile?: () => void;
}

function profileInitial(displayName: string) {
  return Array.from(displayName.trim())[0]?.toLocaleUpperCase() || '学';
}

function profileActivity(profile: LocalProfileSummary) {
  const activity: string[] = [];
  if (profile.lessonCount !== undefined) {
    activity.push(`${profile.lessonCount} ${profile.lessonCount === 1 ? 'lesson' : 'lessons'}`);
  }
  if (profile.wordCount !== undefined) {
    activity.push(`${profile.wordCount} ${profile.wordCount === 1 ? 'word' : 'words'}`);
  }
  return activity.join(' · ');
}

export function LocalSignIn({
  profiles,
  onSignIn,
  onCreateProfile,
  busy = false,
  error,
}: LocalSignInProps) {
  const [mode, setMode] = useState<'signin' | 'create'>(() => profiles.length ? 'signin' : 'create');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [signInEmail, setSignInEmail] = useState('');
  const headingId = useId();
  const nameInputId = useId();
  const emailInputId = useId();
  const signInEmailInputId = useId();

  useEffect(() => {
    if (!profiles.length) setMode('create');
  }, [profiles.length]);

  const submitProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = displayName.trim();
    if (!name || !email.trim() || busy) return;
    onCreateProfile(name, email.trim());
  };

  const submitSignIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = signInEmail.trim();
    if (!normalizedEmail || busy) return;
    onSignIn(normalizedEmail);
  };

  return <section className="local-auth" aria-labelledby={headingId} aria-busy={busy}>
    <div className="local-auth-intro">
      <div className="local-auth-brand" aria-hidden="true">读</div>
      <span className="local-auth-eyebrow">CHINESE CLICK READER</span>
      <h1 id={headingId}>{profiles.length ? 'Sign in to your reader' : 'Create your local account'}</h1>
      <p>Keep your saved lessons, vocabulary, and reading history together on this device.</p>

      <div className="local-auth-privacy">
        <span aria-hidden="true">⌂</span>
        <div>
          <b>Local to this browser</b>
          <p>This is a local profile, not an online account. Nothing is uploaded, and profiles do not sync automatically between devices.</p>
        </div>
      </div>
      <p className="local-auth-fineprint">Use vocabulary export/import when moving devices. Clearing this browser’s site data may remove local profiles.</p>
    </div>

    <div className="local-auth-action">
      {profiles.length > 0 && <div className="local-auth-tabs" role="group" aria-label="Profile action">
        <button
          type="button"
          className={mode === 'signin' ? 'active' : ''}
          aria-pressed={mode === 'signin'}
          onClick={() => setMode('signin')}
          disabled={busy}
        >Sign in</button>
        <button
          type="button"
          className={mode === 'create' ? 'active' : ''}
          aria-pressed={mode === 'create'}
          onClick={() => setMode('create')}
          disabled={busy}
        >Create account</button>
      </div>}

      {error && <p className="local-auth-error" role="alert">{error}</p>}

      {mode === 'signin' && profiles.length > 0 ? <form className="local-auth-create" onSubmit={submitSignIn}>
        <div className="local-auth-section-heading">
          <h2>Welcome back</h2>
          <p>Enter the email used when you created your account on this device.</p>
        </div>
        <label htmlFor={signInEmailInputId}>Email</label>
        <input
          id={signInEmailInputId}
          type="email"
          value={signInEmail}
          onChange={(event) => setSignInEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          disabled={busy}
          required
        />
        <button className="local-auth-primary" type="submit" disabled={busy || !signInEmail.trim()}>
          {busy ? 'Signing in…' : 'Sign in'}
          {!busy && <span aria-hidden="true">→</span>}
        </button>
        <small className="local-auth-create-note">This signs you into an account stored on this browser. There is no cloud recovery yet.</small>
      </form> : <form className="local-auth-create" onSubmit={submitProfile}>
        <div className="local-auth-section-heading">
          <h2>{profiles.length ? 'Create another account' : 'Let’s set up your reader'}</h2>
          <p>Choose a name that helps you recognize whose lessons are saved here.</p>
        </div>
        <label htmlFor={nameInputId}>Profile name</label>
        <input
          id={nameInputId}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="For example, Joshua"
          maxLength={40}
          autoComplete="name"
          autoFocus={profiles.length === 0}
          disabled={busy}
          required
        />
        <label htmlFor={emailInputId}>Email</label>
        <input
          id={emailInputId}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={busy}
          required
        />
        <button className="local-auth-primary" type="submit" disabled={busy || !displayName.trim() || !email.trim()}>
          {busy ? 'Creating account…' : 'Create account'}
          {!busy && <span aria-hidden="true">→</span>}
        </button>
        <small className="local-auth-create-note">Your email is only used to find this profile on this browser. No password is stored, and this is not yet a cloud account.</small>
      </form>}
    </div>
  </section>;
}

export function LocalProfileMenu({ profile, onSwitchProfile, onLeaveProfile }: LocalProfileMenuProps) {
  const activity = profileActivity(profile);
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOnOutsideInteraction = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuRef.current?.open) {
        menuRef.current.open = false;
        menuRef.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideInteraction);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideInteraction);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return <details ref={menuRef} className="local-profile-menu">
    <summary aria-label={`Local profile menu for ${profile.displayName}`}>
      <span className="local-profile-menu-avatar" aria-hidden="true">{profileInitial(profile.displayName)}</span>
      <span className="local-profile-menu-name">{profile.displayName}</span>
      <span className="local-profile-menu-chevron" aria-hidden="true">⌄</span>
    </summary>
    <div className="local-profile-popover">
      <div className="local-profile-popover-heading">
        <span className="local-profile-menu-avatar" aria-hidden="true">{profileInitial(profile.displayName)}</span>
        <div>
          <b>{profile.displayName}</b>
          <small>{activity || 'Local learning profile'}</small>
        </div>
      </div>
      <p>Lessons and words are stored in this browser and do not sync automatically.</p>
      <div className="local-profile-menu-actions">
        <button type="button" onClick={onSwitchProfile}>Switch profile</button>
        {onLeaveProfile && <button type="button" className="quiet" onClick={onLeaveProfile}>Sign out</button>}
      </div>
    </div>
  </details>;
}
