import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { lookupCoords } from '@/constants/cityCoords';
import { useSubscription } from '@/services/revenuecat';
import { BeanPhoto, BlogPost, BucketItem, BucketStatus, BucketTag, TravelBlogSettings, Trip, ItineraryItem, TripComment, VisitedPlace } from '@/types';
import { encodePersistedBeanNotes, hydratePersistedBean } from '@/utils/beanPersistence';
import { defaultPremiumState, normalizePremiumState, remainingFreeBeans, type SubscriptionPlan, type UserPremiumState } from '@/utils/premium';
import { createDefaultBlogSettings, generateBlogDraftFromBean, publishBlogPost, uniqueBlogSlug } from '@/utils/travelBlog';
import { useTravelAuth, useTravelUser } from '@/hooks/useTravelAuth';

function uid() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const localPreview = process.env.EXPO_PUBLIC_LOCAL_PREVIEW === '1';
const PREMIUM_STORAGE_KEY = 'travel-bean-premium-state';
const GUEST_PLACES_STORAGE_KEY = 'travel-bean-guest-places';
const BLOG_SETTINGS_STORAGE_KEY = 'travel-bean-blog-settings';
const BLOG_POSTS_STORAGE_KEY = 'travel-bean-blog-posts';
const PUBLIC_BLOG_IMAGE_MAX_WIDTH = 1280;
const PUBLIC_BLOG_IMAGE_QUALITY = 0.68;
const PUBLIC_BLOG_IMAGE_PIPELINE_VERSION = '2026-07-05-create-time-jpeg-v1';
const PUBLIC_BLOG_MAX_PUBLISH_PHOTOS = 4;
const PUBLIC_BLOG_PHOTO_READ_TIMEOUT_MS = 60000;
const PUBLIC_BLOG_PHOTO_PREP_TIMEOUT_MS = 90000;
const PUBLIC_BLOG_PHOTO_UPLOAD_TIMEOUT_MS = 120000;

export const BLOG_PUBLISHING_PREMIUM_ERROR = 'BLOG_PUBLISHING_PREMIUM_REQUIRED';

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
    originalFileName: r.originalFileName ?? r.original_file_name ?? undefined,
    compressedUrl: r.compressedUrl ?? r.compressed_url ?? undefined,
    thumbnailUrl: r.thumbnailUrl ?? r.thumbnail_url ?? undefined,
    blogImageUrl: r.blogImageUrl ?? r.blog_image_url ?? undefined,
    width: r.width ?? undefined,
    height: r.height ?? undefined,
    uploadStatus: r.uploadStatus ?? r.upload_status ?? undefined,
    order: r.order ?? undefined,
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

function absolutePhotoFetchUrl(uri: string) {
  if (/^(https?:|file:|blob:|asset-library:|ph:)/i.test(uri)) return uri;
  if (uri.startsWith('/api/')) {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return domain ? `https://${domain}${uri}` : uri;
  }
  return uri;
}

function apiPathFromPhotoUrl(uri: string | undefined) {
  if (!uri) return '';
  try {
    const parsed = new URL(uri, 'https://travelbean.local');
    return parsed.pathname;
  } catch {
    return uri.split('?')[0];
  }
}

function isPrivateBeanPhotoUrl(uri: string | undefined) {
  return /^\/api\/bean\/photos\/img\//i.test(apiPathFromPhotoUrl(uri));
}

