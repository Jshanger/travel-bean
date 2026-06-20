import { Feather } from '@expo/vector-icons';
import { useUser } from '@clerk/expo';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import BeanCollageCard from '@/components/BeanCollageCard';
import CreateBeanMascot from '@/components/CreateBeanMascot';
import PremiumModal from '@/components/PremiumModal';
import { useApp } from '@/context/AppContext';
import { BeanPhoto, PromptResponse, VisitedPlace } from '@/types';
import { persistBeanPhotos } from '@/utils/photoPersistence';
import {
  ACTIVE_LAYOUTS, allBeans, BeanLayout, BeanMood, beanTitle, formatDate, isPremiumLayout, journalMemoryText, LAYOUTS, memoryResponses, MOODS, photoLimitForPremium, primaryPhoto, serializeJournalNotes, STORY_PROMPTS,
} from '@/utils/travelBeanMvp';
import { TRAVEL_QUOTES, type QuotePlacement, type QuoteSourceType, type TravelQuote } from '@/utils/quoteLibrary';

const INK = '#2A1714';
const MUTED = '#7B6258';
const ORANGE = '#F26A2E';
const PAPER = '#FFF8EF';
const CARD = '#FFFDF8';
const BORDER = '#F1D7C5';
type JournalEditForm = {
  name: string;
  country: string;
  dateVisited: string;
  title: string;
  summary: string;
  extraNotes: string;
  mood: BeanMood | '';
  layout: BeanLayout;
  promptResponses: PromptResponse[];
  photos: BeanPhoto[];
  selectedQuoteText: string;
  selectedQuoteAuthor: string;
  quoteSourceType: QuoteSourceType;
};

