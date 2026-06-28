import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildJourneyTemplateItinerary,
  createStoryEntries,
  createTravelBeanDraft,
} from '../utils/coreFlows.ts';
import {
  isUnfinishedBeanDraft,
  isPremiumLayout,
  journalMemoryText,
  journalSummary,
  LAYOUTS,
  makeBeanPlace,
  photoLimitForPremium,
  randomStoryPrompts,
  STORY_PROMPT_BANK,
  STORY_PROMPTS,
} from '../utils/travelBeanMvp.ts';
import {
  defaultPremiumState,
  normalizePremiumState,
  remainingFreeBeans,
} from '../utils/premium.ts';
import {
  TRAVEL_QUOTES,
  suggestQuotesForMood,
  quotesForCategory,
} from '../utils/quoteLibrary.ts';
import {
  BEAN_DATA_MARKER,
  encodePersistedBeanNotes,
  hydratePersistedBean,
  splitPersistedBeanNotes,
} from '../utils/beanPersistence.ts';

test('creates a Travel Bean draft with mood and photo prompt reflections', () => {
  const draft = createTravelBeanDraft({
    name: '  Daikanyama cafe  ',
    country: 'Japan',
    city: 'Tokyo',
    category: 'coffee_shop',
    latitude: 35.648,
    longitude: 139.704,
    moodTags: ['Reflective', 'Cinematic'],
    promptResponses: [
      { id: 'p1', photoId: 'photo-1', prompt: 'What did this place feel like?', response: 'A quiet pause between neon streets.' },
      { id: 'p2', photoId: 'photo-2', prompt: 'What surprised you most?', response: '' },
    ],
  });

  assert.equal(draft.name, 'Daikanyama cafe');
  assert.equal(draft.country, 'Japan');
  assert.equal(draft.category, 'coffee_shop');
  assert.match(draft.notes, /Mood: Reflective, Cinematic/);
  assert.match(draft.notes, /A quiet pause between neon streets/);
});

test('creates Story Bean entries from selected photos and responses', () => {
  const entries = createStoryEntries([
    { photoId: 'a', prompt: 'What stayed with you?', response: 'The sound of rain on the awning.' },
    { photoId: 'b', prompt: 'What felt different from home?' },
  ]);

  assert.equal(entries.length, 2);
  assert.equal(entries[0].photoId, 'a');
  assert.equal(entries[1].response, '');
  assert.match(entries[0].id, /^story-entry-1-/);
});

test('starts a Journey Bean template with real day-by-day stops', () => {
  const itinerary = buildJourneyTemplateItinerary({
    plan: ['Arrival walk', 'Museum and dinner'],
    dayStops: [
      ['Station', 'Old town', 'Noodle bar'],
      ['Museum', 'Garden', 'Rooftop'],
    ],
  });

  assert.equal(itinerary.length, 6);
  assert.deepEqual(itinerary.map(item => item.timeBlock).slice(0, 3), ['Morning', 'Afternoon', 'Evening']);
  assert.equal(itinerary[3].day, 2);
  assert.equal(itinerary[4].notes, 'Museum and dinner');
});

