import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ClickedWordHistoryItem, SavedText, SavedWord, View } from './types';
import { createProfileStorage } from './utils/storage';
import {
  createLocalProfile,
  getCurrentLocalProfile,
  listLocalProfiles,
  signInLocalProfile,
  signOutLocalProfile,
  type LocalProfile,
} from './utils/localAccounts';
import { loadExtendedDictionary, lookupCuratedDictionaryEntry, lookupDictionaryEntry } from './utils/cedict';
import { UNKNOWN_MEANING } from './utils/wordEntry';
import { mergeSavedWord, unlinkWordFromText, wordBelongsToText } from './utils/wordSources';
import { ReaderPage } from './pages/ReaderPage';
import { SavedTextsPage } from './pages/SavedTextsPage';
import { VocabularyPage } from './pages/VocabularyPage';
import { LocalProfileMenu, LocalSignIn, type LocalProfileSummary } from './components/LocalSignIn';

export type DictionaryStatus = 'loading' | 'ready' | 'error';

const isMissingMeaning = (meaning: string) => !meaning.trim() || meaning === UNKNOWN_MEANING;

function profileSummary(profile: LocalProfile): LocalProfileSummary {
  const profileStorage = createProfileStorage(profile.id);
  return {
    id: profile.id,
    displayName: profile.displayName,
    lessonCount: profileStorage.texts().length,
    wordCount: profileStorage.words().length,
    lastUsedLabel: new Date(profile.lastSignedInAt).toDateString() === new Date().toDateString()
      ? 'Used today'
      : `Used ${new Date(profile.lastSignedInAt).toLocaleDateString()}`,
  };
}

export default function App() {
  const [profile, setProfile] = useState<LocalProfile | undefined>(getCurrentLocalProfile);
  const [profiles, setProfiles] = useState<LocalProfile[]>(listLocalProfiles);
  const [authError, setAuthError] = useState<string>();

  const refreshProfiles = () => setProfiles(listLocalProfiles());
  const signIn = (email: string) => {
    try {
      const next = signInLocalProfile(email);
      setAuthError(undefined);
      setProfile(next);
      refreshProfiles();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not open that local profile.');
    }
  };
  const createProfile = (displayName: string, email: string) => {
    try {
      const next = createLocalProfile({ displayName, email });
      setAuthError(undefined);
      setProfile(next);
      refreshProfiles();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Could not create that local profile.');
    }
  };
  const leaveProfile = () => {
    signOutLocalProfile();
    setProfile(undefined);
    refreshProfiles();
  };

  if (!profile) {
    return <LocalSignIn
      profiles={profiles.map(profileSummary)}
      onSignIn={signIn}
      onCreateProfile={createProfile}
      error={authError}
    />;
  }

  return <ProfileWorkspace
    key={profile.id}
    profile={profile}
    onSwitchProfile={leaveProfile}
    onLeaveProfile={leaveProfile}
  />;
}

