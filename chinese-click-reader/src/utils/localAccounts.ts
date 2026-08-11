/**
 * A convenience namespace stored in this browser. It is not an authenticated
 * identity and the email is only used to find the local profile.
 */
export interface LocalProfile {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  lastSignedInAt: string;
}

export interface LocalSession {
  profileId: string;
  signedInAt: string;
}

export interface LocalStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CreateLocalProfileInput {
  email: string;
  displayName: string;
}

export type ProfileDataCollection = 'words' | 'texts' | 'history';

export interface ProfileStorageKeys {
  words: string;
  texts: string;
  history: string;
}

export interface LegacyMigrationResult {
  claimed: boolean;
  claimedByProfileId?: string;
  moved: Record<ProfileDataCollection, number>;
}

interface LegacyMigrationMarker {
  claimedByProfileId: string;
  claimedAt: string;
}

export const LOCAL_PROFILES_STORAGE_KEY = 'ccr:local-profiles:v1';
export const LOCAL_SESSION_STORAGE_KEY = 'ccr:local-session:v1';
export const LEGACY_MIGRATION_STORAGE_KEY = 'ccr:legacy-anonymous-claim:v1';

export const LEGACY_ANONYMOUS_STORAGE_KEYS: Readonly<ProfileStorageKeys> = Object.freeze({
  words: 'ccr-saved-words',
  texts: 'ccr-saved-texts',
  history: 'ccr-clicked-history',
});

const PROFILE_STORAGE_PREFIX = 'ccr:profile:v1';
const EMPTY_MOVED: Record<ProfileDataCollection, number> = { words: 0, texts: 0, history: 0 };

function browserStorage(): LocalStorageLike {
  if (typeof localStorage === 'undefined') {
    throw new Error('Local profiles require browser localStorage.');
  }
  return localStorage;
}

function resolveStorage(storage?: LocalStorageLike) {
  return storage ?? browserStorage();
}

