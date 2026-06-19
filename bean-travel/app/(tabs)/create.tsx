import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ImageStyle, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextStyle, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import BeanCollageCard, { TemplateBeanMascotMark } from '@/components/BeanCollageCard';
import CreateBeanMascot from '@/components/CreateBeanMascot';
import PremiumModal from '@/components/PremiumModal';
import { useApp } from '@/context/AppContext';
import { ProviderPlaceSuggestion, searchPredictivePlaces } from '@/services/placeSearch';
import { persistBeanPhotos } from '@/utils/photoPersistence';
import {
  QUOTE_CATEGORIES,
  quotesForCategory,
  suggestQuotesForMood,
  type QuoteCategory,
  type QuotePlacement,
  type QuoteSourceType,
  type TravelQuote,
} from '@/utils/quoteLibrary';
import {
  ACTIVE_LAYOUTS, BeanLayout, BeanMood, fallbackPhoto, FREE_PHOTO_LIMIT, isPremiumLayout, type LayoutConfig, makeBeanPlace, MOODS, photoLimitForPremium, randomStoryPrompts, SAMPLE_BEANS, STORY_PROMPTS, TravelBeanDraft,
} from '@/utils/travelBeanMvp';
import { BeanPhoto, PromptResponse } from '@/types';

type Step = 'photos' | 'story' | 'look' | 'result';

const INK = '#2A1714';
const MUTED = '#7B6258';
const ORANGE = '#F26A2E';
const PAPER = '#FFF8EF';
const CARD = '#FFFDF8';
const BORDER = '#F1D7C5';
const NO_WORD_BREAK = { wordBreak: 'keep-all', overflowWrap: 'normal' } as unknown as TextStyle;
const GRAYSCALE_IMAGE_STYLE = Platform.OS === 'web' ? ({ filter: 'grayscale(1)' } as unknown as ImageStyle) : undefined;
const PREMIUM_TEXT_POSTCARDS = new Set([
  'This Is Postcard',
  'Wish You Were Here',
  'Snapshots Postcard',
  'City Cover',
  'Black City Postcard',
  'Any City Mosaic',
  'Seek Travel',
  'Mountain Postcard',
  'Temple Heritage',
  'Break Postcard',
  'Destination Sidebar',
  'Greetings Grid',
  'Masthead Postcard',
  'Pinned Snapshot',
]);

const PREVIEW_TEXTURE_DOTS = [
  { left: '10%', top: '13%', size: 2 },
  { left: '24%', top: '72%', size: 2 },
  { left: '41%', top: '24%', size: 2 },
  { left: '58%', top: '82%', size: 2 },
  { left: '73%', top: '18%', size: 2 },
  { left: '88%', top: '62%', size: 2 },
] as const;

const STORY_PLACEHOLDERS: Record<string, string> = {
  'What made this place special?': 'The sunsets were unreal and everything felt peaceful.',
  'What is one moment you will remember?': 'Exploring the little streets with no plan.',
  'How did this trip make you feel?': 'Grateful, happy, and inspired.',
  'What tiny detail do you not want to forget?': 'The warm light on the walls, the quiet after dinner...',
  'What did this place smell, sound, or feel like?': 'Sea air, bells in the distance, warm stone underfoot...',
  'Who were you with, and what made it sweet?': 'Just us, laughing over tiny things all afternoon.',
  'What surprised you here?': 'How peaceful it felt once we slowed down.',
  'What would you tell future-you about this moment?': 'Remember how simple and happy this felt.',
  'What did you find by accident?': 'A little side street we never would have planned.',
  'What felt different from home?': 'The pace, the colors, the way everyone lingered outside.',
  'What color or light do you remember most?': 'Gold on the rooftops and soft pink in the sky.',
  'What made you smile here?': 'The tiny tables, the music, and getting a little lost.',
  'What did you eat, hear, or notice?': 'Fresh bread, clinking glasses, and waves below.',
  'What was the best slow moment?': 'Sitting with nowhere to be and watching the day change.',
  'What would make you want to come back?': 'That feeling of being completely present.',
};

function createPromptResponses(prompts: readonly string[]) {
  const stamp = Date.now();
  return prompts.map((prompt, index) => ({
    id: `prompt-${stamp}-${index}`,
    prompt,
    response: '',
  }));
}

function storyPlaceholder(prompt: string, index: number) {
  const fallback = [
    'A detail you want to keep...',
    'A tiny moment from the day...',
    'A feeling you want to remember...',
  ];
  return STORY_PLACEHOLDERS[prompt] ?? fallback[index % fallback.length];
}

function sortLayoutsForPhotoCount(layouts: LayoutConfig[], photoCount: number) {
  return [...layouts].sort((a, b) => layoutFitScore(b.name, photoCount) - layoutFitScore(a.name, photoCount));
}

function isRecommendedLayout(layout: BeanLayout, photoCount: number) {
  return layoutFitScore(layout, photoCount) >= 90;
}

function layoutFitLabel(layout: BeanLayout, photoCount: number) {
  const count = Math.min(Math.max(photoCount, 1), 8);
  if (isRecommendedLayout(layout, count)) return `Best for ${count} photo${count === 1 ? '' : 's'}`;
  if (layoutFitScore(layout, count) >= 70) return `Good for ${count}`;
  return '';
}

function layoutFitScore(layout: BeanLayout, photoCount: number) {
  const count = Math.min(Math.max(photoCount, 1), 8);
  const bestByCount: Record<number, BeanLayout[]> = {
    1: ['Mountain Postcard', 'Black City Postcard', 'Break Postcard', 'Masthead Postcard', 'This Is Postcard', 'Pinned Snapshot', 'Classic Postcard'],
    2: ['Temple Heritage', 'Seek Travel', 'Destination Sidebar', 'Pinned Snapshot', 'Classic Postcard', 'Polaroid Stack'],
    3: ['Food Trip', 'Boarding Pass', 'Airmail Border', 'Polaroid Stack'],
    4: ['Food Trip', 'Boarding Pass', 'Editorial Grid', 'Airmail Border'],
    5: ['Any City Mosaic', 'Greetings Grid', 'Film Strip', 'Airmail Border', 'Editorial Grid'],
    6: ['Greetings Grid', 'Film Strip', 'Airmail Border', 'Any City Mosaic'],
    7: ['Snapshots Postcard', 'Greetings Grid', 'Film Strip'],
    8: ['Snapshots Postcard', 'Wish You Were Here', 'Greetings Grid'],
  };
  const goodByCount: Record<number, BeanLayout[]> = {
    1: ['Seek Travel', 'City Cover', 'Destination Sidebar', 'Masthead Postcard'],
    2: ['Food Trip', 'Boarding Pass', 'Airmail Border', 'Masthead Postcard'],
    3: ['Temple Heritage', 'Classic Postcard', 'Airmail Border', 'Editorial Grid'],
    4: ['Any City Mosaic', 'Greetings Grid', 'Film Strip', 'Classic Postcard'],
    5: ['Food Trip', 'Airmail Border', 'Boarding Pass', 'Editorial Grid'],
    6: ['Any City Mosaic', 'Editorial Grid', 'Airmail Border', 'Wish You Were Here'],
    7: ['Film Strip', 'Greetings Grid', 'Snapshots Postcard'],
    8: ['Film Strip', 'Greetings Grid', 'Wish You Were Here'],
  };
  if (bestByCount[count]?.includes(layout)) return 100;
  if (goodByCount[count]?.includes(layout)) return 75;
  return 20;
}

