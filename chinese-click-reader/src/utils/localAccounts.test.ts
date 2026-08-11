import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimLegacyAnonymousData,
  createLocalProfile,
  createOrSignInLocalProfile,
  findLocalProfileByEmail,
  getCurrentLocalProfile,
  getCurrentLocalSession,
  LEGACY_ANONYMOUS_STORAGE_KEYS,
  LEGACY_MIGRATION_STORAGE_KEY,
  listLocalProfiles,
  LOCAL_PROFILES_STORAGE_KEY,
  LOCAL_SESSION_STORAGE_KEY,
  normalizeLocalDisplayName,
  normalizeLocalEmail,
  profileStorageKeys,
  readProfileData,
  signInLocalProfile,
  signInLocalProfileById,
  signOutLocalProfile,
  type LocalProfile,
  type LocalStorageLike,
  writeProfileData,
} from './localAccounts';

class MemoryStorage implements LocalStorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-01T08:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('local-only profiles', () => {
  it('normalizes email identity and learner-facing display names', () => {
    expect(normalizeLocalEmail('  Joshua.Gabriel@Example.COM  ')).toBe('joshua.gabriel@example.com');
    expect(normalizeLocalEmail('ＪＯＳＨＵＡ＠ＥＸＡＭＰＬＥ．ＣＯＭ')).toBe('joshua@example.com');
    expect(normalizeLocalDisplayName('  Joshua   Gabriel \n ')).toBe('Joshua Gabriel');
  });

  it('creates a normalized profile and persists the current local session', () => {
    const storage = new MemoryStorage();
    const profile = createLocalProfile({
      email: ' Learner@Example.com ',
      displayName: '  Li   Hua ',
    }, storage);

    expect(profile.email).toBe('learner@example.com');
    expect(profile.displayName).toBe('Li Hua');
    expect(listLocalProfiles(storage)).toEqual([profile]);
    expect(getCurrentLocalSession(storage)).toEqual({
      profileId: profile.id,
      signedInAt: '2026-08-01T08:00:00.000Z',
    });
    expect(getCurrentLocalProfile(storage)).toEqual(profile);
    expect(storage.getItem(LOCAL_PROFILES_STORAGE_KEY)).not.toContain('password');
    expect(storage.getItem(LOCAL_SESSION_STORAGE_KEY)).not.toContain('password');
  });

  it('rejects invalid input and duplicate normalized emails', () => {
    const storage = new MemoryStorage();
    expect(() => createLocalProfile({ email: 'not-an-email', displayName: 'Learner' }, storage))
      .toThrow('valid email');
    expect(() => createLocalProfile({ email: 'learner@example.com', displayName: '   ' }, storage))
      .toThrow('display name');

    createLocalProfile({ email: 'learner@example.com', displayName: 'Learner' }, storage);
    expect(() => createLocalProfile({ email: ' LEARNER@EXAMPLE.COM ', displayName: 'Other' }, storage))
      .toThrow('already exists');
    expect(listLocalProfiles(storage)).toHaveLength(1);
  });

  it('signs in by normalized email and refreshes the persisted session', () => {
    const storage = new MemoryStorage();
    const created = createLocalProfile({ email: 'reader@example.com', displayName: 'Reader' }, storage);
    signOutLocalProfile(storage);
    vi.setSystemTime(new Date('2026-08-02T10:30:00.000Z'));

    const signedIn = signInLocalProfile('  READER@EXAMPLE.COM ', storage);

    expect(signedIn.id).toBe(created.id);
    expect(signedIn.lastSignedInAt).toBe('2026-08-02T10:30:00.000Z');
    expect(getCurrentLocalSession(storage)?.profileId).toBe(created.id);
    expect(findLocalProfileByEmail('Reader@Example.Com', storage)?.id).toBe(created.id);
  });

  it('supports profile selection by id without treating it as secure authentication', () => {
    const storage = new MemoryStorage();
    const first = createLocalProfile({ email: 'one@example.com', displayName: 'One' }, storage);
    const second = createLocalProfile({ email: 'two@example.com', displayName: 'Two' }, storage);

    signInLocalProfileById(first.id, storage);
    expect(getCurrentLocalProfile(storage)?.id).toBe(first.id);
    signInLocalProfileById(second.id, storage);
    expect(getCurrentLocalProfile(storage)?.id).toBe(second.id);
    expect(() => signInLocalProfileById('missing-profile', storage)).toThrow('not found');
    expect(() => signInLocalProfile('missing@example.com', storage)).toThrow('No local profile');
  });

  it('creates or signs in without duplicating an existing email', () => {
    const storage = new MemoryStorage();
    const first = createOrSignInLocalProfile({
      email: 'learner@example.com',
      displayName: 'Original name',
    }, storage);
    const again = createOrSignInLocalProfile({
      email: 'LEARNER@EXAMPLE.COM',
      displayName: 'Ignored replacement',
    }, storage);

    expect(again.id).toBe(first.id);
    expect(again.displayName).toBe('Original name');
    expect(listLocalProfiles(storage)).toHaveLength(1);
  });

  it('signs out by removing only the session', () => {
    const storage = new MemoryStorage();
    const profile = createLocalProfile({ email: 'reader@example.com', displayName: 'Reader' }, storage);
    writeProfileData(profile.id, 'words', [{ id: 'word-1' }], storage);

    signOutLocalProfile(storage);

    expect(getCurrentLocalSession(storage)).toBeUndefined();
    expect(getCurrentLocalProfile(storage)).toBeUndefined();
    expect(listLocalProfiles(storage)).toHaveLength(1);
    expect(readProfileData(profile.id, 'words', storage)).toEqual([{ id: 'word-1' }]);
  });

  it('ignores malformed profile lists and orphaned sessions safely', () => {
    const storage = new MemoryStorage();
    storage.setItem(LOCAL_PROFILES_STORAGE_KEY, '{bad json');
    storage.setItem(LOCAL_SESSION_STORAGE_KEY, JSON.stringify({
      profileId: 'missing',
      signedInAt: '2026-08-01T08:00:00.000Z',
    }));

    expect(listLocalProfiles(storage)).toEqual([]);
    expect(getCurrentLocalSession(storage)).toBeUndefined();
    expect(getCurrentLocalProfile(storage)).toBeUndefined();
  });
});