function isPublicBlogPhotoUrl(uri: string | undefined) {
  return /^\/api\/blog\/public\/images\//i.test(apiPathFromPhotoUrl(uri));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      value => {
        clearTimeout(timeout);
        resolve(value);
      },
      error => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function readPhotoBlob(uri: string, token?: string | null) {
  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', absolutePhotoFetchUrl(uri), true);
    xhr.responseType = 'blob';
    xhr.timeout = PUBLIC_BLOG_PHOTO_READ_TIMEOUT_MS;
    if (token && isPrivateBeanPhotoUrl(uri)) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.onload = () => {
      if ((xhr.status >= 200 && xhr.status < 300) || (xhr.status === 0 && xhr.response)) {
        resolve(xhr.response as Blob);
        return;
      }
      reject(new Error(`Could not read the selected photo (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Could not read the selected photo'));
    xhr.ontimeout = () => reject(new Error('Reading the selected photo took too long'));
    xhr.send();
  });
}

function shouldUploadForPublicBlog(uri: string | undefined) {
  if (!uri) return false;
  if (isPublicBlogPhotoUrl(uri)) return false;
  if (isPrivateBeanPhotoUrl(uri)) return true;
  if (/^https?:\/\//i.test(uri)) return false;
  return true;
}

function publicUploadPhotoId(photoId: string) {
  const clean = photoId.replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
  return clean.startsWith('public-') ? clean : `public-${clean || uid()}`;
}

function publicBlogImagePath(photoId: string) {
  return `/api/blog/public/images/${encodeURIComponent(photoId)}`;
}

function cleanPhotoForPublicSync(photo: BlogPost['photos'][number]): BlogPost['photos'][number] {
  const imageUrl = photo.imageUrl;
  const thumbnailUrl = isPublicBlogPhotoUrl(photo.thumbnailUrl) || /^https?:\/\//i.test(photo.thumbnailUrl ?? '')
    ? photo.thumbnailUrl
    : undefined;
  return {
    id: photo.id,
    imageUrl,
    caption: photo.caption,
    included: photo.included !== false,
    originalFileName: photo.originalFileName,
    thumbnailUrl,
    width: photo.width,
    height: photo.height,
    uploadStatus: 'uploaded',
    order: photo.order,
  };
}

async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read photo data'));
    reader.onerror = () => reject(new Error('Could not read photo data'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlBase64(dataUrl: string) {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

async function blobToBase64(blob: Blob) {
  return dataUrlBase64(await blobToDataUrl(blob));
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error('Could not read photo data');
  return response.blob();
}

async function optimizedWebPhotoDataUrl(blob: Blob) {
  if (typeof document === 'undefined' || typeof window === 'undefined' || typeof URL === 'undefined') {
    return blobToDataUrl(blob);
  }
  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new window.Image();
    let finished = false;
    const finish = (callback: () => void) => {
      if (finished) return;
      finished = true;
      URL.revokeObjectURL(objectUrl);
      callback();
    };

    image.onload = () => {
      const scale = Math.min(1, PUBLIC_BLOG_IMAGE_MAX_WIDTH / Math.max(image.width, 1));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        finish(() => reject(new Error('Could not optimize photo')));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        nextBlob => {
          if (!nextBlob) {
            finish(() => reject(new Error('Could not optimize photo')));
            return;
          }
          blobToDataUrl(nextBlob).then(
            dataUrl => finish(() => resolve(dataUrl)),
            error => finish(() => reject(error)),
          );
        },
        'image/jpeg',
        PUBLIC_BLOG_IMAGE_QUALITY,
      );
    };
    image.onerror = () => finish(() => reject(new Error('Could not optimize photo')));
    image.src = objectUrl;
  });
}

async function writeTempPhotoForOptimization(uri: string, token?: string | null) {
  const blob = await readPhotoBlob(uri, token);
  const base64 = await blobToBase64(blob);
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) throw new Error('Could not prepare a temporary photo file');
  const tempUri = `${directory}travel-bean-blog-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  await FileSystem.writeAsStringAsync(tempUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  return tempUri;
}

async function optimizedNativePhotoDataUrl(uri: string, token?: string | null) {
  let sourceUri = uri;
  let tempUri: string | null = null;
  try {
    if (!/^file:\/\//i.test(uri) && !/^data:image\//i.test(uri)) {
      tempUri = await writeTempPhotoForOptimization(uri, token);
      sourceUri = tempUri;
    }
    const result = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: PUBLIC_BLOG_IMAGE_MAX_WIDTH } }],
      {
        base64: true,
        compress: PUBLIC_BLOG_IMAGE_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    if (!result.base64) throw new Error('Could not optimize photo data');
    return `data:image/jpeg;base64,${result.base64}`;
  } finally {
    if (tempUri) {
      FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => undefined);
    }
  }
}

async function optimizedNativePhotoFile(uri: string, token?: string | null) {
  let sourceUri = uri;
  let tempUri: string | null = null;
  try {
    if (!/^file:\/\//i.test(uri) && !/^data:image\//i.test(uri)) {
      tempUri = await writeTempPhotoForOptimization(uri, token);
      sourceUri = tempUri;
    }
    const result = await ImageManipulator.manipulateAsync(
      sourceUri,
      [{ resize: { width: PUBLIC_BLOG_IMAGE_MAX_WIDTH } }],
      {
        compress: PUBLIC_BLOG_IMAGE_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    return {
      uri: result.uri,
      contentType: 'image/jpeg',
      cleanup: async () => {
        if (result.uri && result.uri !== uri) {
          await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
        }
        if (tempUri) {
          await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => undefined);
        }
      },
    };
  } catch (error) {
    if (tempUri) {
      FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => undefined);
    }
    throw error;
  }
}

async function photoDataUrl(uri: string, token?: string | null) {
  if (Platform.OS !== 'web') {
    try {
      return await optimizedNativePhotoDataUrl(uri, token);
    } catch (error) {
      console.warn('Could not optimize blog photo before upload', error);
      throw new Error('Could not optimize the selected photo for publishing. Please re-add the photo and try again.');
    }
  }
  const contentType = photoContentType(uri);
  if (/^data:image\//i.test(uri)) {
    if (Platform.OS === 'web') {
      try {
        const blob = await dataUrlToBlob(uri);
        return await withTimeout(
          optimizedWebPhotoDataUrl(blob),
          PUBLIC_BLOG_PHOTO_PREP_TIMEOUT_MS,
          'Preparing the photo took too long',
        );
      } catch (error) {
        console.warn('Could not optimize web blog photo before upload', error);
      }
    }
    return uri;
  }
  if (Platform.OS !== 'web' && /^file:\/\//i.test(uri)) {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:${contentType};base64,${base64}`;
  }
  const blob = await readPhotoBlob(uri, token);
  if (Platform.OS === 'web') {
    try {
      return await withTimeout(
        optimizedWebPhotoDataUrl(blob),
        PUBLIC_BLOG_PHOTO_PREP_TIMEOUT_MS,
        'Preparing the photo took too long',
      );
    } catch (error) {
      console.warn('Could not optimize web blog photo before upload', error);
    }
  }
  return blobToDataUrl(blob);
}

async function uploadPublicBlogPhotoForSync(
  settings: TravelBlogSettings,
  post: BlogPost,
  photo: BlogPost['photos'][number],
  uploadUri: string,
  token?: string | null,
) {
  const username = settings.username?.trim();
  if (!username) throw new Error('Choose a blog username before publishing.');
  const publicPhotoId = publicUploadPhotoId(photo.id);
  console.log('[PHOTO_UPLOAD]', 'public blog upload starting', {
    postId: post.id,
    photoId: photo.id,
    publicPhotoId,
    uriKind: isPrivateBeanPhotoUrl(uploadUri) ? 'private-bean' : uploadUri.split(':')[0],
  });

  try {
    const query = new URLSearchParams({
      username,
      sourcePlaceId: post.sourcePlaceId || post.id,
      photoId: publicPhotoId,
      caption: photo.caption ?? '',
    });
    const uploadUrl = `${getApiRoot()}/blog/public-sync/photo?${query.toString()}`;
    const contentType = photoContentType(uploadUri);
    let payload: any;
    if (Platform.OS !== 'web') {
      const optimized = await withTimeout(
        optimizedNativePhotoFile(uploadUri, token),
        PUBLIC_BLOG_PHOTO_PREP_TIMEOUT_MS,
        'Preparing one of the blog photos took too long',
      );
      const nativeUpload = await withTimeout(
        FileSystem.uploadAsync(uploadUrl, optimized.uri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { 'Content-Type': optimized.contentType },
        }),
        PUBLIC_BLOG_PHOTO_UPLOAD_TIMEOUT_MS,
        'Uploading one of the blog photos took too long',
      ).finally(() => optimized.cleanup());
      payload = JSON.parse(nativeUpload.body || '{}');
      if (nativeUpload.status < 200 || nativeUpload.status >= 300) {
        throw new Error(payload?.error ?? `Photo upload failed (${nativeUpload.status})`);
      }
    } else {
      const blob = await withTimeout(
        readPhotoBlob(uploadUri, token),
        PUBLIC_BLOG_PHOTO_READ_TIMEOUT_MS,
        'Reading one of the blog photos took too long',
      );
      const response = await withTimeout(
        fetch(uploadUrl, {
          method: 'POST',
          headers: {
            'Content-Type': contentType,
          },
          body: blob,
        }),
        PUBLIC_BLOG_PHOTO_UPLOAD_TIMEOUT_MS,
        'Uploading one of the blog photos took too long',
      );
      payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? `Photo upload failed (${response.status})`);
      }
    }
    if (!payload?.success || !payload?.photo?.imageUrl) {
      throw new Error(payload?.error ?? 'Photo upload failed');
    }
    console.log('[PHOTO_UPLOAD]', 'public blog upload complete', {
      postId: post.id,
      photoId: photo.id,
      publicPhotoId,
      imageUrl: payload.photo.imageUrl,
    });
    return {
      ...photo,
      id: payload.photo.id ?? publicPhotoId,
      imageUrl: payload.photo.imageUrl,
      compressedUrl: payload.photo.imageUrl,
      thumbnailUrl: payload.photo.imageUrl,
      blogImageUrl: payload.photo.imageUrl,
      uploadStatus: 'uploaded' as const,
    };
  } catch (error) {
    console.error('[PHOTO_UPLOAD_ERROR]', error, {
      postId: post.id,
      photoId: photo.id,
      publicPhotoId,
    });
    throw error;
  }
}

