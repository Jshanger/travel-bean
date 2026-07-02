import type { BlogPost, BlogPostPhoto, BlogPrivacy, TravelBlogSettings, VisitedPlace } from '../types';
import { beanTitle, formatDate, journalMemoryText, primaryPhoto } from './travelBeanMvp';

const DEFAULT_BLOG_TITLE = 'My Travel Bean Blog';

export function createDefaultBlogSettings(now = new Date().toISOString()): TravelBlogSettings {
  return {
    id: `blog-${now}`,
    username: '',
    title: DEFAULT_BLOG_TITLE,
    intro: 'A growing collection of places, photos, and memories from my travels.',
    privacy: 'private',
    createdAt: now,
    updatedAt: now,
  };
}

export function sanitizeBlogUsername(value: string) {
  return value
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 24);
}

export function formatPublicUsername(value: string) {
  const username = sanitizeBlogUsername(value);
  return username ? `@${username}` : '@travelbean';
}

export function blogPath(settings: TravelBlogSettings, post?: Pick<BlogPost, 'slug'>) {
  const username = sanitizeBlogUsername(settings.username);
  if (!username) return '';
  return post ? `/@${username}/${post.slug}` : `/@${username}`;
}

export function publicBlogUrl(settings: TravelBlogSettings, post?: Pick<BlogPost, 'slug'>) {
  const path = blogPath(settings, post);
  if (!path) return '';
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}${path}`;
  if (typeof window !== 'undefined' && window.location?.origin) return `${window.location.origin}${path}`;
  return `https://travelbean.app${path}`;
}

export function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'travel-memory';
}

export function uniqueBlogSlug(title: string, existingPosts: BlogPost[], ignorePostId?: string) {
  const base = slugify(title);
  const used = new Set(existingPosts.filter(post => post.id !== ignorePostId).map(post => post.slug));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

export function generateBlogDraftFromBean(bean: VisitedPlace, existingPosts: BlogPost[] = [], now = new Date().toISOString()): BlogPost {
  const title = beanTitle(bean);
  const story = journalMemoryText(bean);
  const longEntry = extractLongEntry(bean.notes);
  const photos = blogPhotos(bean);
  const cover = photos[0];
  const subtitle = longEntry && story ? story : `${formatDate(bean.dateVisited)} in ${bean.name}`;
  const opening = longEntry || story || `On ${formatDate(bean.dateVisited)}, I saved this memory from ${bean.name}, ${bean.country}.`;
  const fallbackDetail = story || longEntry
    ? ''
    : `This is the place to add the parts the photos cannot quite hold yet: who was nearby, what was happening around me, what I noticed first, and the small details I want to remember later.`;
  const bodyParts = [
    longEntry || story || opening,
    fallbackDetail,
  ].filter(Boolean);

  return {
    id: `blog-post-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    sourcePlaceId: bean.id,
    status: 'draft',
    privacy: 'private',
    slug: uniqueBlogSlug(title, existingPosts),
    title,
    subtitle,
    opening,
    body: bodyParts.join('\n\n'),
    coverPhotoId: cover?.id,
    coverImageUrl: cover?.imageUrl ?? primaryPhoto(bean),
    photos,
    place: bean.name,
    country: bean.country,
    city: bean.city,
    dateVisited: bean.dateVisited,
    category: categoryLabel(bean.category),
    tags: buildTags(bean),
    hideExactLocation: false,
    hideDate: false,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
  };
}

export function publishBlogPost(post: BlogPost, privacy: BlogPrivacy = post.privacy === 'password' ? 'password' : 'public') {
  const now = new Date().toISOString();
  return {
    ...post,
    status: 'published' as const,
    privacy,
    updatedAt: now,
    publishedAt: post.publishedAt ?? now,
  };
}

function blogPhotos(bean: VisitedPlace): BlogPostPhoto[] {
  const source = bean.photos?.length ? bean.photos : [{ id: `${bean.id}-cover`, imageUrl: primaryPhoto(bean) }];
  const seen = new Set<string>();
  return source
    .filter(photo => {
      if (!photo.imageUrl || seen.has(photo.imageUrl)) return false;
      seen.add(photo.imageUrl);
      return true;
    })
    .slice(0, 8)
    .map(photo => ({
      id: photo.id,
      imageUrl: photo.imageUrl,
      caption: photo.caption,
      included: true,
    }));
}

function extractLongEntry(notes: string) {
  return notes
    .split('More notes:\n')[1]
    ?.split('\n\nMood:')[0]
    ?.split('\n\nLayout:')[0]
    ?.trim() ?? '';
}

function buildTags(bean: VisitedPlace) {
  return Array.from(new Set([
    bean.country,
    bean.city,
    bean.name,
    categoryLabel(bean.category),
    ...(bean.moodTags ?? []),
  ]
    .map(tag => tag?.trim())
    .filter((tag): tag is string => Boolean(tag))))
    .slice(0, 8);
}

function categoryLabel(category: string) {
  return category
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
