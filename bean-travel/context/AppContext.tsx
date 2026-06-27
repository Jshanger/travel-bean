import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { lookupCoords } from '@/constants/cityCoords';
import { useSubscription } from '@/services/revenuecat';
import { BeanPhoto, BlogPost, BucketItem, BucketStatus, BucketTag, TravelBlogSettings, Trip, ItineraryItem, TripComment, VisitedPlace } from '@/types';
import { encodePersistedBeanNotes, hydratePersistedBean } from '@/utils/beanPersistence';
import { defaultPremiumState, FREE_BLOG_POST_LIMIT, normalizePremiumState, remainingFreeBeans, type SubscriptionPlan, type UserPremiumState } from '@/utils/premium';
import { createDefaultBlogSettings, generateBlogDraftFromBean, uniqueBlogSlug } from '@/utils/travelBlog';
import { useTravelAuth, useTravelUser } from '@/hooks/useTravelAuth';

function uid() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const localPreview = process.env.EXPO_PUBLIC_LOCAL_PREVIEW === '1';
const PREMIUM_STORAGE_KEY = 'travel-bean-premium-state';
const GUEST_PLACES_STORAGE_KEY = 'travel-bean-guest-places';
const BLOG_SETTINGS_STORAGE_KEY = 'travel-bean-blog-settings';
const BLOG_POSTS_STORAGE_KEY = 'travel-bean-blog-posts';

export const BLOG_POST_LIMIT_ERROR = 'BLOG_POST_LIMIT_REACHED';

type TripDraft = Omit<Trip, 'id' | 'createdAt' | 'shareId' | 'itinerary'> & {
  itinerary?: Array<Omit<ItineraryItem, 'id' | 'votes' | 'comments'> | ItineraryItem>;
};

type UserProfile = {
  userId: string;
  email: string;
  name: string;
  imageUrl: string;
  marketingConsent: boolean;
  createdAt: string;
  updatedAt: string;
};

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api/bean`;
  return '/api/bean';
}

function getApiRoot(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  return '/api';
}

async function apiFetch(path: string, token: string | null, options?: RequestInit) {
  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.message ?? (body as any)?.error ?? `API error ${res.status}`);
  }
  return res.json();
}

async function blogApiFetch(path: string, token: string | null, options?: RequestInit) {
  const res = await fetch(`${getApiRoot()}/blog${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.message ?? (body as any)?.error ?? `API error ${res.status}`);
  }
  return res.json();
}

function mapPhoto(r: any): BeanPhoto | null {
  const imageUrl = r.imageUrl ?? r.image_url;
  if (!r.id || !imageUrl) return null;
  return {
    id: r.id,
    imageUrl,
    caption: r.caption ?? undefined,
  };
}

function mapPlace(r: any): VisitedPlace {
  const persisted = hydratePersistedBean(r);
  return {
    id: persisted.id,
    name: persisted.name,
    country: persisted.country,
    city: persisted.city ?? undefined,
    category: persisted.category,
    dateVisited: persisted.dateVisited ?? persisted.date_visited ?? '',
    notes: persisted.notes ?? '',
    latitude: persisted.latitude ?? undefined,
    longitude: persisted.longitude ?? undefined,
    createdAt: persisted.createdAt ?? persisted.created_at ?? new Date().toISOString(),
    moodTags: persisted.moodTags ?? persisted.mood_tags ?? undefined,
    promptResponses: persisted.promptResponses ?? persisted.prompt_responses ?? undefined,
    photos: persisted.photos ?? undefined,
    selectedLayout: persisted.selectedLayout ?? persisted.selected_layout ?? undefined,
    selectedMood: persisted.selectedMood ?? persisted.selected_mood ?? undefined,
    isPremiumLayout: persisted.isPremiumLayout ?? persisted.is_premium_layout ?? undefined,
    hasWatermark: persisted.hasWatermark ?? persisted.has_watermark ?? undefined,
    exportQuality: persisted.exportQuality ?? persisted.export_quality ?? undefined,
    selectedQuoteText: persisted.selectedQuoteText ?? persisted.selected_quote_text ?? undefined,
    selectedQuoteAuthor: persisted.selectedQuoteAuthor ?? persisted.selected_quote_author ?? undefined,
    quoteSourceType: persisted.quoteSourceType ?? persisted.quote_source_type ?? undefined,
    quotePlacement: persisted.quotePlacement ?? persisted.quote_placement ?? undefined,
    isPremiumQuoteStyle: persisted.isPremiumQuoteStyle ?? persisted.is_premium_quote_style ?? undefined,
  };
}

function placeApiPayload(place: Partial<VisitedPlace>) {
  const { photos: _photos, ...payload } = place;
  return {
    ...payload,
    notes: encodePersistedBeanNotes(place.notes ?? '', place),
  };
}

function photoContentType(uri: string) {
  const cleanUri = uri.split('?')[0].toLowerCase();
  if (cleanUri.endsWith('.png')) return 'image/png';
  if (cleanUri.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function readPhotoBlob(uri: string) {
  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', uri, true);
    xhr.responseType = 'blob';
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('Could not read the selected photo'));
    xhr.send();
  });
}

