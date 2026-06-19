import * as FileSystem from 'expo-file-system/legacy';
import type { BeanPhoto } from '@/types';

const PHOTO_DIRECTORY_NAME = 'travel-bean-photos';
const PHOTO_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}${PHOTO_DIRECTORY_NAME}/`
  : null;

function isRemoteUri(uri: string) {
  return /^https?:\/\//i.test(uri);
}

function isDataUri(uri: string) {
  return /^data:/i.test(uri);
}

function isAlreadyPersistent(uri: string) {
  return Boolean(PHOTO_DIRECTORY && uri.startsWith(PHOTO_DIRECTORY));
}

function photoExtension(uri: string) {
  const clean = uri.split('?')[0].toLowerCase();
  const match = clean.match(/\.(jpe?g|png|webp|heic|heif)$/);
  return match?.[1] ?? 'jpg';
}

function safePhotoId(id: string, index: number) {
  const safe = id.replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-').slice(0, 42);
  return safe || `photo-${index}`;
}

async function ensurePhotoDirectory() {
  if (!PHOTO_DIRECTORY) return null;
  const info = await FileSystem.getInfoAsync(PHOTO_DIRECTORY);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIRECTORY, { intermediates: true });
  }
  return PHOTO_DIRECTORY;
}

export async function persistBeanPhoto(photo: BeanPhoto, index = 0): Promise<BeanPhoto> {
  const uri = photo.imageUrl;
  if (!uri || isRemoteUri(uri) || isDataUri(uri) || isAlreadyPersistent(uri)) {
    return photo;
  }

  const directory = await ensurePhotoDirectory();
  if (!directory) return photo;

  const existing = await FileSystem.getInfoAsync(uri).catch(() => null);
  if (!existing?.exists) return photo;

  const extension = photoExtension(uri);
  const destination = `${directory}${Date.now()}-${safePhotoId(photo.id, index)}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return { ...photo, imageUrl: destination };
}

export async function persistBeanPhotos(photos: BeanPhoto[]): Promise<BeanPhoto[]> {
  const persisted: BeanPhoto[] = [];
  for (let index = 0; index < photos.length; index += 1) {
    try {
      persisted.push(await persistBeanPhoto(photos[index], index));
    } catch (error) {
      console.warn('Could not persist selected Bean photo', error);
      persisted.push(photos[index]);
    }
  }
  return persisted;
}