describe('profile-scoped learning data', () => {
  it('creates distinct, encoded namespaces for lessons, words, and history', () => {
    const first = profileStorageKeys('profile one');
    const second = profileStorageKeys('profile/two');

    expect(first.words).toContain('profile%20one');
    expect(second.words).toContain('profile%2Ftwo');
    expect(new Set(Object.values(first))).toHaveLength(3);
    expect(first.words).not.toBe(second.words);
    expect(() => profileStorageKeys('   ')).toThrow('profile id');
  });

  it('keeps all three learning collections isolated between profiles', () => {
    const storage = new MemoryStorage();
    const first = createLocalProfile({ email: 'one@example.com', displayName: 'One' }, storage);
    const second = createLocalProfile({ email: 'two@example.com', displayName: 'Two' }, storage);

    writeProfileData(first.id, 'words', [{ id: 'first-word' }], storage);
    writeProfileData(first.id, 'texts', [{ id: 'first-text' }], storage);
    writeProfileData(first.id, 'history', [{ id: 'first-history' }], storage);
    writeProfileData(second.id, 'words', [{ id: 'second-word' }], storage);

    expect(readProfileData(first.id, 'words', storage)).toEqual([{ id: 'first-word' }]);
    expect(readProfileData(first.id, 'texts', storage)).toEqual([{ id: 'first-text' }]);
    expect(readProfileData(first.id, 'history', storage)).toEqual([{ id: 'first-history' }]);
    expect(readProfileData(second.id, 'words', storage)).toEqual([{ id: 'second-word' }]);
    expect(readProfileData(second.id, 'texts', storage)).toEqual([]);
    expect(readProfileData(second.id, 'history', storage)).toEqual([]);
  });

  it('returns an empty collection when scoped data is malformed', () => {
    const storage = new MemoryStorage();
    const profile = createLocalProfile({ email: 'reader@example.com', displayName: 'Reader' }, storage);
    storage.setItem(profileStorageKeys(profile.id).words, '{not an array}');

    expect(readProfileData(profile.id, 'words', storage)).toEqual([]);
  });
});