async function uploadPlacePhoto(placeId: string, photo: BeanPhoto, token: string | null) {
  const response = await fetch(`${getApiBase()}/photos/upload?placeId=${encodeURIComponent(placeId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': photoContentType(photo.imageUrl),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: await readPhotoBlob(photo.imageUrl),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.message ?? (error as any)?.error ?? `Photo upload failed (${response.status})`);
  }
  return mapPhoto(await response.json());
}

async function syncPlacePhotos(placeId: string, desired: BeanPhoto[], token: string | null) {
  const existingRows = await apiFetch(`/photos?placeId=${encodeURIComponent(placeId)}`, token) as any[];
  const existingIds = new Set(existingRows.map(row => row.id));
  const desiredExistingIds = new Set(desired.filter(photo => existingIds.has(photo.id)).map(photo => photo.id));

  await Promise.all(existingRows
    .filter(row => !desiredExistingIds.has(row.id))
    .map(row => apiFetch(`/photos/${encodeURIComponent(row.id)}`, token, { method: 'DELETE' })));

  const retained = existingRows
    .filter(row => desiredExistingIds.has(row.id))
    .map(mapPhoto)
    .filter((photo): photo is BeanPhoto => Boolean(photo));

  const uploaded: BeanPhoto[] = [];
  for (const photo of desired.filter(item => !existingIds.has(item.id))) {
    const next = await uploadPlacePhoto(placeId, photo, token);
    if (next) uploaded.push(next);
  }
  return [...retained, ...uploaded];
}
function mapBucket(r: any): BucketItem {
  return {
    id: r.id,
    name: r.name,
    location: r.location,
    country: r.country ?? undefined,
    source: r.source,
    tags: (r.tags ?? []) as BucketTag[],
    status: r.status as BucketStatus,
    notes: r.notes ?? '',
    imageUrl: r.imageUrl ?? undefined,
    imageObjectPath: r.imageObjectPath ?? r.image_object_path ?? undefined,
    createdAt: r.createdAt ?? r.created_at ?? new Date().toISOString(),
  };
}
function mapTrip(r: any): Trip {
  return {
    id: r.id,
    name: r.name,
    destination: r.destination,
    startDate: r.startDate ?? r.start_date ?? '',
    endDate: r.endDate ?? r.end_date ?? '',
    travellers: (r.travellers ?? []) as string[],
    itinerary: (r.itinerary ?? []) as ItineraryItem[],
    shareId: r.shareId ?? r.share_id ?? '',
    createdAt: r.createdAt ?? r.created_at ?? new Date().toISOString(),
  };
}

function mapUserProfile(r: any): UserProfile | null {
  if (!r) return null;
  return {
    userId: r.userId ?? r.user_id ?? '',
    email: r.email ?? '',
    name: r.name ?? '',
    imageUrl: r.imageUrl ?? r.image_url ?? '',
    marketingConsent: Boolean(r.marketingConsent ?? r.marketing_consent),
    createdAt: r.createdAt ?? r.created_at ?? new Date().toISOString(),
    updatedAt: r.updatedAt ?? r.updated_at ?? new Date().toISOString(),
  };
}

function mapBlogSettings(row: any): TravelBlogSettings | null {
  if (!row) return null;
  return {
    id: row.id ?? row.userId ?? row.user_id ?? 'blog',
    username: row.username ?? '',
    title: row.title ?? 'My Travel Bean Blog',
    intro: row.intro ?? '',
    privacy: row.privacy ?? 'private',
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
  };
}

function mapBlogPost(row: any): BlogPost {
  return {
    id: row.id,
    sourcePlaceId: row.sourcePlaceId ?? row.source_place_id ?? '',
    status: row.status ?? 'draft',
    privacy: row.privacy ?? 'private',
    password: row.password ?? undefined,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? '',
    opening: row.opening ?? '',
    body: row.body ?? '',
    coverPhotoId: row.coverPhotoId ?? row.cover_photo_id ?? undefined,
    coverImageUrl: row.coverImageUrl ?? row.cover_image_url ?? undefined,
    photos: Array.isArray(row.photos) ? row.photos : [],
    place: row.place ?? '',
    country: row.country ?? '',
    city: row.city ?? undefined,
    dateVisited: row.dateVisited ?? row.date_visited ?? '',
    category: row.category ?? 'Travel',
    tags: Array.isArray(row.tags) ? row.tags : [],
    hideExactLocation: Boolean(row.hideExactLocation ?? row.hide_exact_location),
    hideDate: Boolean(row.hideDate ?? row.hide_date),
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? row.updated_at ?? new Date().toISOString(),
    publishedAt: row.publishedAt ?? row.published_at ?? null,
  };
}

function parseStoredBlogSettings(value: string | null): TravelBlogSettings | null {
  if (!value) return null;
  try {
    const now = new Date().toISOString();
    const parsed = JSON.parse(value);
    return parsed ? { ...createDefaultBlogSettings(now), ...parsed } : null;
  } catch {
    return null;
  }
}

function parseStoredBlogPosts(value: string | null): BlogPost[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface AppContextType {
  places: VisitedPlace[];
  bucketItems: BucketItem[];
  trips: Trip[];
  blogSettings: TravelBlogSettings;
  blogPosts: BlogPost[];
  loading: boolean;
  isPro: boolean;
  isPremium: boolean;
  subscriptionPlan: SubscriptionPlan;
  beansCreatedThisMonth: number;
  monthlyBeanLimit: number;
  freeBeansRemaining: number;
  premiumSince: string | null;
  canCreateBean: boolean;
  userProfile: UserProfile | null;
  refreshEntitlements: () => Promise<void>;
  activatePro: () => Promise<void>;
  activatePremiumPlan: (plan: Exclude<SubscriptionPlan, 'free'>) => Promise<void>;
  deactivatePremiumMode: () => Promise<void>;
  recordBeanCreated: () => Promise<void>;
  updateMarketingConsent: (marketingConsent: boolean) => Promise<void>;
  addPlace: (p: Omit<VisitedPlace, 'id' | 'createdAt'>) => Promise<VisitedPlace>;
  editPlace: (id: string, p: Partial<VisitedPlace>) => Promise<void>;
  deletePlace: (id: string) => Promise<void>;
  addBucketItem: (b: Omit<BucketItem, 'id' | 'createdAt'>) => Promise<void>;
  editBucketItem: (id: string, b: Partial<BucketItem>) => Promise<void>;
  deleteBucketItem: (id: string) => Promise<void>;
  addTrip: (t: TripDraft) => Promise<Trip>;
  editTrip: (id: string, t: Partial<Trip>) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  saveBlogSettings: (settings: Partial<TravelBlogSettings>) => Promise<TravelBlogSettings>;
  createBlogDraftFromPlace: (placeId: string) => Promise<BlogPost>;
  editBlogPost: (id: string, post: Partial<BlogPost>) => Promise<void>;
  publishBlogPostById: (id: string, postOverride?: Partial<BlogPost>) => Promise<BlogPost | undefined>;
  unpublishBlogPost: (id: string) => Promise<void>;
  deleteBlogPost: (id: string) => Promise<void>;
  getBlogPostById: (id: string) => BlogPost | undefined;
  syncBlogToCloud: () => Promise<{ settings: TravelBlogSettings; posts: BlogPost[] }>;
  emailDashboardLink: (email?: string) => Promise<void>;
  addItineraryItem: (tripId: string, item: Omit<ItineraryItem, 'id' | 'votes' | 'comments'>) => Promise<void>;
  editItineraryItem: (tripId: string, itemId: string, item: Partial<ItineraryItem>) => Promise<void>;
  deleteItineraryItem: (tripId: string, itemId: string) => Promise<void>;
  addComment: (tripId: string, itemId: string, comment: Omit<TripComment, 'id' | 'createdAt'>) => Promise<void>;
  voteOnItem: (tripId: string, itemId: string, vote: 'mustGo' | 'maybe' | 'skip') => Promise<void>;
  getTripById: (id: string) => Trip | undefined;
  getUniqueCountries: () => string[];
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useTravelAuth();
  const { user } = useTravelUser();
  const { isSubscribed, refetchCustomerInfo } = useSubscription();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [places, setPlaces] = useState<VisitedPlace[]>([]);
  const [bucketItems, setBucketItems] = useState<BucketItem[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [blogSettings, setBlogSettings] = useState<TravelBlogSettings>(() => createDefaultBlogSettings());
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiIsPro, setApiIsPro] = useState(false);
  const [forceLocalData, setForceLocalData] = useState(localPreview);
  const [premiumState, setPremiumState] = useState<UserPremiumState>(() => defaultPremiumState());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const useLocalData = forceLocalData || !isSignedIn;

  const isPremium = isSubscribed || apiIsPro || premiumState.isPremium;
  const isPro = isPremium;
  const freeBeansRemaining = remainingFreeBeans(premiumState);
  const canCreateBean = isPremium || freeBeansRemaining > 0;

  const storePremiumState = useCallback(async (next: UserPremiumState) => {
    setPremiumState(next);
    await AsyncStorage.setItem(PREMIUM_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const storeLocalPlaces = useCallback(async (next: VisitedPlace[]) => {
    setPlaces(next);
    await AsyncStorage.setItem(GUEST_PLACES_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const storeBlogSettings = useCallback(async (next: TravelBlogSettings) => {
    setBlogSettings(next);
    await AsyncStorage.setItem(BLOG_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const storeBlogPosts = useCallback(async (next: BlogPost[]) => {
    setBlogPosts(next);
    await AsyncStorage.setItem(BLOG_POSTS_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const recordBeanCreatedRef = useRef<() => Promise<void>>(async () => undefined);

  const savePlaceLocally = useCallback(async (p: Omit<VisitedPlace, 'id' | 'createdAt'>) => {
    const coords = p.latitude != null ? {} : (lookupCoords(p.name) ?? lookupCoords(p.city ?? '') ?? {});
    const row: VisitedPlace = { ...p, ...coords, id: uid(), createdAt: new Date().toISOString() };
    await storeLocalPlaces([row, ...places]);
    await recordBeanCreatedRef.current();
    return row;
  }, [places, storeLocalPlaces]);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(PREMIUM_STORAGE_KEY)
      .then(value => {
        if (!mounted) return;
        setPremiumState(normalizePremiumState(value ? JSON.parse(value) : null));
      })
      .catch(() => {
        if (mounted) setPremiumState(defaultPremiumState());
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (useLocalData || !isSignedIn || !user) {
      setUserProfile(null);
      return () => {
        mounted = false;
      };
    }
    async function syncProfile() {
      const email = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
      if (!email) return;
      try {
        const token = await getTokenRef.current();
        const profile = mapUserProfile(await apiFetch('/profile', token, {
          method: 'PUT',
          body: JSON.stringify({
            email,
            name: user?.fullName ?? user?.firstName ?? '',
            imageUrl: user?.imageUrl ?? '',
          }),
        }));
        if (mounted) setUserProfile(profile);
      } catch (error) {
        console.warn('Unable to sync user profile', error);
      }
    }
    syncProfile();
    return () => {
      mounted = false;
    };
  }, [isSignedIn, useLocalData, user?.id, user?.primaryEmailAddress?.emailAddress, user?.fullName, user?.firstName, user?.imageUrl]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      AsyncStorage.getItem(BLOG_SETTINGS_STORAGE_KEY),
      AsyncStorage.getItem(BLOG_POSTS_STORAGE_KEY),
    ])
      .then(([settingsValue, postsValue]) => {
        if (!mounted) return;
        setBlogSettings(parseStoredBlogSettings(settingsValue) ?? createDefaultBlogSettings());
        setBlogPosts(parseStoredBlogPosts(postsValue));
      })
      .catch(() => {
        if (!mounted) return;
        setBlogSettings(createDefaultBlogSettings());
        setBlogPosts([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    if (useLocalData) {
      setLoading(true);
      AsyncStorage.getItem(GUEST_PLACES_STORAGE_KEY)
        .then(value => {
          if (!mounted) return;
          const rows = value ? JSON.parse(value) : [];
          setPlaces(Array.isArray(rows) ? rows.map(mapPlace) : []);
        })
        .catch(() => {
          if (mounted) setPlaces([]);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
      return () => {
        mounted = false;
      };
    }
    async function load() {
      setLoading(true);
      try {
        const token = await getTokenRef.current();
        const [p, b, t, ent, blogSettingsRow, blogPostRows, localBlogSettingsValue, localBlogPostsValue] = await Promise.all([
          apiFetch('/places', token),
          apiFetch('/bucket', token),
          apiFetch('/trips', token),
          apiFetch('/entitlements', token).catch(() => ({ isPro: false })),
          blogApiFetch('/settings', token).catch(() => null),
          blogApiFetch('/posts', token).catch(() => []),
          AsyncStorage.getItem(BLOG_SETTINGS_STORAGE_KEY),
          AsyncStorage.getItem(BLOG_POSTS_STORAGE_KEY),
        ]);
        const localBlogSettings = parseStoredBlogSettings(localBlogSettingsValue);
        const localBlogPosts = parseStoredBlogPosts(localBlogPostsValue);
        setApiIsPro((ent as any).isPro === true);
        const photoRows = await apiFetch('/photos/all', token).catch(async () => {
          const rows = await Promise.all((p as any[]).map(place => apiFetch(`/photos?placeId=${encodeURIComponent(place.id)}`, token).catch(() => [])));
          return rows.flat();
        }) as any[];
        const photosByPlace = photoRows.reduce<Record<string, BeanPhoto[]>>((groups, row) => {
          const photo = mapPhoto(row);
          const placeId = row.placeId ?? row.place_id;
          if (!photo || !placeId) return groups;
          groups[placeId] = [...(groups[placeId] ?? []), photo];
          return groups;
        }, {});
        const loadedPlaces: VisitedPlace[] = (p as any[])
          .map(mapPlace)
          .map(place => ({ ...place, photos: photosByPlace[place.id] ?? place.photos }))
          .map(place => place.latitude != null ? place : { ...place, ...lookupCoords(place.name) });
        setPlaces(loadedPlaces);
        setBucketItems((b as any[]).map(mapBucket));
        setTrips((t as any[]).map(mapTrip));
        let mappedBlogSettings = mapBlogSettings(blogSettingsRow);
        const publishedLocalPosts = localBlogPosts.filter(post => post.status === 'published');
        if (!mappedBlogSettings && localBlogSettings?.username) {
          const settingsToSync: TravelBlogSettings = {
            ...localBlogSettings,
            privacy: publishedLocalPosts.length && localBlogSettings.privacy === 'private' ? 'public' : localBlogSettings.privacy,
          };
          mappedBlogSettings = mapBlogSettings(await blogApiFetch('/settings', token, {
            method: 'PUT',
            body: JSON.stringify(settingsToSync),
          }).catch(() => null));
        }
        if (mappedBlogSettings) {
          await storeBlogSettings(mappedBlogSettings);
        }
        const cloudBlogPosts = Array.isArray(blogPostRows) ? blogPostRows.map(mapBlogPost) : [];
        if (cloudBlogPosts.length) {
          await storeBlogPosts(cloudBlogPosts);
        } else if (mappedBlogSettings?.username && localBlogPosts.length) {
          const syncedPosts = await Promise.all(localBlogPosts.map(async post => {
            try {
              const saved = mapBlogPost(await blogApiFetch('/posts', token, {
                method: 'POST',
                body: JSON.stringify(post),
              }));
              if (post.status === 'published') {
                return mapBlogPost(await blogApiFetch(`/posts/${encodeURIComponent(saved.id)}/publish`, token, {
                  method: 'POST',
                  body: JSON.stringify({ privacy: post.privacy === 'password' ? 'password' : 'public' }),
                }));
              }
              return saved;
            } catch (error) {
              console.warn('Cloud blog post migration failed; preserving post locally.', error);
              return null;
            }
          }));
          const migratedPosts = syncedPosts.filter((post): post is BlogPost => Boolean(post));
          await storeBlogPosts(migratedPosts.length ? migratedPosts : localBlogPosts);
        } else {
          await storeBlogPosts(cloudBlogPosts);
        }
      } catch (e) {
        console.error('Failed to load data', e);
        setForceLocalData(true);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [storeBlogPosts, storeBlogSettings, useLocalData]);

  const activatePremiumPlan = useCallback(async (plan: Exclude<SubscriptionPlan, 'free'>) => {
    const next = normalizePremiumState({
      ...premiumState,
      isPremium: true,
      subscriptionPlan: plan,
      premiumSince: premiumState.premiumSince ?? new Date().toISOString(),
    });
    await storePremiumState(next);
  }, [premiumState, storePremiumState]);

  const deactivatePremiumMode = useCallback(async () => {
    const next = normalizePremiumState({
      ...premiumState,
      isPremium: false,
      subscriptionPlan: 'free',
      premiumSince: null,
    });
    await storePremiumState(next);
  }, [premiumState, storePremiumState]);

  const recordBeanCreated = useCallback(async () => {
    if (isPremium) return;
    const next = normalizePremiumState({
      ...premiumState,
      beansCreatedThisMonth: premiumState.beansCreatedThisMonth + 1,
    });
    await storePremiumState(next);
  }, [isPremium, premiumState, storePremiumState]);
  recordBeanCreatedRef.current = recordBeanCreated;

  const updateMarketingConsent = useCallback(async (marketingConsent: boolean) => {
    const email = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() || userProfile?.email;
    if (useLocalData || !email) {
      const now = new Date().toISOString();
      setUserProfile(prev => ({
        userId: prev?.userId ?? user?.id ?? '',
        email: email ?? '',
        name: prev?.name ?? user?.fullName ?? user?.firstName ?? '',
        imageUrl: prev?.imageUrl ?? user?.imageUrl ?? '',
        marketingConsent,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      }));
      return;
    }
    const token = await getToken();
    const profile = mapUserProfile(await apiFetch('/profile', token, {
      method: 'PUT',
      body: JSON.stringify({
        email,
        name: user?.fullName ?? user?.firstName ?? userProfile?.name ?? '',
        imageUrl: user?.imageUrl ?? userProfile?.imageUrl ?? '',
        marketingConsent,
      }),
    }));
    setUserProfile(profile);
  }, [getToken, useLocalData, user?.firstName, user?.fullName, user?.id, user?.imageUrl, user?.primaryEmailAddress?.emailAddress, userProfile]);

  // ── Places ──────────────────────────────────────────────
  const addPlace = useCallback(async (p: Omit<VisitedPlace, 'id' | 'createdAt'>) => {
    if (useLocalData) {
      return savePlaceLocally(p);
    }
    try {
      const token = await getToken();
      const coords = p.latitude != null ? {} : (lookupCoords(p.name) ?? {});
      const row = await apiFetch('/places', token, {
        method: 'POST',
        body: JSON.stringify(placeApiPayload({ ...p, ...coords })),
      }).then(mapPlace);
      const photos: BeanPhoto[] = [];
      try {
        for (const photo of p.photos ?? []) {
          const uploaded = await uploadPlacePhoto(row.id, photo, token);
          if (uploaded) photos.push(uploaded);
        }
      } catch (error) {
        await apiFetch(`/places/${row.id}`, token, { method: 'DELETE' }).catch(() => undefined);
        throw error;
      }
      const completeRow = { ...row, photos };
      setPlaces(prev => [completeRow, ...prev]);
      await recordBeanCreated();
      return completeRow;
    } catch (error) {
      console.warn('Cloud save failed; preserving Bean on this device instead.', error);
      setForceLocalData(true);
      return savePlaceLocally(p);
    }
  }, [getToken, recordBeanCreated, savePlaceLocally, useLocalData]);

  const editPlace = useCallback(async (id: string, p: Partial<VisitedPlace>) => {
    if (useLocalData) {
      await storeLocalPlaces(places.map(x => x.id === id ? { ...x, ...p } : x));
      return;
    }
    try {
      const token = await getToken();
      const existing = places.find(x => x.id === id);
      const next = { ...existing, ...p };
      const row = await apiFetch(`/places/${id}`, token, {
        method: 'PUT',
        body: JSON.stringify(placeApiPayload(next)),
      }).then(mapPlace);
      const photos = p.photos ? await syncPlacePhotos(id, p.photos, token) : existing?.photos;
      const completeRow = { ...row, photos };
      setPlaces(prev => prev.map(x => x.id === id ? completeRow : x));
    } catch (error) {
      console.warn('Cloud edit failed; preserving the updated Bean on this device instead.', error);
      setForceLocalData(true);
      await storeLocalPlaces(places.map(x => x.id === id ? { ...x, ...p } : x));
    }
  }, [getToken, places, storeLocalPlaces, useLocalData]);

  const deletePlace = useCallback(async (id: string) => {
    if (useLocalData) {
      await storeLocalPlaces(places.filter(x => x.id !== id));
      return;
    }
    try {
      const token = await getToken();
      await apiFetch(`/places/${id}`, token, { method: 'DELETE' });
      setPlaces(prev => prev.filter(x => x.id !== id));
    } catch (error) {
      console.warn('Cloud delete failed; removing the Bean from this device instead.', error);
      setForceLocalData(true);
      await storeLocalPlaces(places.filter(x => x.id !== id));
    }
  }, [getToken, places, storeLocalPlaces, useLocalData]);

  // ── Bucket ──────────────────────────────────────────────
  const addBucketItem = useCallback(async (b: Omit<BucketItem, 'id' | 'createdAt'>) => {
    if (useLocalData) {
      setBucketItems(prev => [{ ...b, id: uid(), createdAt: new Date().toISOString() }, ...prev]);
      return;
    }
    const token = await getToken();
    const row = await apiFetch('/bucket', token, { method: 'POST', body: JSON.stringify(b) }).then(mapBucket);
    setBucketItems(prev => [row, ...prev]);
  }, [getToken, useLocalData]);

  const editBucketItem = useCallback(async (id: string, b: Partial<BucketItem>) => {
    if (useLocalData) {
      setBucketItems(prev => prev.map(x => x.id === id ? { ...x, ...b } : x));
      return;
    }
    const token = await getToken();
    const existing = bucketItems.find(x => x.id === id);
    const row = await apiFetch(`/bucket/${id}`, token, { method: 'PUT', body: JSON.stringify({ ...existing, ...b }) }).then(mapBucket);
    setBucketItems(prev => prev.map(x => x.id === id ? row : x));
  }, [getToken, bucketItems, useLocalData]);

  const deleteBucketItem = useCallback(async (id: string) => {
    if (useLocalData) {
      setBucketItems(prev => prev.filter(x => x.id !== id));
      return;
    }
    const token = await getToken();
    await apiFetch(`/bucket/${id}`, token, { method: 'DELETE' });
    setBucketItems(prev => prev.filter(x => x.id !== id));
  }, [getToken, useLocalData]);

  // ── Trips ──────────────────────────────────────────────
  const addTrip = useCallback(async (t: TripDraft) => {
    const itinerary = (t.itinerary ?? []).map(item => ({
      ...item,
      id: 'id' in item ? item.id : uid(),
      votes: 'votes' in item ? item.votes : { mustGo: 0, maybe: 0, skip: 0 },
      comments: 'comments' in item ? item.comments : [],
    })) as ItineraryItem[];
    const payload = { ...t, itinerary };
    if (useLocalData) {
      const row: Trip = { ...payload, id: uid(), shareId: uid(), createdAt: new Date().toISOString() };
      setTrips(prev => [row, ...prev]);
      return row;
    }
    const token = await getToken();
    const row = await apiFetch('/trips', token, { method: 'POST', body: JSON.stringify(payload) }).then(mapTrip);
    const withSeededItems = row.itinerary.length > 0 ? row : { ...row, itinerary };
    if (withSeededItems.itinerary.length > row.itinerary.length) {
      await apiFetch(`/trips/${row.id}`, token, { method: 'PUT', body: JSON.stringify(withSeededItems) });
    }
    setTrips(prev => [withSeededItems, ...prev]);
    return withSeededItems;
  }, [getToken, useLocalData]);

  const editTrip = useCallback(async (id: string, t: Partial<Trip>) => {
    if (useLocalData) {
      setTrips(prev => prev.map(x => x.id === id ? { ...x, ...t } : x));
      return;
    }
    const token = await getToken();
    const existing = trips.find(x => x.id === id);
    const row = await apiFetch(`/trips/${id}`, token, { method: 'PUT', body: JSON.stringify({ ...existing, ...t }) }).then(mapTrip);
    setTrips(prev => prev.map(x => x.id === id ? row : x));
  }, [getToken, trips, useLocalData]);

  const deleteTrip = useCallback(async (id: string) => {
    if (useLocalData) {
      setTrips(prev => prev.filter(x => x.id !== id));
      return;
    }
    const token = await getToken();
    await apiFetch(`/trips/${id}`, token, { method: 'DELETE' });
    setTrips(prev => prev.filter(x => x.id !== id));
  }, [getToken, useLocalData]);

  // ── Travel Blog ─────────────────────────────────────────
  const saveBlogSettings = useCallback(async (settings: Partial<TravelBlogSettings>) => {
    const now = new Date().toISOString();
    const next: TravelBlogSettings = {
      ...blogSettings,
      ...settings,
      updatedAt: now,
      createdAt: blogSettings.createdAt || now,
    };
    const requiresCloud = next.privacy !== 'private';
    if (requiresCloud && useLocalData) {
      throw new Error('Sign in to publish your Travel Bean Blog for public readers.');
    }
    if (!useLocalData) {
      try {
        const token = await getToken();
        const saved = mapBlogSettings(await blogApiFetch('/settings', token, {
          method: 'PUT',
          body: JSON.stringify(next),
        }));
        if (saved) {
          setBlogSettings(saved);
          await AsyncStorage.setItem(BLOG_SETTINGS_STORAGE_KEY, JSON.stringify(saved));
          return saved;
        }
      } catch (error) {
        console.warn('Cloud blog settings save failed; preserving on this device instead.', error);
        if (requiresCloud) {
          throw error;
        }
      }
    }
    await storeBlogSettings(next);
    return next;
  }, [blogSettings, getToken, storeBlogSettings, useLocalData]);

  const createBlogDraftFromPlace = useCallback(async (placeId: string) => {
    const place = places.find(item => item.id === placeId);
    if (!place) throw new Error('Journal entry not found');
    const existing = blogPosts.find(post => post.sourcePlaceId === placeId && post.status === 'draft');
    if (existing) return existing;
    const bloggedBeanIds = new Set(blogPosts.map(post => post.sourcePlaceId).filter(Boolean));
    if (!isPremium && bloggedBeanIds.size >= FREE_BLOG_POST_LIMIT) {
      const error = new Error(`You can make ${FREE_BLOG_POST_LIMIT} Travel Bean blog posts for free. Upgrade to publish more travel stories.`);
      error.name = BLOG_POST_LIMIT_ERROR;
      throw error;
    }
    const draft = generateBlogDraftFromBean(place, blogPosts);
    if (!useLocalData) {
      try {
        const token = await getToken();
        const saved = mapBlogPost(await blogApiFetch('/posts', token, {
          method: 'POST',
          body: JSON.stringify(draft),
        }));
        await storeBlogPosts([saved, ...blogPosts]);
        return saved;
      } catch (error) {
        console.warn('Cloud blog draft save failed; preserving on this device instead.', error);
      }
    }
    await storeBlogPosts([draft, ...blogPosts]);
    return draft;
  }, [blogPosts, getToken, isPremium, places, storeBlogPosts, useLocalData]);

  const editBlogPost = useCallback(async (id: string, post: Partial<BlogPost>) => {
    const now = new Date().toISOString();
    if (!useLocalData) {
      try {
        const token = await getToken();
        const saved = mapBlogPost(await blogApiFetch(`/posts/${encodeURIComponent(id)}`, token, {
          method: 'PUT',
          body: JSON.stringify({ ...post, updatedAt: now }),
        }));
        await storeBlogPosts(blogPosts.map(item => item.id === id ? saved : item));
        return;
      } catch (error) {
        console.warn('Cloud blog post edit failed; preserving on this device instead.', error);
      }
    }
    const next = blogPosts.map(item => {
      if (item.id !== id) return item;
      const requestedTitle = post.title ?? item.title;
      const shouldRegenerateSlug = post.title != null && post.title.trim() !== item.title.trim();
      return {
        ...item,
        ...post,
        title: requestedTitle,
        slug: post.slug ?? (shouldRegenerateSlug ? uniqueBlogSlug(requestedTitle, blogPosts, id) : item.slug),
        updatedAt: now,
      };
    });
    await storeBlogPosts(next);
  }, [blogPosts, getToken, storeBlogPosts, useLocalData]);

  const publishBlogPostById = useCallback(async (id: string, postOverride?: Partial<BlogPost>) => {
    const currentPost = blogPosts.find(item => item.id === id);
    if (!currentPost) {
      throw new Error('Blog post not found.');
    }
    if (!blogSettings.username) {
      throw new Error('Choose a blog username before publishing.');
    }
    if (useLocalData) {
      throw new Error('Sign in to publish your Travel Bean Blog for public readers.');
    }

    const token = await getToken();
    const postToPublish = { ...currentPost, ...postOverride, id };
    const publicSettings = mapBlogSettings(await blogApiFetch('/settings', token, {
      method: 'PUT',
      body: JSON.stringify({ ...blogSettings, privacy: 'public' }),
    }));
    if (publicSettings) await storeBlogSettings(publicSettings);

    let cloudPost: BlogPost;
    try {
      cloudPost = mapBlogPost(await blogApiFetch(`/posts/${encodeURIComponent(id)}`, token, {
        method: 'PUT',
        body: JSON.stringify(postToPublish),
      }));
    } catch {
      cloudPost = mapBlogPost(await blogApiFetch('/posts', token, {
        method: 'POST',
        body: JSON.stringify(postToPublish),
      }));
    }

    const saved = mapBlogPost(await blogApiFetch(`/posts/${encodeURIComponent(cloudPost.id)}/publish`, token, {
      method: 'POST',
      body: JSON.stringify({ privacy: postToPublish.privacy === 'password' ? 'password' : 'public' }),
    }));
    await storeBlogPosts(blogPosts.map(item => item.id === id ? saved : item));
    return saved;
  }, [blogPosts, blogSettings, getToken, storeBlogPosts, storeBlogSettings, useLocalData]);

  const unpublishBlogPost = useCallback(async (id: string) => {
    if (!useLocalData) {
      try {
        const token = await getToken();
        const saved = mapBlogPost(await blogApiFetch(`/posts/${encodeURIComponent(id)}/unpublish`, token, {
          method: 'POST',
          body: JSON.stringify({}),
        }));
        await storeBlogPosts(blogPosts.map(item => item.id === id ? saved : item));
        return;
      } catch (error) {
        console.warn('Cloud blog unpublish failed; preserving on this device instead.', error);
      }
    }
    const now = new Date().toISOString();
    await storeBlogPosts(blogPosts.map(item => item.id === id ? {
      ...item,
      status: 'draft',
      privacy: 'private',
      updatedAt: now,
      publishedAt: null,
    } : item));
  }, [blogPosts, getToken, storeBlogPosts, useLocalData]);

  const deleteBlogPost = useCallback(async (id: string) => {
    if (!useLocalData) {
      try {
        const token = await getToken();
        await blogApiFetch(`/posts/${encodeURIComponent(id)}`, token, { method: 'DELETE' });
      } catch (error) {
        console.warn('Cloud blog delete failed; removing from this device instead.', error);
      }
    }
    await storeBlogPosts(blogPosts.filter(item => item.id !== id));
  }, [blogPosts, getToken, storeBlogPosts, useLocalData]);

  const getBlogPostById = useCallback((id: string) => blogPosts.find(post => post.id === id), [blogPosts]);

  const syncBlogToCloud = useCallback(async () => {
    if (!blogSettings.username) {
      throw new Error('Choose a blog username before publishing.');
    }
    if (useLocalData) {
      throw new Error('Sign in to publish your Travel Bean Blog for public readers.');
    }
    const token = await getToken();
    const savedSettings = mapBlogSettings(await blogApiFetch('/settings', token, {
      method: 'PUT',
      body: JSON.stringify({ ...blogSettings, privacy: 'public' }),
    }));
    if (!savedSettings) {
      throw new Error('Could not publish blog settings.');
    }

    const syncedPosts = await Promise.all(blogPosts.map(async post => {
      let savedPost: BlogPost;
      try {
        savedPost = mapBlogPost(await blogApiFetch(`/posts/${encodeURIComponent(post.id)}`, token, {
          method: 'PUT',
          body: JSON.stringify(post),
        }));
      } catch {
        savedPost = mapBlogPost(await blogApiFetch('/posts', token, {
          method: 'POST',
          body: JSON.stringify(post),
        }));
      }
      if (post.status === 'published') {
        return mapBlogPost(await blogApiFetch(`/posts/${encodeURIComponent(savedPost.id)}/publish`, token, {
          method: 'POST',
          body: JSON.stringify({ privacy: post.privacy === 'password' ? 'password' : 'public' }),
        }));
      }
      return savedPost;
    }));

    await storeBlogSettings(savedSettings);
    await storeBlogPosts(syncedPosts);
    return { settings: savedSettings, posts: syncedPosts };
  }, [blogPosts, blogSettings, getToken, storeBlogPosts, storeBlogSettings, useLocalData]);

  const emailDashboardLink = useCallback(async (email?: string) => {
    if (useLocalData) throw new Error('Cloud account is required');
    const token = await getToken();
    await blogApiFetch('/email-dashboard-link', token, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }, [getToken, useLocalData]);

  // ── Itinerary ──────────────────────────────────────────────
  const addItineraryItem = useCallback(async (tripId: string, item: Omit<ItineraryItem, 'id' | 'votes' | 'comments'>) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    const newItem: ItineraryItem = { ...item, id: uid(), votes: { mustGo: 0, maybe: 0, skip: 0 }, comments: [] };
    const updated = { ...trip, itinerary: [...trip.itinerary, newItem] };
    if (useLocalData) {
      setTrips(prev => prev.map(t => t.id === tripId ? updated : t));
      return;
    }
    const token = await getToken();
    await apiFetch(`/trips/${tripId}`, token, { method: 'PUT', body: JSON.stringify(updated) });
    setTrips(prev => prev.map(t => t.id === tripId ? updated : t));
  }, [getToken, trips, useLocalData]);

  const editItineraryItem = useCallback(async (tripId: string, itemId: string, item: Partial<ItineraryItem>) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    const updated = { ...trip, itinerary: trip.itinerary.map(i => i.id === itemId ? { ...i, ...item } : i) };
    if (useLocalData) {
      setTrips(prev => prev.map(t => t.id === tripId ? updated : t));
      return;
    }
    const token = await getToken();
    await apiFetch(`/trips/${tripId}`, token, { method: 'PUT', body: JSON.stringify(updated) });
    setTrips(prev => prev.map(t => t.id === tripId ? updated : t));
  }, [getToken, trips, useLocalData]);

  const deleteItineraryItem = useCallback(async (tripId: string, itemId: string) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    const updated = { ...trip, itinerary: trip.itinerary.filter(i => i.id !== itemId) };
    if (useLocalData) {
      setTrips(prev => prev.map(t => t.id === tripId ? updated : t));
      return;
    }
    const token = await getToken();
    await apiFetch(`/trips/${tripId}`, token, { method: 'PUT', body: JSON.stringify(updated) });
    setTrips(prev => prev.map(t => t.id === tripId ? updated : t));
  }, [getToken, trips, useLocalData]);

  const addComment = useCallback(async (tripId: string, itemId: string, comment: Omit<TripComment, 'id' | 'createdAt'>) => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    const newComment: TripComment = { ...comment, id: uid(), createdAt: new Date().toISOString() };
    const updated = {
      ...trip,
      itinerary: trip.itinerary.map(i => i.id === itemId ? { ...i, comments: [...i.comments, newComment] } : i),
    };
    if (useLocalData) {
      setTrips(prev => prev.map(t => t.id === tripId ? updated : t));
      return;
    }
    const token = await getToken();
    await apiFetch(`/trips/${tripId}`, token, { method: 'PUT', body: JSON.stringify(updated) });
    setTrips(prev => prev.map(t => t.id === tripId ? updated : t));
  }, [getToken, trips, useLocalData]);

  const voteOnItem = useCallback(async (tripId: string, itemId: string, vote: 'mustGo' | 'maybe' | 'skip') => {
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;
    const updated = {
      ...trip,
      itinerary: trip.itinerary.map(i => i.id === itemId ? { ...i, votes: { ...i.votes, [vote]: i.votes[vote] + 1 } } : i),
    };
    if (useLocalData) {
      setTrips(prev => prev.map(t => t.id === tripId ? updated : t));
      return;
    }
    const token = await getToken();
    await apiFetch(`/trips/${tripId}`, token, { method: 'PUT', body: JSON.stringify(updated) });
    setTrips(prev => prev.map(t => t.id === tripId ? updated : t));
  }, [getToken, trips, useLocalData]);

  const getTripById = useCallback((id: string) => trips.find(t => t.id === id), [trips]);

  const getUniqueCountries = useCallback(() => {
    return [...new Set(places.map(p => p.country))];
  }, [places]);

  const refreshEntitlements = useCallback(async () => {
    try {
      await refetchCustomerInfo();
      const token = await getToken();
      const ent = await apiFetch('/entitlements', token);
      setApiIsPro((ent as any).isPro === true);
    } catch {}
  }, [getToken, refetchCustomerInfo]);

  const activatePro = useCallback(async () => {
    await activatePremiumPlan('monthly');
  }, [activatePremiumPlan]);

  return (
    <AppContext.Provider value={{
      places, bucketItems, trips, blogSettings, blogPosts, loading,
      isPro, isPremium,
      subscriptionPlan: premiumState.subscriptionPlan,
      beansCreatedThisMonth: premiumState.beansCreatedThisMonth,
      monthlyBeanLimit: premiumState.monthlyBeanLimit,
      freeBeansRemaining,
      premiumSince: premiumState.premiumSince,
      canCreateBean,
      userProfile,
      refreshEntitlements, activatePro, activatePremiumPlan, deactivatePremiumMode, recordBeanCreated, updateMarketingConsent,
      addPlace, editPlace, deletePlace,
      addBucketItem, editBucketItem, deleteBucketItem,
      addTrip, editTrip, deleteTrip,
      saveBlogSettings, createBlogDraftFromPlace, editBlogPost, publishBlogPostById, unpublishBlogPost, deleteBlogPost, getBlogPostById, syncBlogToCloud, emailDashboardLink,
      addItineraryItem, editItineraryItem, deleteItineraryItem,
      addComment, voteOnItem,
      getTripById, getUniqueCountries,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