test('launch build does not force Pro on', () => {
  const source = readFileSync(new URL('../context/AppContext.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /isPro\s*=\s*true\s*\|\|/);
});

test('first launch opens Travel Bean for guests instead of forcing legacy auth', () => {
  const rootRoute = readFileSync(new URL('../app/index.tsx', import.meta.url), 'utf8');
  const rootLayout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  const tabsLayout = readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  const homeScreen = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
  const appContext = readFileSync(new URL('../context/AppContext.tsx', import.meta.url), 'utf8');
  const revenueCat = readFileSync(new URL('../services/revenuecat.tsx', import.meta.url), 'utf8');

  assert.match(rootRoute, /Redirect href="\/\(tabs\)"/);
  assert.doesNotMatch(tabsLayout, /Redirect href="\/\(auth\)\/sign-in"/);
  assert.doesNotMatch(tabsLayout, /if \(!isLoaded\) return null/);
  assert.doesNotMatch(rootLayout, /ClerkLoaded/);
  assert.match(appContext, /GUEST_PLACES_STORAGE_KEY/);
  assert.match(appContext, /const \[forceLocalData, setForceLocalData\] = useState\(localPreview\)/);
  assert.match(appContext, /const useLocalData = forceLocalData \|\| !isSignedIn/);
  assert.match(appContext, /const getTokenRef = useRef\(getToken\)/);
  assert.match(appContext, /\}, \[(?:storeBlogPosts, storeBlogSettings, )?useLocalData\]\);/);
  assert.doesNotMatch(rootLayout, /initializeRevenueCat\(\)/);
  assert.match(revenueCat, /enabled: isConfigured/);
  assert.match(revenueCat, /RevenueCat initialization failed/);
  assert.match(homeScreen, /HomeMap/);
  assert.doesNotMatch(homeScreen, /PlacesMap/);
});

test('journal saves fall back to device storage when cloud authentication fails', () => {
  const appContext = readFileSync(new URL('../context/AppContext.tsx', import.meta.url), 'utf8');

  assert.match(appContext, /const \[forceLocalData, setForceLocalData\]/);
  assert.match(appContext, /Cloud save failed; preserving Bean on this device instead/);
  assert.match(appContext, /setForceLocalData\(true\);\s+return savePlaceLocally\(p\);/);
  assert.match(appContext, /Cloud edit failed; preserving the updated Bean on this device instead/);
  assert.match(appContext, /Cloud delete failed; removing the Bean from this device instead/);
});

test('continue memory card only treats explicit drafts as unfinished', () => {
  const completed = {
    ...makeBeanPlace({
      place: 'Santorini',
      country: 'Greece',
      date: '2026-06-01',
      layout: 'Boarding Pass',
      mood: 'Cozy',
      photos: [],
      responses: [
        { id: 'p1', prompt: 'What made this place special?', response: '' },
      ],
    }),
    id: 'completed-bean',
    createdAt: '2026-06-01T12:00:00.000Z',
  };

  const draft = {
    ...completed,
    id: 'draft-bean',
    notes: `${completed.notes}\n\nStatus: Draft`,
  };

  assert.equal(isUnfinishedBeanDraft(completed), false);
  assert.equal(isUnfinishedBeanDraft(draft), true);
});

test('journal memory text does not duplicate title-only entries', () => {
  const titleOnly = {
    ...makeBeanPlace({
      place: 'Santorini',
      country: 'Greece',
      date: '2026-06-01',
      layout: 'Polaroid Stack',
      mood: 'Cozy',
      photos: [],
      responses: [
        { id: 'p1', prompt: 'What made this place special?', response: '' },
      ],
    }),
    id: 'title-only-bean',
    createdAt: '2026-06-01T12:00:00.000Z',
  };

  assert.equal(journalSummary(titleOnly), 'Santorini memories');
  assert.equal(journalMemoryText(titleOnly), '');

  const withSummary = {
    ...titleOnly,
    notes: 'Santorini memories\n\nSummary:\nQuiet cliffs and gold light.',
  };

  assert.equal(journalMemoryText(withSummary), 'Quiet cliffs and gold light.');

  const titlePlusMemory = {
    ...titleOnly,
    notes: 'Golden hour memories. The sunsets were unreal and everything felt peaceful.',
  };

  assert.equal(journalMemoryText(titlePlusMemory), 'The sunsets were unreal and everything felt peaceful.');
});

test('story prompt bank can rotate beyond the default questions', () => {
  const nextPrompts = randomStoryPrompts(STORY_PROMPTS, 3);

  assert.ok(STORY_PROMPT_BANK.length > STORY_PROMPTS.length);
  assert.equal(nextPrompts.length, 3);
  assert.equal(new Set(nextPrompts).size, nextPrompts.length);
  assert.ok(nextPrompts.every(prompt => !STORY_PROMPTS.includes(prompt as typeof STORY_PROMPTS[number])));
});

