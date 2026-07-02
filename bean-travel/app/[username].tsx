import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SocialShareSheet, { type SocialSharePayload } from '@/components/SocialShareSheet';
import { BlogPost, TravelBlogSettings } from '@/types';
import { blogPath, formatPublicUsername, publicBlogUrl, sanitizeBlogUsername } from '@/utils/travelBlog';
import { formatDate } from '@/utils/travelBeanMvp';

const INK = '#2A1714';
const MUTED = '#7B6258';
const ORANGE = '#F26A2E';
const PAPER = '#FFF8EF';
const CARD = '#FFFDF8';
const BORDER = '#F1D7C5';

export default function PublicBlogHome() {
  const router = useRouter();
  const params = useLocalSearchParams<{ username?: string }>();
  const [remoteBlog, setRemoteBlog] = useState<{ settings: TravelBlogSettings; posts: BlogPost[] } | null>(null);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [sharePayload, setSharePayload] = useState<SocialSharePayload | null>(null);
  const requested = String(params.username ?? '');
  const username = sanitizeBlogUsername(requested);
  const isBlogRoute = requested.startsWith('@');
  const activeSettings = remoteBlog?.settings;
  const posts = useMemo(() => (remoteBlog?.posts ?? [])
    .filter(post => post.status === 'published' && post.privacy !== 'private')
    .sort((a, b) => (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt)), [remoteBlog?.posts]);
  const places = Array.from(new Set(posts.map(post => `${post.place}, ${post.country}`))).slice(0, 8);
  const blogUrl = activeSettings ? publicBlogUrl(activeSettings) : '';

  async function shareBlog() {
    if (!activeSettings) return;
    setSharePayload({
      url: publicBlogUrl(activeSettings),
      title: activeSettings.title || 'Travel Bean Blog',
      text: activeSettings.intro || 'My Travel Bean Blog',
      kind: 'blog',
    });
  }

  async function sharePost(post: BlogPost) {
    if (!activeSettings) return;
    setSharePayload({
      url: publicBlogUrl(activeSettings, post),
      title: post.title,
      text: post.subtitle || activeSettings.title,
      mediaUrl: post.coverImageUrl,
      kind: 'post',
    });
  }

  useEffect(() => {
    let mounted = true;
    if (!isBlogRoute || !username) {
      setRemoteLoaded(true);
      return () => {
        mounted = false;
      };
    }
    setRemoteLoaded(false);
    fetch(`${apiRoot()}/blog/public/${encodeURIComponent(username)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!mounted) return;
        setRemoteBlog(data);
      })
      .catch(() => {
        if (mounted) setRemoteBlog(null);
      })
      .finally(() => {
        if (mounted) setRemoteLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [isBlogRoute, username]);

  if (!isBlogRoute || (!activeSettings && remoteLoaded)) {
    return <NotFound />;
  }

  if (!activeSettings) {
    return <LoadingBlog />;
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.nav}>
        <View style={styles.navBrand}>
          <View style={styles.brandDot} />
          <Text style={styles.brand}>Travel Bean Blog</Text>
        </View>
        <View style={styles.navActions}>
          <TouchableOpacity style={styles.navButton} onPress={() => router.push('/blog' as any)} activeOpacity={0.86}>
            <Feather name="arrow-left" size={14} color={ORANGE} />
            <Text style={styles.navButtonText}>Back to app</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButtonPrimary} onPress={shareBlog} activeOpacity={0.86}>
            <Feather name="share-2" size={14} color="#fff" />
            <Text style={styles.navButtonPrimaryText}>Share Blog</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.hero}>
        <Text style={styles.kicker}>{formatPublicUsername(activeSettings.username)}</Text>
        <Text style={styles.heroTitle}>{activeSettings.title || 'My Travel Bean Blog'}</Text>
        <Text style={styles.heroText}>{activeSettings.intro}</Text>
        <Text style={styles.publicUrl}>{blogUrl}</Text>
      </View>

      {posts[0] ? <FeaturedPost post={posts[0]} onPress={() => router.push(blogPath(activeSettings, posts[0]) as any)} onShare={() => sharePost(posts[0])} /> : (
        <View style={styles.emptyCard}>
          <Feather name="lock" size={28} color={ORANGE} />
          <Text style={styles.emptyTitle}>No public stories yet</Text>
          <Text style={styles.emptyText}>Published Travel Bean stories will appear here.</Text>
        </View>
      )}

      {posts.length > 1 ? (
        <>
          <Text style={styles.sectionTitle}>Latest Posts</Text>
          <View style={styles.postGrid}>
            {posts.slice(1).map(post => (
              <PostCard key={post.id} post={post} onPress={() => router.push(blogPath(activeSettings, post) as any)} onShare={() => sharePost(post)} />
            ))}
          </View>
        </>
      ) : null}

      {places.length ? (
        <>
          <Text style={styles.sectionTitle}>Places</Text>
          <View style={styles.placeWrap}>
            {places.map(place => <Text key={place} style={styles.placePill}>{place}</Text>)}
          </View>
        </>
      ) : null}
      </ScrollView>
      <SocialShareSheet visible={Boolean(sharePayload)} payload={sharePayload} onClose={() => setSharePayload(null)} />
    </>
  );
}

function FeaturedPost({ post, onPress, onShare }: { post: BlogPost; onPress: () => void; onShare: () => void }) {
  return (
    <TouchableOpacity style={styles.featured} onPress={onPress} activeOpacity={0.9}>
      {post.coverImageUrl ? <Image source={{ uri: post.coverImageUrl }} style={styles.featuredImage} contentFit="cover" contentPosition="top center" /> : null}
      <View style={styles.featuredBody}>
        <Text style={styles.postMeta}>{post.category} · {post.hideDate ? 'Date hidden' : formatDate(post.dateVisited)}</Text>
        <Text style={styles.featuredTitle}>{post.title}</Text>
        <Text style={styles.postExcerpt} numberOfLines={3}>{post.subtitle || post.opening}</Text>
        <View style={styles.readRow}>
          <Text style={styles.readText}>{post.privacy === 'password' ? 'Password protected' : 'Read story'}</Text>
          <Feather name="arrow-right" size={16} color={ORANGE} />
        </View>
        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionPill} onPress={onShare} activeOpacity={0.86}>
            <Feather name="share-2" size={14} color={ORANGE} />
            <Text style={styles.actionPillText}>Share Post</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function PostCard({ post, onPress, onShare }: { post: BlogPost; onPress: () => void; onShare: () => void }) {
  return (
    <TouchableOpacity style={styles.postCard} onPress={onPress} activeOpacity={0.88}>
      {post.coverImageUrl ? <Image source={{ uri: post.coverImageUrl }} style={styles.postImage} contentFit="cover" contentPosition="top center" /> : null}
      <View style={styles.postBody}>
        <Text style={styles.postMeta}>{post.place}, {post.country}</Text>
        <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
        <Text style={styles.postExcerpt} numberOfLines={2}>{post.subtitle}</Text>
        <View style={styles.cardActionRow}>
          <TouchableOpacity style={styles.iconAction} onPress={onShare} activeOpacity={0.86}>
            <Feather name="share-2" size={14} color={ORANGE} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function NotFound() {
  return (
    <View style={[styles.screen, styles.notFound]}>
      <Text style={styles.emptyTitle}>This Travel Bean Blog is not public yet</Text>
      <Text style={styles.emptyText}>Ask the blogger to publish from their Blog Dashboard.</Text>
    </View>
  );
}

function LoadingBlog() {
  return (
    <View style={[styles.screen, styles.notFound]}>
      <Text style={styles.emptyTitle}>Loading Travel Bean blog</Text>
    </View>
  );
}

function apiRoot() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  if (typeof window !== 'undefined' && window.location?.origin) return `${window.location.origin}/api`;
  return '/api';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAPER },
  content: { width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 34 : 56, paddingBottom: 70 },
  nav: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' },
  navBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  brandDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: ORANGE },
  brand: { color: INK, fontSize: 18, fontFamily: 'Inter_700Bold' },
  navButton: { minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  navButtonText: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold' },
  navButtonPrimary: { minHeight: 38, borderRadius: 19, backgroundColor: ORANGE, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  navButtonPrimaryText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  hero: { paddingVertical: 28, borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 22 },
  kicker: { color: ORANGE, fontSize: 13, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  heroTitle: { color: INK, fontSize: Platform.OS === 'web' ? 48 : 34, lineHeight: Platform.OS === 'web' ? 56 : 41, fontFamily: 'Inter_700Bold' },
  heroText: { color: MUTED, fontSize: 17, lineHeight: 26, fontFamily: 'Inter_500Medium', marginTop: 10, maxWidth: 720 },
  publicUrl: { color: ORANGE, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_700Bold', marginTop: 12 },
  featured: { borderRadius: 26, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, overflow: 'hidden', marginBottom: 24 },
  featuredImage: { width: '100%', aspectRatio: Platform.OS === 'web' ? 2.2 : 1.35, backgroundColor: '#EAD2C2' },
  featuredBody: { padding: 20 },
  postMeta: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  featuredTitle: { color: INK, fontSize: 30, lineHeight: 36, fontFamily: 'Inter_700Bold' },
  postExcerpt: { color: MUTED, fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium', marginTop: 7 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 14 },
  readText: { color: ORANGE, fontSize: 14, fontFamily: 'Inter_700Bold' },
  postActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  actionPill: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: BORDER, backgroundColor: PAPER, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  actionPillText: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold' },
  sectionTitle: { color: INK, fontSize: 24, fontFamily: 'Inter_700Bold', marginBottom: 12, marginTop: 8 },
  postGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  postCard: { width: Platform.OS === 'web' ? '32%' : '100%', minWidth: 260, flexGrow: 1, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, overflow: 'hidden' },
  postImage: { width: '100%', aspectRatio: 1.35, backgroundColor: '#EAD2C2' },
  postBody: { padding: 14 },
  postTitle: { color: INK, fontSize: 19, lineHeight: 24, fontFamily: 'Inter_700Bold' },
  cardActionRow: { flexDirection: 'row', gap: 7, marginTop: 11 },
  iconAction: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: BORDER, backgroundColor: PAPER, alignItems: 'center', justifyContent: 'center' },
  placeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  placePill: { color: ORANGE, fontSize: 13, fontFamily: 'Inter_700Bold', borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  emptyCard: { borderRadius: 22, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 24, alignItems: 'center' },
  emptyTitle: { color: INK, fontSize: 24, lineHeight: 30, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptyText: { color: MUTED, fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 7 },
  notFound: { alignItems: 'center', justifyContent: 'center', padding: 24 },
});