async function embedPublicBlogPhotoForSync(
  post: BlogPost,
  photo: BlogPost['photos'][number],
  uploadUri: string,
  token?: string | null,
) {
  const publicPhotoId = publicUploadPhotoId(photo.id);
  console.log('[PHOTO_UPLOAD]', 'embedding compressed public blog photo', {
    postId: post.id,
    photoId: photo.id,
    publicPhotoId,
  });
  const imageData = await withTimeout(
    photoDataUrl(uploadUri, token),
    PUBLIC_BLOG_PHOTO_PREP_TIMEOUT_MS,
    'Preparing one of the blog photos took too long',
  );
  return {
    ...cleanPhotoForPublicSync({
      ...photo,
      id: publicPhotoId,
      imageUrl: publicBlogImagePath(publicPhotoId),
      compressedUrl: publicBlogImagePath(publicPhotoId),
      thumbnailUrl: publicBlogImagePath(publicPhotoId),
      blogImageUrl: publicBlogImagePath(publicPhotoId),
      uploadStatus: 'uploaded',
    }),
    imageData,
  } as BlogPost['photos'][number] & { imageData: string };
}

async function prepareBlogPostsForPublicSync(settings: TravelBlogSettings, posts: BlogPost[], token?: string | null) {
  const prepared: BlogPost[] = [];
  for (const post of posts) {
    const candidatePhotos = post.photos
      .slice(0, 8)
      .filter(photo => photo.included !== false || photo.id === post.coverPhotoId);
    const coverPhoto = candidatePhotos.find(photo => photo.id === post.coverPhotoId);
    const publicPhotos = [
      ...(coverPhoto ? [coverPhoto] : []),
      ...candidatePhotos.filter(photo => photo.id !== coverPhoto?.id),
    ].slice(0, PUBLIC_BLOG_MAX_PUBLISH_PHOTOS);
    const photos: BlogPost['photos'] = [];
    const originalToPublicId = new Map<string, string>();
    for (const photo of publicPhotos) {
      const uploadUri = photo.blogImageUrl ?? photo.compressedUrl ?? photo.imageUrl;
      if (shouldUploadForPublicBlog(uploadUri)) {
        try {
          const uploaded = await uploadPublicBlogPhotoForSync(settings, post, photo, uploadUri, token);
          originalToPublicId.set(photo.id, uploaded.id);
          photos.push(uploaded);
        } catch (error) {
          console.warn('Could not prepare blog photo for upload', PUBLIC_BLOG_IMAGE_PIPELINE_VERSION, error);
          throw new Error('Could not prepare one of the blog photos. Re-add the photo and publish again.');
        }
      } else {
        photos.push(cleanPhotoForPublicSync(photo));
      }
    }
    const publicCoverPhotoId = post.coverPhotoId ? (originalToPublicId.get(post.coverPhotoId) ?? post.coverPhotoId) : undefined;
    const syncedCoverPhoto = photos.find(photo => photo.id === publicCoverPhotoId) ?? photos[0];
    prepared.push({
      ...post,
      photos,
      coverPhotoId: syncedCoverPhoto?.id ?? publicCoverPhotoId ?? post.coverPhotoId,
      coverImageUrl: syncedCoverPhoto?.imageUrl ?? post.coverImageUrl,
    } as BlogPost);
  }
  return prepared;
}