test('all users can add up to eight photos per memory', () => {
  const createScreen = readFileSync(new URL('../app/(tabs)/create.tsx', import.meta.url), 'utf8');
  const addPlaceFlow = readFileSync(new URL('../components/AddPlaceBeanFlow.tsx', import.meta.url), 'utf8');
  const journalScreen = readFileSync(new URL('../app/(tabs)/journal.tsx', import.meta.url), 'utf8');

  assert.equal(photoLimitForPremium(false), 8);
  assert.equal(photoLimitForPremium(true), 8);

  assert.match(createScreen, /const photoLimit = photoLimitForPremium\(isPremium\)/);
  assert.match(createScreen, /const slotsLeft = photoLimit - photos\.length/);
  assert.match(createScreen, /selectionLimit: slotsLeft/);
  assert.match(createScreen, /return \[\.\.\.prev, \.\.\.uniqueIncoming\]\.slice\(0, photoLimit\)/);
  assert.match(createScreen, /Select 1-\{photoLimit\} photos/);
  assert.match(createScreen, /keyboardShouldPersistTaps="handled"/);

  assert.match(addPlaceFlow, /const photoLimit = photoLimitForPremium\(isPremium\)/);
  assert.match(addPlaceFlow, /const slotsLeft = photoLimit - photos\.length/);
  assert.match(addPlaceFlow, /selectionLimit: slotsLeft/);
  assert.match(addPlaceFlow, /\.slice\(0, photoLimit\)/);

  assert.match(journalScreen, /const photoLimit = photoLimitForPremium\(isPremium\)/);
  assert.match(journalScreen, /const editPhotoLimit = Math\.max\(photoLimit, editForm\.photos\.length\)/);
  assert.match(journalScreen, /const slotsLeft = editPhotoLimit - editForm\.photos\.length/);
});

test('picked Bean photos are persisted and editor forms stay keyboard-aware', () => {
  const createScreen = readFileSync(new URL('../app/(tabs)/create.tsx', import.meta.url), 'utf8');
  const addPlaceFlow = readFileSync(new URL('../components/AddPlaceBeanFlow.tsx', import.meta.url), 'utf8');
  const journalScreen = readFileSync(new URL('../app/(tabs)/journal.tsx', import.meta.url), 'utf8');
  const photoPersistence = readFileSync(new URL('../utils/photoPersistence.ts', import.meta.url), 'utf8');

  assert.match(photoPersistence, /expo-file-system\/legacy/);
  assert.match(photoPersistence, /FileSystem\.documentDirectory/);
  assert.match(photoPersistence, /FileSystem\.copyAsync/);

  assert.match(createScreen, /import \{ persistBeanPhotos \} from '@\/utils\/photoPersistence'/);
  assert.match(createScreen, /const persistedPhotos = await persistBeanPhotos\(photos\)/);
  assert.match(addPlaceFlow, /const persistedPhotos = await persistBeanPhotos\(beanPhotos\)/);
  assert.match(journalScreen, /const persistedPhotos = await persistBeanPhotos\(editForm\.photos\)/);
  assert.match(journalScreen, /const persistedIncoming = await persistBeanPhotos\(incoming\)/);
  assert.match(journalScreen, /Remove photo/);

  assert.match(createScreen, /automaticallyAdjustKeyboardInsets/);
  assert.match(journalScreen, /automaticallyAdjustKeyboardInsets/);
  assert.match(journalScreen, /scrollEnabled=\{false\}/);
});

