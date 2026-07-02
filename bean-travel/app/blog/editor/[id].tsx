import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PremiumModal from '@/components/PremiumModal';
import SocialShareSheet, { type SocialSharePayload } from '@/components/SocialShareSheet';
import { useApp } from '@/context/AppContext';
import type { BlogPost, BlogPrivacy } from '@/types';
import { blogPath, generateBlogDraftFromBean, publicBlogUrl } from '@/utils/travelBlog';

const INK = '#2A1714';
const MUTED = '#7B6258';
const ORANGE = '#F26A2E';
const PAPER = '#FFF8EF';
const CARD = '#FFFDF8';
const BORDER = '#F1D7C5';

export default function BlogEditorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const { places, blogSettings, blogPosts, isPremium, getBlogPostById, editBlogPost, publishBlogPostById, unpublishBlogPost } = useApp();
  const post = params.id ? getBlogPostById(String(params.id)) : undefined;
  const [draft, setDraft] = useState<BlogPost | undefined>(post);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [premiumVisible, setPremiumVisible] = useState(false);
  const [sharePayload, setSharePayload] = useState<SocialSharePayload | null>(null);
  const editorBottomPadding = Platform.OS === 'web' ? 260 : Math.max(insets.bottom + 260, 300);

  useEffect(() => {
    setDraft(post);
  }, [post?.id, post?.updatedAt]);

  if (!draft) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <Text style={styles.missingTitle}>Draft not found</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/(tabs)/journal')}>
          <Text style={styles.secondaryButtonText}>Back to Journal</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function patch(update: Partial<BlogPost>) {
    setSaveNotice(null);
    setDraft(prev => prev ? { ...prev, ...update } : prev);
  }

  function draftForSave(current: BlogPost): BlogPost {
    const nextPassword = current.privacy === 'password' ? current.password?.trim() : undefined;
    return {
      ...current,
      password: nextPassword,
      status: current.privacy === 'private' ? 'draft' : current.status,
      publishedAt: current.privacy === 'private' ? null : current.publishedAt,
    };
  }

  async function save() {
    if (!draft) return;
    const draftToSave = draftForSave(draft);
    if (draft.status === 'published' && draftToSave.privacy === 'password' && !draftToSave.password) {
      setSaveNotice({ type: 'error', message: 'Add a post password before saving this protected live story.' });
      return;
    }
    setSaving(true);
    setSaveNotice(null);
    try {
      await editBlogPost(draftToSave.id, draftToSave);
      setDraft(draftToSave);
      setSaveNotice({ type: 'success', message: 'Draft saved. Your changes are safe.' });
    } catch (error: any) {
      setSaveNotice({ type: 'error', message: error?.message ?? "Sorry, we couldn't save this draft. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!draft) return;
    if (!isPremium) {
      setPremiumVisible(true);
      setSaveNotice({ type: 'error', message: 'Publishing is Premium-only. You can keep editing this draft for free.' });
      return;
    }
    const publishPrivacy: BlogPrivacy = draft.privacy === 'password' ? 'password' : 'public';
    const draftToPublish: BlogPost = {
      ...draftForSave(draft),
      privacy: publishPrivacy,
    };
    if (draftToPublish.privacy === 'password' && !draftToPublish.password) {
      setSaveNotice({ type: 'error', message: 'Add a post password before publishing this protected story.' });
      return;
    }
    if (!blogSettings.username) {
      router.push({ pathname: '/blog/settings', params: { sourcePlaceId: draftToPublish.sourcePlaceId } } as any);
      return;
    }
    async function publishCurrentDraft() {
      setSaving(true);
      try {
        await editBlogPost(draftToPublish.id, draftToPublish);
        const published = await publishBlogPostById(draftToPublish.id, draftToPublish);
        if (published) {
          setDraft(published);
          Alert.alert('Published', 'Your post is live on your public Travel Bean Blog.');
        }
      } catch (error: any) {
        Alert.alert('Could not publish publicly', error?.message ?? 'Please sign in and try again once you are online.');
      } finally {
        setSaving(false);
      }
    }
    if (Platform.OS === 'web') {
      await publishCurrentDraft();
      return;
    }
    Alert.alert('Publish this post?', 'This will make the post visible on your public Travel Bean Blog.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Publish',
        onPress: publishCurrentDraft,
      },
    ]);
  }

  async function unpublish() {
    if (!draft) return;
    await unpublishBlogPost(draft.id);
    setDraft({ ...draft, status: 'draft', privacy: 'private', publishedAt: null });
  }

  function setPrivacy(privacy: BlogPrivacy) {
    if (!draft) return;
    patch({ privacy, password: privacy === 'password' ? draft.password : undefined });
  }

  function togglePhoto(photoId: string) {
    if (!draft) return;
    patch({
      photos: draft.photos.map(photo => photo.id === photoId ? { ...photo, included: !photo.included } : photo),
    });
  }

  function makeCover(photoId: string) {
    if (!draft) return;
    const photo = draft.photos.find(item => item.id === photoId);
    if (!photo) return;
    patch({ coverPhotoId: photo.id, coverImageUrl: photo.imageUrl });
  }

  function openPublicLink() {
    if (!draft || draft.status !== 'published') return;
    router.push(blogPath(blogSettings, draft) as any);
  }

  async function sharePostLink() {
    if (!draft || draft.status !== 'published') return;
    setSharePayload({
      url: publicBlogUrl(blogSettings, draft),
      title: draft.title,
      text: draft.subtitle || blogSettings.title,
      mediaUrl: draft.coverImageUrl,
      kind: 'post',
    });
  }

  async function shareBlogLink() {
    if (!blogSettings.username) return;
    setSharePayload({
      url: publicBlogUrl(blogSettings),
      title: blogSettings.title || 'Travel Bean Blog',
      text: blogSettings.intro,
      kind: 'blog',
    });
  }

  function dismissKeyboard() {
    Keyboard.dismiss();
  }

  function refreshFromJournal() {
    if (!draft) return;
    const source = places.find(place => place.id === draft.sourcePlaceId);
    if (!source) {
      Alert.alert('Journal entry missing', 'The original journal entry could not be found.');
      return;
    }
    const regenerated = generateBlogDraftFromBean(source, blogPosts, draft.createdAt);
    setDraft({
      ...draft,
      title: regenerated.title,
      subtitle: regenerated.subtitle,
      opening: regenerated.opening,
      body: regenerated.body,
      coverPhotoId: regenerated.coverPhotoId,
      coverImageUrl: regenerated.coverImageUrl,
      photos: regenerated.photos,
      place: regenerated.place,
      country: regenerated.country,
      city: regenerated.city,
      dateVisited: regenerated.dateVisited,
      category: regenerated.category,
      tags: regenerated.tags,
    });
  }

  return (
    <>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: (Platform.OS === 'web' ? 42 : insets.top + 18), paddingBottom: editorBottomPadding }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={Platform.OS !== 'web'}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.86}>
            <Feather name="chevron-left" size={23} color={INK} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Blog Draft</Text>
            <Text style={styles.subtitle}>{draft.status === 'published' ? 'Published on your Travel Bean Blog' : 'Private until you publish it'}</Text>
          </View>
        </View>

        <View style={styles.card}>
        {draft.coverImageUrl ? <Image source={{ uri: draft.coverImageUrl }} style={styles.cover} contentFit="cover" contentPosition="top center" /> : null}
        <Text style={styles.label}>Blog title</Text>
        <TextInput value={draft.title} onChangeText={title => patch({ title })} style={styles.input} />
        <Text style={styles.label}>Subtitle</Text>
        <TextInput value={draft.subtitle} onChangeText={subtitle => patch({ subtitle })} style={styles.input} />
        <Text style={styles.label}>Story</Text>
        <TextInput value={draft.body} onChangeText={body => patch({ body })} multiline scrollEnabled={false} style={[styles.input, styles.bodyInput]} />
        <TouchableOpacity style={styles.refreshButton} onPress={refreshFromJournal} activeOpacity={0.86}>
          <Feather name="refresh-cw" size={15} color={ORANGE} />
          <Text style={styles.refreshText}>Refresh from Journal Entry</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Privacy</Text>
        <View style={styles.segmentRow}>
          {([
            ['private', 'Private Draft', 'lock'],
            ['public', 'Public', 'globe'],
            ['password', 'Password', 'key'],
          ] as const).map(([value, label, icon]) => (
            <TouchableOpacity key={value} style={[styles.segment, draft.privacy === value && styles.segmentActive]} onPress={() => setPrivacy(value)} activeOpacity={0.86}>
              <Feather name={icon} size={14} color={draft.privacy === value ? ORANGE : MUTED} />
              <Text style={[styles.segmentText, draft.privacy === value && styles.segmentTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {draft.privacy === 'password' ? (
          <>
            <Text style={styles.label}>Post password</Text>
            <TextInput value={draft.password ?? ''} onChangeText={password => patch({ password })} style={styles.input} placeholder="Choose a password" placeholderTextColor="#A98B7A" secureTextEntry autoCapitalize="none" autoCorrect={false} />
            <Text style={styles.helperText}>Readers will need this password before they can open the full story and gallery.</Text>
          </>
        ) : null}

        <View style={styles.formRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Category</Text>
            <TextInput value={draft.category} onChangeText={category => patch({ category })} style={styles.input} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Tags</Text>
            <TextInput value={draft.tags.join(', ')} onChangeText={value => patch({ tags: value.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 12) })} style={styles.input} />
          </View>
        </View>

        <Text style={styles.label}>Photos</Text>
        <View style={styles.photoGrid}>
          {draft.photos.map(photo => (
            <View key={photo.id} style={styles.photoTile}>
              <TouchableOpacity onPress={() => togglePhoto(photo.id)} activeOpacity={0.88}>
                <Image source={{ uri: photo.imageUrl }} style={[styles.photo, !photo.included && styles.photoMuted]} contentFit="cover" contentPosition="top center" />
              </TouchableOpacity>
              <View style={styles.photoActions}>
                <TouchableOpacity style={[styles.smallPill, draft.coverPhotoId === photo.id && styles.smallPillActive]} onPress={() => makeCover(photo.id)}>
                  <Text style={[styles.smallPillText, draft.coverPhotoId === photo.id && styles.smallPillTextActive]}>{draft.coverPhotoId === photo.id ? 'Cover' : 'Make cover'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconMini} onPress={() => togglePhoto(photo.id)}>
                  <Feather name={photo.included ? 'check' : 'x'} size={14} color={photo.included ? ORANGE : MUTED} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving} activeOpacity={0.88}>
          <Feather name="save" size={17} color="#fff" />
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Draft'}</Text>
        </TouchableOpacity>
        {saveNotice ? (
          <View style={[styles.saveNotice, saveNotice.type === 'error' && styles.saveNoticeError]}>
            <Feather name={saveNotice.type === 'success' ? 'check-circle' : 'alert-circle'} size={17} color={saveNotice.type === 'success' ? '#153A46' : '#B83224'} />
            <Text style={[styles.saveNoticeText, saveNotice.type === 'error' && styles.saveNoticeTextError]}>{saveNotice.message}</Text>
          </View>
        ) : null}
        {draft.status === 'published' ? (
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={openPublicLink} activeOpacity={0.86}>
              <Feather name="external-link" size={16} color={ORANGE} />
              <Text style={styles.secondaryButtonText}>View Public Post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={sharePostLink} activeOpacity={0.86}>
              <Feather name="share-2" size={16} color={ORANGE} />
              <Text style={styles.secondaryButtonText}>Share Post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={shareBlogLink} activeOpacity={0.86}>
              <Feather name="globe" size={16} color={ORANGE} />
              <Text style={styles.secondaryButtonText}>Share Blog</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={unpublish} activeOpacity={0.86}>
              <Feather name="eye-off" size={16} color={ORANGE} />
              <Text style={styles.secondaryButtonText}>Unpublish</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.publishButton} onPress={publish} activeOpacity={0.88}>
            <Feather name="globe" size={17} color="#fff" />
            <Text style={styles.publishText}>Publish to Travel Blog</Text>
          </TouchableOpacity>
        )}
        </View>
      </ScrollView>
      <View style={[styles.stickyActions, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity style={styles.stickyQuietButton} onPress={dismissKeyboard} activeOpacity={0.86}>
          <Feather name="chevron-down" size={16} color={MUTED} />
          <Text style={styles.stickyQuietText}>Done</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.stickySaveButton, saving && styles.stickyButtonDisabled]} onPress={save} disabled={saving} activeOpacity={0.88}>
          <Feather name="save" size={15} color="#fff" />
          <Text style={styles.stickyButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
        {draft.status === 'published' ? (
          <TouchableOpacity style={styles.stickyPublishButton} onPress={openPublicLink} activeOpacity={0.88}>
            <Feather name="external-link" size={15} color="#fff" />
            <Text style={styles.stickyButtonText}>View</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.stickyPublishButton} onPress={publish} activeOpacity={0.88}>
            <Feather name="globe" size={15} color="#fff" />
            <Text style={styles.stickyButtonText}>Publish</Text>
          </TouchableOpacity>
        )}
      </View>
      </KeyboardAvoidingView>
      <PremiumModal visible={premiumVisible} mode="general" onClose={() => setPremiumVisible(false)} />
      <SocialShareSheet visible={Boolean(sharePayload)} payload={sharePayload} onClose={() => setSharePayload(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAPER },
  scroll: { flex: 1, backgroundColor: PAPER },
  centered: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  missingTitle: { color: INK, fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 14 },
  header: { maxWidth: 860, width: '100%', alignSelf: 'center', paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1E6' },
  title: { color: INK, fontSize: 28, fontFamily: 'Inter_700Bold' },
  subtitle: { color: MUTED, fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 3 },
  card: { maxWidth: 860, width: '100%', alignSelf: 'center', marginHorizontal: 20, borderRadius: 24, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 18 },
  cover: { width: '100%', aspectRatio: 1.75, borderRadius: 18, backgroundColor: '#EAD2C2', marginBottom: 6 },
  label: { color: MUTED, fontSize: 12, fontFamily: 'Inter_700Bold', marginBottom: 7, marginTop: 14 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: PAPER, paddingHorizontal: 13, paddingVertical: 11, color: INK, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  bodyInput: { minHeight: 220, textAlignVertical: 'top', lineHeight: 22 },
  helperText: { color: MUTED, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_500Medium', marginTop: 7 },
  refreshButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFF1E6', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  refreshText: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold' },
  formRow: { flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 10 },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: { flexGrow: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: PAPER, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  segmentActive: { borderColor: ORANGE, backgroundColor: '#FFF1E6' },
  segmentText: { color: MUTED, fontSize: 12, fontFamily: 'Inter_700Bold' },
  segmentTextActive: { color: ORANGE },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoTile: { width: Platform.OS === 'web' ? 150 : '47%', minWidth: 136 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 16, backgroundColor: '#EAD2C2' },
  photoMuted: { opacity: 0.38 },
  photoActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  smallPill: { flex: 1, minHeight: 30, borderRadius: 15, borderWidth: 1, borderColor: BORDER, backgroundColor: PAPER, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  smallPillActive: { borderColor: ORANGE, backgroundColor: '#FFF1E6' },
  smallPillText: { color: MUTED, fontSize: 10, fontFamily: 'Inter_700Bold' },
  smallPillTextActive: { color: ORANGE },
  iconMini: { width: 32, height: 30, borderRadius: 15, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', backgroundColor: PAPER },
  saveButton: { marginTop: 18, minHeight: 52, borderRadius: 26, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  saveText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  saveNotice: { marginTop: 10, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: '#9BDCCB', backgroundColor: '#EAF8F3', paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  saveNoticeError: { borderColor: '#F0B5A8', backgroundColor: '#FFF1E6' },
  saveNoticeText: { flex: 1, color: '#153A46', fontSize: 13, lineHeight: 18, fontFamily: 'Inter_700Bold' },
  saveNoticeTextError: { color: '#B83224' },
  publishButton: { marginTop: 10, minHeight: 52, borderRadius: 26, backgroundColor: '#153A46', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  publishText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  buttonRow: { flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 10, marginTop: 10 },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: BORDER, backgroundColor: PAPER, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 14 },
  secondaryButtonText: { color: ORANGE, fontSize: 13, fontFamily: 'Inter_700Bold' },
  stickyActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 70,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: '#FFF8EFEE',
    paddingTop: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  stickyQuietButton: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  stickyQuietText: { color: MUTED, fontSize: 13, fontFamily: 'Inter_700Bold' },
  stickySaveButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: ORANGE,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  stickyPublishButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: '#153A46',
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  stickyButtonDisabled: { opacity: 0.65 },
  stickyButtonText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
});