export default function JournalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; entryId?: string; from?: string; returnTo?: string }>();
  const insets = useSafeAreaInsets();
  const { places, editPlace, deletePlace, isPremium, subscriptionPlan, activatePremiumPlan, deactivatePremiumMode, blogSettings, createBlogDraftFromPlace, emailDashboardLink } = useApp();
  const { user } = useUser();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailReturnTarget, setDetailReturnTarget] = useState<'journal' | 'passport'>('journal');
  const [ignoredRouteKey, setIgnoredRouteKey] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<'view' | 'edit'>('view');
  const [editForm, setEditForm] = useState<JournalEditForm>({
    name: '',
    country: '',
    dateVisited: '',
    title: '',
    summary: '',
    extraNotes: '',
    mood: '',
    layout: 'Boarding Pass' as BeanLayout,
    promptResponses: [],
    photos: [],
    selectedQuoteText: '',
    selectedQuoteAuthor: '',
    quoteSourceType: 'none',
  });
  const [premiumVisible, setPremiumVisible] = useState(false);
  const [quoteSearch, setQuoteSearch] = useState('');
  const [quoteDropdownOpen, setQuoteDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [emailingDashboardLink, setEmailingDashboardLink] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const shotRef = useRef<any>(null);
  const beans = allBeans(places);
  const top = Platform.OS === 'web' ? 56 : insets.top;
  const bottom = Platform.OS === 'web' ? 112 : 112 + insets.bottom;
  const isWideWeb = Platform.OS === 'web' && windowWidth >= 900;
  const shelfIsWide = windowWidth >= 540;
  const detailMaxWidth = isWideWeb ? Math.min(1040, windowWidth - 96) : 640;
  const detailControlMaxWidth = isWideWeb ? detailMaxWidth : 620;
  const selectedBean = selectedId ? beans.find(bean => bean.id === selectedId) : undefined;
  const photoLimit = photoLimitForPremium(isPremium);
  const editPhotoLimit = Math.max(photoLimit, editForm.photos.length);
  const returnTo = routeParam(params.returnTo) ?? routeParam(params.from);
  const hasEntryRouteParam = Boolean(routeParam(params.id) ?? routeParam(params.entryId) ?? returnTo);
  const captureOptions = useMemo(() => ({
    format: isPremium ? 'png' : 'jpg',
    quality: isPremium ? 1 : 0.82,
  }), [isPremium]);
  const quoteMatches = useMemo(() => {
    const q = quoteSearch.trim().toLowerCase();
    const source = q
      ? TRAVEL_QUOTES.filter(quote => quoteSearchText(quote).includes(q))
      : TRAVEL_QUOTES.filter(quote => quote.moodTags.includes(editForm.mood as BeanMood) || quote.categories.includes('Short'));
    return source.slice(0, 8);
  }, [editForm.mood, quoteSearch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return beans.filter(bean => {
      if (!q) return true;
      return `${bean.name} ${bean.country} ${bean.notes} ${bean.moodTags?.join(' ') ?? ''}`.toLowerCase().includes(q);
    });
  }, [beans, query]);

  useEffect(() => {
    const entryId = routeParam(params.id) ?? routeParam(params.entryId);
    const routeKey = entryId ? `${entryId}:${returnTo ?? 'journal'}` : null;
    if (!entryId) {
      if (ignoredRouteKey) setIgnoredRouteKey(null);
      if (selectedId) {
        setSelectedId(null);
        setDetailReturnTarget('journal');
        setDetailMode('view');
        setViewerOpen(false);
      }
      return;
    }
    if (routeKey && routeKey === ignoredRouteKey) return;
    if (!entryId || selectedId === entryId) return;
    const bean = beans.find(item => item.id === entryId);
    if (bean) openEntry(bean, returnTo === 'passport' ? 'passport' : 'journal');
  }, [beans, ignoredRouteKey, params.entryId, params.id, returnTo, selectedId]);

  function openEntry(bean: VisitedPlace, returnTarget: 'journal' | 'passport' = 'journal') {
    const title = beanTitle(bean);
    const summary = journalMemoryText(bean);
    const moreNotes = getExtraNotes(bean);
    const savedLayout = getSavedLayout(bean);
    setSelectedId(bean.id);
    setDetailReturnTarget(returnTarget);
    setDetailMode('view');
    setViewerIndex(0);
    setViewerOpen(false);
    setQuoteSearch('');
    setQuoteDropdownOpen(isPremiumLayout(savedLayout));
    setEditForm({
      name: bean.name,
      country: bean.country,
      dateVisited: bean.dateVisited,
      title,
      summary,
      extraNotes: moreNotes,
      mood: normalizeMood(bean.moodTags?.[0] ?? getSavedMood(bean)),
      layout: savedLayout,
      promptResponses: editablePromptResponses(bean),
      photos: editablePhotos(bean),
      selectedQuoteText: bean.selectedQuoteText ?? '',
      selectedQuoteAuthor: bean.selectedQuoteAuthor ?? '',
      quoteSourceType: bean.quoteSourceType ?? (bean.selectedQuoteText ? 'premium_library' : 'none'),
    });
  }

  function closeDetail() {
    if (detailReturnTarget === 'passport' && selectedBean) {
      router.replace({
        pathname: '/(tabs)/passport',
        params: { id: selectedBean.id },
      } as any);
      return;
    }
    const entryId = routeParam(params.id) ?? routeParam(params.entryId);
    setSelectedId(null);
    setDetailReturnTarget('journal');
    if (entryId) setIgnoredRouteKey(`${entryId}:${returnTo ?? 'journal'}`);
    if (hasEntryRouteParam) {
      router.replace('/(tabs)/journal');
    }
  }

  function goJournalList() {
    const entryId = routeParam(params.id) ?? routeParam(params.entryId);
    setSelectedId(null);
    setDetailReturnTarget('journal');
    if (entryId) setIgnoredRouteKey(`${entryId}:${returnTo ?? 'journal'}`);
    router.replace('/(tabs)/journal');
  }

  function goHome() {
    setSelectedId(null);
    setDetailReturnTarget('journal');
    router.replace('/(tabs)');
  }

  function openTravelBlog() {
    router.push('/blog' as any);
  }

  async function sendDashboardLink() {
    const email = user?.primaryEmailAddress?.emailAddress;
    setEmailingDashboardLink(true);
    try {
      await emailDashboardLink(email);
      Alert.alert('Link sent', 'Link sent. Check your email to open Travel Bean on your laptop.');
    } catch {
      Alert.alert('Email failed', 'Sorry, we couldn’t send the email. Please try again.');
    } finally {
      setEmailingDashboardLink(false);
    }
  }

  async function togglePremiumTesting() {
    try {
      if (Platform.OS !== 'web') await Haptics.selectionAsync();
      if (isPremium) {
        await deactivatePremiumMode();
      } else {
        await activatePremiumPlan('monthly');
      }
    } catch (error) {
      console.warn('Unable to toggle premium testing', error);
      Alert.alert('Premium testing', 'Could not change premium testing mode right now.');
    }
  }

  async function saveEntry() {
    if (!selectedBean || selectedBean.id.startsWith('sample-')) return;
    setSaving(true);
    try {
      const layout = editForm.layout;
      const mood = normalizeMood(editForm.mood);
      const selectedQuoteText = editForm.selectedQuoteText.trim();
      const selectedQuoteAuthor = editForm.selectedQuoteAuthor.trim();
      const canUseQuote = false;
      const persistedPhotos = await persistBeanPhotos(editForm.photos);
      await editPlace(selectedBean.id, {
        name: editForm.name,
        country: editForm.country,
        dateVisited: editForm.dateVisited,
        notes: serializeJournalNotes(editForm.title, editForm.summary, editForm.extraNotes, mood, layout),
        moodTags: mood ? [mood] : [],
        promptResponses: editForm.promptResponses,
        photos: persistedPhotos,
        selectedLayout: layout,
        selectedMood: mood || undefined,
        isPremiumLayout: isPremiumLayout(layout),
        hasWatermark: !isPremium,
        exportQuality: isPremium ? 'hd' : 'standard',
        selectedQuoteText: canUseQuote ? selectedQuoteText : null,
        selectedQuoteAuthor: canUseQuote ? selectedQuoteAuthor || null : null,
        quoteSourceType: canUseQuote ? editForm.quoteSourceType : 'none',
        quotePlacement: canUseQuote ? quotePlacementForLayout(layout) : 'none',
        isPremiumQuoteStyle: canUseQuote,
      });
      setEditForm(prev => ({ ...prev, photos: persistedPhotos }));
      setDetailMode('view');
      Alert.alert('Saved', 'Your journal entry has been updated.');
    } catch (error: any) {
      Alert.alert('Could not save entry', error?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function pickEditPhotos() {
    const slotsLeft = editPhotoLimit - editForm.photos.length;
    if (slotsLeft <= 0) {
      Alert.alert(`${editPhotoLimit} photos selected`, 'Remove a photo before adding another.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to update this Bean.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: slotsLeft,
      quality: 0.86,
    });
    if (result.canceled) return;
    const incoming = result.assets.slice(0, slotsLeft).map((asset, index) => ({
      id: asset.assetId ?? `${asset.uri}-${index}`,
      imageUrl: asset.uri,
    }));
    const persistedIncoming = await persistBeanPhotos(incoming);
    setEditForm(prev => {
      const seen = new Set(prev.photos.flatMap(photo => [photo.id, photo.imageUrl]));
      const uniqueIncoming = persistedIncoming.filter(photo => {
        if (seen.has(photo.id) || seen.has(photo.imageUrl)) return false;
        seen.add(photo.id);
        seen.add(photo.imageUrl);
        return true;
      });
      return { ...prev, photos: [...prev.photos, ...uniqueIncoming].slice(0, editPhotoLimit) };
    });
    Haptics.selectionAsync();
  }

  function removeEditPhoto(photoId: string) {
    setEditForm(prev => ({ ...prev, photos: prev.photos.filter(photo => photo.id !== photoId) }));
    Haptics.selectionAsync();
  }

  function moveEditPhoto(photoId: string, direction: -1 | 1) {
    setEditForm(prev => {
      const index = prev.photos.findIndex(photo => photo.id === photoId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.photos.length) return prev;
      const photos = [...prev.photos];
      const [photo] = photos.splice(index, 1);
      photos.splice(nextIndex, 0, photo);
      return { ...prev, photos };
    });
    Haptics.selectionAsync();
  }

  function makeEditPhotoCover(photoId: string) {
    setEditForm(prev => {
      const index = prev.photos.findIndex(photo => photo.id === photoId);
      if (index <= 0) return prev;
      const photos = [...prev.photos];
      const [photo] = photos.splice(index, 1);
      return { ...prev, photos: [photo, ...photos] };
    });
    Haptics.selectionAsync();
  }

  function openPhotoViewer(index: number) {
    setViewerIndex(index);
    setViewerOpen(true);
  }

  function openCollageAlbum(photoCount: number) {
    if (photoCount <= 0) return;
    openPhotoViewer(0);
  }

  async function addEntryToBlog() {
    if (!selectedBean || selectedBean.id.startsWith('sample-')) return;
    try {
      if (!blogSettings.username) {
        router.push({ pathname: '/blog/settings', params: { sourcePlaceId: selectedBean.id } } as any);
        return;
      }
      const draft = await createBlogDraftFromPlace(selectedBean.id);
      router.push({ pathname: '/blog/editor/[id]', params: { id: draft.id } } as any);
    } catch (error: any) {
      Alert.alert('Could not create blog draft', error?.message ?? 'Please try again.');
    }
  }

  function updatePromptResponse(index: number, response: string) {
    setEditForm(prev => ({
      ...prev,
      promptResponses: prev.promptResponses.map((item, itemIndex) => itemIndex === index ? { ...item, response } : item),
    }));
  }

  function chooseEditLayout(layout: BeanLayout) {
    if (!isPremium && isPremiumLayout(layout)) {
      setPremiumVisible(true);
      return;
    }
    const premiumLayout = isPremiumLayout(layout);
    setEditForm(prev => ({
      ...prev,
      layout,
      selectedQuoteText: premiumLayout ? prev.selectedQuoteText : '',
      selectedQuoteAuthor: premiumLayout ? prev.selectedQuoteAuthor : '',
      quoteSourceType: premiumLayout ? prev.quoteSourceType : 'none',
    }));
    setQuoteDropdownOpen(premiumLayout);
    Haptics.selectionAsync();
  }

  function selectJournalQuote(quote: TravelQuote) {
    setEditForm(prev => ({
      ...prev,
      selectedQuoteText: quote.text,
      selectedQuoteAuthor: quote.author,
      quoteSourceType: 'premium_library',
    }));
    setQuoteDropdownOpen(false);
    setQuoteSearch('');
    Haptics.selectionAsync();
  }

  async function captureEntry() {
    const uri = await shotRef.current?.capture();
    if (!uri) throw new Error('Capture failed');
    return uri;
  }

  async function downloadEntry() {
    if (!selectedBean || exporting) return;
    setExporting(true);
    try {
      const uri = await captureEntry();
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = uri;
        link.download = `${selectedBean.name || 'travel'}-bean.${isPremium ? 'png' : 'jpg'}`;
        link.click();
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Allow photo library access to save this Bean.');
          return;
        }
        await MediaLibrary.saveToLibraryAsync(uri);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Bean collage saved.');
    } catch {
      Alert.alert('Could not download', 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function forwardEntry() {
    if (!selectedBean || exporting) return;
    setExporting(true);
    try {
      const uri = await captureEntry();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: isPremium ? 'image/png' : 'image/jpeg', dialogTitle: 'Forward your Bean' });
      } else if (Platform.OS === 'web' && navigator.share) {
        await navigator.share({ title: `${selectedBean.name} Bean`, text: journalMemoryText(selectedBean) || beanTitle(selectedBean) });
      } else {
        Alert.alert('Sharing unavailable', 'Use Download Collage to save it first.');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Could not forward', 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  function deleteEntry() {
    if (!selectedBean || selectedBean.id.startsWith('sample-')) return;
    Alert.alert('Delete journal entry?', 'This removes the saved Bean from your journal.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePlace(selectedBean.id);
            setSelectedId(null);
          } catch (error: any) {
            Alert.alert('Could not delete entry', error?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  }

  if (selectedBean) {
    const readOnly = selectedBean.id.startsWith('sample-');
    const memories = memoryResponses(selectedBean);
    const entryTitle = beanTitle(selectedBean);
    const entryStory = journalMemoryText(selectedBean);
    const entryPhotos = albumPhotoUris(selectedBean);
    const extraNotes = getExtraNotes(selectedBean);
    const savedLayout = getSavedLayout(selectedBean);
    const savedMood = selectedBean.moodTags?.[0] ?? getSavedMood(selectedBean);
    return (
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={{ paddingTop: top + 14, paddingBottom: bottom + (detailMode === 'edit' ? 180 : 0), paddingHorizontal: isWideWeb ? 44 : 20 }}
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.detailHeader, isWideWeb && { width: '100%', maxWidth: detailMaxWidth, alignSelf: 'center' }]}>
            <TouchableOpacity
              accessibilityLabel={detailReturnTarget === 'passport' ? 'Back to Passport' : 'Back to Journal'}
              style={styles.backButton}
              onPress={closeDetail}
            >
              <Feather name="chevron-left" size={24} color={INK} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>{detailMode === 'edit' ? 'Edit Journal Entry' : 'Journal Entry'}</Text>
              <Text style={styles.subtitle}>{detailMode === 'edit' ? (readOnly ? 'Sample Bean preview' : 'Add more of what happened here') : `${selectedBean.name}, ${selectedBean.country}`}</Text>
            </View>
          </View>

          <View style={[styles.detailExitRow, { maxWidth: detailControlMaxWidth }]}>
            <TouchableOpacity style={styles.detailExitButton} onPress={goHome} activeOpacity={0.86}>
              <Feather name="home" size={16} color={ORANGE} />
              <Text style={styles.detailExitText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.detailExitButton, styles.detailExitPrimary]} onPress={goJournalList} activeOpacity={0.86}>
              <Feather name="book-open" size={16} color="#fff" />
              <Text style={styles.detailExitPrimaryText}>All Journal Entries</Text>
            </TouchableOpacity>
          </View>

          {detailMode === 'view' ? (
            <>
              <View style={styles.actualCollageStage}>
                <TouchableOpacity
                  style={styles.collageTapTarget}
                  onPress={() => openCollageAlbum(entryPhotos.length)}
                  activeOpacity={0.96}
                >
                  <ViewShot ref={shotRef} style={[styles.collageCapture, { maxWidth: detailMaxWidth }]} options={captureOptions as any}>
                    <BeanCollageCard
                      place={selectedBean.name}
                      country={selectedBean.country}
                      date={selectedBean.dateVisited}
                      mood={selectedBean.moodTags?.[0]}
                      title={entryTitle}
                      story={entryStory}
                      photo={entryPhotos[0] ?? primaryPhoto(selectedBean)}
                      photos={entryPhotos}
                      layout={savedLayout}
                      hasWatermark={selectedBean.hasWatermark ?? !isPremium}
                      exportQuality={isPremium ? 'hd' : 'standard'}
                      selectedQuoteText={null}
                      selectedQuoteAuthor={null}
                      quotePlacement="none"
                    />
                  </ViewShot>
                </TouchableOpacity>
              </View>
              <View style={[styles.detailActions, { maxWidth: detailControlMaxWidth }]}>
                <TouchableOpacity style={styles.detailActionButton} onPress={downloadEntry} disabled={exporting}>
                  <Feather name="download" size={17} color={INK} />
                  <Text style={styles.detailActionText}>{exporting ? 'Working...' : isPremium ? 'Download HD' : 'Download Collage'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.detailActionButton} onPress={forwardEntry} disabled={exporting}>
                  <Feather name="send" size={17} color={INK} />
                  <Text style={styles.detailActionText}>Share Collage</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.detailActionButton} onPress={() => setDetailMode('edit')}>
                  <Feather name="edit-3" size={17} color={INK} />
                  <Text style={styles.detailActionText}>Edit</Text>
                </TouchableOpacity>
              </View>
              {!readOnly && (
                <TouchableOpacity style={[styles.blogDraftButton, { maxWidth: detailControlMaxWidth }]} onPress={addEntryToBlog} activeOpacity={0.88}>
                  <Feather name="edit" size={17} color="#fff" />
                  <Text style={styles.blogDraftText}>Add to Travel Blog</Text>
                </TouchableOpacity>
              )}
              <View style={[styles.infoPanel, isWideWeb && { width: '100%', maxWidth: detailMaxWidth, alignSelf: 'center' }]}>
                <View style={styles.infoHeader}>
                  <Text style={styles.infoTitle}>Saved information</Text>
                  <View style={styles.infoPill}>
                    <Feather name="archive" size={13} color={ORANGE} />
                    <Text style={styles.infoPillText}>{entryPhotos.length} photo{entryPhotos.length === 1 ? '' : 's'}</Text>
                  </View>
                </View>
                <InfoRow icon="map-pin" label="Place" value={`${selectedBean.name}, ${selectedBean.country}`} />
                <InfoRow icon="calendar" label="Date" value={formatDate(selectedBean.dateVisited)} />
                <InfoRow icon="smile" label="Mood" value={savedMood || 'Not set'} />
                <InfoRow icon="layout" label="Collage style" value={savedLayout} />
                {entryStory ? (
                  <>
                    <Text style={styles.infoSectionLabel}>Summary</Text>
                    <Text style={styles.infoBody}>{entryStory}</Text>
                  </>
                ) : null}
                <View style={styles.longEntryHeader}>
                  <Text style={styles.infoSectionLabel}>Journal entry</Text>
                  {!readOnly && (
                    <TouchableOpacity onPress={() => setDetailMode('edit')}>
                      <Text style={styles.inlineEditText}>{extraNotes ? 'Edit' : 'Add'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {extraNotes ? (
                  <Text style={styles.infoBody}>{extraNotes}</Text>
                ) : (
                  <Text style={styles.emptyEntryText}>No long-form journal entry yet.</Text>
                )}
                {selectedBean.promptResponses?.some(item => item.response.trim()) && (
                  <>
                    <Text style={styles.infoSectionLabel}>Memory prompts</Text>
                    {selectedBean.promptResponses.filter(item => item.response.trim()).map(item => (
                      <View key={item.id} style={styles.promptMemory}>
                        <Text style={styles.promptMemoryQuestion}>{item.prompt}</Text>
                        <Text style={styles.promptMemoryAnswer}>{item.response}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
              {!readOnly && (
                <TouchableOpacity style={[styles.deleteButton, isWideWeb && { width: '100%', maxWidth: detailControlMaxWidth, alignSelf: 'center' }]} onPress={deleteEntry} activeOpacity={0.86}>
                  <Feather name="trash-2" size={17} color="#B43324" />
                  <Text style={styles.deleteText}>Delete Entry</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <View style={[styles.editorMascotCard, isWideWeb && { width: '100%', maxWidth: detailMaxWidth, alignSelf: 'center' }]}>
                <CreateBeanMascot size={72} frameless bubble="heart" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.editorMascotTitle}>Tune this memory</Text>
                  <Text style={styles.editorMascotText}>Edit the story, mood, photos, layout, and saved collage details here.</Text>
                </View>
              </View>

              <View style={[styles.editorPreviewWrap, { maxWidth: detailMaxWidth }]}>
                <BeanCollageCard
                  place={editForm.name}
                  country={editForm.country}
                  date={editForm.dateVisited}
                  mood={editForm.mood || undefined}
                  title={editForm.title}
                  story={editForm.summary}
                  photo={editForm.photos[0]?.imageUrl ?? primaryPhoto(selectedBean)}
                  photos={editForm.photos.map(photo => photo.imageUrl)}
                  layout={editForm.layout}
                  hasWatermark={!isPremium}
                  exportQuality={isPremium ? 'hd' : 'standard'}
                  selectedQuoteText={null}
                  selectedQuoteAuthor={null}
                  quotePlacement="none"
                />
              </View>

              <View style={[styles.editorCard, isWideWeb && { width: '100%', maxWidth: detailMaxWidth, alignSelf: 'center' }]}>
            <View style={styles.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Place</Text>
                <TextInput editable={!readOnly} value={editForm.name} onChangeText={name => setEditForm(prev => ({ ...prev, name }))} style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Country</Text>
                <TextInput editable={!readOnly} value={editForm.country} onChangeText={country => setEditForm(prev => ({ ...prev, country }))} style={styles.input} />
              </View>
            </View>

            <Text style={styles.label}>Date</Text>
            <TextInput editable={!readOnly} value={editForm.dateVisited} onChangeText={dateVisited => setEditForm(prev => ({ ...prev, dateVisited }))} style={styles.input} />

            <Text style={styles.label}>Journal title</Text>
            <TextInput editable={!readOnly} value={editForm.title} onChangeText={title => setEditForm(prev => ({ ...prev, title }))} style={styles.input} />

            <Text style={styles.label}>Memory summary</Text>
            <TextInput
              editable={!readOnly}
              value={editForm.summary}
              onChangeText={summary => setEditForm(prev => ({ ...prev, summary }))}
              multiline
              scrollEnabled={false}
              style={[styles.input, styles.summaryInput]}
            />

            <Text style={styles.label}>Memory prompts</Text>
            {editForm.promptResponses.map((item, index) => (
              <View key={item.id} style={styles.editPromptBox}>
                <Text style={styles.editPromptQuestion}>{item.prompt}</Text>
                <TextInput
                  editable={!readOnly}
                  value={item.response}
                  onChangeText={value => updatePromptResponse(index, value)}
                  multiline
                  scrollEnabled={false}
                  maxLength={180}
                  placeholder="Add what you remember..."
                  placeholderTextColor="#A98B7A"
                  style={styles.editPromptInput}
                />
              </View>
            ))}

            <Text style={styles.label}>Long journal entry</Text>
            <TextInput
              editable={!readOnly}
              value={editForm.extraNotes}
              onChangeText={extraNotes => setEditForm(prev => ({ ...prev, extraNotes }))}
              placeholder="Write the fuller story here. Capture the place, the people nearby, what you and others were doing and the small details the pictures just can't quite capture."
              placeholderTextColor="#A98B7A"
              multiline
              scrollEnabled={false}
              style={[styles.input, styles.notesInput]}
            />

            <Text style={styles.label}>Photos</Text>
            <Text style={styles.photoOrderHint}>First photo is the cover. Use arrows to reorder or make another photo the cover.</Text>
            <View style={styles.editPhotoGrid}>
              {editForm.photos.map((photo, index) => (
                <View key={photo.id} style={styles.editPhotoTileWrap}>
                  <Image source={{ uri: photo.imageUrl }} style={styles.editPhotoTile} contentFit="cover" contentPosition="top center" />
                  <View style={[styles.editPhotoIndexBadge, index === 0 && styles.editPhotoCoverBadge]}>
                    <Text style={styles.editPhotoIndexText}>{index === 0 ? 'Cover' : index + 1}</Text>
                  </View>
                  {!readOnly && (
                    <View style={styles.editPhotoOrderControls}>
                      <TouchableOpacity
                        accessibilityLabel="Move photo earlier"
                        style={[styles.editPhotoOrderButton, index === 0 && styles.editPhotoOrderButtonDisabled]}
                        onPress={() => moveEditPhoto(photo.id, -1)}
                        disabled={index === 0}
                        activeOpacity={0.84}
                      >
                        <Feather name="chevron-left" size={13} color={index === 0 ? '#C3AA9A' : ORANGE} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        accessibilityLabel="Move photo later"
                        style={[styles.editPhotoOrderButton, index === editForm.photos.length - 1 && styles.editPhotoOrderButtonDisabled]}
                        onPress={() => moveEditPhoto(photo.id, 1)}
                        disabled={index === editForm.photos.length - 1}
                        activeOpacity={0.84}
                      >
                        <Feather name="chevron-right" size={13} color={index === editForm.photos.length - 1 ? '#C3AA9A' : ORANGE} />
                      </TouchableOpacity>
                    </View>
                  )}
                  {!readOnly && (
                    <TouchableOpacity
                      accessibilityLabel="Remove photo"
                      style={styles.editPhotoRemove}
                      onPress={() => removeEditPhoto(photo.id)}
                      activeOpacity={0.84}
                    >
                      <Feather name="x" size={13} color="#fff" />
                    </TouchableOpacity>
                  )}
                  {!readOnly && index > 0 && (
                    <TouchableOpacity
                      style={styles.makeCoverButton}
                      onPress={() => makeEditPhotoCover(photo.id)}
                      activeOpacity={0.86}
                    >
                      <Text style={styles.makeCoverText}>Make cover</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {!readOnly && editForm.photos.length < editPhotoLimit && (
                <TouchableOpacity style={styles.editPhotoAdd} onPress={pickEditPhotos} activeOpacity={0.86}>
                  <Feather name="image" size={18} color={ORANGE} />
                  <Text style={styles.editPhotoAddText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.label}>Mood</Text>
            <View style={styles.editChipRow}>
              {MOODS.map(item => (
                <TouchableOpacity
                  key={item}
                  style={[styles.editMoodChip, editForm.mood === item && styles.editMoodChipActive]}
                  onPress={() => !readOnly && setEditForm(prev => ({ ...prev, mood: item }))}
                  activeOpacity={0.86}
                >
                  <Text style={[styles.editMoodChipText, editForm.mood === item && styles.editMoodChipTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Collage style</Text>
            <View style={styles.editLayoutGrid}>
              {ACTIVE_LAYOUTS.map(item => {
                const locked = item.type === 'premium' && !isPremium;
                const selected = editForm.layout === item.name;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.editLayoutChip, selected && styles.editLayoutChipActive, locked && styles.editLayoutChipLocked]}
                    onPress={() => !readOnly && chooseEditLayout(item.name)}
                    activeOpacity={0.86}
                  >
                    <Feather name={locked ? 'lock' : item.type === 'premium' ? 'star' : 'image'} size={14} color={selected ? ORANGE : MUTED} />
                    <Text style={[styles.editLayoutChipText, selected && styles.editLayoutChipTextActive]} numberOfLines={2}>{item.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {memories.length > 0 && (
              <View style={styles.memoryBox}>
                <Text style={styles.memoryBoxTitle}>Original memories</Text>
                {memories.map((memory, index) => (
                  <Text key={`${memory}-${index}`} style={styles.memoryLine}>{memory}</Text>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveButton, readOnly && styles.saveButtonDisabled]}
              onPress={saveEntry}
              disabled={readOnly || saving}
              activeOpacity={0.86}
            >
              <Feather name="save" size={17} color="#fff" />
              <Text style={styles.saveText}>{readOnly ? 'Sample Entry' : saving ? 'Saving...' : 'Save Entry'}</Text>
            </TouchableOpacity>
            {!readOnly && (
              <TouchableOpacity style={styles.deleteButton} onPress={deleteEntry} activeOpacity={0.86}>
                <Feather name="trash-2" size={17} color="#B43324" />
                <Text style={styles.deleteText}>Delete Entry</Text>
              </TouchableOpacity>
            )}
              </View>
            </>
          )}
        </ScrollView>
        <PhotoViewerModal
          photos={entryPhotos}
          index={viewerIndex}
          visible={viewerOpen}
          onClose={() => setViewerOpen(false)}
          onIndex={setViewerIndex}
        />
        <PremiumModal visible={premiumVisible} mode="templates" onClose={() => setPremiumVisible(false)} />
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: top + 14, paddingBottom: bottom }} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Journal</Text>
          <Text style={styles.subtitle}>All your Beans in one beautiful journal</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(tabs)/create')}>
          <Feather name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.journalMascotCard, shelfIsWide ? styles.journalMascotCardWide : styles.journalMascotCardStacked]}>
        <View style={styles.shelfMascotWrap}>
          <CreateBeanMascot size={shelfIsWide ? 96 : 86} frameless bubble="heart" />
        </View>
        <View style={[styles.shelfContent, shelfIsWide ? styles.shelfContentWide : styles.shelfContentStacked]}>
          <Text style={styles.journalMascotTitle}>Your Travel Shelf</Text>
          <Text style={styles.journalMascotText}>Open a Bean to edit its story, update the collage, or turn it into a blog post.</Text>
          <View style={styles.shelfStatsRow}>
            <View style={styles.shelfStatPill}>
              <Feather name="book-open" size={13} color="#FFE7D6" />
              <Text style={styles.shelfStatText}>{beans.length} Beans saved</Text>
            </View>
            <TouchableOpacity style={styles.shelfBlogAction} onPress={openTravelBlog} activeOpacity={0.84}>
              <Feather name="globe" size={13} color="#153A46" />
              <Text style={styles.shelfBlogActionText}>Open Travel Blog</Text>
              <Feather name="arrow-right" size={13} color="#153A46" />
            </TouchableOpacity>
          </View>
          <View style={[styles.webShelfPanel, shelfIsWide && styles.webShelfPanelWide]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.webShelfTitle}>Edit blog on web</Text>
              <Text style={styles.webShelfText}>Send yourself a link to manage posts, drafts, and publishing from your laptop.</Text>
            </View>
            <TouchableOpacity
              style={[styles.webShelfButton, emailingDashboardLink && styles.webShelfButtonDisabled]}
              onPress={sendDashboardLink}
              activeOpacity={0.86}
              disabled={emailingDashboardLink}
            >
              {emailingDashboardLink ? (
                <ActivityIndicator color="#153A46" />
              ) : (
                <>
                  <Feather name="mail" size={14} color="#153A46" />
                  <Text style={styles.webShelfButtonText}>Email web link</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.premiumTestingCard} onPress={togglePremiumTesting} activeOpacity={0.88}>
        <View style={styles.premiumTestingIcon}>
          <Feather name={isPremium ? 'zap' : 'star'} size={18} color={ORANGE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.premiumTestingTitle}>Testing premium features</Text>
          <Text style={styles.premiumTestingText}>
            {isPremium ? `Blog publishing is on (${subscriptionPlan}).` : 'Turn on public blog publishing, HD exports, and shareable links.'}
          </Text>
        </View>
        <View style={[styles.testingSwitch, isPremium && styles.testingSwitchOn]}>
          <View style={[styles.testingKnob, isPremium && styles.testingKnobOn]} />
        </View>
      </TouchableOpacity>

      <View style={styles.searchRow}>
        <Feather name="search" size={18} color={MUTED} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search Beans" placeholderTextColor="#A98B7A" style={styles.searchInput} />
      </View>

      <View style={styles.grid}>
        {filtered.map(bean => {
          const heroPhoto = primaryPhoto(bean);
          const title = beanTitle(bean);
          const summary = journalMemoryText(bean);
          return (
            <TouchableOpacity
              key={bean.id}
              style={styles.beanCard}
              onPress={() => router.push({ pathname: '/(tabs)/journal', params: { id: bean.id } } as any)}
              activeOpacity={0.88}
            >
              <View style={styles.journalPhotoFrame}>
                <Image source={{ uri: heroPhoto }} style={styles.journalHeroPhoto} contentFit="cover" contentPosition="top center" />
                <View style={styles.photoShade} />
                <View style={styles.photoOpenBadge}>
                  <Feather name="maximize-2" size={13} color="#fff" />
                </View>
              </View>
              <View style={styles.journalCardBody}>
                <Text style={styles.journalPlace} numberOfLines={1}>{bean.name}, {bean.country}</Text>
                <Text style={styles.journalDate}>{formatDate(bean.dateVisited)}</Text>
                <Text style={styles.journalMemoryTitle} numberOfLines={2}>{title}</Text>
                {summary && summary !== title ? <Text style={styles.journalSummary} numberOfLines={2}>{summary}</Text> : null}
                <View style={styles.viewCollageRow}>
                  <Feather name="image" size={14} color={ORANGE} />
                  <Text style={styles.viewCollageText}>Tap to view</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <PremiumModal visible={premiumVisible} mode="templates" onClose={() => setPremiumVisible(false)} />
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Feather.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Feather name={icon} size={15} color={ORANGE} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function PhotoViewerModal({
  photos,
  index,
  visible,
  onClose,
  onIndex,
}: {
  photos: string[];
  index: number;
  visible: boolean;
  onClose: () => void;
  onIndex: (index: number) => void;
}) {
  const viewerRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const safeIndex = Math.max(0, Math.min(index, Math.max(photos.length - 1, 0)));

  useEffect(() => {
    if (!visible) return;
    const handle = setTimeout(() => {
      viewerRef.current?.scrollTo({ x: safeIndex * width, animated: false });
    }, 40);
    return () => clearTimeout(handle);
  }, [safeIndex, visible, width]);

  function handleViewerScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const width = event.nativeEvent.layoutMeasurement.width;
    if (!width) return;
    onIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  }

  function step(direction: -1 | 1) {
    const next = Math.max(0, Math.min(safeIndex + direction, photos.length - 1));
    onIndex(next);
    viewerRef.current?.scrollTo({ x: next * width, animated: true });
  }

  if (!photos.length) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        <View style={styles.viewerHeader}>
          <Text style={styles.viewerCount}>{safeIndex + 1}/{photos.length}</Text>
          <TouchableOpacity accessibilityLabel="Close photo viewer" style={styles.viewerClose} onPress={onClose} activeOpacity={0.86}>
            <Feather name="x" size={21} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView
          ref={viewerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleViewerScroll}
          scrollEventThrottle={16}
          style={styles.viewerScroller}
        >
          {photos.map((uri, photoIndex) => (
            <View key={`${uri}-viewer-${photoIndex}`} style={[styles.viewerSlide, { width }]}>
              <Image source={{ uri }} style={styles.viewerImage} contentFit="contain" />
            </View>
          ))}
        </ScrollView>
        {photos.length > 1 && (
          <View style={styles.viewerControls}>
            <TouchableOpacity style={[styles.viewerArrow, safeIndex === 0 && styles.viewerArrowDisabled]} onPress={() => step(-1)} disabled={safeIndex === 0}>
              <Feather name="chevron-left" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.viewerArrow, safeIndex === photos.length - 1 && styles.viewerArrowDisabled]} onPress={() => step(1)} disabled={safeIndex === photos.length - 1}>
              <Feather name="chevron-right" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

function editablePromptResponses(bean: VisitedPlace): PromptResponse[] {
  if (bean.promptResponses?.length) {
    return bean.promptResponses.map((item, index) => ({
      id: item.id || `prompt-${index}`,
      prompt: item.prompt || STORY_PROMPTS[index] || `Memory ${index + 1}`,
      response: item.response ?? '',
      photoId: item.photoId,
    }));
  }

  const memories = memoryResponses(bean);
  return STORY_PROMPTS.map((prompt, index) => ({
    id: `prompt-${index}`,
    prompt,
    response: memories[index] ?? (index === 0 ? journalMemoryText(bean) : ''),
  }));
}

function editablePhotos(bean: VisitedPlace): BeanPhoto[] {
  if (bean.photos?.length) return bean.photos;
  return [{ id: `${bean.id}-primary-photo`, imageUrl: primaryPhoto(bean) }];
}

function albumPhotoUris(bean: VisitedPlace) {
  const uris = (bean.photos?.map(photo => photo.imageUrl) ?? [primaryPhoto(bean)]).filter(Boolean);
  const seen = new Set<string>();
  return uris.filter(uri => {
    if (seen.has(uri)) return false;
    seen.add(uri);
    return true;
  }).slice(0, 8);
}

function quoteSearchText(quote: TravelQuote) {
  return `${quote.text} ${quote.author} ${quote.categories.join(' ')} ${quote.moodTags.join(' ')}`.toLowerCase();
}

function normalizeMood(value?: string): BeanMood | '' {
  return MOODS.includes(value as BeanMood) ? value as BeanMood : '';
}

function quotePlacementForLayout(layout: BeanLayout | string): QuotePlacement {
  if (layout === 'Film Strip') return 'film_subtitle';
  if (isPremiumLayout(layout)) return 'elegant_overlay';
  return 'none';
}

function routeParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getExtraNotes(bean: VisitedPlace) {
  return bean.notes
    .split('More notes:\n')[1]
    ?.split('\n\nMood:')[0]
    ?.split('\n\nLayout:')[0]
    ?.trim() ?? '';
}

function getSavedMood(bean: VisitedPlace) {
  return bean.notes.match(/(?:^|\n)Mood:\s*([^\n]+)/i)?.[1]?.trim() ?? '';
}

function getSavedLayout(bean: VisitedPlace): BeanLayout {
  const saved = bean.selectedLayout ?? bean.notes.match(/(?:^|\n)Layout:\s*([^\n]+)/i)?.[1]?.trim();
  if (saved === 'Full Photo') return 'Boarding Pass';
  if (saved === 'Split Collage') return 'Editorial Grid';
  if (saved === 'Postcard Stack') return 'Polaroid Stack';
  if (LAYOUTS.some(layout => layout.name === saved)) return saved as BeanLayout;
  return 'Polaroid Stack';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAPER },
  header: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { color: INK, fontSize: 28, fontFamily: 'Inter_700Bold' },
  subtitle: { color: MUTED, fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 3 },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  journalMascotCard: { marginHorizontal: 16, marginBottom: 12, borderRadius: 26, borderWidth: 1, borderColor: '#2A5D5F', backgroundColor: '#153A46', padding: 18, gap: 16, shadowColor: '#12313B', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.22, shadowRadius: 28, elevation: 8 },
  journalMascotCardWide: { flexDirection: 'row', alignItems: 'center' },
  journalMascotCardStacked: { alignItems: 'center' },
  shelfMascotWrap: { alignItems: 'center', justifyContent: 'center' },
  shelfContent: { flex: 1 },
  shelfContentWide: { minWidth: 0 },
  shelfContentStacked: { width: '100%' },
  journalMascotTitle: { color: '#FFF8EF', fontSize: 22, lineHeight: 27, fontFamily: 'Inter_700Bold' },
  journalMascotText: { color: '#D9EFF7', fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', marginTop: 5 },
  shelfStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  shelfStatPill: { minHeight: 32, borderRadius: 16, backgroundColor: 'rgba(255,248,239,0.14)', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6 },
  shelfStatText: { color: '#FFE7D6', fontSize: 11, fontFamily: 'Inter_700Bold' },
  shelfBlogAction: { minHeight: 32, borderRadius: 16, backgroundColor: '#FFE7D6', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  shelfBlogActionText: { color: '#153A46', fontSize: 11, fontFamily: 'Inter_700Bold' },
  webShelfPanel: { marginTop: 13, borderRadius: 18, backgroundColor: 'rgba(255,248,239,0.10)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,231,214,0.22)', padding: 12, gap: 10 },
  webShelfPanelWide: { flexDirection: 'row', alignItems: 'center' },
  webShelfTitle: { color: '#FFF8EF', fontSize: 14, fontFamily: 'Inter_700Bold' },
  webShelfText: { color: '#D9EFF7', fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', marginTop: 3 },
  webShelfButton: { alignSelf: 'flex-start', minHeight: 36, borderRadius: 18, backgroundColor: '#FFE7D6', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  webShelfButtonDisabled: { opacity: 0.72 },
  webShelfButtonText: { color: '#153A46', fontSize: 12, fontFamily: 'Inter_700Bold' },
  premiumTestingCard: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, borderWidth: 1, borderColor: '#F2C3A3', backgroundColor: '#FFF1E6', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  premiumTestingIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' },
  premiumTestingTitle: { color: INK, fontSize: 15, fontFamily: 'Inter_700Bold' },
  premiumTestingText: { color: MUTED, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  testingSwitch: { width: 52, height: 30, borderRadius: 15, padding: 3, backgroundColor: '#E0C5B4', justifyContent: 'center' },
  testingSwitchOn: { backgroundColor: ORANGE },
  testingKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', shadowColor: '#8B5B38', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6, elevation: 2 },
  testingKnobOn: { alignSelf: 'flex-end' },
  searchRow: { marginHorizontal: 16, height: 48, borderRadius: 15, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: INK, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  grid: { width: '100%', maxWidth: 1060, alignSelf: 'center', paddingHorizontal: 14, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14 },
  beanCard: {
    width: Platform.OS === 'web' ? '48%' : '100%',
    maxWidth: 520,
    minWidth: 280,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    overflow: 'hidden',
    shadowColor: '#8B5B38',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 22,
    elevation: 5,
  },
  journalPhotoFrame: { position: 'relative', width: '100%', aspectRatio: 0.92, backgroundColor: '#EAD2C2' },
  journalHeroPhoto: { width: '100%', height: '100%' },
  photoShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 92, backgroundColor: 'rgba(42,23,20,0.18)' },
  photoOpenBadge: { position: 'absolute', right: 13, bottom: 13, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(242,106,46,0.92)', alignItems: 'center', justifyContent: 'center' },
  journalCardBody: { flex: 1, padding: 17 },
  journalPlace: { color: INK, fontSize: 18, fontFamily: 'Inter_700Bold' },
  journalDate: { color: MUTED, fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 3 },
  journalMemoryTitle: { color: INK, fontSize: 21, lineHeight: 25, fontFamily: 'Inter_700Bold', marginTop: 11 },
  journalSummary: { color: MUTED, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium', marginTop: 7 },
  viewCollageRow: { marginTop: 'auto', minHeight: 36, borderRadius: 18, backgroundColor: '#FFF1E6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  viewCollageText: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1E6' },
  detailTitle: { color: INK, fontSize: 24, fontFamily: 'Inter_700Bold' },
  detailExitRow: { width: '100%', maxWidth: 620, alignSelf: 'center', flexDirection: 'row', gap: 9, marginBottom: 14 },
  detailExitButton: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: 10 },
  detailExitPrimary: { backgroundColor: ORANGE, borderColor: ORANGE },
  detailExitText: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold' },
  detailExitPrimaryText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  actualCollageStage: { width: '100%', alignItems: 'center' },
  collageTapTarget: { width: '100%', alignItems: 'center' },
  collageCapture: { width: '100%', maxWidth: 640, alignSelf: 'center' },
  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(18,12,10,0.96)', justifyContent: 'center' },
  viewerHeader: { position: 'absolute', left: 18, right: 18, top: Platform.OS === 'web' ? 18 : 46, zIndex: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewerCount: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_700Bold' },
  viewerClose: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  viewerScroller: { flex: 1 },
  viewerSlide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  viewerImage: { width: '100%', height: '82%' },
  viewerControls: { position: 'absolute', left: 18, right: 18, bottom: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewerArrow: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  viewerArrowDisabled: { opacity: 0.35 },
  editorMascotCard: { marginBottom: 14, borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  editorMascotTitle: { color: INK, fontSize: 16, fontFamily: 'Inter_700Bold' },
  editorMascotText: { color: MUTED, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', marginTop: 3 },
  editorPreviewWrap: { width: '100%', maxWidth: 640, alignSelf: 'center', marginBottom: 14 },
  editorCard: { borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 15 },
  formRow: { flexDirection: 'row', gap: 10 },
  label: { color: MUTED, fontSize: 12, fontFamily: 'Inter_700Bold', marginBottom: 6, marginTop: 10 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFF8EF', paddingHorizontal: 12, paddingVertical: 10, color: INK, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  lockedInput: { color: MUTED, backgroundColor: '#FFF3E8' },
  summaryInput: { minHeight: 116, textAlignVertical: 'top', lineHeight: 20, paddingTop: 12 },
  notesInput: { minHeight: 156, textAlignVertical: 'top', lineHeight: 20, paddingTop: 12 },
  quoteInput: { minHeight: 82, textAlignVertical: 'top', lineHeight: 20, paddingTop: 12 },
  quoteDropdownButton: { minHeight: 48, borderRadius: 16, borderWidth: 1, borderColor: '#E8C8B1', backgroundColor: '#FFF8EF', flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, marginBottom: 9 },
  quoteDropdownText: { flex: 1, color: INK, fontSize: 14, fontFamily: 'Inter_700Bold' },
  quoteDropdownPanel: { borderRadius: 18, borderWidth: 1, borderColor: '#F0D4BF', backgroundColor: '#FFFDF8', padding: 10, marginBottom: 10 },
  quoteSearchRow: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: '#E8C8B1', backgroundColor: '#FFF8EF', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, marginBottom: 9 },
  quoteSearchInput: { flex: 1, color: INK, fontSize: 14, fontFamily: 'Inter_600SemiBold', paddingVertical: 9 },
  quoteSearchClear: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1E6' },
  journalQuoteResults: { gap: 8, marginBottom: 10 },
  journalQuoteCard: { borderRadius: 14, borderWidth: 1, borderColor: '#EED0BA', backgroundColor: '#FFFDF8', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  journalQuoteCardActive: { borderColor: ORANGE, backgroundColor: '#FFF1E6' },
  journalQuoteText: { color: INK, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_700Bold' },
  journalQuoteAuthor: { color: MUTED, fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 4 },
  journalQuoteUseButton: { minWidth: 58, minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: ORANGE, backgroundColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  journalQuoteUseButtonActive: { backgroundColor: ORANGE },
  journalQuoteUseText: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold' },
  journalQuoteUseTextActive: { color: '#fff' },
  quoteEmptySearch: { color: MUTED, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold', fontStyle: 'italic', paddingVertical: 4 },
  editPromptBox: { borderRadius: 14, backgroundColor: '#FFF7EC', borderWidth: 1, borderColor: '#F4D9C3', padding: 12, marginBottom: 9 },
  editPromptQuestion: { color: INK, fontSize: 12, fontFamily: 'Inter_700Bold', marginBottom: 7 },
  editPromptInput: { minHeight: 58, color: INK, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', padding: 0, textAlignVertical: 'top' },
  editPhotoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoOrderHint: { color: MUTED, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', marginTop: -2, marginBottom: 9 },
  editPhotoTileWrap: { position: 'relative', width: 112, minHeight: 160 },
  editPhotoTile: { width: 112, height: 104, borderRadius: 18, backgroundColor: '#EAD2C2' },
  editPhotoRemove: { position: 'absolute', top: -7, right: -7, width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: CARD, backgroundColor: '#B43324', alignItems: 'center', justifyContent: 'center' },
  editPhotoIndexBadge: { position: 'absolute', top: 7, left: 7, minHeight: 23, borderRadius: 12, backgroundColor: 'rgba(42,23,20,0.62)', paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  editPhotoCoverBadge: { backgroundColor: 'rgba(242,106,46,0.95)' },
  editPhotoIndexText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },
  editPhotoOrderControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 7 },
  editPhotoOrderButton: { width: 32, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#E8C8B1', backgroundColor: '#FFF8EF', alignItems: 'center', justifyContent: 'center' },
  editPhotoOrderButtonDisabled: { opacity: 0.45 },
  makeCoverButton: { marginTop: 6, minHeight: 26, borderRadius: 13, borderWidth: 1, borderColor: '#F2C3A3', backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  makeCoverText: { color: ORANGE, fontSize: 10, fontFamily: 'Inter_700Bold' },
  editPhotoAdd: { width: 108, height: 96, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: ORANGE, backgroundColor: '#FFF7EC', alignItems: 'center', justifyContent: 'center', gap: 5 },
  editPhotoAddText: { color: ORANGE, fontSize: 11, fontFamily: 'Inter_700Bold' },
  editChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editMoodChip: { minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFF8EF', paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  editMoodChipActive: { borderColor: ORANGE, backgroundColor: '#FFF1E6' },
  editMoodChipText: { color: INK, fontSize: 12, fontFamily: 'Inter_700Bold' },
  editMoodChipTextActive: { color: ORANGE },
  editLayoutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editLayoutChip: { width: Platform.OS === 'web' ? '23.7%' : '48.5%', minHeight: 74, borderRadius: 14, borderWidth: 1, borderColor: '#E8C8B1', backgroundColor: '#FFF8EF', padding: 10, gap: 6, justifyContent: 'space-between' },
  editLayoutChipActive: { borderColor: ORANGE, borderWidth: 2, backgroundColor: '#FFF1E6' },
  editLayoutChipLocked: { opacity: 0.76 },
  editLayoutChipText: { color: INK, fontSize: 11, lineHeight: 15, fontFamily: 'Inter_700Bold' },
  editLayoutChipTextActive: { color: ORANGE },
  clearQuoteButton: { marginTop: 9, alignSelf: 'flex-start', minHeight: 36, borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFF7EC', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  clearQuoteText: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold' },
  memoryBox: { marginTop: 14, borderRadius: 14, backgroundColor: '#FFF1E6', padding: 13, gap: 8 },
  memoryBoxTitle: { color: INK, fontSize: 14, fontFamily: 'Inter_700Bold' },
  memoryLine: { color: MUTED, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium' },
  saveButton: { marginTop: 16, minHeight: 50, borderRadius: 25, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  saveButtonDisabled: { backgroundColor: '#D1B6A5' },
  saveText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  deleteButton: { marginTop: 10, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: '#F1B7AC', backgroundColor: '#FFF3F0', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  deleteText: { color: '#B43324', fontSize: 15, fontFamily: 'Inter_700Bold' },
  detailActions: { width: '100%', maxWidth: 620, alignSelf: 'center', flexDirection: 'row', gap: 8, marginTop: 12 },
  detailActionButton: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  detailActionText: { color: INK, fontSize: 12, fontFamily: 'Inter_700Bold' },
  blogDraftButton: { width: '100%', maxWidth: 620, alignSelf: 'center', marginTop: 10, minHeight: 52, borderRadius: 26, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  blogDraftText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  infoPanel: { marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 14 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  infoTitle: { color: INK, fontSize: 18, fontFamily: 'Inter_700Bold' },
  infoPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: '#FFF1E6' },
  infoPillText: { color: ORANGE, fontSize: 11, fontFamily: 'Inter_700Bold' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EACCB8' },
  infoIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center' },
  infoLabel: { color: MUTED, fontSize: 11, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  infoValue: { color: INK, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  infoSectionLabel: { color: INK, fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 14, marginBottom: 6 },
  infoBody: { color: MUTED, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_500Medium' },
  longEntryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  inlineEditText: { color: ORANGE, fontSize: 13, fontFamily: 'Inter_700Bold', marginTop: 14, marginBottom: 6 },
  emptyEntryText: { color: '#A98B7A', fontSize: 14, lineHeight: 21, fontFamily: 'Inter_500Medium', fontStyle: 'italic' },
  promptMemory: { borderRadius: 13, backgroundColor: '#FFF8EF', borderWidth: 1, borderColor: BORDER, padding: 11, marginBottom: 8 },
  promptMemoryQuestion: { color: INK, fontSize: 12, fontFamily: 'Inter_700Bold', marginBottom: 5 },
  promptMemoryAnswer: { color: MUTED, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium' },
});