test('Travel Blog routes and journal action are wired', () => {
  const rootLayout = readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  const journalScreen = readFileSync(new URL('../app/(tabs)/journal.tsx', import.meta.url), 'utf8');
  const travelBlog = readFileSync(new URL('../utils/travelBlog.ts', import.meta.url), 'utf8');

  assert.match(travelBlog, /export function sanitizeBlogUsername/);
  assert.match(travelBlog, /replace\(\/\[\^a-z0-9_\]\/g, ''\)/);
  assert.match(travelBlog, /export function slugify/);
  assert.match(travelBlog, /status: 'draft'/);
  assert.match(travelBlog, /privacy: 'private'/);
  assert.match(travelBlog, /sourcePlaceId: bean\.id/);
  assert.match(travelBlog, /slice\(0, 8\)/);
  assert.match(rootLayout, /blog\/settings/);
  assert.match(rootLayout, /blog\/editor\/\[id\]/);
  assert.match(rootLayout, /\[username\]\/\[slug\]/);
  assert.match(journalScreen, /Add to Travel Blog/);
  assert.match(journalScreen, /createBlogDraftFromPlace/);
});

test('Travel Blog privacy controls protect drafts and password posts', () => {
  const editorScreen = readFileSync(new URL('../app/blog/editor/[id].tsx', import.meta.url), 'utf8');
  const publicPostScreen = readFileSync(new URL('../app/[username]/[slug].tsx', import.meta.url), 'utf8');
  const blogRoutes = readFileSync(new URL('../../api-server/src/routes/blog.ts', import.meta.url), 'utf8');

  assert.match(editorScreen, /Add a post password before publishing this protected story/);
  assert.match(editorScreen, /secureTextEntry autoCapitalize="none" autoCorrect=\{false\}/);
  assert.match(editorScreen, /Readers will need this password/);

  assert.match(publicPostScreen, /submittedPassword/);
  assert.match(publicPostScreen, /Unlock Story/);
  assert.match(publicPostScreen, /That password did not unlock this story/);

  assert.match(blogRoutes, /function publicListPostPayload/);
  assert.match(blogRoutes, /body: isPasswordProtected \? "" : post\.body/);
  assert.match(blogRoutes, /passwordRequired: true/);
  assert.match(blogRoutes, /A password is required before publishing a password-protected post/);
  assert.match(blogRoutes, /canServePublicPhoto\(photoId: string, password\?: string\)/);
});

