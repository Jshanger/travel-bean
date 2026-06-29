import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SocialShareSheet, { type SocialSharePayload } from '@/components/SocialShareSheet';
import type { BlogPost, TravelBlogSettings } from '@/types';
import { blogPath, formatPublicUsername, publicBlogUrl, sanitizeBlogUsername } from '@/utils/travelBlog';
import { formatDate } from '@/utils/travelBeanMvp';

const INK = '#2A1714';
const MUTED = '#7B6258';
const ORANGE = '#F26A2E';
const PAPER = '#FFF8EF';
const CARD = '#FFFDF8';
const BORDER = '#F1D7C5';

export default function PublicBlogPost() {
  const router = useRouter();
  const params = useLocalSearchParams<{ username?: string; slug?: string }>();
  const [password, setPassword] = useState('');
  const [submittedPassword, setSubmittedPassword] = useState('');
  const [passwordAttempted, setPasswordAttempted] = useState(false);
  const [remotePost, setRemotePost] = useState<{ settings: TravelBlogSettings; post: BlogPost & { passwordRequired?: boolean } } | null>(null);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [sharePayload, setSharePayload] = useState<SocialSharePayload | null>(null);
  const requested = sanitizeBlogUsername(String(params.username ?? ''));
  const post = remotePost?.post;
  const activeSettings = remotePost?.settings;
  const passwordRequired = Boolean(post && 'passwordRequired' in post && post.passwordRequired);
  const unlocked = post?.privacy !== 'password' || !passwordRequired;

  async function sharePost() {
    if (!activeSettings || !post) return;
    setSharePayload({
      url: publicBlogUrl(activeSettings, post),
      title: post.title,
      text: post.subtitle || activeSettings.title,
      mediaUrl: post.coverImageUrl,
      kind: 'post',
    });
  }

  async function shareBlog() {
    if (!activeSettings) return;
    setSharePayload({
      url: publicBlogUrl(activeSettings),
      title: activeSettings.title || 'Travel Bean Blog',
      text: activeSettings.intro,
      kind: 'blog',
    });
  }

  useEffect(() => {
    let mounted = true;
    if (!requested || !params.slug) {
      setRemoteLoaded(true);
      return () => {
        mounted = false;
      };
    }
    setRemoteLoaded(false);
    const query = submittedPassword ? `?password=${encodeURIComponent(submittedPassword)}` : '';
    fetch(`${apiRoot()}/blog/public/${encodeURIComponent(requested)}/${encodeURIComponent(String(params.slug))}${query}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!mounted) return;
        setRemotePost(data);
      })
      .catch(() => {
        if (mounted) setRemotePost(null);
      })
      .finally(() => {
        if (mounted) setRemoteLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [params.slug, requested, submittedPassword]);

  if ((!activeSettings || !post) && !remoteLoaded) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.missingTitle}>Loading story</Text>
      </View>
    );
  }

  if (!activeSettings || !post) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.missingTitle}>Post not found</Text>
        <Text style={styles.missingText}>This Travel Bean story is private or no longer published.</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.nav}>
        <TouchableOpacity style={styles.brandRow} onPress={() => router.push(blogPath(activeSettings) as any)} activeOpacity={0.86}>
          <View style={styles.brandDot} />
          <Text style={styles.brand}>Travel Bean Blog</Text>
        </TouchableOpacity>
        <View style={styles.navActions}>
          <TouchableOpacity style={styles.navButton} onPress={shareBlog} activeOpacity={0.86}>
            <Feather name="globe" size={14} color={ORANGE} />
            <Text style={styles.navButtonText}>Share Blog</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButtonPrimary} onPress={sharePost} activeOpacity={0.86}>
            <Feather name="share-2" size={14} color="#fff" />
            <Text style={styles.navButtonPrimaryText}>Share Post</Text>
          </TouchableOpacity>
        </View>
      </View>

      {post.coverImageUrl ? <Image source={{ uri: post.coverImageUrl }} style={styles.cover} contentFit="cover" contentPosition="top center" /> : null}
      <View style={styles.article}>
        <Text style={styles.kicker}>{post.category} · {formatPublicUsername(activeSettings.username)}</Text>
        <Text style={styles.title}>{post.title}</Text>
        <Text style={styles.subtitle}>{post.subtitle}</Text>
        <Text style={styles.publicUrl}>{publicBlogUrl(activeSettings, post)}</Text>
        <View style={styles.metaRow}>
          <Feather name="map-pin" size={14} color={ORANGE} />
          <Text style={styles.metaText}>{post.hideExactLocation ? post.country : `${post.place}, ${post.country}`}</Text>
          {!post.hideDate ? (
            <>
              <Feather name="calendar" size={14} color={ORANGE} />
              <Text style={styles.metaText}>{formatDate(post.dateVisited)}</Text>
            </>
          ) : null}
        </View>

        {post.privacy === 'password' && !unlocked ? (
          <View style={styles.passwordCard}>
            <Feather name="lock" size={26} color={ORANGE} />
            <Text style={styles.passwordTitle}>Password protected</Text>
            <Text style={styles.passwordText}>Enter the post password to read this Travel Bean story.</Text>
            <TextInput
              value={password}
              onChangeText={value => {
                setPassword(value);
                if (passwordAttempted) setPasswordAttempted(false);
              }}
              placeholder="Password"
              placeholderTextColor="#A98B7A"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.passwordInput}
            />
            {passwordAttempted && passwordRequired ? <Text style={styles.passwordError}>That password did not unlock this story.</Text> : null}
            <TouchableOpacity
              style={[styles.unlockButton, !password.trim() && styles.unlockButtonDisabled]}
              onPress={() => {
                const cleanPassword = password.trim();
                if (!cleanPassword) return;
                setPasswordAttempted(true);
                setSubmittedPassword(cleanPassword);
              }}
              disabled={!password.trim()}
              activeOpacity={0.86}
            >
              <Feather name="unlock" size={16} color="#fff" />
              <Text style={styles.unlockButtonText}>Unlock Story</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.body}>{post.body}</Text>
            {post.photos.filter(photo => photo.included).length ? (
              <View style={styles.gallery}>
                {post.photos.filter(photo => photo.included).map(photo => (
                  <View key={photo.id} style={styles.galleryItem}>
                    <Image source={{ uri: photo.imageUrl }} style={styles.galleryImage} contentFit="cover" contentPosition="top center" />
                    {photo.caption ? <Text style={styles.caption}>{photo.caption}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </View>
      <Text style={styles.footer}>Made with Travel Bean</Text>
      </ScrollView>
      <SocialShareSheet visible={Boolean(sharePayload)} payload={sharePayload} onClose={() => setSharePayload(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAPER },
  content: { width: '100%', maxWidth: 980, alignSelf: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 34 : 56, paddingBottom: 70 },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  missingTitle: { color: INK, fontSize: 24, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  missingText: { color: MUTED, fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 7 },
  nav: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46 },
  navActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  brandDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: ORANGE },
  brand: { color: INK, fontSize: 18, fontFamily: 'Inter_700Bold' },
  navButton: { minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  navButtonText: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold' },
  navButtonPrimary: { minHeight: 38, borderRadius: 19, backgroundColor: ORANGE, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  navButtonPrimaryText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  cover: { width: '100%', aspectRatio: Platform.OS === 'web' ? 2.1 : 1.28, borderRadius: 24, backgroundColor: '#EAD2C2', marginBottom: 18 },
  article: { borderRadius: 24, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: Platform.OS === 'web' ? 28 : 18 },
  kicker: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  title: { color: INK, fontSize: Platform.OS === 'web' ? 46 : 34, lineHeight: Platform.OS === 'web' ? 54 : 40, fontFamily: 'Inter_700Bold' },
  subtitle: { color: MUTED, fontSize: 18, lineHeight: 27, fontFamily: 'Inter_500Medium', marginTop: 10 },
  publicUrl: { color: ORANGE, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_700Bold', marginTop: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginTop: 16, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: BORDER },
  metaText: { color: MUTED, fontSize: 13, fontFamily: 'Inter_700Bold', marginRight: 7 },
  body: { color: INK, fontSize: 18, lineHeight: 31, fontFamily: 'Inter_500Medium', marginTop: 22 },
  gallery: { marginTop: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  galleryItem: { width: Platform.OS === 'web' ? '48.8%' : '100%', flexGrow: 1 },
  galleryImage: { width: '100%', aspectRatio: 1.18, borderRadius: 18, backgroundColor: '#EAD2C2' },
  caption: { color: MUTED, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium', marginTop: 7 },
  passwordCard: { marginTop: 22, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: PAPER, padding: 18, alignItems: 'center' },
  passwordTitle: { color: INK, fontSize: 22, fontFamily: 'Inter_700Bold', marginTop: 9 },
  passwordText: { color: MUTED, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 5 },
  passwordInput: { width: '100%', maxWidth: 360, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, paddingHorizontal: 13, color: INK, fontSize: 15, fontFamily: 'Inter_600SemiBold', marginTop: 14 },
  passwordError: { color: '#B83224', fontSize: 12, lineHeight: 18, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 8 },
  unlockButton: { minHeight: 46, borderRadius: 23, backgroundColor: ORANGE, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  unlockButtonDisabled: { opacity: 0.45 },
  unlockButtonText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  footer: { color: ORANGE, fontSize: 13, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 22 },
});

function apiRoot() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api`;
  if (typeof window !== 'undefined' && window.location?.origin) return `${window.location.origin}/api`;
  return '/api';
}