function readJson(storage: LocalStorageLike, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function readArray(storage: LocalStorageLike, key: string): unknown[] {
  const value = readJson(storage, key);
  return Array.isArray(value) ? value : [];
}

export function normalizeLocalEmail(email: string) {
  return email.normalize('NFKC').trim().toLowerCase();
}

export function normalizeLocalDisplayName(displayName: string) {
  return displayName.normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function validateEmail(email: string) {
  if (!email || !/^[^\s@]+@[^\s@]+$/u.test(email)) {
    throw new Error('Enter a valid email address for this local profile.');
  }
}

function validateDisplayName(displayName: string) {
  if (!displayName) throw new Error('Enter a display name for this local profile.');
  if ([...displayName].length > 60) throw new Error('Display name must be 60 characters or fewer.');
}

function isLocalProfile(value: unknown): value is LocalProfile {
  if (!value || typeof value !== 'object') return false;
  const profile = value as Partial<LocalProfile>;
  return typeof profile.id === 'string' && Boolean(profile.id.trim())
    && typeof profile.email === 'string' && Boolean(profile.email.trim())
    && typeof profile.displayName === 'string' && Boolean(profile.displayName.trim())
    && typeof profile.createdAt === 'string'
    && typeof profile.updatedAt === 'string'
    && typeof profile.lastSignedInAt === 'string';
}

function readProfiles(storage: LocalStorageLike) {
  const value = readJson(storage, LOCAL_PROFILES_STORAGE_KEY);
  if (!Array.isArray(value)) return [];

  const profiles: LocalProfile[] = [];
  const ids = new Set<string>();
  const emails = new Set<string>();
  for (const candidate of value) {
    if (!isLocalProfile(candidate)) continue;
    const email = normalizeLocalEmail(candidate.email);
    const displayName = normalizeLocalDisplayName(candidate.displayName);
    if (!email || !displayName || ids.has(candidate.id) || emails.has(email)) continue;
    ids.add(candidate.id);
    emails.add(email);
    profiles.push({ ...candidate, email, displayName });
  }
  return profiles;
}

function writeProfiles(storage: LocalStorageLike, profiles: LocalProfile[]) {
  storage.setItem(LOCAL_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // The id only namespaces local data; it is not an authentication secret.
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function persistSession(storage: LocalStorageLike, profileId: string, signedInAt: string) {
  const session: LocalSession = { profileId, signedInAt };
  storage.setItem(LOCAL_SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function listLocalProfiles(storage?: LocalStorageLike) {
  return readProfiles(resolveStorage(storage));
}

export function findLocalProfileByEmail(email: string, storage?: LocalStorageLike) {
  const normalizedEmail = normalizeLocalEmail(email);
  return readProfiles(resolveStorage(storage)).find((profile) => profile.email === normalizedEmail);
}

export function profileStorageKeys(profileId: string): ProfileStorageKeys {
  const id = profileId.trim();
  if (!id) throw new Error('A local profile id is required.');
  const scope = `${PROFILE_STORAGE_PREFIX}:${encodeURIComponent(id)}`;
  return {
    words: `${scope}:saved-words`,
    texts: `${scope}:saved-texts`,
    history: `${scope}:clicked-history`,
  };
}

export function readProfileData<T>(
  profileId: string,
  collection: ProfileDataCollection,
  storage?: LocalStorageLike,
): T[] {
  return readArray(resolveStorage(storage), profileStorageKeys(profileId)[collection]) as T[];
}

export function writeProfileData<T>(
  profileId: string,
  collection: ProfileDataCollection,
  items: readonly T[],
  storage?: LocalStorageLike,
) {
  resolveStorage(storage).setItem(
    profileStorageKeys(profileId)[collection],
    JSON.stringify(items),
  );
}

function migrationOwner(storage: LocalStorageLike) {
  const raw = storage.getItem(LEGACY_MIGRATION_STORAGE_KEY);
  if (raw === null) return undefined;
  try {
    const marker = JSON.parse(raw) as Partial<LegacyMigrationMarker>;
    return typeof marker.claimedByProfileId === 'string' ? marker.claimedByProfileId : '';
  } catch {
    // A present marker still means the one-time migration was already attempted.
    return '';
  }
}

function mergeClaimedArrays(existing: unknown[], legacy: unknown[]) {
  const merged = [...existing];
  const ids = new Set(existing.flatMap((item) => (
    item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string'
      ? [(item as { id: string }).id]
      : []
  )));
  for (const item of legacy) {
    const id = item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string'
      ? (item as { id: string }).id
      : undefined;
    if (id && ids.has(id)) continue;
    if (id) ids.add(id);
    merged.push(item);
  }
  return merged;
}

/**
 * Move pre-profile arrays into the first local profile once. A persistent
 * marker prevents later profiles from claiming the same anonymous data.
 */
export function claimLegacyAnonymousData(
  profileId: string,
  storage?: LocalStorageLike,
): LegacyMigrationResult {
  const targetStorage = resolveStorage(storage);
  const owner = migrationOwner(targetStorage);
  if (owner !== undefined) {
    return { claimed: false, claimedByProfileId: owner || undefined, moved: { ...EMPTY_MOVED } };
  }

  const profiles = readProfiles(targetStorage);
  if (!profiles.length || profiles[0].id !== profileId) {
    return { claimed: false, moved: { ...EMPTY_MOVED } };
  }

  const scopedKeys = profileStorageKeys(profileId);
  const moved = { ...EMPTY_MOVED };
  for (const collection of ['words', 'texts', 'history'] as const) {
    const legacy = readArray(targetStorage, LEGACY_ANONYMOUS_STORAGE_KEYS[collection]);
    const existing = readArray(targetStorage, scopedKeys[collection]);
    const merged = mergeClaimedArrays(existing, legacy);
    targetStorage.setItem(scopedKeys[collection], JSON.stringify(merged));
    moved[collection] = legacy.length;
  }

  const claimedAt = new Date().toISOString();
  const marker: LegacyMigrationMarker = { claimedByProfileId: profileId, claimedAt };
  targetStorage.setItem(LEGACY_MIGRATION_STORAGE_KEY, JSON.stringify(marker));
  for (const key of Object.values(LEGACY_ANONYMOUS_STORAGE_KEYS)) targetStorage.removeItem(key);

  return { claimed: true, claimedByProfileId: profileId, moved };
}

export function createLocalProfile(
  input: CreateLocalProfileInput,
  storage?: LocalStorageLike,
) {
  const targetStorage = resolveStorage(storage);
  const email = normalizeLocalEmail(input.email);
  const displayName = normalizeLocalDisplayName(input.displayName);
  validateEmail(email);
  validateDisplayName(displayName);

  const profiles = readProfiles(targetStorage);
  if (profiles.some((profile) => profile.email === email)) {
    throw new Error('A local profile with this email already exists.');
  }

  const now = new Date().toISOString();
  const profile: LocalProfile = {
    id: createId(),
    email,
    displayName,
    createdAt: now,
    updatedAt: now,
    lastSignedInAt: now,
  };
  writeProfiles(targetStorage, [...profiles, profile]);
  claimLegacyAnonymousData(profile.id, targetStorage);
  persistSession(targetStorage, profile.id, now);
  return profile;
}

function signInProfile(profileId: string, storage: LocalStorageLike) {
  const profiles = readProfiles(storage);
  const index = profiles.findIndex((profile) => profile.id === profileId);
  if (index < 0) throw new Error('Local profile not found on this device.');

  const now = new Date().toISOString();
  const profile = { ...profiles[index], updatedAt: now, lastSignedInAt: now };
  profiles[index] = profile;
  writeProfiles(storage, profiles);
  claimLegacyAnonymousData(profile.id, storage);
  persistSession(storage, profile.id, now);
  return profile;
}

export function signInLocalProfile(email: string, storage?: LocalStorageLike) {
  const targetStorage = resolveStorage(storage);
  const normalizedEmail = normalizeLocalEmail(email);
  validateEmail(normalizedEmail);
  const profile = readProfiles(targetStorage).find((candidate) => candidate.email === normalizedEmail);
  if (!profile) throw new Error('No local profile uses this email on this device.');
  return signInProfile(profile.id, targetStorage);
}

export function signInLocalProfileById(profileId: string, storage?: LocalStorageLike) {
  return signInProfile(profileId, resolveStorage(storage));
}

export function createOrSignInLocalProfile(
  input: CreateLocalProfileInput,
  storage?: LocalStorageLike,
) {
  const targetStorage = resolveStorage(storage);
  const existing = findLocalProfileByEmail(input.email, targetStorage);
  return existing
    ? signInProfile(existing.id, targetStorage)
    : createLocalProfile(input, targetStorage);
}

export function getCurrentLocalSession(storage?: LocalStorageLike): LocalSession | undefined {
  const targetStorage = resolveStorage(storage);
  const value = readJson(targetStorage, LOCAL_SESSION_STORAGE_KEY);
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<LocalSession>;
  if (typeof candidate.profileId !== 'string' || typeof candidate.signedInAt !== 'string') return undefined;
  if (!readProfiles(targetStorage).some((profile) => profile.id === candidate.profileId)) return undefined;
  return { profileId: candidate.profileId, signedInAt: candidate.signedInAt };
}

export function getCurrentLocalProfile(storage?: LocalStorageLike) {
  const targetStorage = resolveStorage(storage);
  const session = getCurrentLocalSession(targetStorage);
  if (!session) return undefined;
  return readProfiles(targetStorage).find((profile) => profile.id === session.profileId);
}

export function signOutLocalProfile(storage?: LocalStorageLike) {
  resolveStorage(storage).removeItem(LOCAL_SESSION_STORAGE_KEY);
}