test('premium postcard destination titles shrink instead of being shortened', () => {
  const createScreen = readFileSync(new URL('../app/(tabs)/create.tsx', import.meta.url), 'utf8');
  const collageCard = readFileSync(new URL('../components/BeanCollageCard.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(createScreen, /shortPlace/);
  assert.doesNotMatch(createScreen, /slice\(0,\s*10\).*\.{3}/);
  assert.match(createScreen, /<FittedPreviewText style=\{styles\.previewThisPlace\} minimumFontScale=\{0\.25\}>\{placeUpper\}<\/FittedPreviewText>/);
  assert.match(createScreen, /<FittedPreviewText style=\{styles\.previewMastheadTitle\} minimumFontScale=\{0\.25\}>\{placeUpper\}<\/FittedPreviewText>/);
  assert.match(createScreen, /previewMastheadTitle: \{ width: '100%'/);
  assert.match(createScreen, /ellipsizeMode="clip"/);

  assert.doesNotMatch(collageCard, /destinationTitleText/);
  assert.doesNotMatch(collageCard, /thisIsPlaceText|mastheadPlaceText/);
  assert.match(collageCard, /<FittedText\s+numberOfLines=\{1\}\s+minimumFontScale=\{0\.28\}[\s\S]*>\s*\{placeUpper\}\s*<\/FittedText>/);
  assert.match(collageCard, /<FittedText\s+numberOfLines=\{1\}\s+minimumFontScale=\{0\.3\}[\s\S]*>\s*\{placeUpper\}\s*<\/FittedText>/);
  assert.match(collageCard, /mastheadPlace: \{ width: '100%'/);
});

test('free watermark uses the branded bean mascot mark', () => {
  const collageCard = readFileSync(new URL('../components/BeanCollageCard.tsx', import.meta.url), 'utf8');
  const createScreen = readFileSync(new URL('../app/(tabs)/create.tsx', import.meta.url), 'utf8');

  assert.match(collageCard, /<CreateBeanMascot size=\{small \? 56 : 76\} frameless bubble="heart" \/>/);
  assert.match(collageCard, /Travel Bean/);
  assert.match(collageCard, /mascotWatermarkLabel/);
  assert.match(createScreen, /includeMascotMark/);
  assert.match(createScreen, /Bean Mascot Mark/);
  assert.doesNotMatch(collageCard, /Feather name="navigation"/);
});

test('Snapshots Postcard is a premium eight-photo template', () => {
  const createScreen = readFileSync(new URL('../app/(tabs)/create.tsx', import.meta.url), 'utf8');
  const collageCard = readFileSync(new URL('../components/BeanCollageCard.tsx', import.meta.url), 'utf8');

  assert.ok(LAYOUTS.some(layout => layout.name === 'Snapshots Postcard' && layout.type === 'premium'));
  assert.match(createScreen, /'Snapshots Postcard'/);
  assert.match(createScreen, /p6 = previewPhotos\[6\]/);
  assert.match(createScreen, /p7 = previewPhotos\[7\]/);
  assert.match(createScreen, /previewSnapshotsGrid/);

  assert.match(collageCard, /'Snapshots Postcard'/);
  assert.match(collageCard, /const visiblePhotos = photos\.filter\(Boolean\)\.slice\(0, 8\)/);
  assert.match(collageCard, /p6 = photos\[6\]/);
  assert.match(collageCard, /p7 = photos\[7\]/);
  assert.match(collageCard, /snapshotsPhotoGrid/);
});

test('Travel Bean Premium keeps the requested free and premium layout split', () => {
  assert.deepEqual(LAYOUTS.filter(layout => layout.type === 'free').map(layout => layout.name), [
    'Polaroid Stack',
    'Editorial Grid',
    'Classic Postcard',
    'Boarding Pass',
    'Airmail Border',
    'Film Strip',
  ]);
  assert.deepEqual(LAYOUTS.filter(layout => layout.type === 'premium').map(layout => layout.name), [
    'This Is Postcard',
    'Wish You Were Here',
    'Snapshots Postcard',
    'City Cover',
    'Black City Postcard',
    'Any City Mosaic',
    'Seek Travel',
    'Mountain Postcard',
    'Temple Heritage',
    'Break Postcard',
    'Food Trip',
    'Destination Sidebar',
    'Greetings Grid',
    'Masthead Postcard',
    'Pinned Snapshot',
  ]);
  assert.equal(isPremiumLayout('Polaroid Stack'), false);
  assert.equal(isPremiumLayout('Classic Postcard'), false);
  assert.equal(isPremiumLayout('Scrapbook Story'), false);
  assert.equal(isPremiumLayout('Airmail Border'), false);
  assert.equal(isPremiumLayout('Film Strip'), false);
  assert.equal(isPremiumLayout('Boarding Pass'), false);
  assert.equal(isPremiumLayout('This Is Postcard'), true);
  assert.equal(isPremiumLayout('Snapshots Postcard'), true);
});

test('free Bean monthly limit resets by calendar month', () => {
  const may = normalizePremiumState({
    ...defaultPremiumState(new Date('2026-05-15T12:00:00Z')),
    beansCreatedThisMonth: 10,
  }, new Date('2026-05-20T12:00:00Z'));
  assert.equal(remainingFreeBeans(may), 0);

  const june = normalizePremiumState(may, new Date('2026-06-01T12:00:00Z'));
  assert.equal(june.beansCreatedThisMonth, 0);
  assert.equal(remainingFreeBeans(june), 10);
});

test('premium quote library supports mood suggestions and browsing', () => {
  assert.ok(TRAVEL_QUOTES.length >= 50);
  assert.equal(new Set(TRAVEL_QUOTES.map(quote => quote.id)).size, TRAVEL_QUOTES.length);
  assert.ok(TRAVEL_QUOTES.every(quote => quote.text.length <= 180));
  assert.equal(suggestQuotesForMood('Cozy').length, 3);
  assert.ok(suggestQuotesForMood('Dreamy').every(quote => quote.moodTags.includes('Dreamy') || quote.categories.includes('Short')));
  assert.ok(quotesForCategory('Adventure').some(quote => quote.author === 'J.R.R. Tolkien'));
  assert.ok(quotesForCategory('Home').length > 0);
  assert.ok(quotesForCategory('Self-discovery').length > 0);
});

test('premium quote metadata is saved onto generated Beans', () => {
  const bean = makeBeanPlace({
    place: 'Santorini',
    country: 'Greece',
    date: '2026-06-01',
    layout: 'Film Strip',
    mood: 'Dreamy',
    photos: [],
    responses: [
      { id: 'p1', prompt: 'What made this place special?', response: 'Soft light over the caldera.' },
    ],
    selectedQuoteText: 'To travel is to live.',
    selectedQuoteAuthor: 'Hans Christian Andersen',
    quoteSourceType: 'premium_library',
    quotePlacement: 'film_subtitle',
    isPremiumQuoteStyle: true,
  });

  assert.equal(bean.selectedQuoteText, 'To travel is to live.');
  assert.equal(bean.selectedQuoteAuthor, 'Hans Christian Andersen');
  assert.equal(bean.quoteSourceType, 'premium_library');
  assert.equal(bean.quotePlacement, 'film_subtitle');
  assert.equal(bean.isPremiumQuoteStyle, true);
});

test('saved Beans retain their full editable metadata after an API round trip', () => {
  const bean = {
    ...makeBeanPlace({
      place: 'Santorini',
      country: 'Greece',
      date: '2026-06-01',
      layout: 'Film Strip',
      mood: 'Dreamy',
      photos: [],
      responses: [
        { id: 'p1', prompt: 'What made this place special?', response: 'Soft light over the caldera.' },
        { id: 'p2', prompt: 'What did you notice?', response: 'Blue domes against the sea.' },
      ],
      selectedQuoteText: 'To travel is to live.',
      selectedQuoteAuthor: 'Hans Christian Andersen',
      quoteSourceType: 'premium_library',
      quotePlacement: 'film_subtitle',
      isPremiumQuoteStyle: true,
    }),
    id: 'persisted-bean',
    createdAt: '2026-06-01T12:00:00.000Z',
    hasWatermark: false,
    exportQuality: 'hd' as const,
  };

  const encoded = encodePersistedBeanNotes(bean.notes, bean);
  const hydrated = hydratePersistedBean({ ...bean, notes: encoded });

  assert.match(encoded, new RegExp(BEAN_DATA_MARKER.trim()));
  assert.doesNotMatch(hydrated.notes, /__TRAVEL_BEAN_DATA__/);
  assert.deepEqual(hydrated.promptResponses, bean.promptResponses);
  assert.equal(hydrated.selectedLayout, 'Film Strip');
  assert.equal(hydrated.selectedMood, 'Dreamy');
  assert.equal(hydrated.selectedQuoteText, 'To travel is to live.');
  assert.equal(hydrated.quotePlacement, 'film_subtitle');
  assert.equal(hydrated.hasWatermark, false);
  assert.equal(hydrated.exportQuality, 'hd');
});

test('malformed persisted Bean metadata stays visible instead of losing journal notes', () => {
  const malformed = `A human memory${BEAN_DATA_MARKER}{not-json}`;
  const decoded = splitPersistedBeanNotes(malformed);
  assert.equal(decoded.notes, malformed);
  assert.deepEqual(decoded.metadata, {});
});
