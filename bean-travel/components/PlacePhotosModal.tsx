import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Modal,
  Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTravelAuth } from '@/hooks/useTravelAuth';
import { PlacePhoto, VisitedPlace } from '@/types';
import CollageBuilderModal from './CollageBuilderModal';
import VoiceDictation from './VoiceDictation';

const PHOTO_LIMIT = 6;
const MEMORY_MOODS = ['Dreamy', 'Chaotic', 'Golden', 'Peaceful', 'Funny', 'Unreal', 'Tiny detail', 'Worth reliving'];
const MEMORY_PROMPTS = [
  'What tiny detail do you never want to forget?',
  'What did this place feel like?',
  'What was happening around this moment?',
  'What would you relive tomorrow?',
];

const { width: SCREEN_W } = Dimensions.get('window');
const PHOTO_GAP = 3;
const PHOTO_SIZE = (SCREEN_W - 48 - PHOTO_GAP * 2) / 3;

// ─── helpers ──────────────────────────────────────────────────────────────────

function getApiBase() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api/bean` : '/api/bean';
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
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// ─── component ────────────────────────────────────────────────────────────────

interface Props {
  place: VisitedPlace | null;
  visible: boolean;
  onClose: () => void;
}

export default function PlacePhotosModal({ place, visible, onClose }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { getToken } = useTravelAuth();
  const { isPro, editPlace } = useApp();

  const [photos, setPhotos] = useState<PlacePhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [collageVisible, setCollageVisible] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [memoryNote, setMemoryNote] = useState('');
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [promptIndex, setPromptIndex] = useState(0);

  const authHeaders: Record<string, string> = authToken
    ? { Authorization: `Bearer ${authToken}` }
    : {};

  // Refresh token whenever modal becomes visible
  useEffect(() => {
    if (visible) getToken().then(setAuthToken);
  }, [visible, getToken]);

  function imgSource(photoId: string) {
    return { uri: `${getApiBase()}/photos/img/${encodeURIComponent(photoId)}`, headers: authHeaders };
  }

  const atLimit = photos.length >= PHOTO_LIMIT;

  const loadPhotos = useCallback(async () => {
    if (!place) return;
    setLoading(true);
    try {
      const token = await getToken();
      const data = await apiFetch(`/photos?placeId=${place.id}`, token);
      setPhotos(data);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [place, getToken]);

  useEffect(() => {
    if (visible && place) {
      setSelected(new Set());
      setMemoryNote(place.notes ?? '');
      setSelectedMood(null);
      setPromptIndex(Math.abs(place.name.length + place.country.length) % MEMORY_PROMPTS.length);
      loadPhotos();
    }
  }, [visible, place]);

  async function uploadAssets(assets: ImagePicker.ImagePickerAsset[]) {
    if (!place || assets.length === 0) return;
    setUploading(true);

    try {
      const token = await getToken();
      const apiBase = getApiBase();
      for (const asset of assets) {
        const ext = (asset.uri.split('.').pop() ?? 'jpg').toLowerCase();
        const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';

        const blob = await new Promise<Blob>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', asset.uri, true);
          xhr.responseType = 'blob';
          xhr.onload = () => resolve(xhr.response as Blob);
          xhr.onerror = () => reject(new Error('Failed to read image file'));
          xhr.send();
        });

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 60_000);
        let uploadResp: Response;
        try {
          uploadResp = await fetch(
            `${apiBase}/photos/upload?placeId=${encodeURIComponent(place!.id)}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': contentType,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: blob,
              signal: controller.signal,
            }
          );
        } finally {
          clearTimeout(timer);
        }
        if (!uploadResp.ok) {
          const errBody = await uploadResp.json().catch(() => ({}));
          if ((errBody as any)?.error === 'pro_required') {
            Alert.alert('Bean Pro', 'Upgrade to Pro for unlimited Memories.');
            break;
          }
          throw new Error((errBody as any)?.error ?? `Upload failed (${uploadResp.status})`);
        }
        const photo = await uploadResp.json();
        setPhotos(prev => [...prev, photo]);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  // ── pick + upload ──────────────────────────────────────────────────────────
  async function pickAndUpload() {
    if (atLimit) {
      Alert.alert('Six photos selected', 'Remove a photo before adding another.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to add photos.');
      return;
    }

    const slotsLeft = PHOTO_LIMIT - photos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: slotsLeft,
      quality: 0.85,
    });

    if (!result.canceled && result.assets.length) await uploadAssets(result.assets);
  }

  async function takeAndUpload() {
    if (atLimit) {
      Alert.alert('Six photos selected', 'Remove a photo before adding another.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera needed', 'Allow camera access to capture a new Memory.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets.length) await uploadAssets(result.assets);
  }

  // ── delete ─────────────────────────────────────────────────────────────────
  function confirmDelete(photo: PlacePhoto) {
    Alert.alert('Delete photo?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const token = await getToken();
          await apiFetch(`/photos/${photo.id}`, token, { method: 'DELETE' });
          setPhotos(prev => prev.filter(p => p.id !== photo.id));
          setSelected(prev => { const s = new Set(prev); s.delete(photo.id); return s; });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        },
      },
    ]);
  }

  // ── toggle selection ───────────────────────────────────────────────────────
  function toggleSelect(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  function openCollage() {
    if (!isPro) { router.push('/(tabs)/more'); onClose(); return; }
    setCollageVisible(true);
  }

  async function saveMemoryNote() {
    if (!place) return;
    const trimmed = memoryNote.trim();
    const note = selectedMood
      ? `${trimmed}${trimmed ? '\n' : ''}Mood: ${selectedMood}`
      : trimmed;
    await editPlace(place.id, { notes: note });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Memory saved', 'This reflection now lives with the Place.');
  }

  function selectAll() {
    Haptics.selectionAsync();
    setSelected(new Set(photos.map(p => p.id)));
  }

  function surpriseSelect() {
    Haptics.selectionAsync();
    const shuffled = [...photos].sort(() => Math.random() - 0.5).slice(0, Math.min(4, photos.length));
    setSelected(new Set(shuffled.map(p => p.id)));
  }

  if (!place) return null;

  return (
    <>
      {/* ── Main gallery modal ── */}
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>{place.name}</Text>
              <Text style={[styles.headerSub, { color: atLimit ? colors.primary : colors.mutedForeground }]}>
                {atLimit
                  ? `${PHOTO_LIMIT}/${PHOTO_LIMIT} Memories`
                  : `${photos.length} Memory${photos.length !== 1 ? 's' : ''}${selected.size > 0 ? ` · ${selected.size} selected` : ''}`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={pickAndUpload}
              disabled={uploading}
              style={[styles.headerBtn, { backgroundColor: colors.primary + '15', borderRadius: 20 }]}
            >
              {uploading
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Feather name={atLimit ? 'check' : 'plus'} size={20} color={colors.primary} />}
            </TouchableOpacity>
          </View>

          {photos.length > 0 && (
            <LinearGradient
              colors={['#11131D', '#542CF4', '#16BFD0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.memoryHero}
            >
              <View style={styles.heroCopy}>
                <Text style={styles.heroKicker}>Memories</Text>
                <Text style={styles.heroTitle}>{place.name}</Text>
                <Text style={styles.heroSub}>{photos.length} photo moment{photos.length !== 1 ? 's' : ''} ready for a collage, Story, or diary note.</Text>
              </View>
              <View style={styles.heroStack}>
                {photos.slice(0, 3).map((photo, index) => (
                  <Image
                    key={photo.id}
                    source={imgSource(photo.id)}
                    style={[styles.heroPhoto, index === 1 && styles.heroPhotoTwo, index === 2 && styles.heroPhotoThree]}
                    contentFit="cover"
                  />
                ))}
              </View>
            </LinearGradient>
          )}

          {/* Selection hint */}
          {photos.length >= 2 && selected.size === 0 && (
            <View style={[styles.hintBar, { backgroundColor: colors.muted }]}>
              <Feather name="star" size={13} color={colors.primary} />
              <Text style={[styles.hintTxt, { color: colors.mutedForeground }]}>Tap Select all or long-press individual Memories to choose a collage set.</Text>
            </View>
          )}

          {photos.length > 0 && (
            <View style={styles.memoryTools}>
              <TouchableOpacity style={[styles.toolPill, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={selectAll}>
                <Feather name="check-square" size={14} color={colors.primary} />
                <Text style={[styles.toolText, { color: colors.foreground }]}>Select all</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toolPill, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={surpriseSelect}>
                <Feather name="shuffle" size={14} color={colors.primary} />
                <Text style={[styles.toolText, { color: colors.foreground }]}>Surprise me</Text>
              </TouchableOpacity>
              {selected.size > 0 && (
                <TouchableOpacity style={[styles.toolPill, { backgroundColor: colors.muted, borderColor: 'transparent' }]} onPress={() => setSelected(new Set())}>
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.toolText, { color: colors.mutedForeground }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Grid */}
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : photos.length === 0 ? (
            <View style={styles.center}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                <Feather name="camera" size={32} color={colors.mutedForeground} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Memories yet</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Tap + to add a photo memory from your library</Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity style={[styles.addFirstBtn, { backgroundColor: colors.primary }]} onPress={pickAndUpload}>
                  <Feather name="image" size={16} color="#fff" />
                  <Text style={styles.addFirstBtnTxt}>Add from library</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.addFirstBtn, { backgroundColor: colors.foreground }]} onPress={takeAndUpload}>
                  <Feather name="camera" size={16} color="#fff" />
                  <Text style={styles.addFirstBtnTxt}>Take photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.grid}>
              <View style={[styles.promptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.promptTop}>
                  <View style={[styles.promptIcon, { backgroundColor: colors.primary + '14' }]}>
                    <Feather name="edit-3" size={16} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.promptLabel, { color: colors.mutedForeground }]}>Quick reflection</Text>
                    <Text style={[styles.promptQuestion, { color: colors.foreground }]}>{MEMORY_PROMPTS[promptIndex]}</Text>
                  </View>
                  <VoiceDictation onResult={text => setMemoryNote(n => (n ? n.trimEnd() + ' ' : '') + text)} />
                </View>
                <TextInput
                  style={[styles.promptInput, { backgroundColor: colors.muted, color: colors.foreground }]}
                  placeholder="Write one sentence for this memory..."
                  placeholderTextColor={colors.mutedForeground}
                  value={memoryNote}
                  onChangeText={setMemoryNote}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodRow}>
                  {MEMORY_MOODS.map(mood => {
                    const active = selectedMood === mood;
                    return (
                      <TouchableOpacity
                        key={mood}
                        style={[styles.moodChip, { backgroundColor: active ? colors.primary : colors.muted }]}
                        onPress={() => setSelectedMood(active ? null : mood)}
                      >
                        <Text style={[styles.moodText, { color: active ? '#fff' : colors.mutedForeground }]}>{mood}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity
                  style={[styles.saveNoteBtn, { backgroundColor: memoryNote.trim() || selectedMood ? colors.foreground : colors.muted }]}
                  onPress={saveMemoryNote}
                  disabled={!memoryNote.trim() && !selectedMood}
                >
                  <Text style={[styles.saveNoteText, { color: memoryNote.trim() || selectedMood ? '#fff' : colors.mutedForeground }]}>Save reflection to this Place</Text>
                </TouchableOpacity>
              </View>

              {photos.map(photo => (
                <TouchableOpacity
                  key={photo.id}
                  onPress={() => { if (selected.size > 0) toggleSelect(photo.id); }}
                  onLongPress={() => toggleSelect(photo.id)}
                  activeOpacity={0.85}
                  style={[styles.photoCell, { borderColor: selected.has(photo.id) ? colors.primary : 'transparent' }]}
                >
                  <Image source={imgSource(photo.id)} style={styles.photo} contentFit="cover" />
                  {selected.has(photo.id) && (
                    <View style={[styles.selectBadge, { backgroundColor: colors.primary }]}>
                      <Feather name="check" size={12} color="#fff" />
                    </View>
                  )}
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(photo)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="trash-2" size={13} color="#fff" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Make Memory Collage footer — visible so people can find it */}
          <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <View style={styles.footerActions}>
              <TouchableOpacity style={[styles.footerMiniBtn, { backgroundColor: colors.muted }]} onPress={takeAndUpload} disabled={uploading}>
                <Feather name="camera" size={16} color={colors.foreground} />
                <Text style={[styles.footerMiniText, { color: colors.foreground }]}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.footerMiniBtn, { backgroundColor: colors.muted }]} onPress={pickAndUpload} disabled={uploading}>
                <Feather name="image" size={16} color={colors.foreground} />
                <Text style={[styles.footerMiniText, { color: colors.foreground }]}>Library</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.collageBtn, { backgroundColor: photos.length >= 2 ? (isPro ? colors.primary : colors.foreground) : colors.muted }]}
              onPress={photos.length >= 2 ? openCollage : pickAndUpload}
              activeOpacity={0.85}
            >
              <Feather name={photos.length >= 2 ? (isPro ? 'grid' : 'lock') : 'image'} size={17} color={photos.length >= 2 ? '#fff' : colors.mutedForeground} />
              <Text style={[styles.collageBtnTxt, { color: photos.length >= 2 ? '#fff' : colors.mutedForeground }]}>
                {photos.length < 2 ? 'Add 2 memories to make a collage' : selected.size >= 2 ? `Make Memory Collage (${selected.size} selected)` : 'Make Memory Collage'}
              </Text>
              {photos.length >= 2 && !isPro && (
                <View style={styles.proBadgeInline}>
                  <Text style={styles.proBadgeInlineTxt}>PRO</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Collage builder (full-screen, Pro only) ── */}
      {place && (
        <CollageBuilderModal
          place={place}
          photos={photos}
          visible={collageVisible}
          onClose={() => setCollageVisible(false)}
          authHeaders={authHeaders}
          initialSelectedIds={[...selected]}
        />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  modal: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 12,
    paddingBottom: 12, borderBottomWidth: 1, gap: 8,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  headerSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },

  memoryHero: {
    margin: 14,
    borderRadius: 26,
    minHeight: 148,
    padding: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#2500FF',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
  heroCopy: { flex: 1, paddingRight: 12 },
  heroKicker: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 },
  heroTitle: { color: '#fff', fontSize: 25, lineHeight: 29, fontFamily: 'Inter_700Bold' },
  heroSub: { color: 'rgba(255,255,255,0.76)', fontSize: 13, lineHeight: 18, fontFamily: 'Inter_500Medium', marginTop: 8 },
  heroStack: { width: 116, height: 112, position: 'relative' },
  heroPhoto: { position: 'absolute', width: 78, height: 94, borderRadius: 18, right: 16, top: 8, borderWidth: 3, borderColor: '#fff', transform: [{ rotate: '5deg' }] },
  heroPhotoTwo: { right: 44, top: 18, transform: [{ rotate: '-8deg' }], opacity: 0.92 },
  heroPhotoThree: { right: 0, top: 30, transform: [{ rotate: '12deg' }], opacity: 0.88 },

  hintBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  hintTxt: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  memoryTools: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  toolPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  toolText: { fontSize: 12, fontFamily: 'Inter_700Bold' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  emptyIcon: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  emptySub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20 },
  emptyActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 12 },
  addFirstBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 12 },
  addFirstBtnTxt: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' },

  grid: { padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: PHOTO_GAP },
  promptCard: { width: '100%', borderRadius: 22, borderWidth: 1, padding: 14, marginBottom: 12 },
  promptTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  promptIcon: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  promptLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  promptQuestion: { fontSize: 16, lineHeight: 20, fontFamily: 'Inter_700Bold', marginTop: 2 },
  promptInput: { minHeight: 74, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, lineHeight: 19, fontFamily: 'Inter_500Medium' },
  moodRow: { gap: 7, paddingVertical: 10 },
  moodChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  moodText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  saveNoteBtn: { borderRadius: 16, paddingVertical: 12, alignItems: 'center' },
  saveNoteText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  photoCell: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 8, overflow: 'hidden', borderWidth: 2 },
  photo: { width: '100%', height: '100%' },
  selectBadge: {
    position: 'absolute', top: 6, right: 6, width: 22, height: 22,
    borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: {
    position: 'absolute', bottom: 6, right: 6, width: 26, height: 26,
    borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },

  footer: { padding: 16, borderTopWidth: 1 },
  footerActions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  footerMiniBtn: { flex: 1, minHeight: 44, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerMiniText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  collageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  collageBtnTxt: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
  proBadgeInline: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  proBadgeInlineTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 0.6 },
});
