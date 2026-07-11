import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PremiumModal from '@/components/PremiumModal';
import SocialShareSheet, { type SocialSharePayload } from '@/components/SocialShareSheet';
import { BLOG_PUBLISHING_PREMIUM_ERROR, useApp } from '@/context/AppContext';
import { useTravelAuth, useTravelUser } from '@/hooks/useTravelAuth';
import type { BlogPost, VisitedPlace } from '@/types';
import { blogPath, publicBlogUrl } from '@/utils/travelBlog';
import { beanTitle, formatDate, primaryPhoto } from '@/utils/travelBeanMvp';

const INK = '#2A1714';
const MUTED = '#7B6258';
const ORANGE = '#F26A2E';
const PAPER = '#FFF8EF';
const CARD = '#FFFDF8';
const BORDER = '#F1D7C5';

function dashboardUrl() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN?.replace(/^https?:\/\//, '');
  if (domain) return `https://${domain}/dashboard`;
  if (typeof window !== 'undefined' && window.location?.origin) return `${window.location.origin}/dashboard`;
  return 'https://travel-bean-production.up.railway.app/dashboard';
}

function dashboardEmailBody(url = dashboardUrl()) {
  return [
    'Open your Travel Bean dashboard from your laptop:',
    '',
    url,
    '',
    'Log in on web to edit blog posts, organise drafts, and publish your travel stories.',
  ].join('\n');
}

async function openDashboardEmailDraft(email?: string) {
  const subject = 'Edit your Travel Bean Blog on web';
  const body = dashboardEmailBody();
  const recipient = email?.trim() ? encodeURIComponent(email.trim()) : '';
  const mailto = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  try {
    await Linking.openURL(mailto);
    return 'mail' as const;
  } catch {
    await Share.share({ title: subject, message: body });
    return 'share' as const;
  }
}

type BlogDashboardProps = {
  requireSignedIn?: boolean;
};

