import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import type { BeanPhoto } from '@/types';

const PHOTO_DIRECTORY_NAME = 'travel-bean-photos';
const BLOG_PHOTO_DIRECTORY_NAME = 'travel-bean-blog-photos';
const PHOTO_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}${PHOTO_DIRECTORY_NAME}/`
  : null;
const BLOG_PHOTO_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}${BLOG_PHOTO_DIRECTORY_NAME}/`
  : null;
const BEAN_IMAGE_MAX_EDGE = 1600;
const BEAN_IMAGE_QUALITY = 0.74;
const BLOG_IMAGE_MAX_EDGE = 1280;
const BLOG_IMAGE_QUALITY = 0.68;
const BLOG_IMAGE_PIPELINE_VERSION = '2026-07-05-create-time-jpeg-v1';

function isRemoteUri(uri: string) {
  return /^https?:\/\//i.test(uri);
}

function isDataUri(uri: string) {
  return /^data:/i.test(uri);
}

function isAlreadyPersistent(uri: string) {
  return Boolean(
    (PHOTO_DIRECTORY && uri.startsWith(PHOTO_DIRECTORY))
    || (BLOG_PHOTO_DIRECTORY && uri.startsWith(BLOG_PHOTO_DIRECTORY)),
  );
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

async function ensureBlogPhotoDirectory() {
  if (!BLOG_PHOTO_DIRECTORY) return null;
  const info = await FileSystem.getInfoAsync(BLOG_PHOTO_DIRECTORY);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(BLOG_PHOTO_DIRECTORY, { intermediates: true });
  }
  return BLOG_PHOTO_DIRECTORY;
}

async function optimizedJpegFile(
  sourceUri: string,
  destination: string,
  maxEdge: number,
  quality: number,
) {
  let result = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: maxEdge } }],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  if (result.height > maxEdge) {
    const secondPass = await ImageManipulator.manipulateAsync(
      result.uri,
      [{ resize: { height: maxEdge } }],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
    FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
    result = secondPass;
  }

  await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => undefined);
  await FileSystem.copyAsync({ from: result.uri, to: destination });
  FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
  return {
    uri: destination,
    width: result.width,
    height: result.height,
  };
}

async function prepareBlogPhoto(photo: BeanPhoto, sourceUri: string, index: number): Promise<BeanPhoto> {
  if (!sourceUri || isRemoteUri(sourceUri) || isDataUri(sourceUri)) return photo;
  if (photo.blogImageUrl && isAlreadyPersistent(photo.blogImageUrl)) return photo;

  const directory = await ensureBlogPhotoDirectory();
  if (!directory) return photo;

  const existing = await FileSystem.getInfoAsync(sourceUri).catch(() => null);
  if (!existing?.exists) return photo;

  const destination = `${directory}${safePhotoId(photo.id, index)}-${BLOG_IMAGE_PIPELINE_VERSION}.jpg`;
  const optimized = await optimizedJpegFile(sourceUri, destination, BLOG_IMAGE_MAX_EDGE, BLOG_IMAGE_QUALITY);
  return {
    ...photo,
    blogImageUrl: optimized.uri,
    thumbnailUrl: optimized.uri,
    width: photo.width ?? optimized.width,
    height: photo.height ?? optimized.height,
    uploadStatus: 'uploaded',
    order: photo.order ?? index,
  };
}

export async function persistBeanPhoto(photo: BeanPhoto, index = 0): Promise<BeanPhoto> {
  const uri = photo.imageUrl;
  if (!uri || isRemoteUri(uri) || isDataUri(uri)) {
    return prepareBlogPhoto(photo, photo.blogImageUrl ?? uri, index).catch(() => photo);
  }

  const directory = await ensurePhotoDirectory();
  if (!directory) return photo;

  const existing = await FileSystem.getInfoAsync(uri).catch(() => null);
  if (!existing?.exists) return photo;

  const safeId = safePhotoId(photo.id, index);
  const destination = isAlreadyPersistent(uri)
    ? uri
    : `${directory}${Date.now()}-${safeId}.jpg`;
  const optimized = isAlreadyPersistent(uri)
    ? { uri, width: photo.width, height: photo.height }
    : await optimizedJpegFile(uri, destination, BEAN_IMAGE_MAX_EDGE, BEAN_IMAGE_QUALITY);
  const compressedPhoto: BeanPhoto = {
    ...photo,
    imageUrl: optimized.uri,
    compressedUrl: optimized.uri,
    thumbnailUrl: photo.thumbnailUrl ?? optimized.uri,
    width: photo.width ?? optimized.width,
    height: photo.height ?? optimized.height,
    uploadStatus: 'uploaded',
    order: photo.order ?? index,
  };

  try {
    return await prepareBlogPhoto(compressedPhoto, optimized.uri, index);
  } catch (error) {
    console.warn('Could not prepare blog-ready Bean photo', error);
    return compressedPhoto;
  }
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