function ProfileWorkspace({
  profile,
  onSwitchProfile,
  onLeaveProfile,
}: {
  profile: LocalProfile;
  onSwitchProfile: () => void;
  onLeaveProfile: () => void;
}) {
  const profileStorage = useMemo(() => createProfileStorage(profile.id), [profile.id]);
  const [view, setView] = useState<View>('reader');
  const [words, setWords] = useState<SavedWord[]>(profileStorage.words);
  const [texts, setTexts] = useState<SavedText[]>(profileStorage.texts);
  const [history, setHistory] = useState<ClickedWordHistoryItem[]>(profileStorage.history);
  const [openText, setOpenText] = useState<SavedText>();
  const [dictionaryStatus, setDictionaryStatus] = useState<DictionaryStatus>('loading');

  const updateWords = (update: SavedWord[] | ((current: SavedWord[]) => SavedWord[])) => {
    setWords((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      profileStorage.setWords(next);
      return next;
    });
  };
  const updateTexts = (update: SavedText[] | ((current: SavedText[]) => SavedText[])) => {
    setTexts((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      profileStorage.setTexts(next);
      return next;
    });
  };
  const updateHistory = (update: ClickedWordHistoryItem[] | ((current: ClickedWordHistoryItem[]) => ClickedWordHistoryItem[])) => {
    setHistory((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      profileStorage.setHistory(next);
      return next;
    });
  };
  const consumeOpenText = useCallback(() => setOpenText(undefined), []);

  useEffect(() => {
    let active = true;
    loadExtendedDictionary()
      .then(() => {
        if (!active) return;
        setDictionaryStatus('ready');

        // Repair placeholders from earlier versions without touching meanings
        // that a learner edited themselves.
        setWords((current) => {
          let changed = false;
          const next = current.map((word) => {
            if (word.userEditedMeaning) return word;
            const curatedEntry = lookupCuratedDictionaryEntry(word.chinese);
            if (!curatedEntry && !isMissingMeaning(word.meaning)) return word;
            const entry = curatedEntry ?? lookupDictionaryEntry(word.chinese);
            if (!entry) return word;
            if (word.meaning === entry.meaning && word.pinyin === entry.pinyin && word.difficultyLabel === entry.difficultyLabel) return word;
            changed = true;
            return {
              ...word,
              pinyin: entry.pinyin,
              meaning: entry.meaning,
              exampleSentence: word.exampleSentence ?? entry.exampleSentence,
              difficultyLabel: entry.difficultyLabel,
              updatedAt: new Date().toISOString(),
            };
          });
          if (changed) profileStorage.setWords(next);
          return next;
        });

        setHistory((current) => {
          let changed = false;
          const next = current.map((item) => {
            const curatedEntry = lookupCuratedDictionaryEntry(item.chinese);
            if (!curatedEntry && !isMissingMeaning(item.meaning)) return item;
            const entry = curatedEntry ?? lookupDictionaryEntry(item.chinese);
            if (!entry) return item;
            if (item.meaning === entry.meaning && item.pinyin === entry.pinyin) return item;
            changed = true;
            return { ...item, pinyin: entry.pinyin, meaning: entry.meaning };
          });
          if (changed) profileStorage.setHistory(next);
          return next;
        });
      })
      .catch(() => {
        if (active) setDictionaryStatus('error');
      });

    return () => {
      active = false;
    };
  }, [profileStorage]);

  const saveWord = (word: SavedWord) => {
    updateWords((current) => {
      const existing = current.find((item) => item.chinese === word.chinese);
      return existing
        ? current.map((item) => item.id === existing.id ? mergeSavedWord(item, word) : item)
        : [word, ...current];
    });
  };

  const saveText = (text: SavedText) => {
    updateTexts((current) => [text, ...current.filter((item) => item.id !== text.id)]);
  };

  const deleteText = (id: string) => {
    updateTexts((current) => current.filter((text) => text.id !== id));
    updateWords((current) => current.map((word) => wordBelongsToText(word, id)
      ? unlinkWordFromText(word, id)
      : word));
  };

  const addHistory = (item: ClickedWordHistoryItem) => {
    updateHistory((current) => [item, ...current.filter((entry) => entry.chinese !== item.chinese)].slice(0, 24));
  };

  const importWords = (incoming: SavedWord[]) => {
    updateWords((current) => {
      const merged = [...current];
      for (const word of incoming) {
        const index = merged.findIndex((item) => item.chinese === word.chinese);
        if (index >= 0) merged[index] = mergeSavedWord(merged[index], word);
        else merged.push(word);
      }
      return merged;
    });
  };

  return <>
    <header>
      <button className="brand" onClick={() => setView('reader')}>
        <span>点</span><div>Chinese Click Reader<small>中文点读</small></div>
      </button>
      <nav>
        <button className={view === 'reader' ? 'active' : ''} onClick={() => setView('reader')}>Reader</button>
        <button className={view === 'texts' ? 'active' : ''} onClick={() => setView('texts')}>Saved texts <i>{texts.length}</i></button>
        <button className={view === 'vocabulary' ? 'active' : ''} onClick={() => setView('vocabulary')}>Vocabulary <i>{words.length}</i></button>
        <LocalProfileMenu
          profile={{ id: profile.id, displayName: profile.displayName, lessonCount: texts.length, wordCount: words.length }}
          onSwitchProfile={onSwitchProfile}
          onLeaveProfile={onLeaveProfile}
        />
      </nav>
    </header>
    <main className="shell">
      {view === 'reader' && <ReaderPage
        initialText={openText}
        onConsumeInitial={consumeOpenText}
        words={words}
        history={history}
        dictionaryStatus={dictionaryStatus}
        onSaveWord={saveWord}
        onSaveText={saveText}
        onAddHistory={addHistory}
        onClearHistory={() => updateHistory([])}
      />}
      {view === 'texts' && <SavedTextsPage
        texts={texts}
        onOpen={(text) => { setOpenText(text); setView('reader'); }}
        onDelete={deleteText}
        onRename={(id, title) => updateTexts((current) => current.map((text) => text.id === id
          ? { ...text, title, updatedAt: new Date().toISOString() }
          : text))}
      />}
      {view === 'vocabulary' && <VocabularyPage
        words={words}
        texts={texts}
        onDelete={(id) => updateWords((current) => current.filter((word) => word.id !== id))}
        onImport={importWords}
      />}
    </main>
    <footer>
      <span>点</span> Learn Chinese from the words around you.
      <b>Local & private — your data stays in this browser.</b>
      <a href="https://www.mdbg.net/chinese/dictionary?page=cc-cedict" target="_blank" rel="noreferrer">Dictionary: CC-CEDICT</a>
    </footer>
  </>;
}