describe('one-time legacy anonymous data claim', () => {
  it('moves all legacy arrays into the first profile and removes anonymous keys', () => {
    const storage = new MemoryStorage();
    const legacyWords = [{ id: 'word-1', chinese: '幸福' }];
    const legacyTexts = [{ id: 'text-1', title: 'Lesson' }];
    const legacyHistory = [{ id: 'history-1', chinese: '情况' }];
    storage.setItem(LEGACY_ANONYMOUS_STORAGE_KEYS.words, JSON.stringify(legacyWords));
    storage.setItem(LEGACY_ANONYMOUS_STORAGE_KEYS.texts, JSON.stringify(legacyTexts));
    storage.setItem(LEGACY_ANONYMOUS_STORAGE_KEYS.history, JSON.stringify(legacyHistory));

    const first = createLocalProfile({ email: 'first@example.com', displayName: 'First' }, storage);

    expect(readProfileData(first.id, 'words', storage)).toEqual(legacyWords);
    expect(readProfileData(first.id, 'texts', storage)).toEqual(legacyTexts);
    expect(readProfileData(first.id, 'history', storage)).toEqual(legacyHistory);
    expect(storage.getItem(LEGACY_ANONYMOUS_STORAGE_KEYS.words)).toBeNull();
    expect(storage.getItem(LEGACY_ANONYMOUS_STORAGE_KEYS.texts)).toBeNull();
    expect(storage.getItem(LEGACY_ANONYMOUS_STORAGE_KEYS.history)).toBeNull();
    expect(JSON.parse(storage.getItem(LEGACY_MIGRATION_STORAGE_KEY) ?? '{}'))
      .toMatchObject({ claimedByProfileId: first.id });
  });

  it('never gives later legacy arrays to a second profile after the claim marker exists', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_ANONYMOUS_STORAGE_KEYS.words, JSON.stringify([{ id: 'original' }]));
    const first = createLocalProfile({ email: 'first@example.com', displayName: 'First' }, storage);
    storage.setItem(LEGACY_ANONYMOUS_STORAGE_KEYS.words, JSON.stringify([{ id: 'late' }]));

    const second = createLocalProfile({ email: 'second@example.com', displayName: 'Second' }, storage);
    const secondAttempt = claimLegacyAnonymousData(second.id, storage);

    expect(readProfileData(first.id, 'words', storage)).toEqual([{ id: 'original' }]);
    expect(readProfileData(second.id, 'words', storage)).toEqual([]);
    expect(secondAttempt).toEqual({
      claimed: false,
      claimedByProfileId: first.id,
      moved: { words: 0, texts: 0, history: 0 },
    });
  });

  it('marks malformed or absent legacy values as checked without throwing', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_ANONYMOUS_STORAGE_KEYS.words, '{bad json');

    const profile = createLocalProfile({ email: 'reader@example.com', displayName: 'Reader' }, storage);

    expect(readProfileData(profile.id, 'words', storage)).toEqual([]);
    expect(storage.getItem(LEGACY_MIGRATION_STORAGE_KEY)).not.toBeNull();
    expect(claimLegacyAnonymousData(profile.id, storage).claimed).toBe(false);
  });

  it('merges into existing first-profile data without duplicating matching ids', () => {
    const storage = new MemoryStorage();
    const now = '2026-08-01T08:00:00.000Z';
    const profile: LocalProfile = {
      id: 'first',
      email: 'first@example.com',
      displayName: 'First',
      createdAt: now,
      updatedAt: now,
      lastSignedInAt: now,
    };
    storage.setItem(LOCAL_PROFILES_STORAGE_KEY, JSON.stringify([profile]));
    writeProfileData(profile.id, 'words', [{ id: 'same', meaning: 'profile version' }], storage);
    storage.setItem(LEGACY_ANONYMOUS_STORAGE_KEYS.words, JSON.stringify([
      { id: 'same', meaning: 'legacy version' },
      { id: 'new', meaning: 'migrated' },
    ]));

    const result = claimLegacyAnonymousData(profile.id, storage);

    expect(result.moved.words).toBe(2);
    expect(readProfileData(profile.id, 'words', storage)).toEqual([
      { id: 'same', meaning: 'profile version' },
      { id: 'new', meaning: 'migrated' },
    ]);
  });

  it('refuses an explicit claim for a profile that is not first', () => {
    const storage = new MemoryStorage();
    const now = '2026-08-01T08:00:00.000Z';
    const profiles: LocalProfile[] = [
      { id: 'first', email: 'first@example.com', displayName: 'First', createdAt: now, updatedAt: now, lastSignedInAt: now },
      { id: 'second', email: 'second@example.com', displayName: 'Second', createdAt: now, updatedAt: now, lastSignedInAt: now },
    ];
    storage.setItem(LOCAL_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    storage.setItem(LEGACY_ANONYMOUS_STORAGE_KEYS.texts, JSON.stringify([{ id: 'legacy-text' }]));

    expect(claimLegacyAnonymousData('second', storage)).toEqual({
      claimed: false,
      moved: { words: 0, texts: 0, history: 0 },
    });
    expect(readProfileData('second', 'texts', storage)).toEqual([]);
    expect(storage.getItem(LEGACY_ANONYMOUS_STORAGE_KEYS.texts)).not.toBeNull();
  });
});