async function uploadPlacePhoto(placeId: string, photo: BeanPhoto, token: string | null) {
  const response = await fetch(`${getApiBase()}/photos/upload?placeId=${encodeURIComponent(placeId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': photoContentType(photo.imageUrl),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: await readPhotoBlob(photo.imageUrl, token),
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
    .map(row => {
      const serverPhoto = mapPhoto(row);
      const localPhoto = desired.find(item => item.id === row.id);
      return serverPhoto && localPhoto ? {
        ...serverPhoto,
        blogImageUrl: localPhoto.blogImageUrl ?? serverPhoto.blogImageUrl,
        compressedUrl: localPhoto.compressedUrl ?? serverPhoto.compressedUrl,
        thumbnailUrl: localPhoto.thumbnailUrl ?? serverPhoto.thumbnailUrl,
        width: localPhoto.width ?? serverPhoto.width,
        height: localPhoto.height ?? serverPhoto.height,
        uploadStatus: localPhoto.uploadStatus ?? serverPhoto.uploadStatus,
        order: localPhoto.order ?? serverPhoto.order,
      } : serverPhoto;
    })
    .filter((photo): photo is BeanPhoto => Boolean(photo));

  const uploaded: BeanPhoto[] = [];
  for (const photo of desired.filter(item => !existingIds.has(item.id))) {
    const next = await uploadPlacePhoto(placeId, photo, token);
    if (next) uploaded.push({
      ...next,
      blogImageUrl: photo.blogImageUrl ?? photo.compressedUrl ?? photo.imageUrl,
      compressedUrl: photo.compressedUrl,
      thumbnailUrl: photo.thumbnailUrl ?? photo.blogImageUrl ?? photo.compressedUrl,
      width: photo.width,
      height: photo.height,
      uploadStatus: photo.uploadStatus ?? 'uploaded',
      order: photo.order,
    });
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

async function publishLocalBlogSnapshot(settings: TravelBlogSettings, posts: BlogPost[], token?: string | null): Promise<{ settings: TravelBlogSettings; posts: BlogPost[] }> {
  const syncPosts = await prepareBlogPostsForPublicSync(settings, posts, token);
  const response = await blogApiFetch('/public-sync', null, {
    method: 'POST',
    body: JSON.stringify({
      settings: { ...settings, privacy: 'public' },
      posts: syncPosts,
    }),
  });
  const savedSettings = mapBlogSettings(response.settings);
  if (!savedSettings) {
    throw new Error('Could not publish blog settings.');
  }
  const localById = new Map(posts.map(post => [post.id, post]));
  const syncedPosts = Array.isArray(response.posts)
    ? response.posts.map((row: any) => {
      const synced = mapBlogPost(row);
      const local = localById.get(synced.id);
      if (!local) return synced;
      return {
        ...synced,
        coverPhotoId: synced.coverPhotoId ?? local.coverPhotoId,
        coverImageUrl: synced.coverImageUrl ?? local.coverImageUrl,
        photos: synced.photos?.length ? synced.photos : local.photos.map(cleanPhotoForPublicSync),
      };
    })
    : posts;
  return {
    settings: savedSettings,
    posts: syncedPosts,
  };
}

async function publishLocalBlogPost(settings: TravelBlogSettings, post: BlogPost, token?: string | null): Promise<{ settings: TravelBlogSettings; post: BlogPost }> {
  const [syncPost] = await prepareBlogPostsForPublicSync(settings, [post], token);
  const response = await blogApiFetch('/public-sync', null, {
    method: 'POST',
    body: JSON.stringify({
      settings: { ...settings, privacy: 'public' },
      posts: [syncPost],
      replaceAll: false,
    }),
  });
  const savedSettings = mapBlogSettings(response.settings);
  if (!savedSettings) {
    throw new Error('Could not publish blog settings.');
  }
  const syncedPost = Array.isArray(response.posts) && response.posts[0] ? mapBlogPost(response.posts[0]) : post;
  return {
    settings: savedSettings,
    post: {
      ...syncedPost,
      coverPhotoId: syncedPost.coverPhotoId ?? post.coverPhotoId,
      coverImageUrl: syncedPost.coverImageUrl ?? post.coverImageUrl,
      photos: syncedPost.photos?.length ? syncedPost.photos : post.photos.map(cleanPhotoForPublicSync),
    },
  };
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
          if (uploaded) photos.push({
            ...uploaded,
            blogImageUrl: photo.blogImageUrl ?? photo.compressedUrl ?? photo.imageUrl,
            compressedUrl: photo.compressedUrl,
            thumbnailUrl: photo.thumbnailUrl ?? photo.blogImageUrl ?? photo.compressedUrl,
            width: photo.width,
            height: photo.height,
            uploadStatus: photo.uploadStatus ?? 'uploaded',
            order: photo.order,
          });
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
        if (requiresCloud && !useLocalData) {
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
  }, [blogPosts, getToken, places, storeBlogPosts, useLocalData]);

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
    if (!isPremium) {
      const error = new Error('Publishing your public Travel Bean Blog is a Premium feature. You can keep drafting for free.');
      error.name = BLOG_PUBLISHING_PREMIUM_ERROR;
      throw error;
    }
    const postToPublish = { ...currentPost, ...postOverride, id };
    if (useLocalData) {
      const publishedPost = publishBlogPost(postToPublish, postToPublish.privacy === 'password' ? 'password' : 'public');
      const publishedSettings: TravelBlogSettings = { ...blogSettings, privacy: 'public', updatedAt: new Date().toISOString() };
      const token = await getToken().catch(() => null);
      const synced = await publishLocalBlogPost(publishedSettings, publishedPost, token);
      await storeBlogSettings(synced.settings);
      const savedPost = synced.post;
      await storeBlogPosts(blogPosts.map(item => item.id === id ? savedPost : item));
      return savedPost;
    }

    const token = await getToken();
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
  }, [blogPosts, blogSettings, getToken, isPremium, storeBlogPosts, storeBlogSettings, useLocalData]);

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
    if (!isPremium) {
      const error = new Error('Publishing your public Travel Bean Blog is a Premium feature. You can keep drafting for free.');
      error.name = BLOG_PUBLISHING_PREMIUM_ERROR;
      throw error;
    }
    if (useLocalData) {
      const token = await getToken().catch(() => null);
      const synced = await publishLocalBlogSnapshot(
        { ...blogSettings, privacy: 'public', updatedAt: new Date().toISOString() },
        blogPosts,
        token,
      );
      await storeBlogSettings(synced.settings);
      await storeBlogPosts(synced.posts);
      return synced;
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
  }, [blogPosts, blogSettings, getToken, isPremium, storeBlogPosts, storeBlogSettings, useLocalData]);

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