export default function BlogDashboard({ requireSignedIn = false }: BlogDashboardProps = {}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [premiumVisible, setPremiumVisible] = useState(false);
  const [emailingDashboardLink, setEmailingDashboardLink] = useState(false);
  const [dashboardLinkStatus, setDashboardLinkStatus] = useState<'idle' | 'sent' | 'draft' | 'failed'>('idle');
  const [sharePayload, setSharePayload] = useState<SocialSharePayload | null>(null);
  const { isSignedIn } = useTravelAuth();
  const { user } = useTravelUser();
  const { blogSettings, blogPosts, places, userProfile, isPremium, createBlogDraftFromPlace, deleteBlogPost, emailDashboardLink, syncBlogToCloud } = useApp();
  const publishedPosts = useMemo(() => blogPosts.filter(post => post.status === 'published'), [blogPosts]);
  const draftPosts = useMemo(() => blogPosts.filter(post => post.status === 'draft'), [blogPosts]);
  const blogUrl = publicBlogUrl(blogSettings);
  const publicReaderLinkText = blogUrl || 'Choose a username to create your public link';
  const isPublicBlogLive = blogSettings.privacy === 'public';
  const top = Platform.OS === 'web' ? 42 : insets.top + 18;
  const bottomNavHeight = 76 + Math.max(insets.bottom, 10);

  function goSignIn() {
    router.push({ pathname: '/sign-in', params: { redirect: '/dashboard' } } as any);
  }

  async function ensurePublicBlogSettings() {
    if (!isPremium) {
      setPremiumVisible(true);
      return null;
    }
    if (!blogUrl) {
      Alert.alert('Set your blog username', 'Choose a username before sharing your public blog link.');
      return null;
    }
    try {
      const synced = await syncBlogToCloud();
      return synced.settings;
    } catch (error: any) {
      if (error?.name === BLOG_PUBLISHING_PREMIUM_ERROR) {
        setPremiumVisible(true);
        return null;
      }
      Alert.alert('Could not publish blog', error?.message ?? 'Please try again once you are online.');
      return null;
    }
  }

  async function shareBlog() {
    const publicSettings = await ensurePublicBlogSettings();
    if (!publicSettings) {
      return;
    }
    setSharePayload({
      url: publicBlogUrl(publicSettings),
      title: publicSettings.title || 'Travel Bean Blog',
      text: publicSettings.intro,
      kind: 'blog',
    });
  }

  async function viewPublicBlog() {
    const publicSettings = await ensurePublicBlogSettings();
    if (!publicSettings) return;
    router.push(blogPath(publicSettings) as any);
  }

  async function sharePost(post: BlogPost, settings: typeof blogSettings = blogSettings) {
    setSharePayload({
      url: publicBlogUrl(settings, post),
      title: post.title,
      text: post.subtitle || settings.title,
      mediaUrl: post.coverImageUrl,
      kind: 'post',
    });
  }

  async function sendDashboardLink() {
    setDashboardLinkStatus('idle');
    const email = user?.primaryEmailAddress?.emailAddress ?? userProfile?.email;
    setEmailingDashboardLink(true);
    try {
      if (isSignedIn && email) {
        try {
          await emailDashboardLink(email);
          setDashboardLinkStatus('sent');
          Alert.alert('Link sent', 'Link sent. Check your email to open Travel Bean on your laptop.');
          return;
        } catch {
          // Fall through to a local email draft when the server email provider is not configured yet.
        }
      }

      await openDashboardEmailDraft(email);
      setDashboardLinkStatus('draft');
      Alert.alert(
        'Email ready',
        email
          ? 'Your email app opened with the laptop dashboard link ready to send.'
          : 'Your email app opened with the dashboard link. Add your email address and send it to yourself.'
      );
    } catch {
      setDashboardLinkStatus('failed');
      Alert.alert('Email failed', 'Sorry, we couldn’t send the email. Please try again.');
    } finally {
      setEmailingDashboardLink(false);
    }
  }

  async function openBeanPipeline(bean: VisitedPlace) {
    const existing = blogPosts.find(post => post.sourcePlaceId === bean.id);
    if (existing?.status === 'published') {
      router.push(blogPath(blogSettings, existing) as any);
      return;
    }
    if (existing) {
      router.push({ pathname: '/blog/editor/[id]', params: { id: existing.id } } as any);
      return;
    }
    try {
      const draft = await createBlogDraftFromPlace(bean.id);
      router.push({ pathname: '/blog/editor/[id]', params: { id: draft.id } } as any);
    } catch (error: any) {
      Alert.alert('Could not create draft', error?.message ?? 'Please try again.');
    }
  }

  function confirmDeleteDraft(post: BlogPost) {
    Alert.alert('Delete draft?', 'This removes the draft blog post. Your original Bean stays in your journal.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBlogPost(post.id);
          } catch (error: any) {
            Alert.alert('Could not delete draft', error?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  }

  if (requireSignedIn && !isSignedIn) {
    return <WebDashboardSignInGate onSignIn={goSignIn} onBack={() => router.replace('/blog' as any)} />;
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: top, paddingBottom: bottomNavHeight + 44 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Blog Dashboard</Text>
            <Text style={styles.subtitle}>Write, edit, and publish your Travel Bean Blog.</Text>
          </View>
        </View>

      <View style={styles.dashboardTools}>
        <View style={styles.dashboardToolCard}>
          <View style={styles.dashboardToolIcon}>
            <Feather name="eye" size={17} color={ORANGE} />
          </View>
          <View style={styles.dashboardToolCopy}>
            <Text style={styles.dashboardToolTitle}>Public reader blog</Text>
            <Text style={styles.dashboardToolText}>This is the link other people use to read your published Premium posts.</Text>
            <Text style={styles.publicLink}>{publicReaderLinkText}</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.primaryButton} onPress={shareBlog} activeOpacity={0.86}>
                <Feather name={isPublicBlogLive ? 'share-2' : 'upload-cloud'} size={16} color="#fff" />
                <Text style={styles.primaryText}>{isPublicBlogLive ? 'Share Reader Link' : 'Publish Online'}</Text>
              </TouchableOpacity>
              {blogUrl && isPublicBlogLive ? (
                <TouchableOpacity style={styles.secondaryButton} onPress={viewPublicBlog} activeOpacity={0.86}>
                  <Feather name="external-link" size={16} color={ORANGE} />
                  <Text style={styles.secondaryText}>View Reader Blog</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/blog/settings' as any)} activeOpacity={0.86}>
                <Feather name="settings" size={16} color={ORANGE} />
                <Text style={styles.secondaryText}>Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.dashboardToolCard}>
          <View style={[styles.dashboardToolIcon, styles.laptopIcon]}>
            <Feather name="monitor" size={17} color="#153A46" />
          </View>
          <View style={styles.dashboardToolCopy}>
            <Text style={styles.dashboardToolTitle}>Edit on laptop</Text>
            <Text style={styles.dashboardToolText}>Email yourself the web dashboard link for writing longer posts on a larger screen.</Text>
            <TouchableOpacity
              style={[styles.dashboardPrimaryButton, emailingDashboardLink && styles.disabledButton]}
              onPress={sendDashboardLink}
              activeOpacity={0.86}
              disabled={emailingDashboardLink}
            >
              {emailingDashboardLink ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="mail" size={16} color="#fff" />
                  <Text style={styles.dashboardPrimaryText}>Email Laptop Link</Text>
                </>
              )}
            </TouchableOpacity>
            {dashboardLinkStatus !== 'idle' ? (
              <Text style={[
                styles.webManageStatus,
                dashboardLinkStatus === 'sent' && styles.webManageStatusSent,
                dashboardLinkStatus === 'failed' && styles.webManageStatusFailed,
              ]}>
                {dashboardLinkStatus === 'sent'
                  ? 'Link sent. Check your email to open Travel Bean on your laptop.'
                  : dashboardLinkStatus === 'draft'
                    ? 'Your email app opened with the dashboard link ready to send.'
                    : 'Sorry, we couldn’t send the email. Please try again.'}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Published" value={publishedPosts.length} icon="send" />
        <Stat label="Drafts" value={draftPosts.length} icon="edit-3" />
        <Stat label="Places" value={new Set(blogPosts.map(post => post.country).filter(Boolean)).size} icon="map-pin" />
      </View>

      <BlogSection
        title="Drafts"
        empty="Drafts you create from Beans will appear here."
        posts={draftPosts}
        onEdit={post => router.push({ pathname: '/blog/editor/[id]', params: { id: post.id } } as any)}
        onDelete={confirmDeleteDraft}
      />

      <BlogSection
        title="Published Posts"
        empty="Published posts will appear here with share links."
        posts={publishedPosts}
        onEdit={post => router.push({ pathname: '/blog/editor/[id]', params: { id: post.id } } as any)}
        onView={async post => {
          const publicSettings = await ensurePublicBlogSettings();
          if (publicSettings) router.push(blogPath(publicSettings, post) as any);
        }}
        onShare={async post => {
          const publicSettings = await ensurePublicBlogSettings();
          if (publicSettings) await sharePost(post, publicSettings);
        }}
      />

        <BeansLibrary
          beans={places}
          posts={blogPosts}
          onOpen={openBeanPipeline}
        />
      </ScrollView>
      <PremiumModal visible={premiumVisible} mode="general" onClose={() => setPremiumVisible(false)} />
      <SocialShareSheet visible={Boolean(sharePayload)} payload={sharePayload} onClose={() => setSharePayload(null)} />
      <BlogBottomNav bottomInset={insets.bottom} />
    </>
  );
}

function BlogBottomNav({ bottomInset }: { bottomInset: number }) {
  const router = useRouter();
  const tabs = [
    { label: 'Home', icon: 'home' as const, route: '/' },
    { label: 'Passport', icon: 'map' as const, route: '/passport' },
    { label: 'Create', icon: 'plus' as const, route: '/create', primary: true },
    { label: 'Journal', icon: 'book-open' as const, route: '/journal' },
    { label: 'Blog', icon: 'globe' as const, route: '/blog', active: true },
  ];

  return (
    <View style={[styles.bottomNav, { paddingBottom: Math.max(bottomInset, 10) }]}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.label}
          style={styles.bottomNavItem}
          onPress={() => router.replace(tab.route as any)}
          activeOpacity={0.84}
        >
          <View style={[
            styles.bottomIconWrap,
            tab.primary && styles.bottomCreateIcon,
            tab.active && !tab.primary && styles.bottomActiveIcon,
          ]}>
            <Feather
              name={tab.icon}
              size={tab.primary ? 25 : 22}
              color={tab.primary ? '#fff' : tab.active ? ORANGE : '#9E7B6B'}
            />
          </View>
          <Text style={[styles.bottomNavLabel, tab.active && styles.bottomNavLabelActive]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function WebDashboardSignInGate({ onSignIn, onBack }: { onSignIn: () => void; onBack: () => void }) {
  return (
    <View style={styles.webGateScreen}>
      <View style={styles.webGateShell}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.86}>
          <Feather name="chevron-left" size={23} color={INK} />
          <Text style={styles.backButtonText}>Back to app</Text>
        </TouchableOpacity>
        <View style={styles.webGateCard}>
          <View style={styles.webGateIcon}>
            <Feather name="monitor" size={28} color="#153A46" />
          </View>
          <Text style={styles.webGateKicker}>Laptop dashboard</Text>
          <Text style={styles.webGateTitle}>Sign in to manage your public blog on web.</Text>
          <Text style={styles.webGateText}>
            The phone app stays open for creating Beans. This web dashboard is where you sync drafts, publish reader links, and manage your Travel Bean Blog from a larger screen.
          </Text>
          <TouchableOpacity style={styles.webGateButton} onPress={onSignIn} activeOpacity={0.86}>
            <Feather name="log-in" size={18} color="#fff" />
            <Text style={styles.webGateButtonText}>Sign in to web dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: keyof typeof Feather.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <Feather name={icon} size={17} color={ORANGE} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BlogSection({
  title,
  empty,
  posts,
  onEdit,
  onDelete,
  onView,
  onShare,
}: {
  title: string;
  empty: string;
  posts: BlogPost[];
  onEdit: (post: BlogPost) => void;
  onDelete?: (post: BlogPost) => void;
  onView?: (post: BlogPost) => void;
  onShare?: (post: BlogPost) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {posts.length ? posts.map(post => (
        <View key={post.id} style={styles.postCard}>
          {post.coverImageUrl ? <Image source={{ uri: post.coverImageUrl }} style={styles.postImage} contentFit="cover" contentPosition="top center" /> : (
            <View style={[styles.postImage, styles.imageFallback]}>
              <Feather name="image" size={22} color={ORANGE} />
            </View>
          )}
          <View style={styles.postBody}>
            <Text style={styles.postMeta}>{post.place}, {post.country} · {formatDate(post.dateVisited)}</Text>
            <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
            <Text style={styles.postExcerpt} numberOfLines={2}>{post.subtitle || post.opening}</Text>
            <View style={styles.postActions}>
              <TouchableOpacity style={styles.postButton} onPress={() => onEdit(post)} activeOpacity={0.86}>
                <Feather name="edit-3" size={14} color={ORANGE} />
                <Text style={styles.postButtonText}>Edit</Text>
              </TouchableOpacity>
              {onDelete ? (
                <TouchableOpacity style={styles.postButtonDanger} onPress={() => onDelete(post)} activeOpacity={0.86}>
                  <Feather name="trash-2" size={14} color="#B43324" />
                  <Text style={styles.postButtonDangerText}>Delete</Text>
                </TouchableOpacity>
              ) : null}
              {onView ? (
                <TouchableOpacity style={styles.postButton} onPress={() => onView(post)} activeOpacity={0.86}>
                  <Feather name="external-link" size={14} color={ORANGE} />
                  <Text style={styles.postButtonText}>View</Text>
                </TouchableOpacity>
              ) : null}
              {onShare ? (
                <TouchableOpacity style={styles.postButtonPrimary} onPress={() => onShare(post)} activeOpacity={0.86}>
                  <Feather name="share-2" size={14} color="#fff" />
                  <Text style={styles.postButtonPrimaryText}>Share</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      )) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{empty}</Text>
        </View>
      )}
    </View>
  );
}

function BeansLibrary({
  beans,
  posts,
  onOpen,
}: {
  beans: VisitedPlace[];
  posts: BlogPost[];
  onOpen: (bean: VisitedPlace) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Beans Library</Text>
      {beans.length ? beans.slice(0, 12).map(bean => {
        const post = posts.find(item => item.sourcePlaceId === bean.id);
        const status = post?.status === 'published' ? 'Published' : post ? 'Draft created' : 'Not blogged';
        const action = post?.status === 'published' ? 'View Post' : post ? 'Edit Draft' : 'Turn into Blog Post';
        return (
          <View key={bean.id} style={styles.beanCard}>
            <Image source={{ uri: primaryPhoto(bean) }} style={styles.beanImage} contentFit="cover" contentPosition="top center" />
            <View style={styles.beanBody}>
              <View style={styles.beanTopRow}>
                <Text style={styles.statusChip}>{status}</Text>
              </View>
              <Text style={styles.postTitle} numberOfLines={2}>{beanTitle(bean)}</Text>
              <Text style={styles.postMeta}>{bean.name}, {bean.country} · {formatDate(bean.dateVisited)}</Text>
              <TouchableOpacity style={styles.postButtonPrimary} onPress={() => onOpen(bean)} activeOpacity={0.86}>
                <Feather name={post?.status === 'published' ? 'external-link' : 'edit-3'} size={14} color="#fff" />
                <Text style={styles.postButtonPrimaryText}>{action}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Create Beans on your phone, then manage their blog drafts here on your laptop.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAPER },
  content: { width: '100%', maxWidth: 920, alignSelf: 'center', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backButton: { minWidth: 116, height: 44, borderRadius: 22, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#FFF1E6' },
  backButtonText: { color: INK, fontSize: 13, fontFamily: 'Inter_700Bold' },
  title: { color: INK, fontSize: 30, fontFamily: 'Inter_700Bold' },
  subtitle: { color: MUTED, fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 3 },
  notice: { borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  noticeTitle: { color: INK, fontSize: 15, fontFamily: 'Inter_700Bold' },
  noticeText: { color: MUTED, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium', marginTop: 3 },
  noticeButton: { minHeight: 38, borderRadius: 19, backgroundColor: ORANGE, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  noticeButtonText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  signInNotice: { borderRadius: 22, borderWidth: 1, borderColor: '#F5B996', backgroundColor: '#FFF1E6', padding: 14, flexDirection: Platform.OS === 'web' ? 'row' : 'column', alignItems: Platform.OS === 'web' ? 'center' : 'stretch', gap: 12, marginBottom: 14 },
  signInNoticeIcon: { width: 44, height: 44, borderRadius: 18, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  signInNoticeCopy: { flex: 1, minWidth: 0 },
  signInNoticeTitle: { color: INK, fontSize: 16, fontFamily: 'Inter_700Bold' },
  signInNoticeText: { color: MUTED, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_600SemiBold', marginTop: 3 },
  signInNoticeButton: { minHeight: 44, borderRadius: 22, backgroundColor: ORANGE, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: Platform.OS === 'web' ? 'auto' : 'flex-start' },
  signInNoticeButtonText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  heroCard: { borderRadius: 26, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 18 },
  heroIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  heroTitle: { color: INK, fontSize: 30, lineHeight: 36, fontFamily: 'Inter_700Bold' },
  heroText: { color: MUTED, fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium', marginTop: 7 },
  publicLinkPanel: { marginTop: 16, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: PAPER, padding: 13 },
  panelTitleRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  publicPanelIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFE7D6', alignItems: 'center', justifyContent: 'center' },
  panelTitle: { color: INK, fontSize: 15, fontFamily: 'Inter_700Bold' },
  panelText: { color: MUTED, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_500Medium', marginTop: 2 },
  linkLabel: { color: MUTED, fontSize: 12, fontFamily: 'Inter_700Bold', marginTop: 16 },
  publicLink: { color: ORANGE, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_700Bold', marginTop: 5 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 16 },
  primaryButton: { minHeight: 42, borderRadius: 21, backgroundColor: ORANGE, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  secondaryButton: { minHeight: 42, borderRadius: 21, borderWidth: 1, borderColor: BORDER, backgroundColor: PAPER, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryText: { color: ORANGE, fontSize: 14, fontFamily: 'Inter_700Bold' },
  disabledButton: { opacity: 0.7 },
  dashboardTools: { gap: 12 },
  dashboardToolCard: { borderRadius: 22, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dashboardToolIcon: { width: 42, height: 42, borderRadius: 18, backgroundColor: '#FFE7D6', alignItems: 'center', justifyContent: 'center' },
  laptopIcon: { backgroundColor: '#CBEDE1' },
  dashboardToolCopy: { flex: 1, minWidth: 0 },
  dashboardToolTitle: { color: INK, fontSize: 16, fontFamily: 'Inter_700Bold' },
  dashboardToolText: { color: MUTED, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_500Medium', marginTop: 3 },
  webManageCard: { marginTop: 14, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: '#88C9BA', backgroundColor: '#EFFAF5', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  webManageIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#CBEDE1', alignItems: 'center', justifyContent: 'center' },
  webManageCopy: { flex: 1 },
  webManageTitle: { color: INK, fontSize: 15, fontFamily: 'Inter_700Bold' },
  webManageText: { color: MUTED, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_500Medium', marginTop: 3 },
  dashboardActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 12 },
  dashboardPrimaryButton: { minHeight: 42, borderRadius: 21, backgroundColor: '#153A46', paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'flex-start', marginTop: 12 },
  dashboardPrimaryText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  webManageStatus: { color: MUTED, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_700Bold', marginTop: 8 },
  webManageStatusSent: { color: '#287451' },
  webManageStatusFailed: { color: '#B43324' },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  statCard: { flexGrow: 1, flexBasis: 150, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 15 },
  statValue: { color: INK, fontSize: 30, fontFamily: 'Inter_700Bold', marginTop: 7 },
  statLabel: { color: MUTED, fontSize: 13, fontFamily: 'Inter_700Bold', marginTop: 1 },
  section: { marginTop: 24 },
  sectionTitle: { color: INK, fontSize: 24, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  postCard: { borderRadius: 22, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, overflow: 'hidden', marginBottom: 12, flexDirection: Platform.OS === 'web' ? 'row' : 'column' },
  postImage: { width: Platform.OS === 'web' ? 190 : '100%', aspectRatio: Platform.OS === 'web' ? 1.1 : 1.5, backgroundColor: '#EAD2C2' },
  imageFallback: { alignItems: 'center', justifyContent: 'center' },
  postBody: { flex: 1, padding: 14 },
  postMeta: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold', marginBottom: 6 },
  postTitle: { color: INK, fontSize: 20, lineHeight: 25, fontFamily: 'Inter_700Bold' },
  postExcerpt: { color: MUTED, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', marginTop: 5 },
  postActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  postButton: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: BORDER, backgroundColor: PAPER, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  postButtonText: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold' },
  postButtonDanger: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: '#F0B5A8', backgroundColor: '#FFF1E6', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  postButtonDangerText: { color: '#B43324', fontSize: 12, fontFamily: 'Inter_700Bold' },
  postButtonPrimary: { minHeight: 34, borderRadius: 17, backgroundColor: ORANGE, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  postButtonPrimaryText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  emptyCard: { borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 18 },
  emptyText: { color: MUTED, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_500Medium' },
  beanCard: { borderRadius: 22, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, overflow: 'hidden', marginBottom: 12, flexDirection: Platform.OS === 'web' ? 'row' : 'column' },
  beanImage: { width: Platform.OS === 'web' ? 150 : '100%', aspectRatio: Platform.OS === 'web' ? 1 : 1.6, backgroundColor: '#EAD2C2' },
  beanBody: { flex: 1, padding: 14 },
  beanTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusChip: { color: ORANGE, fontSize: 11, fontFamily: 'Inter_700Bold', backgroundColor: '#FFF1E6', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, overflow: 'hidden' },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 76,
    paddingTop: 7,
    paddingHorizontal: 5,
    backgroundColor: PAPER,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
  },
  bottomNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bottomActiveIcon: { backgroundColor: '#FFF1E6' },
  bottomCreateIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginTop: -16,
    backgroundColor: ORANGE,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  bottomNavLabel: { color: '#9E7B6B', fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  bottomNavLabelActive: { color: ORANGE },
  webGateScreen: { flex: 1, backgroundColor: PAPER, paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 44 : 64 },
  webGateShell: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  webGateCard: { marginTop: 18, borderRadius: 28, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: Platform.OS === 'web' ? 30 : 22 },
  webGateIcon: { width: 68, height: 68, borderRadius: 24, backgroundColor: '#CBEDE1', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  webGateKicker: { color: ORANGE, fontSize: 13, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', marginBottom: 8 },
  webGateTitle: { color: INK, fontSize: Platform.OS === 'web' ? 34 : 28, lineHeight: Platform.OS === 'web' ? 40 : 34, fontFamily: 'Inter_700Bold' },
  webGateText: { color: MUTED, fontSize: 16, lineHeight: 24, fontFamily: 'Inter_500Medium', marginTop: 12 },
  webGateButton: { alignSelf: 'flex-start', minHeight: 50, borderRadius: 25, backgroundColor: ORANGE, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 22 },
  webGateButtonText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