export default function CreateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addPlace, editPlace, isPremium, canCreateBean } = useApp();
  const [step, setStep] = useState<Step>('photos');
  const [place, setPlace] = useState('Santorini');
  const [country, setCountry] = useState('Greece');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [photos, setPhotos] = useState<BeanPhoto[]>([]);
  const [responses, setResponses] = useState<PromptResponse[]>(() => createPromptResponses(STORY_PROMPTS));
  const [layout, setLayout] = useState<BeanLayout>('Polaroid Stack');
  const [mood, setMood] = useState<BeanMood>('Cozy');
  const [saving, setSaving] = useState(false);
  const [placeSuggestions, setPlaceSuggestions] = useState<ProviderPlaceSuggestion[]>([]);
  const [showPlaceSuggestions, setShowPlaceSuggestions] = useState(false);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [premiumVisible, setPremiumVisible] = useState(false);
  const [premiumMode, setPremiumMode] = useState<'templates' | 'limit' | 'export' | 'quotes'>('templates');
  const [pendingLayout, setPendingLayout] = useState<BeanLayout | null>(null);
  const [selectedQuoteText, setSelectedQuoteText] = useState<string | null>(null);
  const [selectedQuoteAuthor, setSelectedQuoteAuthor] = useState<string | null>(null);
  const [quoteSourceType, setQuoteSourceType] = useState<QuoteSourceType>('none');
  const [quoteModal, setQuoteModal] = useState<'suggested' | 'browse' | 'custom' | null>(null);
  const [quoteCategory, setQuoteCategory] = useState<QuoteCategory>('All');
  const [customQuote, setCustomQuote] = useState('');
  const [includeMascotMark, setIncludeMascotMark] = useState(false);
  const [resultEditVisible, setResultEditVisible] = useState(false);
  const [savedBeanId, setSavedBeanId] = useState<string | null>(null);
  const shotRef = useRef<any>(null);
  const didLeaveCreateRef = useRef(false);

  const top = Platform.OS === 'web' ? 56 : insets.top;
  const bottom = Platform.OS === 'web' ? 112 : 112 + insets.bottom;
  const heroPhoto = photos[0]?.imageUrl ?? fallbackPhoto(country);
  const progress = step === 'photos' ? 1 : step === 'story' ? 2 : 3;
  const storyText = useMemo(() => responses.map(r => r.response.trim()).filter(Boolean).join(' '), [responses]);
  const draftTitle = useMemo(() => `${place.trim() || 'Travel'} memories`, [place]);
  const photoLimit = photoLimitForPremium(isPremium);
  const captureOptions = useMemo(() => ({
    format: isPremium ? 'png' : 'jpg',
    quality: isPremium ? 1 : 0.82,
  }), [isPremium]);
  const selectedPhotoCount = Math.max(photos.length || 1, 1);
  const freeLayouts = useMemo(() => sortLayoutsForPhotoCount(ACTIVE_LAYOUTS, selectedPhotoCount), [selectedPhotoCount]);
  const premiumLayouts = useMemo<LayoutConfig[]>(() => [], []);
  const selectedLayoutIsPremium = isPremiumLayout(layout);
  const quotePlacement = useMemo<QuotePlacement>(() => {
    return 'none';
  }, []);
  const suggestedQuotes = useMemo(() => suggestQuotesForMood(mood), [mood]);
  const browsedQuotes = useMemo(() => quotesForCategory(quoteCategory), [quoteCategory]);
  const quoteStyleName = quotePlacementLabel(quotePlacement);

  useEffect(() => {
    if (!isPremium && isPremiumLayout(layout)) {
      setLayout('Polaroid Stack');
    }
    if ((!isPremium || !isPremiumLayout(layout)) && selectedQuoteText) {
      clearQuote();
    }
  }, [isPremium, layout, selectedQuoteText]);

  useEffect(() => {
    if (isPremium || photos.length <= FREE_PHOTO_LIMIT) return;
    setPhotos(prev => prev.slice(0, FREE_PHOTO_LIMIT));
  }, [isPremium, photos.length]);

  useEffect(() => {
    if (step !== 'photos') return;
    const query = place.trim();
    if (query.length < 2) {
      setPlaceSuggestions([]);
      setSearchingPlaces(false);
      return;
    }
    let cancelled = false;
    setSearchingPlaces(true);
    const timer = setTimeout(async () => {
      const results = await searchPredictivePlaces(query);
      if (cancelled) return;
      const exact = results[0]?.name.toLowerCase() === query.toLowerCase() && results[0]?.country === country;
      setPlaceSuggestions(exact ? results.slice(1) : results);
      setSearchingPlaces(false);
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [country, place, step]);

  useFocusEffect(
    useCallback(() => {
      if (didLeaveCreateRef.current) {
        resetCreateSession();
      }
      didLeaveCreateRef.current = false;
      return () => {
        didLeaveCreateRef.current = true;
      };
    }, [])
  );

  async function pickPhotos() {
    const slotsLeft = photoLimit - photos.length;
    if (slotsLeft <= 0) {
      Alert.alert(`${photoLimit} photos selected`, 'Remove a photo before adding another.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to add travel memories.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: slotsLeft,
      quality: 0.86,
    });
    if (result.canceled) return;
    const incoming = result.assets.map((asset, index) => ({
      id: asset.assetId ?? asset.uri ?? `${Date.now()}-${index}`,
      imageUrl: asset.uri,
    }));
    setPhotos(prev => {
      const seen = new Set(prev.flatMap(photo => [photo.id, photo.imageUrl]));
      const uniqueIncoming = incoming.filter(photo => {
        if (seen.has(photo.id) || seen.has(photo.imageUrl)) return false;
        seen.add(photo.id);
        seen.add(photo.imageUrl);
        return true;
      });
      return [...prev, ...uniqueIncoming].slice(0, photoLimit);
    });
    Haptics.selectionAsync();
  }

  function removePhoto(photoId: string) {
    setPhotos(prev => prev.filter(photo => photo.id !== photoId));
    Haptics.selectionAsync();
  }

  function useSamplePhotos() {
    const sample = SAMPLE_BEANS.find(bean => bean.country.toLowerCase() === country.trim().toLowerCase()) ?? SAMPLE_BEANS[0];
    setPhotos((sample.photos ?? []).slice(0, photoLimit));
    if (!place.trim()) setPlace(sample.name);
    if (!country.trim()) setCountry(sample.country);
    Haptics.selectionAsync();
  }

  function updateResponse(index: number, response: string) {
    setResponses(prev => prev.map((item, i) => i === index ? { ...item, response } : item));
  }

  function shuffleStoryQuestions() {
    const nextPrompts = randomStoryPrompts(responses.map(item => item.prompt));
    setResponses(createPromptResponses(nextPrompts));
    Haptics.selectionAsync();
  }

  function refreshStoryQuestion(index: number) {
    const currentPrompts = responses
      .filter((_, promptIndex) => promptIndex !== index)
      .map(item => item.prompt);
    const [nextPrompt] = randomStoryPrompts([
      ...currentPrompts,
      responses[index]?.prompt ?? '',
    ], 1);

    if (!nextPrompt) return;
    setResponses(prev => prev.map((item, promptIndex) => promptIndex === index
      ? { ...item, id: `prompt-${Date.now()}-${promptIndex}`, prompt: nextPrompt, response: '' }
      : item));
    Haptics.selectionAsync();
  }

  function skipStory() {
    setResponses(prev => prev.map(item => ({ ...item, response: '' })));
    setStep('look');
    Haptics.selectionAsync();
  }

  function updatePlace(text: string) {
    setPlace(text);
    setShowPlaceSuggestions(true);
  }

  function selectPlaceSuggestion(suggestion: ProviderPlaceSuggestion) {
    setPlace(suggestion.name);
    setCountry(suggestion.country);
    setShowPlaceSuggestions(false);
    setPlaceSuggestions([]);
    Haptics.selectionAsync();
  }

  function selectQuote(quote: TravelQuote) {
    setSelectedQuoteText(quote.text);
    setSelectedQuoteAuthor(quote.author);
    setQuoteSourceType('premium_library');
    setQuoteModal(null);
    Haptics.selectionAsync();
  }

  function clearQuote() {
    setSelectedQuoteText(null);
    setSelectedQuoteAuthor(null);
    setQuoteSourceType('none');
    setCustomQuote('');
  }

  function openQuoteModal(mode: 'suggested' | 'browse' | 'custom') {
    if (!isPremium || !selectedLayoutIsPremium) {
      setPremiumMode('quotes');
      setPremiumVisible(true);
      return;
    }
    if (mode === 'custom') setCustomQuote(selectedQuoteText && quoteSourceType === 'premium_custom' ? selectedQuoteText : '');
    setQuoteModal(mode);
  }

  function saveCustomQuote() {
    const next = customQuote.trim().slice(0, 180);
    if (!next) {
      Alert.alert('Add a quote', 'Write a short travel quote before saving.');
      return;
    }
    setSelectedQuoteText(next);
    setSelectedQuoteAuthor('You');
    setQuoteSourceType('premium_custom');
    setQuoteModal(null);
    Haptics.selectionAsync();
  }

  function next() {
    if (step === 'photos') setStep('story');
    if (step === 'story') setStep('look');
  }

  function currentDraft(draftPhotos: BeanPhoto[] = photos): TravelBeanDraft {
    return {
      place,
      country,
      date,
      photos: draftPhotos,
      responses,
      layout,
      mood,
      hasWatermark: !isPremium || includeMascotMark,
      exportQuality: isPremium ? 'hd' : 'standard',
      selectedQuoteText: null,
      selectedQuoteAuthor: null,
      quoteSourceType: 'none',
      quotePlacement: 'none',
      isPremiumQuoteStyle: false,
    };
  }

  async function saveBean() {
    if (!canCreateBean) {
      setPremiumMode('limit');
      setPremiumVisible(true);
      return;
    }
    if (!isPremium && isPremiumLayout(layout)) {
      setPremiumMode('templates');
      setPendingLayout(layout);
      setPremiumVisible(true);
      return;
    }
    setSaving(true);
    try {
      const persistedPhotos = await persistBeanPhotos(photos);
      setPhotos(persistedPhotos);
      const row = await addPlace(makeBeanPlace(currentDraft(persistedPhotos)));
      setSavedBeanId(row.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('result');
    } catch (error: any) {
      Alert.alert('Could not save Bean', error?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function saveResultBean() {
    setSaving(true);
    try {
      const persistedPhotos = await persistBeanPhotos(photos);
      setPhotos(persistedPhotos);
      const nextBean = makeBeanPlace(currentDraft(persistedPhotos));
      let targetId = savedBeanId;
      if (savedBeanId) {
        await editPlace(savedBeanId, nextBean);
      } else {
        const row = await addPlace(nextBean);
        setSavedBeanId(row.id);
        targetId = row.id;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({
        pathname: '/(tabs)/journal',
        params: targetId ? { id: targetId } : undefined,
      } as any);
    } catch (error: any) {
      Alert.alert('Could not save Bean', error?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function resetCreateSession() {
    setPhotos([]);
    setResponses(createPromptResponses(STORY_PROMPTS));
    setLayout('Polaroid Stack');
    setMood('Cozy');
    clearQuote();
    setSavedBeanId(null);
    setResultEditVisible(false);
    setStep('photos');
    setDate(new Date().toISOString().slice(0, 10));
  }

  function reset() {
    resetCreateSession();
  }

  function chooseLayout(item: LayoutConfig) {
    if (item.type === 'premium' && !isPremium) {
      setPendingLayout(item.name);
      setPremiumMode('templates');
      setPremiumVisible(true);
      return;
    }
    setLayout(item.name);
    if (!isPremiumLayout(item.name)) clearQuote();
    Haptics.selectionAsync();
  }

  function handlePremiumActivated() {
    if (pendingLayout) {
      setLayout(pendingLayout);
      setPendingLayout(null);
    }
  }

  async function captureBean() {
    const uri = await shotRef.current?.capture();
    if (!uri) throw new Error('Capture failed');
    return uri;
  }

  async function downloadBean() {
    if (exporting) return;
    setExporting(true);
    try {
      const uri = await captureBean();
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = uri;
        link.download = `${place || 'travel'}-bean.${isPremium ? 'png' : 'jpg'}`;
        link.click();
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Allow photo library access to save your Bean.');
          return;
        }
        await MediaLibrary.saveToLibraryAsync(uri);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Your Bean collage is ready.');
    } catch {
      Alert.alert('Could not download', 'Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function shareBean() {
    if (exporting) return;
    setExporting(true);
    try {
      const uri = await captureBean();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: isPremium ? 'image/png' : 'image/jpeg', dialogTitle: 'Share your Bean' });
      } else if (Platform.OS === 'web' && navigator.share) {
        await navigator.share({ title: `${place} Bean`, text: storyText || `${place}, ${country}` });
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

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: top + 14, paddingBottom: bottom + (step === 'story' ? 120 : 0) }}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => step === 'photos' ? router.back() : setStep(step === 'story' ? 'photos' : 'story')}>
          <Feather name="chevron-left" size={24} color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title}>{step === 'result' ? 'Your Bean is ready' : ['Add Photos', 'Tell Your Story', 'Pick Look & Mood'][progress - 1]}</Text>
          <Text style={styles.subtitle}>Step {progress} of 3</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {step !== 'result' && (
        <View style={styles.progressRow}>
          {[1, 2, 3].map(item => <View key={item} style={[styles.progressDot, item <= progress && styles.progressDotActive]} />)}
        </View>
      )}

      {step !== 'result' && (
        <View style={styles.createMascotCard}>
          <CreateBeanMascot size={76} frameless bubble={step === 'story' ? 'heart' : 'star'} />
          <View style={{ flex: 1 }}>
            <Text style={styles.createMascotTitle}>{step === 'photos' ? 'Start with the moment' : step === 'story' ? 'Catch the feeling' : 'Pick the keepsake look'}</Text>
            <Text style={styles.createMascotText}>{step === 'photos' ? 'A few strong photos make the best Bean.' : step === 'story' ? 'The tiny details are what make the memory yours.' : 'Choose a style that fits the trip, then save or share it.'}</Text>
          </View>
        </View>
      )}

      {step === 'photos' && (
        <View style={styles.card}>
          <View style={styles.formRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Place</Text>
              <TextInput
                value={place}
                onChangeText={updatePlace}
                onFocus={() => setShowPlaceSuggestions(true)}
                placeholder="Santorini"
                style={styles.input}
                placeholderTextColor="#B99480"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Country</Text>
              <TextInput value={country} onChangeText={setCountry} placeholder="Greece" style={styles.input} placeholderTextColor="#B99480" />
            </View>
          </View>
          {showPlaceSuggestions && (searchingPlaces || placeSuggestions.length > 0) && (
            <View style={styles.suggestionPanel}>
              {searchingPlaces ? (
                <View style={styles.suggestionRow}>
                  <View style={styles.suggestionIcon}><Feather name="search" size={15} color={MUTED} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName}>Finding places...</Text>
                    <Text style={styles.suggestionMeta}>Predicting the best match</Text>
                  </View>
                </View>
              ) : placeSuggestions.slice(0, 4).map(suggestion => (
                <TouchableOpacity
                  key={`${suggestion.name}-${suggestion.country}-${suggestion.latitude ?? ''}`}
                  style={styles.suggestionRow}
                  onPress={() => selectPlaceSuggestion(suggestion)}
                  activeOpacity={0.84}
                >
                  <View style={styles.suggestionIcon}><Feather name="map-pin" size={15} color={ORANGE} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName}>{suggestion.name}</Text>
                    <Text style={styles.suggestionMeta}>{[suggestion.region ?? suggestion.city, suggestion.country].filter(Boolean).join(', ')}</Text>
                  </View>
                  <Feather name="arrow-up-left" size={16} color={MUTED} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <Text style={styles.label}>Date</Text>
          <TextInput value={date} onChangeText={setDate} placeholder="2026-06-01" style={styles.input} placeholderTextColor="#B99480" />
          <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Select 1-{photoLimit} photos</Text>
          <View style={styles.photoGrid}>
            {photos.map(photo => (
              <View key={photo.id} style={styles.selectedPhotoTile}>
                <Image source={{ uri: photo.imageUrl }} style={styles.photoTile} contentFit="cover" contentPosition="top center" />
                <TouchableOpacity
                  accessibilityLabel="Remove selected photo"
                  style={styles.removePhotoButton}
                  onPress={() => removePhoto(photo.id)}
                  activeOpacity={0.82}
                >
                  <Feather name="x" size={15} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < photoLimit && Array.from({ length: Math.max(1, photoLimit - photos.length) }).map((_, index) => (
              <TouchableOpacity key={index} style={styles.emptyPhoto} onPress={pickPhotos} activeOpacity={0.82}>
                <Feather name="plus" size={24} color={MUTED} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.photoCount}>{photos.length || 0}/{photoLimit} photos selected</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={photos.length ? next : useSamplePhotos} activeOpacity={0.86}>
            <Text style={styles.primaryText}>{photos.length ? 'Next' : 'Use Sample Photos'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'story' && (
        <View style={styles.card}>
          <View style={styles.storyTools}>
            <View style={{ flex: 1 }}>
              <Text style={styles.storyOptionalTitle}>This part is optional</Text>
              <Text style={styles.storyOptionalText}>Answer any prompts you like, skip them, or swap in fresh questions.</Text>
            </View>
            <TouchableOpacity style={styles.storyToolButton} onPress={shuffleStoryQuestions} activeOpacity={0.84}>
              <Feather name="shuffle" size={15} color={ORANGE} />
              <Text style={styles.storyToolText}>Shuffle</Text>
            </TouchableOpacity>
          </View>
          {responses.map((item, index) => (
            <View key={item.id} style={styles.promptCard}>
              <View style={styles.promptIcon}><Feather name={index === 0 ? 'sun' : index === 1 ? 'camera' : 'heart'} size={18} color={ORANGE} /></View>
              <View style={{ flex: 1 }}>
                <View style={styles.promptHeader}>
                  <Text style={styles.prompt}>{item.prompt}</Text>
                  <TouchableOpacity
                    accessibilityLabel="Change question"
                    style={styles.promptRefreshButton}
                    onPress={() => refreshStoryQuestion(index)}
                    activeOpacity={0.82}
                  >
                    <Feather name="refresh-cw" size={14} color={ORANGE} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  value={item.response}
                  onChangeText={text => updateResponse(index, text)}
                  placeholder={storyPlaceholder(item.prompt, index)}
                  placeholderTextColor="#A98B7A"
                  multiline
                  scrollEnabled={false}
                  maxLength={140}
                  style={styles.promptInput}
                />
                <Text style={styles.counter}>{item.response.length}/140</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.skipStoryButton} onPress={skipStory} activeOpacity={0.84}>
            <Feather name="skip-forward" size={16} color={INK} />
            <Text style={styles.skipStoryText}>Skip story for now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={next} activeOpacity={0.86}>
            <Text style={styles.primaryText}>Next</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'look' && (
        <View style={styles.card}>
          <View style={styles.layoutSectionHeader}>
            <Text style={styles.sectionTitle}>Collage styles</Text>
            <Text style={styles.layoutSectionSub}>Choose a simple shareable look</Text>
          </View>
          <View style={styles.layoutGrid}>
            {freeLayouts.map(item => (
              <LayoutOption
                key={item.id}
                item={item}
                selected={layout === item.name}
                locked={false}
                photo={heroPhoto}
                smallPhotos={photos.map(p => p.imageUrl)}
                place={place}
                country={country}
                date={date}
                fitLabel={layoutFitLabel(item.name, selectedPhotoCount)}
                recommended={isRecommendedLayout(item.name, selectedPhotoCount)}
                onPress={() => chooseLayout(item)}
              />
            ))}
          </View>
          <Text style={styles.sectionTitle}>Choose a mood</Text>
          <View style={styles.moodRow}>
            {MOODS.map(item => (
              <TouchableOpacity key={item} style={[styles.moodCard, mood === item && styles.moodCardActive]} onPress={() => setMood(item)} activeOpacity={0.86}>
                <Image source={{ uri: heroPhoto }} style={styles.moodImage} contentFit="cover" contentPosition="top center" />
                <View style={[styles.moodOverlay, moodOverlayStyle(item)]} />
                {item === 'Minimal' && <View style={styles.minimalVeil} />}
                {item === 'Playful' && (
                  <View style={styles.playfulDots}>
                    <View style={[styles.playfulDot, { backgroundColor: '#F26A2E' }]} />
                    <View style={[styles.playfulDot, { backgroundColor: '#54B77B' }]} />
                    <View style={[styles.playfulDot, { backgroundColor: '#F8C14A' }]} />
                  </View>
                )}
                <View style={styles.moodFooter}>
                  <Text style={[styles.moodText, mood === item && styles.moodTextActive]}>{item}</Text>
                  {mood === item && <Feather name="check-circle" size={15} color={ORANGE} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={saveBean} activeOpacity={0.86} disabled={saving}>
            <Text style={styles.primaryText}>{saving ? 'Saving...' : 'Generate My Bean'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'result' && (
        <View style={styles.resultWrap}>
          <ViewShot ref={shotRef} style={styles.resultCollageCapture} options={captureOptions as any}>
            <BeanCollageCard
              place={place}
              country={country}
              date={date}
              mood={mood}
              layout={layout}
              title={draftTitle}
              story={storyText}
              photo={heroPhoto}
              photos={photos.map(p => p.imageUrl)}
              hasWatermark={!isPremium || includeMascotMark}
              exportQuality={isPremium ? 'hd' : 'standard'}
              selectedQuoteText={null}
              selectedQuoteAuthor={null}
              quotePlacement="none"
            />
          </ViewShot>
          {isPremium ? (
            <TouchableOpacity style={[styles.mascotMarkToggle, includeMascotMark && styles.mascotMarkToggleActive]} onPress={() => setIncludeMascotMark(value => !value)} activeOpacity={0.86}>
              <TemplateBeanMascotMark layout={layout} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.mascotMarkTitle}>Bean Mascot Mark</Text>
                <Text style={styles.mascotMarkText}>{includeMascotMark ? 'Shown on this Bean' : 'Hidden on this Bean'}</Text>
              </View>
              <Feather name={includeMascotMark ? 'check-circle' : 'circle'} size={20} color={includeMascotMark ? ORANGE : MUTED} />
            </TouchableOpacity>
          ) : null}
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={() => setResultEditVisible(true)}><Feather name="edit-3" size={17} color={INK} /><Text style={styles.actionText}>Edit Bean</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.saveAction]} onPress={saveResultBean} disabled={saving}><Feather name="save" size={17} color="#fff" /><Text style={styles.saveActionText}>{saving ? 'Saving...' : 'Save & View'}</Text></TouchableOpacity>
          </View>
          {!isPremium && (
            <View style={styles.upgradeBanner}>
              <View style={styles.upgradeIcon}><Feather name="star" size={15} color={ORANGE} /></View>
              <Text style={styles.upgradeText}>Want HD export with no watermark?</Text>
              <TouchableOpacity onPress={() => { setPremiumMode('export'); setPremiumVisible(true); }}>
                <Text style={styles.upgradeLink}>Upgrade</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.exportGrid}>
            <TouchableOpacity style={styles.exportButton} onPress={downloadBean} disabled={exporting}>
              <Feather name="download" size={17} color={INK} />
              <Text style={styles.exportText}>{exporting ? 'Working...' : isPremium ? 'Download HD' : 'Download Collage'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportButton} onPress={shareBean} disabled={exporting}>
              <Feather name="send" size={17} color={INK} />
              <Text style={styles.exportText}>Share Collage</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.doneNavRow}>
            <TouchableOpacity style={styles.doneNavButton} onPress={() => router.replace('/(tabs)')} activeOpacity={0.86}>
              <Feather name="home" size={17} color={ORANGE} />
              <Text style={styles.doneNavText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.doneNavButton, styles.doneNavPrimary]}
              onPress={() => router.push({
                pathname: '/(tabs)/journal',
                params: savedBeanId ? { id: savedBeanId } : undefined,
              } as any)}
              activeOpacity={0.86}
            >
              <Feather name="book-open" size={17} color="#fff" />
              <Text style={styles.doneNavPrimaryText}>{savedBeanId ? 'View Journal Entry' : 'Journal'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.createAnotherButton} onPress={reset} activeOpacity={0.86}>
            <Feather name="plus-circle" size={17} color={ORANGE} />
            <Text style={styles.createAnotherText}>Create Another</Text>
          </TouchableOpacity>
        </View>
      )}
      <ResultEditModal
        visible={resultEditVisible}
        place={place}
        country={country}
        date={date}
        responses={responses}
        layout={layout}
        mood={mood}
        isPremium={isPremium}
        freeLayouts={freeLayouts}
        premiumLayouts={premiumLayouts}
        heroPhoto={heroPhoto}
        photos={photos}
        photoCount={photos.length}
        selectedLayoutIsPremium={selectedLayoutIsPremium}
        selectedQuoteText={selectedQuoteText}
        selectedQuoteAuthor={selectedQuoteAuthor}
        quoteStyleName={quoteStyleName}
        onPlace={updatePlace}
        onCountry={setCountry}
        onDate={setDate}
        onResponse={updateResponse}
        onLayout={chooseLayout}
        onMood={setMood}
        onPhotos={pickPhotos}
        onRemovePhoto={removePhoto}
        onSuggestedQuote={() => openQuoteModal('suggested')}
        onBrowseQuotes={() => openQuoteModal('browse')}
        onCustomQuote={() => openQuoteModal('custom')}
        onClearQuote={clearQuote}
        onClose={() => setResultEditVisible(false)}
      />
      <QuotePickerModal
        mode={quoteModal}
        suggestedQuotes={suggestedQuotes}
        browsedQuotes={browsedQuotes}
        quoteCategory={quoteCategory}
        customQuote={customQuote}
        onCategory={setQuoteCategory}
        onCustomChange={setCustomQuote}
        onSelect={selectQuote}
        onSaveCustom={saveCustomQuote}
        onClose={() => setQuoteModal(null)}
      />
      <PremiumModal
        visible={premiumVisible}
        mode={premiumMode}
        onClose={() => {
          setPremiumVisible(false);
          setPendingLayout(null);
        }}
        onActivated={handlePremiumActivated}
      />
    </ScrollView>
  );
}

function ResultEditModal({
  visible,
  place,
  country,
  date,
  responses,
  layout,
  mood,
  isPremium,
  freeLayouts,
  premiumLayouts,
  heroPhoto,
  photos,
  photoCount,
  selectedLayoutIsPremium,
  selectedQuoteText,
  selectedQuoteAuthor,
  quoteStyleName,
  onPlace,
  onCountry,
  onDate,
  onResponse,
  onLayout,
  onMood,
  onPhotos,
  onRemovePhoto,
  onSuggestedQuote,
  onBrowseQuotes,
  onCustomQuote,
  onClearQuote,
  onClose,
}: {
  visible: boolean;
  place: string;
  country: string;
  date: string;
  responses: PromptResponse[];
  layout: BeanLayout;
  mood: BeanMood;
  isPremium: boolean;
  freeLayouts: LayoutConfig[];
  premiumLayouts: LayoutConfig[];
  heroPhoto: string;
  photos: BeanPhoto[];
  photoCount: number;
  selectedLayoutIsPremium: boolean;
  selectedQuoteText: string | null;
  selectedQuoteAuthor: string | null;
  quoteStyleName: string;
  onPlace: (value: string) => void;
  onCountry: (value: string) => void;
  onDate: (value: string) => void;
  onResponse: (index: number, value: string) => void;
  onLayout: (layout: LayoutConfig) => void;
  onMood: (mood: BeanMood) => void;
  onPhotos: () => void;
  onRemovePhoto: (photoId: string) => void;
  onSuggestedQuote: () => void;
  onBrowseQuotes: () => void;
  onCustomQuote: () => void;
  onClearQuote: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.editBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.editSheet}>
          <View style={styles.editHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.editTitle}>Edit Memory</Text>
              <Text style={styles.editSubtitle}>Update the Bean without going back through the steps.</Text>
            </View>
            <TouchableOpacity style={styles.editCloseButton} onPress={onClose} activeOpacity={0.84}>
              <Feather name="x" size={19} color={INK} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={styles.editContent}
          >
            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Details</Text>
              <View style={styles.editFormRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.editLabel}>Place</Text>
                  <TextInput value={place} onChangeText={onPlace} style={styles.editInput} placeholder="Santorini" placeholderTextColor="#B99480" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.editLabel}>Country</Text>
                  <TextInput value={country} onChangeText={onCountry} style={styles.editInput} placeholder="Greece" placeholderTextColor="#B99480" />
                </View>
              </View>
              <Text style={styles.editLabel}>Date</Text>
              <TextInput value={date} onChangeText={onDate} style={styles.editInput} placeholder="2026-06-01" placeholderTextColor="#B99480" />
            </View>

            <View style={styles.editPhotoRow}>
              <Image source={{ uri: heroPhoto }} style={styles.editPhotoThumb} contentFit="cover" contentPosition="top center" />
              <View style={{ flex: 1 }}>
                <Text style={styles.editPhotoTitle}>{photoCount || 1} photo{photoCount === 1 ? '' : 's'} selected</Text>
                <Text style={styles.editPhotoSub}>Add or remove photos for this Bean.</Text>
              </View>
              <TouchableOpacity style={styles.editSmallButton} onPress={onPhotos} activeOpacity={0.86}>
                <Feather name="image" size={15} color={ORANGE} />
                <Text style={styles.editSmallButtonText}>Photos</Text>
              </TouchableOpacity>
            </View>
            {photos.length > 0 && (
              <View style={styles.editPhotoThumbGrid}>
                {photos.map(photo => (
                  <View key={photo.id} style={styles.editPhotoThumbWrap}>
                    <Image source={{ uri: photo.imageUrl }} style={styles.editPhotoGridThumb} contentFit="cover" contentPosition="top center" />
                    <TouchableOpacity
                      accessibilityLabel="Remove selected photo"
                      style={styles.editPhotoRemoveButton}
                      onPress={() => onRemovePhoto(photo.id)}
                      activeOpacity={0.82}
                    >
                      <Feather name="x" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Memory</Text>
              {responses.map((item, index) => (
                <View key={item.id} style={styles.editPromptBox}>
                  <Text style={styles.editPromptLabel}>{item.prompt}</Text>
                  <TextInput
                    value={item.response}
	                    onChangeText={value => onResponse(index, value)}
	                    multiline
	                    scrollEnabled={false}
	                    maxLength={140}
	                    style={styles.editPromptInput}
                    placeholder="Add what you remember..."
                    placeholderTextColor="#A98B7A"
                  />
                </View>
              ))}
            </View>

            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Layout</Text>
              <View style={styles.editLayoutGrid}>
                {[...freeLayouts, ...premiumLayouts].map(item => (
                  <LayoutEditChip key={item.id} item={item} selected={layout === item.name} locked={item.type === 'premium' && !isPremium} onPress={() => onLayout(item)} />
                ))}
              </View>
            </View>

            <View style={styles.editSection}>
              <Text style={styles.editSectionTitle}>Mood</Text>
              <View style={styles.editMoodRow}>
                {MOODS.map(item => (
                  <TouchableOpacity key={item} style={[styles.editMoodChip, mood === item && styles.editMoodChipActive]} onPress={() => onMood(item)} activeOpacity={0.86}>
                    <Text style={[styles.editMoodText, mood === item && styles.editMoodTextActive]}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

          </ScrollView>

          <TouchableOpacity style={styles.editDoneButton} onPress={onClose} activeOpacity={0.86}>
            <Text style={styles.editDoneText}>Done Editing</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function LayoutEditChip({ item, selected, locked, onPress }: { item: LayoutConfig; selected: boolean; locked: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.editLayoutChip, selected && styles.editLayoutChipActive]} onPress={onPress} activeOpacity={0.86}>
      <View style={[styles.editLayoutIcon, locked && styles.editLayoutIconLocked]}>
        <Feather name={locked ? 'lock' : item.type === 'premium' ? 'star' : 'image'} size={14} color={locked ? '#fff' : ORANGE} />
      </View>
      <Text style={[styles.editLayoutText, selected && styles.editLayoutTextActive]} numberOfLines={2}>{item.name}</Text>
      <Text style={[styles.editLayoutPill, item.type === 'premium' && styles.editLayoutPillPremium]}>{item.type === 'premium' ? 'Premium' : 'Free'}</Text>
    </TouchableOpacity>
  );
}

function LayoutOption({
  item,
  selected,
  locked,
  photo,
  smallPhotos,
  place,
  country,
  date,
  fitLabel,
  recommended,
  onPress,
}: {
  item: LayoutConfig;
  selected: boolean;
  locked: boolean;
  photo: string;
  smallPhotos: string[];
  place: string;
  country: string;
  date: string;
  fitLabel?: string;
  recommended?: boolean;
  onPress: () => void;
}) {
  const isTextPostcard = PREMIUM_TEXT_POSTCARDS.has(item.name);
  const textPostcardLocked = locked && isTextPostcard;
  return (
    <TouchableOpacity key={item.name} style={[styles.layoutCard, item.type === 'free' && styles.freeLayoutCard, isTextPostcard && styles.featuredLayoutCard, selected && styles.selectedCard]} onPress={onPress} activeOpacity={0.85}>
      <BeanPreview layout={item.name} photo={photo} smallPhotos={smallPhotos} place={place} country={country} date={date} />
      {locked && (
        <View style={textPostcardLocked ? styles.postcardLockOverlay : styles.lockOverlay}>
          <View style={textPostcardLocked ? styles.lockCircleSmall : styles.lockCircle}><Feather name="lock" size={textPostcardLocked ? 12 : 16} color="#fff" /></View>
        </View>
      )}
      {fitLabel ? (
        <View style={[styles.layoutFitBadge, recommended && styles.layoutFitBadgeBest]}>
          <Feather name={recommended ? 'star' : 'check'} size={10} color={recommended ? '#fff' : '#2E7A52'} />
          <Text style={[styles.layoutFitText, recommended && styles.layoutFitTextBest]}>{fitLabel}</Text>
        </View>
      ) : null}
      <Text style={styles.layoutName}>{item.name}</Text>
      <Text style={[styles.freePill, item.type === 'premium' && styles.premiumPill]}>{item.type === 'premium' ? 'Premium' : 'FREE'}</Text>
    </TouchableOpacity>
  );
}

function QuoteStyleCard({
  selectedQuoteText,
  selectedQuoteAuthor,
  quoteStyleName,
  onSuggested,
  onBrowse,
  onCustom,
  onClear,
}: {
  selectedQuoteText: string | null;
  selectedQuoteAuthor: string | null;
  quoteStyleName: string;
  onSuggested: () => void;
  onBrowse: () => void;
  onCustom: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.quoteFeatureCard}>
      <View style={styles.quoteFeatureHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.quoteFeatureTitle}>Add a Travel Quote</Text>
          <Text style={styles.quoteFeatureSub}>Quotes sit in a dedicated caption area so your photos stay visible.</Text>
        </View>
        <View style={styles.quotePremiumBadge}>
          <Feather name="star" size={11} color="#fff" />
          <Text style={styles.quotePremiumText}>Premium</Text>
        </View>
      </View>

      {selectedQuoteText ? (
        <View style={styles.selectedQuoteBox}>
          <Text style={styles.selectedQuoteStyle}>{quoteStyleName}</Text>
          <Text style={styles.selectedQuoteText} numberOfLines={3}>{selectedQuoteText}</Text>
          {selectedQuoteAuthor ? <Text style={styles.selectedQuoteAuthor}>{selectedQuoteAuthor}</Text> : null}
        </View>
      ) : (
        <View style={styles.emptyQuoteBox}>
          <QuoteSparkIcon compact />
          <Text style={styles.emptyQuoteText}>No quote selected yet.</Text>
        </View>
      )}

      <View style={styles.quoteOptionGrid}>
        <QuoteOptionButton icon="zap" label="Suggested Quote" onPress={onSuggested} />
        <QuoteOptionButton icon="book-open" label="Browse Quotes" onPress={onBrowse} />
        <QuoteOptionButton icon="edit-3" label="Write My Own" onPress={onCustom} />
        <QuoteOptionButton icon="slash" label="No Quote" onPress={onClear} />
      </View>
    </View>
  );
}

function LockedQuoteStylesCard({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.lockedQuoteCard} onPress={onPress} activeOpacity={0.86}>
      <View style={styles.lockedQuoteIcon}>
        <Feather name="lock" size={17} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.lockedQuoteTitle}>Travel Quote Styles are included with Premium.</Text>
        <Text style={styles.lockedQuoteBody}>Add quotes to postcard, scrapbook, and film-style collages.</Text>
      </View>
      <Text style={styles.lockedQuoteLink}>See Premium</Text>
    </TouchableOpacity>
  );
}

function QuoteOptionButton({ icon, label, onPress }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quoteOptionButton} onPress={onPress} activeOpacity={0.86}>
      <Feather name={icon} size={15} color={ORANGE} />
      <Text style={styles.quoteOptionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function QuoteSparkIcon({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.quoteMarkIcon, compact && styles.quoteMarkIconCompact]}>
      <View style={[styles.quotePaperBack, compact && styles.quotePaperBackCompact]} />
      <View style={[styles.quotePaperFront, compact && styles.quotePaperFrontCompact]}>
        <View style={styles.quoteMarksRow}>
          <View style={[styles.quoteMarkPair, compact && styles.quoteMarkPairCompact]}>
            <View style={[styles.quoteMarkDot, compact && styles.quoteMarkDotCompact]} />
            <View style={[styles.quoteMarkStem, compact && styles.quoteMarkStemCompact]} />
          </View>
          <View style={[styles.quoteMarkPair, compact && styles.quoteMarkPairCompact]}>
            <View style={[styles.quoteMarkDot, compact && styles.quoteMarkDotCompact]} />
            <View style={[styles.quoteMarkStem, compact && styles.quoteMarkStemCompact]} />
          </View>
        </View>
        <View style={[styles.quoteTinyLine, compact && styles.quoteTinyLineCompact]} />
      </View>
      <View style={[styles.quoteSpark, compact && styles.quoteSparkCompact]} />
    </View>
  );
}

function QuotePickerModal({
  mode,
  suggestedQuotes,
  browsedQuotes,
  quoteCategory,
  customQuote,
  onCategory,
  onCustomChange,
  onSelect,
  onSaveCustom,
  onClose,
}: {
  mode: 'suggested' | 'browse' | 'custom' | null;
  suggestedQuotes: TravelQuote[];
  browsedQuotes: TravelQuote[];
  quoteCategory: QuoteCategory;
  customQuote: string;
  onCategory: (category: QuoteCategory) => void;
  onCustomChange: (text: string) => void;
  onSelect: (quote: TravelQuote) => void;
  onSaveCustom: () => void;
  onClose: () => void;
}) {
  const title = mode === 'custom' ? 'Write Your Own Quote' : mode === 'browse' ? 'Browse Quotes' : 'Suggested Quotes';
  const subtitle = mode === 'custom' ? 'Keep it short and beautiful.' : 'Pick a line for your Premium collage.';

  return (
    <Modal visible={mode !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.quoteModalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.quoteModalSheet}>
          <View style={styles.quoteModalHeader}>
            <View>
              <Text style={styles.quoteModalTitle}>{title}</Text>
              <Text style={styles.quoteModalSubtitle}>{subtitle}</Text>
            </View>
            <TouchableOpacity style={styles.quoteCloseButton} onPress={onClose} activeOpacity={0.84}>
              <Feather name="x" size={19} color={INK} />
            </TouchableOpacity>
          </View>

          {mode === 'custom' ? (
            <View style={styles.customQuoteArea}>
              <TextInput
                value={customQuote}
                onChangeText={text => onCustomChange(text.slice(0, 120))}
                placeholder="Golden light, quiet streets, and nowhere to be."
                placeholderTextColor="#A98B7A"
                multiline
                scrollEnabled={false}
                maxLength={180}
                style={styles.customQuoteInput}
              />
              <Text style={styles.customQuoteCount}>{customQuote.length}/180</Text>
              <View style={styles.customQuoteActions}>
                <TouchableOpacity style={styles.quoteSecondaryButton} onPress={onClose} activeOpacity={0.84}>
                  <Text style={styles.quoteSecondaryText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quotePrimaryButton} onPress={onSaveCustom} activeOpacity={0.86}>
                  <Text style={styles.quotePrimaryText}>Save Quote</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.quoteListContent}>
              {mode === 'browse' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quoteCategoryRow}>
                  {QUOTE_CATEGORIES.map(category => (
                    <TouchableOpacity
                      key={category}
                      style={[styles.quoteCategoryPill, quoteCategory === category && styles.quoteCategoryPillActive]}
                      onPress={() => onCategory(category)}
                      activeOpacity={0.84}
                    >
                      <Text style={[styles.quoteCategoryText, quoteCategory === category && styles.quoteCategoryTextActive]}>{category}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {(mode === 'browse' ? browsedQuotes : suggestedQuotes).map(quote => (
                <QuoteLibraryCard key={quote.id} quote={quote} onSelect={() => onSelect(quote)} />
              ))}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function QuoteLibraryCard({ quote, onSelect }: { quote: TravelQuote; onSelect: () => void }) {
  return (
    <View style={styles.quoteLibraryCard}>
      <Text style={styles.quoteLibraryText}>{quote.text}</Text>
      <Text style={styles.quoteLibraryAuthor}>{quote.author}</Text>
      <View style={styles.quoteLibraryFooter}>
        <View style={styles.quoteTagRow}>
          {quote.categories.slice(0, 2).map(category => (
            <Text key={category} style={styles.quoteTag}>{category}</Text>
          ))}
        </View>
        <TouchableOpacity style={styles.quoteSelectButton} onPress={onSelect} activeOpacity={0.86}>
          <Text style={styles.quoteSelectText}>Select</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BeanPreview({ layout, photo, smallPhotos, place, country, date }: { layout: BeanLayout; photo: string; smallPhotos: string[]; place: string; country: string; date: string }) {
  const previewPhotos = [photo, ...smallPhotos];
  const p0 = previewPhotos[0] ?? photo;
  const p1 = previewPhotos[1] ?? p0;
  const p2 = previewPhotos[2] ?? p1;
  const p3 = previewPhotos[3] ?? p2;
  const p4 = previewPhotos[4] ?? p3;
  const p5 = previewPhotos[5] ?? p4;
  const p6 = previewPhotos[6] ?? p4;
  const p7 = previewPhotos[7] ?? p5;

  if (PREMIUM_TEXT_POSTCARDS.has(layout)) {
    return <PremiumPostcardPreview layout={layout} photos={[p0, p1, p2, p3, p4, p5, p6, p7]} place={place} country={country} date={date} />;
  }

  if (layout === 'Food Trip') {
    return (
      <View style={styles.previewFoodTrip}>
        <View style={styles.previewFoodTripPathA}>
          {Array.from({ length: 5 }).map((_, index) => <View key={index} style={styles.previewFoodTripDot} />)}
        </View>
        <View style={styles.previewFoodTripPathB}>
          {Array.from({ length: 4 }).map((_, index) => <View key={index} style={styles.previewFoodTripDot} />)}
        </View>
        <View style={styles.previewFoodTitleBubble}>
          <FittedPreviewText numberOfLines={2} style={styles.previewFoodTitleText} minimumFontScale={0.6}>Food{'\n'}Trip</FittedPreviewText>
        </View>
        <View style={styles.previewFoodPrintLeft}>
          <Image source={{ uri: p0 }} style={styles.previewFoodPhoto} contentFit="cover" contentPosition="top center" />
        </View>
        <View style={styles.previewFoodPrintRight}>
          <Image source={{ uri: p1 }} style={styles.previewFoodPhoto} contentFit="cover" contentPosition="top center" />
        </View>
        <View style={styles.previewFoodPrintCenter}>
          <Image source={{ uri: p2 }} style={styles.previewFoodPhoto} contentFit="cover" contentPosition="top center" />
        </View>
        <View style={styles.previewFoodCaptionLeft}>
          <Text style={styles.previewFoodCaptionText}>IS{'\n'}TRAVELLING</Text>
        </View>
        <View style={styles.previewFoodCaptionRight}>
          <Text style={styles.previewFoodCaptionText}>TASTING{'\n'}STORIES</Text>
        </View>
        <View style={styles.previewFoodSunburst} />
      </View>
    );
  }

  if (layout === 'Scrapbook Story') {
    return (
      <View style={styles.previewScrapbook}>
        <View style={styles.previewTape} />
        <Image source={{ uri: p0 }} style={styles.previewScrapHero} contentFit="cover" contentPosition="top center" />
        <View style={styles.previewScrapBottom}>
          <Image source={{ uri: p1 }} style={styles.previewScrapSmall} contentFit="cover" contentPosition="top center" />
          <Image source={{ uri: p2 }} style={styles.previewScrapSmall} contentFit="cover" contentPosition="top center" />
        </View>
      </View>
    );
  }

  if (layout === 'Polaroid Stack' || layout === 'Postcard Stack') {
    return (
      <View style={styles.previewStack}>
        <View style={styles.postcardPreviewMain}>
          <Image source={{ uri: p0 }} style={styles.postcardPreviewImage} contentFit="cover" contentPosition="top center" />
        </View>
        <View style={styles.postcardPreviewBottom}>
          <Image source={{ uri: p1 }} style={styles.postcardPreviewSmall} contentFit="cover" contentPosition="top center" />
          <Image source={{ uri: p2 }} style={styles.postcardPreviewSmall} contentFit="cover" contentPosition="top center" />
        </View>
      </View>
    );
  }

  if (layout === 'Postcard Mosaic') {
    return (
      <View style={styles.previewMosaic}>
        {[p0, p1, p2, p3].map((uri, index) => (
          <Image key={`${uri}-${index}`} source={{ uri }} style={styles.previewMosaicCell} contentFit="cover" contentPosition="top center" />
        ))}
        <View style={styles.previewStampMark} />
      </View>
    );
  }

  if (layout === 'Classic Postcard') {
    return (
      <View style={styles.previewClassicPostcard}>
        <Image source={{ uri: p0 }} style={styles.previewClassicHero} contentFit="cover" contentPosition="top center" />
        <View style={styles.previewClassicBottom}>
          {[p1, p2].map((uri, index) => (
            <Image key={`${uri}-${index}`} source={{ uri }} style={styles.previewClassicSmall} contentFit="cover" contentPosition="top center" />
          ))}
        </View>
      </View>
    );
  }

  if (layout === 'Editorial Grid') {
    return (
      <View style={styles.previewEditorial}>
        <Image source={{ uri: p0 }} style={styles.previewEditorialHero} contentFit="cover" contentPosition="top center" />
        <View style={styles.previewEditorialBottom}>
          {[p1, p2, p3].map((uri, index) => <Image key={`${uri}-${index}`} source={{ uri }} style={styles.previewEditorialSmall} contentFit="cover" contentPosition="top center" />)}
        </View>
      </View>
    );
  }

  if (layout === 'Film Strip') {
    return (
      <View style={styles.previewFilm}>
        <View style={styles.previewFilmHolesTop} />
        <View style={styles.previewFilmFrames}>
          {[p0, p1, p2].map((uri, index) => <Image key={`${uri}-${index}`} source={{ uri }} style={styles.previewFilmFrame} contentFit="cover" contentPosition="top center" />)}
        </View>
        <View style={styles.previewFilmHolesBottom} />
      </View>
    );
  }

  if (layout === 'Airmail Border') {
    return (
      <View style={styles.previewAirmail}>
        <View style={[styles.previewAirmailStripe, styles.previewAirmailStripeTop]} />
        <View style={styles.previewAirmailRoute}>
          <View style={styles.previewRouteLine} />
          <View style={[styles.previewRouteLine, styles.previewRouteLineShort]} />
        </View>
        <View style={styles.previewAirmailPostmark}>
          <Text style={styles.previewAirmailPostmarkText}>Air Mail</Text>
        </View>
        <Image source={{ uri: p0 }} style={styles.previewAirmailHero} contentFit="cover" contentPosition="top center" />
        <View style={styles.previewAirmailBottom}>
          {[p1, p2].map((uri, index) => (
            <Image key={`${uri}-${index}`} source={{ uri }} style={styles.previewAirmailSmall} contentFit="cover" contentPosition="top center" />
          ))}
        </View>
        <View style={[styles.previewAirmailStripe, styles.previewAirmailStripeBottom]} />
      </View>
    );
  }

  if (layout === 'Vintage Stamp Card') {
    return (
      <View style={styles.previewVintage}>
        <Text style={styles.previewVintageLabel}>Vintage</Text>
        <Image source={{ uri: p0 }} style={styles.previewVintageHero} contentFit="cover" contentPosition="top center" />
        <View style={styles.previewVintageGrid}>
          {[p1, p2, p3].map((uri, index) => (
            <Image key={`${uri}-${index}`} source={{ uri }} style={styles.previewVintageSmall} contentFit="cover" contentPosition="top center" />
          ))}
        </View>
        <View style={styles.previewVintageStamp}>
          <View style={styles.previewVintageStampRing} />
        </View>
      </View>
    );
  }

  if (layout === 'Large Letter Travel') {
    return (
      <View style={styles.previewLetter}>
        <View style={styles.previewLetterPostage}>
          <View style={styles.previewLetterPostageMark} />
        </View>
        <Text style={styles.previewLetterText}>Letter</Text>
        <View style={styles.previewLetterGrid}>
          <Image source={{ uri: p0 }} style={styles.previewLetterHero} contentFit="cover" contentPosition="top center" />
          <View style={styles.previewLetterSide}>
            <Image source={{ uri: p1 }} style={styles.previewLetterSmall} contentFit="cover" contentPosition="top center" />
            <Image source={{ uri: p2 }} style={styles.previewLetterSmall} contentFit="cover" contentPosition="top center" />
          </View>
        </View>
      </View>
    );
  }

  if (layout === 'Boarding Pass') {
    return (
      <View style={styles.previewBoarding}>
        <View style={styles.previewBoardingRail} />
        <View style={styles.previewBoardingTop}>
          <Text style={styles.previewBoardingTopText}>Boarding Pass</Text>
        </View>
        <View style={styles.previewBoardingDots}>
          {Array.from({ length: 5 }).map((_, index) => <View key={index} style={styles.previewBoardingDot} />)}
        </View>
        <Image source={{ uri: p0 }} style={styles.previewBoardingHero} contentFit="cover" contentPosition="top center" />
        <View style={styles.previewBoardingBottom}>
          {[p1, p2].map((uri, index) => (
            <Image key={`${uri}-${index}`} source={{ uri }} style={styles.previewBoardingSmall} contentFit="cover" contentPosition="top center" />
          ))}
        </View>
      </View>
    );
  }

  if (layout === 'Gallery Postcard') {
    return (
      <View style={styles.previewGallery}>
        <Text style={styles.previewGalleryLabel}>Gallery</Text>
        <View style={styles.previewGalleryPill} />
        <Image source={{ uri: p0 }} style={styles.previewGalleryHero} contentFit="cover" contentPosition="top center" />
        <View style={styles.previewGalleryGrid}>
          {[p1, p2, p3].map((uri, index) => (
            <Image key={`${uri}-${index}`} source={{ uri }} style={styles.previewGallerySmall} contentFit="cover" contentPosition="top center" />
          ))}
        </View>
      </View>
    );
  }

  if (layout === 'Sunset Postcard') {
    return (
      <View style={styles.previewSunsetPostcard}>
        <View style={styles.previewSunsetFrameLine} />
        <Text style={styles.previewSunsetLabel}>Sunset Card</Text>
        <Image source={{ uri: p0 }} style={styles.previewSunsetPostcardHero} contentFit="cover" contentPosition="top center" />
        <View style={styles.previewSunsetPostcardBottom}>
          {[p1, p2].map((uri, index) => (
            <Image key={`${uri}-${index}`} source={{ uri }} style={styles.previewSunsetPostcardSmall} contentFit="cover" contentPosition="top center" />
          ))}
        </View>
      </View>
    );
  }

  if (layout === 'Sunset Poster') {
    return (
      <View style={styles.previewSunset}>
        <View style={styles.previewSunsetOrb} />
        <View style={styles.previewSunsetLines}>
          <View style={styles.previewSunsetLineBig} />
          <View style={styles.previewSunsetLine} />
        </View>
        <Image source={{ uri: photo }} style={styles.previewSunsetPhoto} contentFit="cover" contentPosition="top center" />
        <Image source={{ uri: previewPhotos[1] ?? photo }} style={styles.previewSunsetSmall} contentFit="cover" contentPosition="top center" />
      </View>
    );
  }

  if (layout === 'Passport Board') {
    return (
      <View style={styles.previewPassport}>
        <Image source={{ uri: photo }} style={styles.previewPassportPhoto} contentFit="cover" contentPosition="top center" />
        <View style={styles.previewPassportSeal} />
        <View style={styles.previewPassportTicket}>
          <View style={styles.previewPassportLine} />
          <View style={[styles.previewPassportLine, { width: '52%' }]} />
        </View>
      </View>
    );
  }

  if (layout === 'Color Pop Tiles') {
    return (
      <View style={styles.previewColorPop}>
        <View style={styles.previewColorOrange} />
        <View style={styles.previewColorMint} />
        <Image source={{ uri: photo }} style={styles.previewColorHero} contentFit="cover" contentPosition="top center" />
        <Image source={{ uri: previewPhotos[1] ?? photo }} style={styles.previewColorSmallA} contentFit="cover" contentPosition="top center" />
        <Image source={{ uri: previewPhotos[2] ?? photo }} style={styles.previewColorSmallB} contentFit="cover" contentPosition="top center" />
      </View>
    );
  }

  if (layout === 'Dream Glow') {
    return (
      <View style={styles.previewDream}>
        <View style={styles.previewDreamMoon} />
        <View style={styles.previewDreamCloud} />
        <Image source={{ uri: previewPhotos[1] ?? photo }} style={styles.previewDreamBack} contentFit="cover" contentPosition="top center" />
        <Image source={{ uri: photo }} style={styles.previewDreamMain} contentFit="cover" contentPosition="top center" />
      </View>
    );
  }

  if (layout === 'Wander Journal') {
    return (
      <View style={styles.previewJournal}>
        <View style={styles.previewJournalSpine} />
        <View style={styles.previewJournalPage}>
          <Image source={{ uri: p1 }} style={styles.previewJournalLeftPhoto} contentFit="cover" contentPosition="top center" />
          <Image source={{ uri: p2 }} style={styles.previewJournalLeftPhoto} contentFit="cover" contentPosition="top center" />
        </View>
        <View style={styles.previewJournalPage}>
          <Image source={{ uri: p0 }} style={styles.previewJournalPhoto} contentFit="cover" contentPosition="top center" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.previewFullFrame}>
      <Image source={{ uri: photo }} style={styles.previewFull} contentFit="cover" contentPosition="top center" />
      <View style={styles.previewFullSheen} />
    </View>
  );
}

function PremiumPostcardPreview({
  layout,
  photos,
  place,
  country,
  date,
}: {
  layout: BeanLayout;
  photos: string[];
  place: string;
  country: string;
  date: string;
}) {
  const p0 = photos[0];
  const p1 = photos[1] ?? p0;
  const p2 = photos[2] ?? p1;
  const p3 = photos[3] ?? p2;
  const p4 = photos[4] ?? p3;
  const p5 = photos[5] ?? p4;
  const p6 = photos[6] ?? p4;
  const p7 = photos[7] ?? p5;
  const placeUpper = (place.trim() || 'Travel').toUpperCase();
  const previewTempleTitleSize = placeUpper.length > 13 ? 7.8 : placeUpper.length >= 9 ? 8.6 : 11;
  const previewSidebarSize = placeUpper.length > 13 ? 9 : placeUpper.length > 9 ? 11 : 13;
  const year = previewYear(date);
  const blackCitySubtitle = placeUpper === 'SHANGHAI' ? '上海市' : (country.trim() || year).toUpperCase().split('').join(' ');

  if (layout === 'City Cover') {
    return (
      <View style={styles.previewCityCover}>
        <Image source={{ uri: p0 }} style={styles.previewPostcardFill} contentFit="cover" contentPosition="top center" />
        <View style={styles.previewCityCoverTint} />
        <PreviewTexture dark />
        <View style={styles.previewCityCoverFrame} />
        <Text style={styles.previewCityCoverMeta} numberOfLines={1}>{country || year}</Text>
        <FittedPreviewText style={styles.previewCityCoverPlace} minimumFontScale={0.28}>{placeUpper}</FittedPreviewText>
        <View style={styles.previewCityCoverRule} />
      </View>
    );
  }

  if (layout === 'Black City Postcard') {
    return (
      <View style={styles.previewBlackCity}>
        <Image source={{ uri: p0 }} style={[styles.previewPostcardFill, GRAYSCALE_IMAGE_STYLE]} contentFit="cover" contentPosition="top center" />
        <View style={styles.previewBlackCityMist} />
        <View style={styles.previewBlackCityShade} />
        <View style={styles.previewBlackCityContent}>
          <Feather name="map-pin" size={14} color="#FFFDF8" />
          <Text style={styles.previewBlackCityTitle} numberOfLines={1}>{place.trim() || 'Shanghai'}</Text>
          <Text style={styles.previewBlackCitySubtitle} numberOfLines={1}>{blackCitySubtitle}</Text>
        </View>
      </View>
    );
  }

  if (layout === 'Any City Mosaic') {
    return (
      <View style={styles.previewAnyCityMosaic}>
        <View style={styles.previewAnyCityGrid}>
          <Image source={{ uri: p0 }} style={[styles.previewAnyCityTile, styles.previewAnyCityTopLeft, GRAYSCALE_IMAGE_STYLE]} contentFit="cover" contentPosition="top center" />
          <Image source={{ uri: p1 }} style={[styles.previewAnyCityTile, styles.previewAnyCityTopRight, GRAYSCALE_IMAGE_STYLE]} contentFit="cover" contentPosition="top center" />
          <Image source={{ uri: p2 }} style={[styles.previewAnyCityTile, styles.previewAnyCityBottomLeft, GRAYSCALE_IMAGE_STYLE]} contentFit="cover" contentPosition="top center" />
          <Image source={{ uri: p3 }} style={[styles.previewAnyCityTile, styles.previewAnyCityCenter, GRAYSCALE_IMAGE_STYLE]} contentFit="cover" contentPosition="top center" />
          <Image source={{ uri: p4 }} style={[styles.previewAnyCityTile, styles.previewAnyCityBottomRight, GRAYSCALE_IMAGE_STYLE]} contentFit="cover" contentPosition="top center" />
          <View style={styles.previewAnyCityWash} />
          <FittedPreviewText style={styles.previewAnyCityTitle} minimumFontScale={0.5}>{placeUpper || 'ANY CITY'}</FittedPreviewText>
          <FittedPreviewText style={styles.previewAnyCityDate} minimumFontScale={0.58}>{date.replaceAll('-', '.')}</FittedPreviewText>
        </View>
      </View>
    );
  }

  if (layout === 'Seek Travel') {
    return (
      <View style={styles.previewSeekTravel}>
        <Image source={{ uri: p0 }} style={[styles.previewPostcardFill, GRAYSCALE_IMAGE_STYLE]} contentFit="cover" contentPosition="top center" />
        <View style={styles.previewSeekShade} />
        <View style={styles.previewSeekRule} />
        <FittedPreviewText style={styles.previewSeekTitle} numberOfLines={2} minimumFontScale={0.46}>SEEK{'\n'}TO TRAVEL</FittedPreviewText>
        <FittedPreviewText style={styles.previewSeekCopy} numberOfLines={4} minimumFontScale={0.56}>Quote or travel note</FittedPreviewText>
        <View style={styles.previewSeekPhotoFrame}>
          <Image source={{ uri: p1 }} style={styles.previewSeekPhoto} contentFit="cover" contentPosition="top center" />
        </View>
      </View>
    );
  }

  if (layout === 'Mountain Postcard') {
    return (
      <View style={styles.previewMountainPostcard}>
        <View style={styles.previewMountainCard}>
          <Image source={{ uri: p0 }} style={styles.previewMountainPhoto} contentFit="cover" contentPosition="top center" />
          <View style={styles.previewMountainBand}>
            <FittedPreviewText style={styles.previewMountainTitle} minimumFontScale={0.55}>{spacedPreviewTitle(placeUpper || 'MOUNTAIN')}</FittedPreviewText>
          </View>
        </View>
      </View>
    );
  }

  if (layout === 'Temple Heritage') {
    return (
      <View style={styles.previewTempleHeritage}>
        <View style={styles.previewTempleCard}>
          <View style={styles.previewTempleTitlePanel}>
            <FittedPreviewText
              numberOfLines={2}
              style={[
                styles.previewTempleTitle,
                { fontSize: previewTempleTitleSize, lineHeight: previewTempleTitleSize + 2 },
              ]}
              minimumFontScale={0.52}
            >
              {placeUpper || 'BOROBUDUR TEMPLE'}
            </FittedPreviewText>
            <FittedPreviewText style={styles.previewTempleQuote} numberOfLines={3} minimumFontScale={0.54}>Quote or travel note</FittedPreviewText>
            <View style={styles.previewTempleQuoteLine} />
            <Text style={styles.previewTempleDate} numberOfLines={1}>{date.replaceAll('-', ' / ')}</Text>
          </View>
          <Image source={{ uri: p0 }} style={styles.previewTempleHero} contentFit="cover" contentPosition="top center" />
          <Image source={{ uri: p1 }} style={styles.previewTempleStrip} contentFit="cover" contentPosition="top center" />
          <FittedPreviewText style={styles.previewTempleCountry} minimumFontScale={0.62}>{country || 'INDONESIA'}</FittedPreviewText>
          <FittedPreviewText style={styles.previewTemplePostcard} minimumFontScale={0.7}>TRAVEL POSTCARD</FittedPreviewText>
        </View>
      </View>
    );
  }

  if (layout === 'Break Postcard') {
    return (
      <View style={styles.previewBreakPostcard}>
        <View style={styles.previewBreakCard}>
          <Image source={{ uri: p0 }} style={styles.previewBreakImage} contentFit="cover" contentPosition="top center" />
          <View style={styles.previewBreakTint} />
          <Text style={styles.previewBreakScript} numberOfLines={1}>Give yourself a break</Text>
        </View>
      </View>
    );
  }

  if (layout === 'This Is Postcard') {
    return (
      <View style={styles.previewThisIs}>
        <Image source={{ uri: p0 }} style={styles.previewPostcardFill} contentFit="cover" contentPosition="top center" />
        <View style={styles.previewThisIsTint} />
        <PreviewTexture />
        <View style={styles.previewThisInnerFrame} />
        <View style={styles.previewThisTape} />
        <Text style={styles.previewThisSmallLeft}>THIS</Text>
        <Text style={styles.previewThisSmallRight}>IS</Text>
        <FittedPreviewText style={styles.previewThisPlace} minimumFontScale={0.25}>{placeUpper}</FittedPreviewText>
        <Text style={styles.previewThisMeta} numberOfLines={1}>{year}</Text>
      </View>
    );
  }

  if (layout === 'Wish You Were Here') {
    const wishTileStyles = [
      styles.previewWishTile0,
      styles.previewWishTile1,
      styles.previewWishTile2,
      styles.previewWishTile3,
      styles.previewWishTile4,
      styles.previewWishTile5,
      styles.previewWishTile6,
      styles.previewWishTile7,
    ];

    return (
      <View style={styles.previewWish}>
        <PreviewTexture dark />
        {[p0, p1, p2, p3, p4, p5, p1, p2].map((uri, index) => (
          <Image key={`${uri}-${index}`} source={{ uri }} style={[styles.previewWishTile, wishTileStyles[index]]} contentFit="cover" contentPosition="top center" />
        ))}
        <View style={styles.previewWishCenter}>
          <Text style={styles.previewWishText}>WISH{'\n'}YOU{'\n'}WERE{'\n'}HERE</Text>
        </View>
      </View>
    );
  }

  if (layout === 'Snapshots Postcard') {
    return (
      <View style={styles.previewSnapshots}>
        <View style={styles.previewSnapshotsGrid}>
          {[p0, p1, p2, p3, p4, p5, p6, p7].map((uri, index) => (
            <Image key={`${uri}-${index}`} source={{ uri }} style={styles.previewSnapshotsPhoto} contentFit="cover" contentPosition="top center" />
          ))}
        </View>
        <View style={styles.previewSnapshotsText}>
          <FittedPreviewText style={styles.previewSnapshotsEyebrow} minimumFontScale={0.5}>Hello from {place || 'Travel'}</FittedPreviewText>
          <Text style={styles.previewSnapshotsHeadline}>SNAPSHOTS{'\n'}FROM</Text>
          <FittedPreviewText style={styles.previewSnapshotsPlace} minimumFontScale={0.45}>{(country || place || 'Travel').toUpperCase()}</FittedPreviewText>
          <Text style={styles.previewSnapshotsNote}>Wish you were here</Text>
        </View>
      </View>
    );
  }

  if (layout === 'Destination Sidebar') {
    return (
      <View style={styles.previewSidePostcard}>
        <Image source={{ uri: p0 }} style={styles.previewPostcardFill} contentFit="cover" contentPosition="top center" />
        <PreviewTexture />
        <View style={styles.previewSidePanel}>
          <Image source={{ uri: p1 }} style={styles.previewSideInset} contentFit="cover" contentPosition="top center" />
          <View style={styles.previewSideTape} />
          <FittedPreviewText style={[styles.previewSidePlace, { fontSize: previewSidebarSize, lineHeight: previewSidebarSize + 3 }]} minimumFontScale={0.54}>{placeUpper}</FittedPreviewText>
          <Text style={styles.previewSideCopy} numberOfLines={3}>Greetings from {country || 'somewhere beautiful'}</Text>
        </View>
      </View>
    );
  }

  if (layout === 'Greetings Grid') {
    return (
      <View style={styles.previewGreetings}>
        {[p0, p1, p2, p3].map((uri, index) => <Image key={`${uri}-${index}`} source={{ uri }} style={styles.previewGreetingsPhoto} contentFit="cover" contentPosition="top center" />)}
        <PreviewTexture />
        <View style={styles.previewGreetingsBand}>
          <Text style={styles.previewGreetingsSmall}>Greetings from</Text>
          <FittedPreviewText style={styles.previewGreetingsText} minimumFontScale={0.5}>{place || 'Travel'}</FittedPreviewText>
        </View>
      </View>
    );
  }

  if (layout === 'Masthead Postcard') {
    return (
      <View style={styles.previewMasthead}>
        <PreviewTexture />
        <View style={styles.previewMastheadMetaRow}>
          <Text style={styles.previewMastheadMeta}>{year}</Text>
          <Text style={styles.previewMastheadMeta}>Postcard</Text>
        </View>
        <FittedPreviewText style={styles.previewMastheadTitle} minimumFontScale={0.25}>{placeUpper}</FittedPreviewText>
        <Image source={{ uri: p0 }} style={styles.previewMastheadImage} contentFit="cover" contentPosition="top center" />
      </View>
    );
  }

  return (
    <View style={styles.previewPinned}>
      <Image source={{ uri: p0 }} style={styles.previewPostcardFill} contentFit="cover" contentPosition="top center" />
      <PreviewTexture />
      <View style={styles.previewPinnedFrame}>
        <View style={styles.previewPinnedPin} />
        <View style={styles.previewPinnedTape} />
        <Image source={{ uri: p1 }} style={styles.previewPinnedImage} contentFit="cover" contentPosition="top center" />
        <FittedPreviewText style={styles.previewPinnedText} numberOfLines={2} minimumFontScale={0.48}>Hello from {place || 'Travel'}</FittedPreviewText>
      </View>
    </View>
  );
}

function FittedPreviewText({
  children,
  style,
  minimumFontScale = 0.55,
  numberOfLines = 1,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  minimumFontScale?: number;
  numberOfLines?: number;
}) {
  return (
    <Text
      adjustsFontSizeToFit
      minimumFontScale={minimumFontScale}
      numberOfLines={numberOfLines}
      ellipsizeMode="clip"
      style={[NO_WORD_BREAK, style]}
    >
      {children}
    </Text>
  );
}

function PreviewTexture({ dark = false }: { dark?: boolean }) {
  return (
    <View style={styles.previewTextureLayer}>
      {PREVIEW_TEXTURE_DOTS.map((dot, index) => (
        <View
          key={index}
          style={[
            styles.previewTextureDot,
            dark && styles.previewTextureDotDark,
            { left: dot.left, top: dot.top, width: dot.size, height: dot.size, borderRadius: dot.size / 2 },
          ]}
        />
      ))}
    </View>
  );
}

function spacedPreviewTitle(value: string) {
  const words = value.trim().split(/\s+/).slice(0, 3).join(' ');
  return words.length > 18 ? words : words.split('').join(' ');
}

function previewYear(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (!Number.isNaN(parsed.getTime())) return String(parsed.getFullYear());
  return date.slice(0, 4) || '2026';
}

function quotePlacementForLayout(layout: BeanLayout | string): QuotePlacement {
  if (layout === 'Film Strip') return 'film_subtitle';
  if (isPremiumLayout(layout)) return 'elegant_overlay';
  return 'none';
}

function quotePlacementLabel(placement: QuotePlacement) {
  switch (placement) {
    case 'postcard_quote':
      return 'Postcard Quote';
    case 'scrapbook_note':
      return 'Scrapbook Note';
    case 'film_subtitle':
      return 'Film Subtitle';
    case 'elegant_overlay':
      return 'Elegant Overlay';
    default:
      return 'No Quote';
  }
}

function moodOverlayStyle(item: BeanMood) {
  switch (item) {
    case 'Cozy':
      return { backgroundColor: 'rgba(242, 106, 46, 0.2)' };
    case 'Playful':
      return { backgroundColor: 'rgba(255, 194, 74, 0.15)' };
    case 'Dreamy':
      return { backgroundColor: 'rgba(129, 171, 255, 0.26)' };
    case 'Minimal':
      return { backgroundColor: 'rgba(255, 253, 248, 0.18)' };
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAPER },
  header: { paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  title: { color: INK, fontSize: 18, fontFamily: 'Inter_700Bold' },
  subtitle: { color: MUTED, fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 3 },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 14 },
  progressDot: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#ECD1BF' },
  progressDotActive: { backgroundColor: ORANGE },
  createMascotCard: { marginHorizontal: 20, marginBottom: 14, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  createMascotTitle: { color: INK, fontSize: 16, fontFamily: 'Inter_700Bold' },
  createMascotText: { color: MUTED, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_500Medium', marginTop: 3 },
  card: { marginHorizontal: 20, borderRadius: 22, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 16 },
  formRow: { flexDirection: 'row', gap: 10 },
  label: { color: MUTED, fontSize: 12, fontFamily: 'Inter_700Bold', marginBottom: 6, marginTop: 8 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFF8EF', paddingHorizontal: 13, color: INK, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  suggestionPanel: { marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFF8EF', overflow: 'hidden' },
  suggestionRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EACCB8' },
  suggestionIcon: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFE7D6' },
  suggestionName: { color: INK, fontSize: 14, fontFamily: 'Inter_700Bold' },
  suggestionMeta: { color: MUTED, fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  sectionTitle: { color: INK, fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  selectedPhotoTile: { position: 'relative', width: '30.7%', aspectRatio: 0.78 },
  photoTile: { width: '100%', height: '100%', borderRadius: 10, backgroundColor: '#EAD2C2' },
  removePhotoButton: { position: 'absolute', top: 7, right: 7, width: 28, height: 28, borderRadius: 14, backgroundColor: ORANGE, borderWidth: 2, borderColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center', shadowColor: '#6D321D', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 5, elevation: 3 },
  emptyPhoto: { width: '30.7%', aspectRatio: 0.78, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D9B9A3', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF9F0' },
  photoCount: { color: MUTED, fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center', marginVertical: 14 },
  primaryButton: { height: 50, borderRadius: 25, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  primaryText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  storyTools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  storyOptionalTitle: { color: INK, fontSize: 15, fontFamily: 'Inter_700Bold' },
  storyOptionalText: { color: MUTED, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', marginTop: 3 },
  storyToolButton: { minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFF3E8', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  storyToolText: { color: ORANGE, fontSize: 13, fontFamily: 'Inter_700Bold' },
  promptCard: { flexDirection: 'row', gap: 12, borderRadius: 14, backgroundColor: '#FFF7EC', padding: 13, marginBottom: 12 },
  promptIcon: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#FFE7D6', alignItems: 'center', justifyContent: 'center' },
  promptHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  promptRefreshButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFE7D6', alignItems: 'center', justifyContent: 'center' },
  prompt: { flex: 1, color: INK, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_700Bold' },
  promptInput: { minHeight: 58, color: INK, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', padding: 0, textAlignVertical: 'top' },
  counter: { color: '#B49683', fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'right' },
  skipStoryButton: { minHeight: 46, borderRadius: 23, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFFDF8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 },
  skipStoryText: { color: INK, fontSize: 14, fontFamily: 'Inter_700Bold' },
  layoutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  layoutCard: { width: Platform.OS === 'web' ? '31.6%' : '48.4%', borderRadius: 14, borderWidth: 1, borderColor: BORDER, padding: 8, alignItems: 'center', backgroundColor: '#FFF8EF' },
  freeLayoutCard: { width: Platform.OS === 'web' ? '23.4%' : '48.4%' },
  featuredLayoutCard: { width: Platform.OS === 'web' ? '48.4%' : '100%', alignItems: 'stretch' },
  layoutFitBadge: { position: 'absolute', left: 10, top: 10, zIndex: 7, maxWidth: '86%', minHeight: 22, borderRadius: 11, paddingHorizontal: 8, backgroundColor: 'rgba(244,255,249,0.94)', borderWidth: 1, borderColor: '#D2EFD9', flexDirection: 'row', alignItems: 'center', gap: 4 },
  layoutFitBadgeBest: { backgroundColor: ORANGE, borderColor: ORANGE, shadowColor: '#A84921', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 3 },
  layoutFitText: { color: '#2E7A52', fontSize: 9, lineHeight: 11, fontFamily: 'Inter_700Bold' },
  layoutFitTextBest: { color: '#fff' },
  layoutSectionHeader: { marginBottom: 10 },
  layoutSectionSub: { color: MUTED, fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: -6 },
  selectedCard: { borderColor: ORANGE, borderWidth: 2 },
  lockOverlay: { position: 'absolute', left: 8, right: 8, top: 8, bottom: 34, borderRadius: 12, backgroundColor: 'rgba(42,23,20,0.28)', alignItems: 'center', justifyContent: 'center' },
  postcardLockOverlay: { position: 'absolute', right: 14, top: 14, zIndex: 10 },
  lockCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(242,106,46,0.94)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  lockCircleSmall: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(242,106,46,0.96)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  previewFullFrame: { width: '100%', aspectRatio: 0.72, borderRadius: 12, overflow: 'hidden', backgroundColor: '#EAD2C2' },
  previewFull: { width: '100%', height: '100%' },
  previewFullSheen: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '35%', backgroundColor: 'rgba(42,23,20,0.12)' },
  previewScrapbook: { width: '100%', aspectRatio: 0.72, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F2D9B7', padding: 9, gap: 7 },
  previewTape: { position: 'absolute', top: 7, alignSelf: 'center', width: 62, height: 14, borderRadius: 4, backgroundColor: 'rgba(213,147,76,0.44)', transform: [{ rotate: '-2deg' }], zIndex: 5 },
  previewScrapHero: { flex: 1.42, width: '100%', borderRadius: 8, borderWidth: 5, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2', shadowColor: '#7D4F2F', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 4 },
  previewNoteCard: { position: 'absolute', left: 10, bottom: 18, width: '43%', height: '28%', borderRadius: 7, backgroundColor: 'rgba(255,253,248,0.94)', padding: 7, gap: 5, justifyContent: 'center', transform: [{ rotate: '-5deg' }], zIndex: 4 },
  previewScrapBottom: { flex: 0.82, flexDirection: 'row', gap: 7 },
  previewScrapSmall: { flex: 1, borderWidth: 4, borderColor: '#FFFDF8', borderRadius: 7, backgroundColor: '#EAD2C2' },
  previewCollage: { width: '100%', aspectRatio: 0.72, borderRadius: 12, flexDirection: 'row', gap: 4, overflow: 'hidden', backgroundColor: '#fff', padding: 3 },
  previewSplitHero: { flex: 1.18, height: '100%', borderRadius: 8, backgroundColor: '#EAD2C2' },
  previewSplitSide: { flex: 0.82, height: '100%', gap: 4 },
  previewSplitSmall: { flex: 1, borderRadius: 8, backgroundColor: '#EAD2C2' },
  previewStack: { width: '100%', aspectRatio: 0.72, borderRadius: 12, backgroundColor: '#FFF1E6', overflow: 'hidden', padding: 9, gap: 7 },
  postcardPreviewPhoto: { position: 'absolute', width: '58%', height: '54%', borderRadius: 7, borderWidth: 4, borderColor: '#fff', backgroundColor: '#EAD2C2' },
  postcardPreviewBack: { left: '8%', top: '13%', transform: [{ rotate: '-9deg' }], opacity: 0.82 },
  postcardPreviewSide: { right: '7%', bottom: '16%', transform: [{ rotate: '10deg' }], opacity: 0.8 },
  postcardPreviewMain: { flex: 1.42, width: '100%', borderRadius: 8, borderWidth: 6, borderBottomWidth: 16, borderColor: '#FFFDF8', backgroundColor: '#FFFDF8', overflow: 'hidden', shadowColor: '#7D4F2F', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.13, shadowRadius: 10, elevation: 4 },
  postcardPreviewImage: { width: '100%', height: '100%', backgroundColor: '#EAD2C2' },
  postcardPreviewBottom: { flex: 0.72, flexDirection: 'row', gap: 7 },
  postcardPreviewSmall: { flex: 1, borderRadius: 7, borderWidth: 5, borderBottomWidth: 13, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2' },
  postcardPreviewCaption: { flex: 1, gap: 3, justifyContent: 'center', paddingHorizontal: 6 },
  postcardPreviewLine: { width: '62%', height: 3, borderRadius: 2, backgroundColor: '#D8BCA8' },
  previewMosaic: { width: '100%', aspectRatio: 0.72, borderRadius: 12, backgroundColor: '#F8E7D0', flexDirection: 'row', flexWrap: 'wrap', gap: 5, padding: 8, overflow: 'hidden' },
  previewMosaicLines: { position: 'absolute', right: 11, top: 56, width: 46, gap: 6 },
  previewMosaicLine: { height: 2, borderRadius: 1, backgroundColor: 'rgba(132,97,75,0.22)' },
  previewMosaicCell: { width: '48%', height: '48%', borderRadius: 6, borderWidth: 4, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2' },
  previewStampMark: { position: 'absolute', right: 9, top: 9, width: 35, height: 35, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(42,23,20,0.28)', backgroundColor: 'rgba(255,253,248,0.7)' },
  previewMosaicTicket: { position: 'absolute', left: 11, bottom: 13, width: 50, height: 27, borderRadius: 6, backgroundColor: '#F2D4AC', transform: [{ rotate: '-3deg' }] },
  previewFoodTrip: { width: '100%', aspectRatio: 1.48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFF3DE', borderWidth: 1, borderColor: '#EAD7B8' },
  previewFoodTitleBubble: { position: 'absolute', left: '38%', top: '7%', width: 62, height: 62, borderRadius: 31, backgroundColor: '#073B68', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, zIndex: 5 },
  previewFoodTitleText: { width: '100%', color: '#FFF8E8', fontSize: 11, lineHeight: 13, fontFamily: Platform.OS === 'web' ? 'Georgia' : 'Inter_700Bold', fontStyle: 'italic', fontWeight: '700', textAlign: 'center', textTransform: 'uppercase' },
  previewFoodPrintLeft: { position: 'absolute', left: 12, top: 14, width: '32%', height: '43%', backgroundColor: '#FFFDF8', padding: 5, paddingBottom: 16, shadowColor: '#5E4A32', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 4, zIndex: 4 },
  previewFoodPrintRight: { position: 'absolute', right: 12, top: 14, width: '32%', height: '43%', backgroundColor: '#FFFDF8', padding: 5, paddingBottom: 16, shadowColor: '#5E4A32', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 4, zIndex: 4 },
  previewFoodPrintCenter: { position: 'absolute', left: '38%', bottom: 15, width: '24%', height: '43%', backgroundColor: '#FFFDF8', padding: 4, paddingBottom: 13, shadowColor: '#5E4A32', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.14, shadowRadius: 8, elevation: 3, zIndex: 3 },
  previewFoodPhoto: { width: '100%', height: '100%', backgroundColor: '#EAD2C2' },
  previewFoodCaptionLeft: { position: 'absolute', left: '5%', bottom: 28, width: '27%', height: 30, borderRadius: 15, backgroundColor: '#073B68', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, zIndex: 6 },
  previewFoodCaptionRight: { position: 'absolute', right: '5%', bottom: 28, width: '27%', height: 30, borderRadius: 15, backgroundColor: '#073B68', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, zIndex: 6 },
  previewFoodCaptionText: { width: '100%', color: '#FFF8E8', fontSize: 5, lineHeight: 6.3, fontFamily: Platform.OS === 'web' ? 'Georgia' : 'Inter_700Bold', fontStyle: 'italic', textAlign: 'center', textTransform: 'uppercase' },
  previewFoodTripPathA: { position: 'absolute', left: -4, bottom: 52, width: 92, flexDirection: 'row', justifyContent: 'space-between', transform: [{ rotate: '13deg' }], zIndex: 2 },
  previewFoodTripPathB: { position: 'absolute', right: -2, bottom: 43, width: 78, flexDirection: 'row', justifyContent: 'space-between', transform: [{ rotate: '-15deg' }], zIndex: 2 },
  previewFoodTripDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#073B68' },
  previewFoodSunburst: { position: 'absolute', left: 12, bottom: 13, width: 23, height: 23, borderRadius: 4, backgroundColor: '#FFD12D', transform: [{ rotate: '45deg' }], zIndex: 1 },
  previewClassicPostcard: { width: '100%', aspectRatio: 0.72, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFDF8', padding: 9, gap: 7 },
  previewClassicHero: { flex: 1.42, width: '100%', borderRadius: 9, borderWidth: 5, borderColor: '#FFF1E6', backgroundColor: '#EAD2C2' },
  previewClassicBottom: { flex: 0.74, flexDirection: 'row', gap: 7 },
  previewClassicSmall: { flex: 1, borderRadius: 8, borderWidth: 4, borderColor: '#FFF1E6', backgroundColor: '#EAD2C2' },
  previewEditorial: { width: '100%', aspectRatio: 0.72, borderRadius: 12, backgroundColor: '#FFFDF8', overflow: 'hidden', padding: 7, gap: 6 },
  previewEditorialText: { position: 'absolute', left: 9, top: 10, width: '38%', gap: 5, zIndex: 2 },
  previewEditorialLineBig: { width: '90%', height: 6, borderRadius: 3, backgroundColor: '#5B3828' },
  previewEditorialLine: { width: '72%', height: 4, borderRadius: 2, backgroundColor: '#D8BCA8' },
  previewEditorialLineShort: { width: '48%', height: 4, borderRadius: 2, backgroundColor: '#EBCFB9' },
  previewEditorialHero: { flex: 1.38, width: '100%', borderRadius: 8, backgroundColor: '#EAD2C2' },
  previewEditorialBottom: { flex: 0.74, flexDirection: 'row', gap: 5 },
  previewEditorialSmall: { flex: 1, borderRadius: 6, backgroundColor: '#EAD2C2' },
  previewFilm: { width: '100%', aspectRatio: 0.72, borderRadius: 12, backgroundColor: '#221915', paddingVertical: 19, paddingHorizontal: 8, overflow: 'hidden', justifyContent: 'center' },
  previewFilmHolesTop: { position: 'absolute', top: 6, left: 9, right: 9, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,253,248,0.72)' },
  previewFilmHolesBottom: { position: 'absolute', bottom: 6, left: 9, right: 9, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,253,248,0.72)' },
  previewFilmFrames: { flex: 1, flexDirection: 'row', gap: 5 },
  previewFilmFrame: { flex: 1, height: '100%', borderRadius: 5, borderWidth: 2, borderColor: '#D0A56E', backgroundColor: '#EAD2C2' },
  previewFilmNote: { position: 'absolute', left: 29, right: 29, bottom: 26, minHeight: 28, borderRadius: 5, backgroundColor: '#F8E1BF', padding: 6, gap: 4, transform: [{ rotate: '-2deg' }] },
  previewFilmNoteLine: { width: '76%', height: 3, borderRadius: 2, backgroundColor: '#8E5D34' },
  previewAirmail: { width: '100%', aspectRatio: 0.72, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F6FBFD', padding: 10, paddingTop: 26, gap: 7 },
  previewAirmailStripe: { position: 'absolute', left: 0, right: 0, height: 6, zIndex: 4 },
  previewAirmailStripeTop: { top: 0, backgroundColor: '#D95E50' },
  previewAirmailStripeBottom: { bottom: 0, backgroundColor: '#4A9CB8' },
  previewAirmailRoute: { position: 'absolute', left: 9, top: 9, width: 52, height: 17, borderRadius: 6, backgroundColor: 'rgba(255,253,248,0.76)', padding: 4, gap: 3, zIndex: 5 },
  previewRouteLine: { width: '72%', height: 2, borderRadius: 1, backgroundColor: 'rgba(217,94,80,0.52)' },
  previewRouteLineShort: { width: '44%', backgroundColor: 'rgba(74,156,184,0.58)' },
  previewAirmailPostmark: { position: 'absolute', right: 9, top: 8, width: 42, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: 'rgba(44,110,130,0.42)', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }], zIndex: 5 },
  previewAirmailPostmarkText: { color: '#2C6E82', fontSize: 6, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  previewAirmailHero: { flex: 1.38, width: '100%', borderRadius: 9, borderWidth: 5, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2' },
  previewAirmailBottom: { flex: 0.75, flexDirection: 'row', gap: 7 },
  previewAirmailSmall: { flex: 1, borderRadius: 7, borderWidth: 4, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2' },
  previewVintage: { width: '100%', aspectRatio: 0.72, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E8D0A8', padding: 10, paddingTop: 27, gap: 7 },
  previewVintageLabel: { position: 'absolute', left: 10, top: 9, color: '#6E452C', fontSize: 7, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', zIndex: 5 },
  previewVintageHero: { flex: 1.25, width: '100%', borderRadius: 8, borderWidth: 6, borderColor: '#FFF3D6', backgroundColor: '#EAD2C2' },
  previewVintageGrid: { flex: 0.82, flexDirection: 'row', gap: 6 },
  previewVintageSmall: { flex: 1, borderRadius: 7, borderWidth: 4, borderColor: '#FFF3D6', backgroundColor: '#EAD2C2' },
  previewVintageStamp: { position: 'absolute', right: 10, top: 8, width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#8E613D', backgroundColor: 'rgba(255,245,224,0.72)', alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  previewVintageStampRing: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: '#8E613D' },
  previewLetter: { width: '100%', aspectRatio: 0.72, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFF0CA', padding: 9, paddingTop: 25, gap: 6 },
  previewLetterText: { position: 'absolute', left: 10, top: 8, color: '#63301D', fontSize: 8, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', zIndex: 5 },
  previewLetterPostage: { position: 'absolute', right: 10, top: 8, width: 24, height: 20, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(99,48,29,0.38)', backgroundColor: 'rgba(255,253,248,0.52)', alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  previewLetterPostageMark: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: '#B5783D' },
  previewLetterGrid: { flex: 1, flexDirection: 'row', gap: 7 },
  previewLetterHero: { flex: 1.2, borderRadius: 9, borderWidth: 4, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2' },
  previewLetterSide: { flex: 0.88, gap: 7 },
  previewLetterSmall: { flex: 1, borderRadius: 8, borderWidth: 4, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2' },
  previewBoarding: { width: '100%', aspectRatio: 0.72, borderRadius: 12, overflow: 'hidden', backgroundColor: '#EEF9F6', padding: 10, paddingLeft: 24, paddingTop: 28, gap: 7 },
  previewBoardingRail: { position: 'absolute', left: 8, top: 10, bottom: 10, width: 10, borderRadius: 5, backgroundColor: '#235D61' },
  previewBoardingTop: { position: 'absolute', left: 24, right: 9, top: 8, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,253,248,0.7)', justifyContent: 'center', paddingHorizontal: 8, zIndex: 5 },
  previewBoardingTopText: { color: '#235D61', fontSize: 7, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  previewBoardingDots: { position: 'absolute', left: 12, top: 22, bottom: 22, justifyContent: 'space-between', zIndex: 5 },
  previewBoardingDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,253,248,0.84)' },
  previewBoardingHero: { flex: 1.35, width: '100%', borderRadius: 11, borderWidth: 5, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2' },
  previewBoardingBottom: { flex: 0.72, flexDirection: 'row', gap: 7 },
  previewBoardingSmall: { flex: 1, borderRadius: 8, borderWidth: 4, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2' },
  previewGallery: { width: '100%', aspectRatio: 0.72, borderRadius: 12, overflow: 'hidden', backgroundColor: '#191B1D', padding: 9, paddingTop: 28, gap: 7 },
  previewGalleryLabel: { position: 'absolute', left: 10, top: 9, color: '#F8E7D0', fontSize: 7, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', zIndex: 5 },
  previewGalleryPill: { position: 'absolute', right: 10, top: 9, width: 32, height: 13, borderRadius: 7, backgroundColor: 'rgba(248,231,208,0.14)', borderWidth: 1, borderColor: 'rgba(248,231,208,0.24)', zIndex: 5 },
  previewGalleryHero: { flex: 1.25, width: '100%', borderRadius: 9, borderWidth: 3, borderColor: '#F8E7D0', backgroundColor: '#EAD2C2' },
  previewGalleryGrid: { flex: 0.8, flexDirection: 'row', gap: 6 },
  previewGallerySmall: { flex: 1, borderRadius: 7, borderWidth: 2.5, borderColor: '#F8E7D0', backgroundColor: '#EAD2C2' },
  previewSunsetPostcard: { width: '100%', aspectRatio: 0.72, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFE7CF', padding: 10, paddingTop: 28, gap: 7 },
  previewSunsetFrameLine: { position: 'absolute', left: 8, right: 8, top: 8, bottom: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(180,91,45,0.18)' },
  previewSunsetLabel: { position: 'absolute', left: 11, top: 9, color: '#9E4A26', fontSize: 7, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', zIndex: 5 },
  previewSunsetPostcardHero: { flex: 1.4, width: '100%', borderRadius: 11, borderWidth: 6, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2' },
  previewSunsetPostcardBottom: { flex: 0.74, flexDirection: 'row', gap: 7 },
  previewSunsetPostcardSmall: { flex: 1, borderRadius: 9, borderWidth: 4, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2' },
  previewPostcardFill: { ...StyleSheet.absoluteFillObject, backgroundColor: '#EAD2C2' },
  previewTextureLayer: { ...StyleSheet.absoluteFillObject },
  previewTextureDot: { position: 'absolute', backgroundColor: 'rgba(255,253,248,0.48)' },
  previewTextureDotDark: { backgroundColor: 'rgba(255,253,248,0.18)' },
  previewThisIs: { width: '100%', aspectRatio: 1.48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFE76A', borderWidth: 10, borderColor: '#FFE76A' },
  previewThisIsTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(42,23,20,0.18)' },
  previewThisInnerFrame: { position: 'absolute', left: 7, right: 7, top: 7, bottom: 7, borderWidth: 1, borderColor: 'rgba(255,253,248,0.42)' },
  previewThisTape: { position: 'absolute', top: -1, left: '42%', width: 38, height: 10, borderRadius: 3, backgroundColor: 'rgba(255,253,248,0.48)', transform: [{ rotate: '-2deg' }] },
  previewThisSmallLeft: { position: 'absolute', left: 28, top: '33%', color: '#FFFDF8', fontSize: 13, fontFamily: 'Inter_700Bold' },
  previewThisSmallRight: { position: 'absolute', right: 30, top: '33%', color: '#FFFDF8', fontSize: 13, fontFamily: 'Inter_700Bold' },
  previewThisPlace: { position: 'absolute', left: 18, right: 18, top: '43%', color: '#FFFDF8', fontSize: 31, lineHeight: 35, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  previewThisMeta: { position: 'absolute', right: 6, top: 5, color: '#35504A', fontSize: 8, lineHeight: 10, fontFamily: 'Inter_700Bold' },
  previewWish: { width: '100%', aspectRatio: 1.48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1D1D1B' },
  previewWishMeta: { position: 'absolute', left: 9, top: 6, color: '#D7B47A', fontSize: 7, lineHeight: 9, fontFamily: 'Inter_700Bold' },
  previewWishTile: { position: 'absolute', borderRadius: 3, backgroundColor: '#EAD2C2' },
  previewWishTile0: { left: 9, top: 9, width: '28%', height: '27%' },
  previewWishTile1: { left: '36%', top: 9, width: '28%', height: '27%' },
  previewWishTile2: { right: 9, top: 9, width: '28%', height: '27%' },
  previewWishTile3: { left: 9, top: '40%', width: '28%', height: '25%' },
  previewWishTile4: { right: 9, top: '40%', width: '28%', height: '25%' },
  previewWishTile5: { left: 9, bottom: 9, width: '28%', height: '25%' },
  previewWishTile6: { left: '36%', bottom: 9, width: '28%', height: '25%' },
  previewWishTile7: { right: 9, bottom: 9, width: '28%', height: '25%' },
  previewWishCenter: { position: 'absolute', left: '37%', right: '37%', top: '36%', bottom: '31%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1D1D1B', borderWidth: 1, borderColor: 'rgba(255,253,248,0.16)' },
  previewWishText: { color: '#FFFDF8', fontSize: 11, lineHeight: 15, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  previewSnapshots: { width: '100%', aspectRatio: 1.48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E8F5F8', borderWidth: 1, borderColor: '#B7CFDC', padding: 9, flexDirection: 'row', gap: 12 },
  previewSnapshotsGrid: { width: '49%', height: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  previewSnapshotsPhoto: { width: '47.4%', height: '22.8%', backgroundColor: '#D7E7EC' },
  previewSnapshotsText: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  previewSnapshotsEyebrow: { width: '100%', color: '#3C77A3', fontSize: 7, lineHeight: 9, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  previewSnapshotsHeadline: { color: '#3F7CAE', fontSize: 14, lineHeight: 19, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  previewSnapshotsPlace: { width: '100%', color: '#3F7CAE', fontSize: 14, lineHeight: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  previewSnapshotsNote: { color: '#3C77A3', fontSize: 7, lineHeight: 9, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 6 },
  previewCityCover: { width: '100%', aspectRatio: 1.48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1D1D1B' },
  previewCityCoverTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(19,18,16,0.42)' },
  previewCityCoverFrame: { position: 'absolute', left: 10, right: 10, top: 10, bottom: 10, borderWidth: 1, borderColor: 'rgba(255,253,248,0.58)' },
  previewCityCoverMeta: { position: 'absolute', left: 16, right: 16, top: 16, color: '#FFFDF8', fontSize: 7, lineHeight: 9, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  previewCityCoverPlace: { position: 'absolute', left: 16, right: 16, bottom: 25, color: '#FFFDF8', fontSize: 29, lineHeight: 32, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  previewCityCoverRule: { position: 'absolute', left: 16, bottom: 16, width: 42, height: 3, borderRadius: 2, backgroundColor: '#FFE46B' },
  previewBlackCity: { width: '100%', aspectRatio: 1.48, borderRadius: 15, overflow: 'hidden', backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#A7A7A7' },
  previewBlackCityMist: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.18)' },
  previewBlackCityShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)' },
  previewBlackCityContent: { position: 'absolute', left: 12, right: 12, top: '32%', alignItems: 'center', justifyContent: 'center' },
  previewBlackCityTitle: { width: '100%', color: '#FFFDF8', fontSize: 22, lineHeight: 26, fontFamily: Platform.OS === 'web' ? 'Brush Script MT, Segoe Script, cursive' : 'Inter_700Bold', fontStyle: 'italic', fontWeight: '700', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.28)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  previewBlackCitySubtitle: { color: '#FFFDF8', fontSize: 10, lineHeight: 13, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 1 },
  previewAnyCityMosaic: { width: '100%', aspectRatio: 1.48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E8E6DD', alignItems: 'center', justifyContent: 'center', padding: 16 },
  previewAnyCityGrid: { width: '86%', height: '68%', backgroundColor: '#FFFDF8', borderWidth: 5, borderColor: '#FFFDF8', shadowColor: '#37322C', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.22, shadowRadius: 11, elevation: 5 },
  previewAnyCityTile: { position: 'absolute', backgroundColor: '#BCB9B0' },
  previewAnyCityTopLeft: { left: 0, top: 0, width: '64%', height: '31%' },
  previewAnyCityTopRight: { right: 0, top: 0, width: '31%', height: '64%' },
  previewAnyCityBottomLeft: { left: 0, bottom: 0, width: '34%', height: '63%' },
  previewAnyCityCenter: { left: '36.5%', top: '34%', width: '26%', height: '29%' },
  previewAnyCityBottomRight: { right: 0, bottom: 0, width: '63.5%', height: '31%' },
  previewAnyCityWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.08)' },
  previewAnyCityTitle: { position: 'absolute', left: 10, right: 10, top: '31%', color: '#F26A2E', fontSize: 20, lineHeight: 24, fontFamily: 'Inter_700Bold', textAlign: 'center', textTransform: 'uppercase' },
  previewAnyCityDate: { position: 'absolute', left: 0, right: 0, top: '59%', color: 'rgba(255,253,248,0.92)', fontSize: 7, lineHeight: 9, fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
  previewSeekTravel: { width: '100%', aspectRatio: 1.48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#2A2B27' },
  previewSeekShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,18,16,0.62)' },
  previewSeekRule: { position: 'absolute', left: 22, top: 31, width: 40, height: 4, backgroundColor: '#FFFDF8' },
  previewSeekTitle: { position: 'absolute', left: 22, top: 51, width: '42%', color: '#FFFDF8', fontSize: 15.5, lineHeight: 19, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  previewSeekCopy: { position: 'absolute', left: 23, top: 111, width: '41%', color: 'rgba(255,253,248,0.88)', fontSize: 7, lineHeight: 9.4, fontFamily: 'Inter_600SemiBold' },
  previewSeekPhotoFrame: { position: 'absolute', right: 23, top: 31, width: '39%', height: '60%', borderWidth: 5, borderColor: '#FFFDF8', backgroundColor: '#FFFDF8', shadowColor: '#111', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 4 },
  previewSeekPhoto: { width: '100%', height: '100%', backgroundColor: '#BDBAB1' },
  previewMountainPostcard: { width: '100%', aspectRatio: 1.48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#EFEEE7', alignItems: 'center', justifyContent: 'center', padding: 16 },
  previewMountainCard: { width: '84%', height: '68%', backgroundColor: '#FFFDF8', shadowColor: '#3D3931', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.22, shadowRadius: 11, elevation: 5 },
  previewMountainPhoto: { width: '100%', height: '77%', backgroundColor: '#A8D5EA' },
  previewMountainBand: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFDF8', paddingHorizontal: 16 },
  previewMountainTitle: { width: '100%', color: '#5C94A7', fontSize: 9, lineHeight: 12, fontFamily: 'Inter_600SemiBold', textAlign: 'center', textTransform: 'uppercase' },
  previewTempleHeritage: { width: '100%', aspectRatio: 1.48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#EEEDE5', alignItems: 'center', justifyContent: 'center', padding: 14 },
  previewTempleCard: { width: '90%', height: '71%', backgroundColor: '#FFFDF8', shadowColor: '#3B342B', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  previewTempleTitlePanel: { position: 'absolute', left: 0, top: 0, width: '40%', height: '73%', paddingLeft: 6, paddingRight: 9, paddingTop: 10, zIndex: 3 },
  previewTempleTitle: { width: '100%', color: '#5D534B', fontSize: 12.5, lineHeight: 14, fontFamily: Platform.OS === 'web' ? 'Georgia' : 'Inter_700Bold', fontWeight: '700', textTransform: 'uppercase' },
  previewTempleQuoteLine: { position: 'absolute', left: 6, right: 9, top: '67%', height: 1, backgroundColor: '#90877D' },
  previewTempleQuote: { position: 'absolute', left: 6, right: 9, top: '43%', color: '#6A625A', fontSize: 4.2, lineHeight: 5.5, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  previewTempleDate: { position: 'absolute', left: 6, bottom: 7, color: '#8A8178', fontSize: 5, fontFamily: 'Inter_700Bold' },
  previewTempleHero: { position: 'absolute', right: 0, top: 0, width: '58%', height: '68%', backgroundColor: '#D8B28C' },
  previewTempleStrip: { position: 'absolute', left: 0, bottom: 0, width: '66%', height: '25%', backgroundColor: '#D8B28C' },
  previewTempleCountry: { position: 'absolute', right: 8, bottom: 25, width: '30%', color: '#5D534B', fontSize: 7.8, lineHeight: 9.5, fontFamily: Platform.OS === 'web' ? 'Georgia' : 'Inter_700Bold', fontWeight: '700', textAlign: 'right', textTransform: 'uppercase' },
  previewTemplePostcard: { position: 'absolute', right: 9, bottom: 7, color: '#8A8178', fontSize: 5, fontFamily: 'Inter_700Bold', textAlign: 'right' },
  previewBreakPostcard: { width: '100%', aspectRatio: 1.48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#EEEDE5', alignItems: 'center', justifyContent: 'center', padding: 17 },
  previewBreakCard: { width: '84%', height: '64%', backgroundColor: '#D9D4C7', shadowColor: '#363024', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 5 },
  previewBreakImage: { width: '100%', height: '100%', backgroundColor: '#B7B49C' },
  previewBreakTint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(39,48,34,0.14)' },
  previewBreakScript: { position: 'absolute', left: 10, right: 10, top: '43%', color: '#FFFDF8', fontSize: 14, lineHeight: 18, fontFamily: Platform.OS === 'web' ? 'Brush Script MT, Segoe Script, cursive' : 'Inter_700Bold', fontStyle: 'italic', fontWeight: '700', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.24)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  previewSidePostcard: { width: '100%', aspectRatio: 1.48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#D8C4A2', borderWidth: 8, borderColor: '#E9DFCF' },
  previewSidePanel: { position: 'absolute', left: 10, top: 11, bottom: 11, width: '38%', backgroundColor: '#FFFDF8', padding: 7, alignItems: 'center', justifyContent: 'center' },
  previewSideInset: { width: '100%', height: '27%', borderRadius: 2, marginBottom: 6, backgroundColor: '#EAD2C2' },
  previewSideTape: { position: 'absolute', top: 4, left: '30%', width: 32, height: 8, borderRadius: 3, backgroundColor: 'rgba(222,173,105,0.45)', transform: [{ rotate: '-2deg' }] },
  previewSidePlace: { width: '100%', color: '#193226', fontFamily: 'Inter_700Bold', textAlign: 'center' },
  previewSideCopy: { width: '100%', color: '#193226', fontSize: 7, lineHeight: 9, fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginTop: 5 },
  previewGreetings: { width: '100%', aspectRatio: 1.48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFDF8', borderWidth: 7, borderColor: '#EFECE4', flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  previewGreetingsPhoto: { width: '32.6%', height: '49%', backgroundColor: '#EAD2C2' },
  previewGreetingsBand: { position: 'absolute', left: 0, right: 0, top: '37%', height: 45, backgroundColor: 'rgba(255,253,248,0.96)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  previewGreetingsSmall: { color: '#2C2522', fontSize: 6, lineHeight: 8, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase' },
  previewGreetingsText: { width: '100%', color: '#2C2522', fontSize: 16, lineHeight: 19, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  previewMasthead: { width: '100%', aspectRatio: 1.48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFDF8', padding: 8, borderWidth: 1, borderColor: '#DAD4C9' },
  previewMastheadMetaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewMastheadMeta: { color: '#6D6961', fontSize: 7, fontFamily: 'Inter_700Bold' },
  previewMastheadTitle: { width: '100%', color: '#5B5750', fontSize: 27, lineHeight: 32, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  previewMastheadImage: { flex: 1, width: '100%', borderRadius: 2, backgroundColor: '#EAD2C2' },
  previewPinned: { width: '100%', aspectRatio: 1.48, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E5E2D8', alignItems: 'center', justifyContent: 'center' },
  previewPinnedFrame: { width: '58%', height: '72%', backgroundColor: '#FFFDF8', padding: 7, paddingBottom: 27, shadowColor: '#2A1714', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 4 },
  previewPinnedPin: { position: 'absolute', top: -7, left: '50%', width: 15, height: 15, marginLeft: -7, borderRadius: 8, backgroundColor: '#C8C2AB', borderWidth: 1, borderColor: '#8F8670', zIndex: 5 },
  previewPinnedTape: { position: 'absolute', top: -7, left: '32%', width: 43, height: 12, borderRadius: 3, backgroundColor: 'rgba(222,173,105,0.42)', transform: [{ rotate: '1deg' }], zIndex: 4 },
  previewPinnedImage: { flex: 1, width: '100%', backgroundColor: '#EAD2C2' },
  previewPinnedText: { position: 'absolute', left: 8, right: 8, bottom: 5, color: '#4C3328', fontSize: 8.5, lineHeight: 10, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  previewSunset: { width: '100%', aspectRatio: 0.72, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FA6E3E' },
  previewSunsetOrb: { position: 'absolute', right: -18, top: -16, width: 82, height: 82, borderRadius: 41, backgroundColor: '#FFD07B' },
  previewSunsetLines: { position: 'absolute', left: 10, top: 11, width: '48%', gap: 5, zIndex: 2 },
  previewSunsetLineBig: { width: '100%', height: 7, borderRadius: 4, backgroundColor: '#351A15' },
  previewSunsetLine: { width: '68%', height: 4, borderRadius: 2, backgroundColor: '#FFF3D8' },
  previewSunsetPhoto: { position: 'absolute', left: 10, right: 10, bottom: 18, height: '52%', borderRadius: 9, borderWidth: 5, borderColor: '#FFF6E8', backgroundColor: '#EAD2C2' },
  previewSunsetSmall: { position: 'absolute', right: 12, top: 42, width: '31%', height: '27%', borderRadius: 7, borderWidth: 4, borderColor: '#FFF6E8', backgroundColor: '#EAD2C2', transform: [{ rotate: '6deg' }] },
  previewPassport: { width: '100%', aspectRatio: 0.72, borderRadius: 12, overflow: 'hidden', backgroundColor: '#DDF4F1', borderWidth: 1, borderColor: '#A6D3D5' },
  previewPassportPhoto: { position: 'absolute', left: 12, top: 18, width: '58%', height: '48%', borderRadius: 9, borderWidth: 4, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2', transform: [{ rotate: '-2deg' }] },
  previewPassportSeal: { position: 'absolute', right: 13, top: 17, width: 42, height: 42, borderRadius: 21, borderWidth: 3, borderColor: '#2E8B8B', backgroundColor: 'rgba(255,253,248,0.75)' },
  previewPassportTicket: { position: 'absolute', left: 14, bottom: 17, width: '50%', height: '26%', borderRadius: 8, backgroundColor: '#173F4A', padding: 8, gap: 5, justifyContent: 'center' },
  previewPassportLine: { width: '76%', height: 4, borderRadius: 2, backgroundColor: '#B7E8E3' },
  previewColorPop: { width: '100%', aspectRatio: 0.72, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F9CB41' },
  previewColorOrange: { position: 'absolute', left: 0, top: 0, width: '47%', height: '41%', backgroundColor: '#FF6B35' },
  previewColorMint: { position: 'absolute', right: 0, bottom: 0, width: '43%', height: '42%', backgroundColor: '#6ED2B5' },
  previewColorHero: { position: 'absolute', left: 12, top: 15, width: '60%', height: '45%', borderRadius: 10, borderWidth: 5, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2' },
  previewColorSmallA: { position: 'absolute', left: 17, bottom: 19, width: '35%', height: '29%', borderRadius: 9, borderWidth: 4, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2', transform: [{ rotate: '-5deg' }] },
  previewColorSmallB: { position: 'absolute', right: 14, top: 48, width: '30%', height: '29%', borderRadius: 9, borderWidth: 4, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2', transform: [{ rotate: '5deg' }] },
  previewDream: { width: '100%', aspectRatio: 0.72, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E8DDF8' },
  previewDreamMoon: { position: 'absolute', left: -17, top: -18, width: 78, height: 78, borderRadius: 39, backgroundColor: '#FFD9C8', opacity: 0.8 },
  previewDreamCloud: { position: 'absolute', right: -18, bottom: 23, width: 84, height: 50, borderRadius: 25, backgroundColor: '#CDEEFF', opacity: 0.85 },
  previewDreamBack: { position: 'absolute', left: 13, top: 24, width: '47%', height: '40%', borderRadius: 11, opacity: 0.72, backgroundColor: '#EAD2C2', transform: [{ rotate: '-8deg' }] },
  previewDreamMain: { position: 'absolute', right: 13, top: 36, width: '58%', height: '52%', borderRadius: 12, borderWidth: 5, borderColor: 'rgba(255,253,248,0.92)', backgroundColor: '#EAD2C2', transform: [{ rotate: '4deg' }] },
  previewJournal: { width: '100%', aspectRatio: 0.72, borderRadius: 12, backgroundColor: '#D8A566', overflow: 'hidden', padding: 9, flexDirection: 'row', gap: 10 },
  previewJournalSpine: { position: 'absolute', left: '49%', top: 0, bottom: 0, width: 6, backgroundColor: '#B77843' },
  previewJournalTag: { position: 'absolute', left: 11, top: 12, width: 45, height: 25, borderRadius: 6, backgroundColor: '#F7D9AC', transform: [{ rotate: '-4deg' }] },
  previewJournalPage: { flex: 1, borderRadius: 8, backgroundColor: '#FFF7E8', padding: 6, gap: 6 },
  previewJournalLeftPhoto: { flex: 1, borderRadius: 6, borderWidth: 3, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2' },
  previewJournalText: { position: 'absolute', left: 13, bottom: 21, width: '34%', borderRadius: 7, backgroundColor: '#FFFDF8', padding: 7, gap: 4, transform: [{ rotate: '2deg' }] },
  previewJournalTextBig: { width: '80%', height: 5, borderRadius: 3, backgroundColor: '#5B3828' },
  previewJournalLine: { width: '100%', height: 2, borderRadius: 1, backgroundColor: '#E7CDB1' },
  previewJournalPhoto: { flex: 1, borderRadius: 7, borderWidth: 4, borderColor: '#FFFDF8', backgroundColor: '#EAD2C2' },
  previewJournalSmall: { position: 'absolute', right: 12, bottom: 17, width: '35%', height: '31%', borderRadius: 5, borderWidth: 4, borderColor: '#fff', backgroundColor: '#EAD2C2', transform: [{ rotate: '-4deg' }] },
  layoutName: { color: INK, fontSize: 11, fontFamily: 'Inter_700Bold', marginTop: 7, textAlign: 'center' },
  freePill: { color: '#23915B', fontSize: 9, fontFamily: 'Inter_700Bold', backgroundColor: '#DDF3E6', borderRadius: 8, overflow: 'hidden', paddingHorizontal: 5, marginTop: 3 },
  premiumPill: { color: ORANGE, backgroundColor: '#FFE6D7' },
  quoteFeatureCard: { marginBottom: 18, borderRadius: 18, borderWidth: 1, borderColor: '#EECFB8', backgroundColor: '#FFF4E7', padding: 13 },
  quoteFeatureHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
  quoteFeatureTitle: { color: INK, fontSize: 16, fontFamily: 'Inter_700Bold' },
  quoteFeatureSub: { color: MUTED, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', marginTop: 3 },
  quotePremiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: ORANGE },
  quotePremiumText: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },
  selectedQuoteBox: { borderRadius: 14, borderWidth: 1, borderColor: '#E9C7AA', backgroundColor: CARD, padding: 12, marginBottom: 11 },
  selectedQuoteStyle: { color: ORANGE, fontSize: 11, fontFamily: 'Inter_700Bold', marginBottom: 5, textTransform: 'uppercase' },
  selectedQuoteText: { color: INK, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_700Bold' },
  selectedQuoteAuthor: { color: MUTED, fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 6 },
  emptyQuoteBox: { minHeight: 56, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E4BFA4', backgroundColor: '#FFFDF8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 11 },
  emptyQuoteText: { color: MUTED, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  quoteOptionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quoteOptionButton: { width: '48.5%', minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: '#F1D1BC', backgroundColor: '#FFFDF8', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8 },
  quoteOptionText: { color: INK, fontSize: 11, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  quoteMarkIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  quoteMarkIconCompact: { width: 22, height: 22 },
  quotePaperBack: { position: 'absolute', width: 18, height: 16, borderRadius: 5, backgroundColor: '#FFD3B8', transform: [{ rotate: '-8deg' }], left: 1, top: 5 },
  quotePaperBackCompact: { width: 16, height: 14, borderRadius: 4, left: 2, top: 5 },
  quotePaperFront: { width: 18, height: 18, borderRadius: 6, backgroundColor: '#FFFDF8', borderWidth: 1.5, borderColor: ORANGE, alignItems: 'center', justifyContent: 'center', gap: 2, shadowColor: '#8B5B38', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 2 },
  quotePaperFrontCompact: { width: 16, height: 16, borderRadius: 5, gap: 1 },
  quoteMarksRow: { flexDirection: 'row', gap: 2 },
  quoteMarkPair: { width: 4, height: 7, alignItems: 'center' },
  quoteMarkPairCompact: { width: 3, height: 6 },
  quoteMarkDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: ORANGE },
  quoteMarkDotCompact: { width: 3, height: 3, borderRadius: 1.5 },
  quoteMarkStem: { width: 2, height: 4, borderRadius: 1, backgroundColor: ORANGE, marginTop: -1, transform: [{ rotate: '14deg' }] },
  quoteMarkStemCompact: { width: 1.5, height: 3 },
  quoteTinyLine: { width: 10, height: 2, borderRadius: 1, backgroundColor: '#F7B58C' },
  quoteTinyLineCompact: { width: 8, height: 1.5 },
  quoteSpark: { position: 'absolute', right: -1, top: 1, width: 6, height: 6, borderRadius: 3, backgroundColor: '#F7B85E', borderWidth: 1, borderColor: '#FFFDF8' },
  quoteSparkCompact: { right: 0, top: 0, width: 5, height: 5, borderRadius: 2.5 },
  lockedQuoteCard: { marginBottom: 18, minHeight: 72, borderRadius: 18, borderWidth: 1, borderColor: '#F1D1BC', backgroundColor: '#FFF1E6', flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  lockedQuoteIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  lockedQuoteTitle: { color: INK, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_700Bold' },
  lockedQuoteBody: { color: MUTED, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', marginTop: 2 },
  lockedQuoteLink: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold' },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  moodCard: { width: '48.4%', borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFF8EF', overflow: 'hidden' },
  moodCardActive: { borderColor: ORANGE, borderWidth: 2 },
  moodImage: { width: '100%', height: 92, backgroundColor: '#EAD2C2' },
  moodOverlay: { ...StyleSheet.absoluteFillObject, bottom: 40 },
  minimalVeil: { position: 'absolute', top: 10, right: 10, bottom: 50, left: 10, borderRadius: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  playfulDots: { position: 'absolute', top: 9, right: 9, flexDirection: 'row', gap: 4 },
  playfulDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1, borderColor: '#fff' },
  moodFooter: { minHeight: 40, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF8EF' },
  moodText: { color: INK, fontSize: 12, fontFamily: 'Inter_700Bold' },
  moodTextActive: { color: ORANGE, fontFamily: 'Inter_700Bold' },
  resultWrap: { paddingHorizontal: 20 },
  resultCollageCapture: { width: '100%', maxWidth: 430, alignSelf: 'center' },
  resultQuoteCard: { marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: '#F1D1BC', backgroundColor: '#FFFDF8', padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  resultQuoteIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFE7D6', alignItems: 'center', justifyContent: 'center' },
  resultQuoteKicker: { color: ORANGE, fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', marginBottom: 3 },
  resultQuoteText: { color: INK, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_700Bold' },
  resultQuoteAuthor: { color: MUTED, fontSize: 11, fontFamily: 'Inter_600SemiBold', marginTop: 5 },
  mascotMarkToggle: { marginTop: 12, borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  mascotMarkToggleActive: { borderColor: ORANGE, backgroundColor: '#FFF1E6' },
  mascotMarkTitle: { color: INK, fontSize: 13, fontFamily: 'Inter_700Bold' },
  mascotMarkText: { color: MUTED, fontSize: 11, lineHeight: 15, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  actionButton: { flexGrow: 1, flexBasis: '30%', minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8 },
  actionText: { color: INK, fontSize: 11, fontFamily: 'Inter_700Bold' },
  saveAction: { backgroundColor: ORANGE, borderColor: ORANGE },
  saveActionText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  exportGrid: { flexDirection: 'row', gap: 8, marginTop: 8 },
  exportButton: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  exportText: { color: INK, fontSize: 12, fontFamily: 'Inter_700Bold' },
  doneNavRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  doneNavButton: { flex: 1, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: '#F1D1BC', backgroundColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: 10 },
  doneNavPrimary: { backgroundColor: ORANGE, borderColor: ORANGE },
  doneNavText: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold' },
  doneNavPrimaryText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  upgradeBanner: { marginTop: 10, minHeight: 46, borderRadius: 15, borderWidth: 1, borderColor: '#F6D4C0', backgroundColor: '#FFF1E6', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  upgradeIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center' },
  upgradeText: { flex: 1, color: INK, fontSize: 13, fontFamily: 'Inter_700Bold' },
  upgradeLink: { color: ORANGE, fontSize: 13, fontFamily: 'Inter_700Bold' },
  createAnotherButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#F1D1BC', backgroundColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, marginTop: 8 },
  createAnotherText: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold' },
  editBackdrop: { flex: 1, backgroundColor: 'rgba(42,23,20,0.28)', justifyContent: 'flex-end' },
  editSheet: { maxHeight: '92%', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: BORDER, backgroundColor: PAPER, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14 },
  editHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  editTitle: { color: INK, fontSize: 24, lineHeight: 29, fontFamily: 'Inter_700Bold' },
  editSubtitle: { color: MUTED, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium', marginTop: 4 },
  editCloseButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center' },
  editContent: { paddingBottom: 14, gap: 12 },
  editSection: { borderRadius: 18, borderWidth: 1, borderColor: '#EFD6C4', backgroundColor: CARD, padding: 13 },
  editSectionTitle: { color: INK, fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  editFormRow: { flexDirection: 'row', gap: 10 },
  editLabel: { color: MUTED, fontSize: 11, fontFamily: 'Inter_700Bold', marginBottom: 6, marginTop: 4 },
  editInput: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFF8EF', paddingHorizontal: 12, color: INK, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  editPhotoRow: { borderRadius: 18, borderWidth: 1, borderColor: '#EFD6C4', backgroundColor: CARD, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  editPhotoThumb: { width: 58, height: 58, borderRadius: 13, backgroundColor: '#EAD2C2' },
  editPhotoTitle: { color: INK, fontSize: 14, fontFamily: 'Inter_700Bold' },
  editPhotoSub: { color: MUTED, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', marginTop: 3 },
  editSmallButton: { minHeight: 38, borderRadius: 19, borderWidth: 1, borderColor: ORANGE, backgroundColor: '#FFFDF8', paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  editSmallButtonText: { color: ORANGE, fontSize: 11, fontFamily: 'Inter_700Bold' },
  editPhotoThumbGrid: { borderRadius: 18, borderWidth: 1, borderColor: '#EFD6C4', backgroundColor: CARD, padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  editPhotoThumbWrap: { position: 'relative', width: 64, height: 64 },
  editPhotoGridThumb: { width: '100%', height: '100%', borderRadius: 13, backgroundColor: '#EAD2C2' },
  editPhotoRemoveButton: { position: 'absolute', top: -7, right: -7, width: 25, height: 25, borderRadius: 13, backgroundColor: ORANGE, borderWidth: 2, borderColor: '#FFFDF8', alignItems: 'center', justifyContent: 'center', shadowColor: '#6D321D', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 5, elevation: 3 },
  editPromptBox: { borderRadius: 14, backgroundColor: '#FFF7EC', padding: 12, marginBottom: 9 },
  editPromptLabel: { color: INK, fontSize: 12, fontFamily: 'Inter_700Bold', marginBottom: 7 },
  editPromptInput: { minHeight: 64, color: INK, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', padding: 0, textAlignVertical: 'top' },
  editLayoutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editLayoutChip: { width: Platform.OS === 'web' ? '23.8%' : '48.5%', minHeight: 82, borderRadius: 14, borderWidth: 1, borderColor: '#E8C8B1', backgroundColor: '#FFF8EF', padding: 10, justifyContent: 'space-between' },
  editLayoutChipActive: { borderColor: ORANGE, borderWidth: 2, backgroundColor: '#FFF1E6' },
  editLayoutIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFE7D6', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  editLayoutIconLocked: { backgroundColor: ORANGE },
  editLayoutText: { color: INK, fontSize: 12, lineHeight: 16, fontFamily: 'Inter_700Bold' },
  editLayoutTextActive: { color: ORANGE },
  editLayoutPill: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 9, backgroundColor: '#DDF3E6', color: '#23915B', paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontFamily: 'Inter_700Bold', marginTop: 7 },
  editLayoutPillPremium: { backgroundColor: '#FFE6D7', color: ORANGE },
  editMoodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editMoodChip: { minHeight: 40, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: '#FFF8EF', paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' },
  editMoodChipActive: { borderColor: ORANGE, backgroundColor: '#FFF1E6' },
  editMoodText: { color: INK, fontSize: 12, fontFamily: 'Inter_700Bold' },
  editMoodTextActive: { color: ORANGE },
  editDoneButton: { minHeight: 50, borderRadius: 25, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  editDoneText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
  quoteModalBackdrop: { flex: 1, backgroundColor: 'rgba(42,23,20,0.28)', justifyContent: 'flex-end' },
  quoteModalSheet: { maxHeight: '86%', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: BORDER, backgroundColor: PAPER, padding: 18 },
  quoteModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  quoteModalTitle: { color: INK, fontSize: 23, lineHeight: 28, fontFamily: 'Inter_700Bold' },
  quoteModalSubtitle: { color: MUTED, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_500Medium', marginTop: 4 },
  quoteCloseButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center' },
  quoteListContent: { paddingBottom: 12, gap: 10 },
  quoteCategoryRow: { gap: 8, paddingBottom: 8 },
  quoteCategoryPill: { height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#E8C8B1', backgroundColor: '#FFFDF8', paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  quoteCategoryPillActive: { borderColor: ORANGE, backgroundColor: '#FFF1E6' },
  quoteCategoryText: { color: MUTED, fontSize: 12, fontFamily: 'Inter_700Bold' },
  quoteCategoryTextActive: { color: ORANGE },
  quoteLibraryCard: { borderRadius: 18, borderWidth: 1, borderColor: '#EED0BA', backgroundColor: CARD, padding: 14 },
  quoteLibraryText: { color: INK, fontSize: 15, lineHeight: 22, fontFamily: 'Inter_700Bold' },
  quoteLibraryAuthor: { color: MUTED, fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 7 },
  quoteLibraryFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  quoteTagRow: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  quoteTag: { overflow: 'hidden', borderRadius: 9, backgroundColor: '#FFF1E6', color: ORANGE, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontFamily: 'Inter_700Bold' },
  quoteSelectButton: { minHeight: 36, borderRadius: 18, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  quoteSelectText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  customQuoteArea: { gap: 10 },
  customQuoteInput: { minHeight: 130, borderRadius: 18, borderWidth: 1, borderColor: '#EED0BA', backgroundColor: CARD, padding: 14, color: INK, fontSize: 15, lineHeight: 22, fontFamily: 'Inter_600SemiBold', textAlignVertical: 'top' },
  customQuoteCount: { color: MUTED, fontSize: 11, fontFamily: 'Inter_600SemiBold', textAlign: 'right' },
  customQuoteActions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  quoteSecondaryButton: { flex: 1, minHeight: 46, borderRadius: 23, borderWidth: 1, borderColor: ORANGE, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFDF8' },
  quoteSecondaryText: { color: ORANGE, fontSize: 13, fontFamily: 'Inter_700Bold' },
  quotePrimaryButton: { flex: 1, minHeight: 46, borderRadius: 23, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  quotePrimaryText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
});
