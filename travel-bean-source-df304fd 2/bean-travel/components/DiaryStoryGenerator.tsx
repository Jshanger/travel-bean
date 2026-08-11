import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import VoiceDictation from '@/components/VoiceDictation';
import { useColors } from '@/hooks/useColors';
import { useTravelAuth } from '@/hooks/useTravelAuth';
import { Trip, VisitedPlace } from '@/types';

const { width: SCREEN_W } = Dimensions.get('window');

type PromptContext = VisitedPlace['category'] | 'food' | 'people' | 'movement' | 'ritual' | 'landscape' | 'threshold' | 'memory' | 'history';
type StoryFormat = 'photo_journal' | 'diary_page' | 'memory_bean' | 'postcard' | 'monthly_recap';
type PreviewMode = 'reel' | 'collage' | 'diary' | 'postcard' | 'recap';

const PROMPT_BANK: Array<{ mood: string; text: string; contexts?: PromptContext[] }> = [
  { mood: 'Scene', text: 'What was happening just outside the frame?', contexts: ['memory'] },
  { mood: 'Feeling', text: 'What did this place ask you to feel?', contexts: ['memory'] },
  { mood: 'Detail', text: 'What tiny detail would prove you were really here?', contexts: ['memory'] },
  { mood: 'Belonging', text: 'Did you feel like a visitor, a participant, or something in between?', contexts: ['people', 'city', 'hidden_spot'] },
  { mood: 'Rhythm', text: 'What was the everyday rhythm of this place?', contexts: ['city', 'movement', 'people'] },
  { mood: 'Ritual', text: 'What local habit, ritual, or routine did you notice?', contexts: ['ritual', 'restaurant', 'coffee_shop', 'city'] },
  { mood: 'Exchange', text: 'What was being exchanged here besides money, food, or words?', contexts: ['food', 'restaurant', 'coffee_shop', 'people'] },
  { mood: 'Table', text: 'How did people linger, order, share, or sit here?', contexts: ['restaurant', 'coffee_shop', 'food'] },
  { mood: 'Taste', text: 'What taste, smell, or texture brings this moment back?', contexts: ['restaurant', 'coffee_shop', 'food'] },
  { mood: 'Gesture', text: 'What gesture from a person here stayed with you?', contexts: ['people', 'restaurant', 'coffee_shop', 'city'] },
  { mood: 'History', text: 'What history felt visible here, and what felt hidden?', contexts: ['history', 'landmark'] },
  { mood: 'Scale', text: 'How did your body feel against the scale of this place?', contexts: ['landmark', 'nature', 'landscape'] },
  { mood: 'Postcard', text: 'What did this place reveal that a postcard would miss?', contexts: ['landmark', 'hidden_spot', 'city'] },
  { mood: 'Landscape', text: 'What did the weather, light, or air change about this place?', contexts: ['nature', 'landscape'] },
  { mood: 'Sound', text: 'If this photo had sound, what would be loudest?', contexts: ['nature', 'city', 'memory'] },
  { mood: 'Pace', text: 'Did this place make you slow down, rush, wait, or wander?', contexts: ['movement', 'city', 'nature'] },
  { mood: 'Hidden', text: 'What made this feel found rather than advertised?', contexts: ['hidden_spot'] },
  { mood: 'Threshold', text: 'When did this place start feeling temporarily yours?', contexts: ['hotel', 'threshold'] },
  { mood: 'Room', text: 'What did this stay reveal about comfort, privacy, or being away?', contexts: ['hotel', 'threshold'] },
  { mood: 'Unreal', text: 'What made this moment feel unreal while you were inside it?', contexts: ['memory', 'landscape'] },
  { mood: 'Home', text: 'What felt different from home, and what felt strangely familiar?', contexts: ['memory', 'city'] },
  { mood: 'Attention', text: 'What did this place teach you to notice?', contexts: ['memory'] },
  { mood: 'After', text: 'What feeling followed you after leaving?', contexts: ['memory'] },
  { mood: 'Relive', text: 'What part of this would you relive for five more minutes?', contexts: ['memory'] },
  { mood: 'Witness', text: 'What were you witnessing here, not just looking at?', contexts: ['people', 'history', 'city'] },
  { mood: 'Care', text: 'Where did you notice care, repair, patience, or pride?', contexts: ['people', 'city', 'restaurant', 'coffee_shop'] },
  { mood: 'Outsider', text: 'What did you understand here, and what stayed outside your understanding?', contexts: ['people', 'history', 'city'] },
  { mood: 'Memory', text: 'What will this photo remember for you when details fade?', contexts: ['memory'] },
  { mood: 'Field note', text: 'What did people here seem to know that visitors usually miss?', contexts: ['people', 'city', 'ritual'] },
  { mood: 'Ethnographic', text: 'What small rule, custom, or social rhythm did you notice?', contexts: ['people', 'ritual', 'city', 'restaurant', 'coffee_shop'] },
  { mood: 'Power', text: 'Who did this place seem designed for, and who seemed pushed to the edges?', contexts: ['history', 'city', 'landmark'] },
  { mood: 'Memory work', text: 'What version of yourself showed up in this moment?', contexts: ['memory'] },
  { mood: 'Learning', text: 'What did this place teach you without explaining itself?', contexts: ['memory', 'history', 'nature'] },
  { mood: 'Before I forget', text: 'What should future-you never let this photo flatten or simplify?', contexts: ['memory'] },
];

const MOOD_TAGS = ['Peaceful', 'Surreal', 'Joyful', 'Nostalgic', 'Cinematic', 'Chaotic', 'Reflective', 'Free', 'Tender', 'Alive'];

const THEMES = [
  { id: 'cinematic', label: 'Cinematic', colors: ['#080B16', '#262047'], accent: '#F6C85F' },
  { id: 'scrapbook', label: 'Scrapbook', colors: ['#FFF7ED', '#EAF7F1'], accent: '#E8825A' },
  { id: 'minimal', label: 'Minimal', colors: ['#FFFFFF', '#F3F5FA'], accent: '#26283D' },
  { id: 'explorer', label: 'Explorer', colors: ['#173B44', '#1EC8A5'], accent: '#F6E27F' },
] as const;

const STORY_FORMATS: Array<{ id: StoryFormat; label: string; icon: keyof typeof Feather.glyphMap; description: string }> = [
  { id: 'photo_journal', label: 'Photo journal', icon: 'grid', description: 'A shareable collage of a day, weekend, or trip.' },
  { id: 'diary_page', label: 'Diary page', icon: 'book-open', description: 'Location, mood, favourite moment, lesson, and photos.' },
  { id: 'memory_bean', label: 'Memory', icon: 'coffee', description: 'One emotional souvenir built from a photo and reflection.' },
  { id: 'postcard', label: 'Postcard', icon: 'send', description: 'A stamped travel card with one strong line.' },
  { id: 'monthly_recap', label: 'Month recap', icon: 'calendar', description: 'Best photos, repeated moods, places, and what you learned.' },
];

type StoryStyle = typeof THEMES[number]['id'];

export interface StoryEntry {
  photoId: string;
  prompt: string;
  response: string;
  moodTags?: string[];
  skipped?: boolean;
}

export interface TravelStory {
  id: string;
  tripId: string;
  title: string;
  style: StoryStyle;
  entries: StoryEntry[];
  createdAt: string;
}

interface StorySource {
  id: string;
  title: string;
  destination: string;
  startDate?: string;
  endDate?: string;
}

interface StoryPhoto {
  id: string;
  photoId: string;
  uri: string;
  headers?: Record<string, string>;
  placeName?: string;
  location?: string;
  category?: VisitedPlace['category'];
  notes?: string;
  country?: string;
  city?: string;
}

interface Props {
  visible: boolean;
  trip?: Trip;
  storySource?: StorySource;
  places: VisitedPlace[];
  onClose: () => void;
}

function apiBase() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}/api/bean` : '/api/bean';
}

function formatDateRange(start: string, end: string) {
  try {
    const s = new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const e = new Date(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} - ${e}`;
  } catch {
    return `${start} - ${end}`;
  }
}

function relatedPlaces(destination: string, places: VisitedPlace[]) {
  const target = destination.toLowerCase();
  const matches = places.filter(p =>
    [p.country, p.city, p.name]
      .filter(Boolean)
      .some(value => {
        const lower = String(value).toLowerCase();
        return target.includes(lower) || lower.includes(target);
      }),
  );
  return matches.length > 0 ? matches : places;
}

function photoContextKeys(photo: StoryPhoto) {
  const text = `${photo.placeName ?? ''} ${photo.location ?? ''} ${photo.notes ?? ''} ${photo.city ?? ''} ${photo.country ?? ''}`.toLowerCase();
  const keys = new Set<PromptContext>();
  if (photo.category) keys.add(photo.category);
  if (/(cafe|coffee|espresso|tea|restaurant|food|market|dinner|lunch|breakfast|bakery|bar|noodle|ramen|tapas|pastry|meal)/.test(text)) {
    keys.add('food');
    keys.add('ritual');
  }
  if (/(street|city|neighbou?rhood|station|metro|square|old town|medina|bazaar|crossing|avenue|alley)/.test(text)) {
    keys.add('city');
    keys.add('movement');
    keys.add('people');
  }
  if (/(beach|mountain|lake|forest|river|desert|garden|park|waterfall|coast|island|valley|fjord|trail|viewpoint)/.test(text)) {
    keys.add('nature');
    keys.add('landscape');
  }
  if (/(temple|church|mosque|museum|palace|tower|monument|ruin|castle|shrine|memorial|colosseum|cathedral)/.test(text)) {
    keys.add('landmark');
    keys.add('history');
  }
  if (/(hotel|hostel|riad|stay|room|lodge|guesthouse|resort|airbnb)/.test(text)) {
    keys.add('hotel');
    keys.add('threshold');
  }
  if (/(hidden|secret|quiet|local|tucked|unknown|small lane|backstreet)/.test(text)) {
    keys.add('hidden_spot');
  }
  return [...keys];
}

function promptsForPhoto(photo: StoryPhoto) {
  const contexts = photoContextKeys(photo);
  const matched = PROMPT_BANK.filter(prompt => prompt.contexts?.some(context => contexts.includes(context)));
  const remaining = PROMPT_BANK.filter(prompt => !matched.includes(prompt));
  return matched.length >= 4 ? matched : [...matched, ...remaining];
}

function promptForPhoto(photo: StoryPhoto, index: number) {
  const seed = `${photo.placeName ?? ''}${photo.location ?? ''}${photo.notes ?? ''}${photo.category ?? ''}${photo.id}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const candidates = promptsForPhoto(photo);
  return candidates[(seed + index * 5) % candidates.length].text;
}

function promptMood(prompt: string) {
  return PROMPT_BANK.find(item => item.text === prompt)?.mood ?? 'Field note';
}

function firstAnsweredEntry(entries: StoryEntry[]) {
  return entries.find(entry => entry.response.trim()) ?? entries[0];
}

function generatedTitle(photo: StoryPhoto | undefined, entry: StoryEntry | undefined, source: StorySource, format: StoryFormat) {
  const place = photo?.placeName || photo?.city || source.destination.split(',')[0] || 'Travel';
  const mood = entry?.moodTags?.[0] || promptMood(entry?.prompt ?? '') || 'Memory';
  if (format === 'postcard') return `Postcard from ${place}`;
  if (format === 'monthly_recap') return `${new Date().toLocaleDateString('en-GB', { month: 'long' })} in Moments`;
  if (format === 'diary_page') return `${place} diary page`;
  if (format === 'memory_bean') return `${mood} in ${place}`;
  return source.title || `${place} photo journal`;
}

function generatedCaption(entry: StoryEntry | undefined, photo: StoryPhoto | undefined) {
  const response = entry?.response.trim();
  if (response) {
    const firstSentence = response.split(/[.!?]/).map(s => s.trim()).find(Boolean);
    if (firstSentence && firstSentence.length <= 78) return firstSentence;
    if (response.length <= 90) return response;
    return `${response.slice(0, 86).trim()}...`;
  }
  const place = photo?.placeName || photo?.city || photo?.country || 'this place';
  const prompt = entry?.prompt ?? '';
  if (/sound|loudest/i.test(prompt)) return `${place} had its own sound before it became a photo.`;
  if (/teach|understand|learn/i.test(prompt)) return `${place} taught something quietly.`;
  if (/home|familiar/i.test(prompt)) return `Far from home, but not entirely unfamiliar.`;
  if (/ritual|routine|rhythm/i.test(prompt)) return `A small rhythm from ${place} worth remembering.`;
  return `A moment from ${place} that asked to be kept.`;
}

function lessonLine(entries: StoryEntry[]) {
  const answered = entries.map(entry => entry.response.trim()).filter(Boolean);
  const source = answered.find(text => /learn|teach|understand|notice|realiz|felt/i.test(text)) ?? answered[0];
  if (!source) return 'Some places become clearer only after you leave.';
  return source.length > 96 ? `${source.slice(0, 92).trim()}...` : source;
}

function favoriteMoment(entries: StoryEntry[], photos: StoryPhoto[]) {
  const index = Math.max(0, entries.findIndex(entry => entry.response.trim()));
  const entry = entries[index] ?? entries[0];
  const photo = photos[index] ?? photos[0];
  return generatedCaption(entry, photo);
}

function waitForFrame(ms = 160) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function DiaryStoryGenerator({ visible, trip, storySource, places, onClose }: Props) {
  const colors = useColors();
  const { getToken } = useTravelAuth();
  const shotRef = useRef<any>(null);
  const source = storySource ?? {
    id: trip?.id ?? 'place-beans',
    title: trip?.name ?? 'My Place Story',
    destination: trip?.destination ?? 'My Places',
    startDate: trip?.startDate,
    endDate: trip?.endDate,
  };

  const [screen, setScreen] = useState<'select' | 'prompt' | 'preview'>('select');
  const [loading, setLoading] = useState(false);
  const [photos, setPhotos] = useState<StoryPhoto[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [entries, setEntries] = useState<StoryEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [styleId, setStyleId] = useState<StoryStyle>('cinematic');
  const [storyFormat, setStoryFormat] = useState<StoryFormat>('photo_journal');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('reel');
  const [reelIndex, setReelIndex] = useState(0);
  const [exporting, setExporting] = useState(false);

  const selectedPhotos = useMemo(
    () => selectedIds.map(id => photos.find(p => p.id === id)).filter(Boolean) as StoryPhoto[],
    [photos, selectedIds],
  );
  const activePhoto = selectedPhotos[activeIndex];
  const activeEntry = entries[activeIndex];
  const theme = THEMES.find(t => t.id === styleId) ?? THEMES[0];
  const answeredCount = entries.filter(entry => entry.response.trim()).length;

  useEffect(() => {
    if (!visible) return;
    setScreen('select');
    setActiveIndex(0);
    setReelIndex(0);
    setPreviewMode('reel');
    setStoryFormat('photo_journal');
    setEntries([]);
    setSelectedIds([]);
    loadExistingPhotos();
  }, [visible, source.id]);

  useEffect(() => {
    if (screen !== 'preview' || previewMode !== 'reel' || selectedPhotos.length <= 1) return;
    const timer = setInterval(() => {
      setReelIndex(index => (index + 1) % selectedPhotos.length);
    }, 2400);
    return () => clearInterval(timer);
  }, [screen, previewMode, selectedPhotos.length]);

  async function loadExistingPhotos() {
    setLoading(true);
    try {
      const token = await getToken();
      const headers: Record<string, string> | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
      const candidates = relatedPlaces(source.destination, places).slice(0, 24);
      const loaded = await Promise.all(candidates.map(async place => {
        try {
          const res = await fetch(`${apiBase()}/photos?placeId=${place.id}`, { headers });
          if (!res.ok) return [];
          const data = await res.json();
          return (data as Array<{ id: string }>).map(photo => ({
            id: `${place.id}:${photo.id}`,
            photoId: photo.id,
            uri: `${apiBase()}/photos/img/${encodeURIComponent(photo.id)}`,
            headers,
            placeName: place.name,
            location: [place.city, place.country].filter(Boolean).join(', '),
            category: place.category,
            notes: place.notes,
            country: place.country,
            city: place.city,
          }));
        } catch {
          return [];
        }
      }));
      const flattened = loaded.flat();
      setPhotos(flattened);
      setSelectedIds(flattened.slice(0, 6).map(p => p.id));
    } finally {
      setLoading(false);
    }
  }

  async function pickLocalPhotos() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to add story photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 10,
      quality: 0.9,
    });
    if (result.canceled) return;
    const stamp = Date.now();
    const nextPhotos: StoryPhoto[] = result.assets.map((asset, index) => ({
      id: `local-${stamp}-${index}`,
      photoId: `local-${stamp}-${index}`,
      uri: asset.uri,
      placeName: source.destination,
      location: source.destination,
      notes: source.title,
    }));
    setPhotos(prev => [...nextPhotos, ...prev]);
    setSelectedIds(prev => [...nextPhotos.map(p => p.id), ...prev].slice(0, 10));
  }

  function togglePhoto(id: string) {
    Haptics.selectionAsync();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function beginStory() {
    if (selectedPhotos.length === 0) return;
    const nextEntries = selectedPhotos.map((photo, index) => ({
      photoId: photo.id,
      prompt: promptForPhoto(photo, index),
      response: '',
      moodTags: [],
      skipped: false,
    }));
    setEntries(nextEntries);
    setActiveIndex(0);
    setScreen('prompt');
  }

  function updateResponse(text: string) {
    setEntries(prev => prev.map((entry, index) => index === activeIndex ? { ...entry, response: text, skipped: false } : entry));
  }

  function swapPrompt(direction = 1) {
    Haptics.selectionAsync();
    setEntries(prev => prev.map((entry, index) => {
      if (index !== activeIndex) return entry;
      const candidates = activePhoto ? promptsForPhoto(activePhoto) : PROMPT_BANK;
      const currentIndex = Math.max(0, candidates.findIndex(item => item.text === entry.prompt));
      const nextIndex = (currentIndex + direction + candidates.length) % candidates.length;
      return { ...entry, prompt: candidates[nextIndex].text };
    }));
  }

  function toggleMood(tag: string) {
    Haptics.selectionAsync();
    setEntries(prev => prev.map((entry, index) => {
      if (index !== activeIndex) return entry;
      const tags = entry.moodTags ?? [];
      return {
        ...entry,
        moodTags: tags.includes(tag) ? tags.filter(item => item !== tag) : [...tags, tag].slice(0, 3),
      };
    }));
  }

  function skipPrompt() {
    setEntries(prev => prev.map((entry, index) => index === activeIndex ? { ...entry, response: '', skipped: true } : entry));
    nextPrompt();
  }

  function nextPrompt() {
    if (activeIndex < selectedPhotos.length - 1) {
      setActiveIndex(i => i + 1);
    } else {
      setScreen('preview');
    }
  }

  async function exportStory() {
    if (exporting) return;
    setExporting(true);
    try {
      const uri = await shotRef.current?.capture();
      if (!uri) throw new Error('Capture failed');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `${source.title} Story` });
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.saveToLibraryAsync(uri);
          Alert.alert('Saved', 'Story saved to your photo library.');
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Export failed', 'Could not export the story. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function exportAllStoryFrames() {
    if (exporting || selectedPhotos.length === 0) return;
    setExporting(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to save every Story frame.');
        return;
      }
      setPreviewMode('reel');
      await waitForFrame();
      let saved = 0;
      for (let index = 0; index < selectedPhotos.length; index += 1) {
        setReelIndex(index);
        await waitForFrame();
        const uri = await shotRef.current?.capture();
        if (uri) {
          await MediaLibrary.saveToLibraryAsync(uri);
          saved += 1;
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Story frames saved', `${saved} Story frame${saved === 1 ? '' : 's'} saved to your photo library.`);
    } catch {
      Alert.alert('Export failed', 'Could not save all story frames. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.shell, { backgroundColor: colors.background }]}>
        {screen === 'select' && (
          <View style={styles.selectScreen}>
            <LinearGradient colors={['#080B16', '#262047']} style={styles.selectHero}>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.heroKicker}>Story Generator</Text>
              <Text style={styles.heroTitle}>Turn Places into a Story</Text>
              <Text style={styles.heroSub}>
                {source.destination}{source.startDate && source.endDate ? ` · ${formatDateRange(source.startDate, source.endDate)}` : ''}
              </Text>
              <View style={styles.storyPromiseRow}>
                <View style={styles.storyPromise}>
                  <Feather name="image" size={14} color="#F6C85F" />
                  <Text style={styles.storyPromiseText}>Photos</Text>
                </View>
                <View style={styles.storyPromise}>
                  <Feather name="message-circle" size={14} color="#F6C85F" />
                  <Text style={styles.storyPromiseText}>Prompts</Text>
                </View>
                <View style={styles.storyPromise}>
                  <Feather name="edit-3" size={14} color="#F6C85F" />
                  <Text style={styles.storyPromiseText}>Captions</Text>
                </View>
                <View style={styles.storyPromise}>
                  <Feather name="send" size={14} color="#F6C85F" />
                  <Text style={styles.storyPromiseText}>Postcards</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.selectBody}>
              <View style={styles.selectActions}>
                <TouchableOpacity style={[styles.pickBtn, { backgroundColor: colors.primary }]} onPress={pickLocalPhotos}>
                  <Feather name="image" size={17} color="#fff" />
                  <Text style={styles.pickBtnText}>Add Memories</Text>
                </TouchableOpacity>
                <Text style={[styles.selectedCount, { color: colors.mutedForeground }]}>{selectedIds.length} selected · up to 10</Text>
              </View>
              <View style={[styles.sessionHint, { backgroundColor: colors.muted }]}>
                <Feather name="star" size={15} color={colors.primary} />
                <Text style={[styles.sessionHintText, { color: colors.mutedForeground }]}>Each selected photo gets a photo-matched field-note prompt, mood tags, diary titles, and shareable captions.</Text>
              </View>
              <View style={styles.formatSection}>
                <Text style={[styles.formatTitle, { color: colors.foreground }]}>What do you want to make?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.formatScroll}>
                  {STORY_FORMATS.map(format => {
                    const active = storyFormat === format.id;
                    return (
                      <TouchableOpacity
                        key={format.id}
                        style={[styles.formatCard, { backgroundColor: active ? colors.foreground : colors.card, borderColor: active ? colors.foreground : colors.border }]}
                        onPress={() => {
                          setStoryFormat(format.id);
                          Haptics.selectionAsync();
                        }}
                        activeOpacity={0.86}
                      >
                        <View style={[styles.formatIcon, { backgroundColor: active ? 'rgba(255,255,255,0.14)' : colors.muted }]}>
                          <Feather name={format.icon} size={16} color={active ? '#fff' : colors.primary} />
                        </View>
                        <Text style={[styles.formatLabel, { color: active ? '#fff' : colors.foreground }]}>{format.label}</Text>
                        <Text style={[styles.formatDesc, { color: active ? 'rgba(255,255,255,0.68)' : colors.mutedForeground }]} numberOfLines={3}>{format.description}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {loading ? (
                <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
              ) : photos.length === 0 ? (
                <View style={styles.center}>
                  <Feather name="camera" size={34} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Memories yet</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Add photo memories from your library to begin a Story.</Text>
                </View>
              ) : (
                <ScrollView contentContainerStyle={styles.photoGrid}>
                  {photos.map(photo => {
                    const selected = selectedIds.includes(photo.id);
                    return (
                      <TouchableOpacity key={photo.id} style={[styles.photoTile, selected && { borderColor: colors.primary }]} onPress={() => togglePhoto(photo.id)} activeOpacity={0.85}>
                        <Image source={{ uri: photo.uri, headers: photo.headers }} style={styles.photoTileImage} contentFit="cover" />
                        {selected && (
                          <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                            <Feather name="check" size={13} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <View style={[styles.footer, { backgroundColor: colors.background }]}>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: selectedIds.length ? colors.primary : colors.muted }]} disabled={!selectedIds.length} onPress={beginStory}>
              <Text style={[styles.primaryBtnText, { color: selectedIds.length ? '#fff' : colors.mutedForeground }]}>Start Story</Text>
                <Feather name="arrow-right" size={17} color={selectedIds.length ? '#fff' : colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {screen === 'prompt' && activePhoto && activeEntry && (
          <View style={styles.promptScreen}>
            <Image source={{ uri: activePhoto.uri, headers: activePhoto.headers }} style={styles.promptImage} contentFit="cover" />
            <LinearGradient colors={['rgba(0,0,0,0.62)', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.82)']} style={styles.promptShade} />
            <View style={styles.promptTop}>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Feather name="x" size={24} color="#fff" /></TouchableOpacity>
              <View style={styles.promptTopMeta}>
                <Text style={styles.progressText}>{activeIndex + 1}/{selectedPhotos.length}</Text>
                <Text style={styles.answeredText}>{answeredCount} answered</Text>
              </View>
            </View>
            <View style={styles.promptPanel}>
              <View style={styles.progressDots}>
                {selectedPhotos.map((_, index) => <View key={index} style={[styles.dot, index <= activeIndex && styles.dotActive]} />)}
              </View>
              <View style={styles.promptMetaRow}>
                <View style={styles.promptMoodPill}>
                  <Feather name="zap" size={12} color="#F6C85F" />
                  <Text style={styles.promptMoodText}>{promptMood(activeEntry.prompt)} prompt</Text>
                </View>
                <Text style={styles.promptLocationText} numberOfLines={1}>{activePhoto.placeName || activePhoto.location || source.destination}</Text>
              </View>
              <Text style={styles.promptText}>{activeEntry.prompt}</Text>
              <View style={styles.promptUtilityRow}>
                <TouchableOpacity style={styles.promptUtilityBtn} onPress={() => swapPrompt(1)}>
                  <Feather name="refresh-cw" size={13} color="#fff" />
                  <Text style={styles.promptUtilityText}>New prompt</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.promptUtilityBtn} onPress={skipPrompt}>
                  <Feather name="skip-forward" size={13} color="#fff" />
                  <Text style={styles.promptUtilityText}>Skip photo</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.responseInput}
                placeholder="Write what you noticed, felt, or understood here..."
                placeholderTextColor="rgba(255,255,255,0.52)"
                value={activeEntry.response}
                onChangeText={updateResponse}
                multiline
              />
              <View style={styles.moodStrip}>
                {MOOD_TAGS.map(tag => {
                  const active = activeEntry.moodTags?.includes(tag);
                  return (
                    <TouchableOpacity key={tag} style={[styles.moodChip, active && styles.moodChipActive]} onPress={() => toggleMood(tag)} activeOpacity={0.84}>
                      <Text style={[styles.moodChipText, active && styles.moodChipTextActive]}>{tag}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.promptActions}>
                <TouchableOpacity disabled={activeIndex === 0} onPress={() => setActiveIndex(i => Math.max(0, i - 1))} style={styles.ghostBtn}>
                  <Feather name="chevron-left" size={17} color="#fff" />
                  <Text style={styles.ghostBtnText}>Back</Text>
                </TouchableOpacity>
                <VoiceDictation onResult={text => updateResponse(activeEntry.response ? `${activeEntry.response.trimEnd()} ${text}` : text)} showLabel />
                <TouchableOpacity onPress={nextPrompt} style={styles.nextBtn}>
                  <Text style={styles.nextBtnText}>{activeIndex === selectedPhotos.length - 1 ? 'Preview' : 'Next'}</Text>
                  <Feather name="arrow-right" size={16} color="#11131D" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {screen === 'preview' && (
          <View style={styles.previewScreen}>
            <View style={styles.previewHeader}>
              <TouchableOpacity onPress={() => setScreen('prompt')}><Feather name="chevron-left" size={24} color={colors.foreground} /></TouchableOpacity>
              <Text style={[styles.previewTitle, { color: colors.foreground }]}>Your Story</Text>
              <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
            </View>
            <View style={[styles.storyStatsRow, { paddingHorizontal: 18 }]}>
              <View style={[styles.storyStatChip, { backgroundColor: colors.muted }]}>
                <Feather name="image" size={13} color={colors.primary} />
                <Text style={[styles.storyStatText, { color: colors.foreground }]}>{selectedPhotos.length} photos</Text>
              </View>
              <View style={[styles.storyStatChip, { backgroundColor: colors.muted }]}>
                <Feather name="message-circle" size={13} color={colors.primary} />
                <Text style={[styles.storyStatText, { color: colors.foreground }]}>{answeredCount} reflections</Text>
              </View>
              <View style={[styles.storyStatChip, { backgroundColor: colors.muted }]}>
                <Feather name="tag" size={13} color={colors.primary} />
                <Text style={[styles.storyStatText, { color: colors.foreground }]}>{entries.flatMap(e => e.moodTags ?? []).length} moods</Text>
              </View>
            </View>
            <View style={styles.themeRow}>
              {THEMES.map(themeOption => (
                <TouchableOpacity
                  key={themeOption.id}
                  style={[styles.themeChip, { backgroundColor: styleId === themeOption.id ? colors.primary : colors.muted }]}
                  onPress={() => setStyleId(themeOption.id)}
                >
                  <Text style={[styles.themeText, { color: styleId === themeOption.id ? '#fff' : colors.foreground }]}>{themeOption.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[styles.previewModeSwitch, { backgroundColor: colors.muted }]}>
              {([
                { id: 'reel', label: 'Story Reel', icon: 'play-circle' as const },
                { id: 'collage', label: 'Collage Card', icon: 'grid' as const },
                { id: 'diary', label: 'Diary Page', icon: 'book-open' as const },
                { id: 'postcard', label: 'Postcard', icon: 'send' as const },
                { id: 'recap', label: 'Month Recap', icon: 'calendar' as const },
              ] as const).map(option => (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.previewModeBtn, previewMode === option.id && { backgroundColor: colors.foreground }]}
                  onPress={() => {
                    setPreviewMode(option.id);
                    setReelIndex(0);
                    Haptics.selectionAsync();
                  }}
                  activeOpacity={0.84}
                >
                  <Feather name={option.icon} size={14} color={previewMode === option.id ? '#fff' : colors.mutedForeground} />
                  <Text style={[styles.previewModeText, { color: previewMode === option.id ? '#fff' : colors.mutedForeground }]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView contentContainerStyle={styles.previewScroll}>
              {previewMode === 'reel' ? (
                <StoryReelPreview
                  ref={shotRef}
                  source={source}
                  photos={selectedPhotos}
                  entries={entries}
                  theme={theme}
                  activeIndex={reelIndex}
                  onSelect={setReelIndex}
                  storyFormat={storyFormat}
                />
              ) : (
                <StoryCollagePreview
                  ref={shotRef}
                  source={source}
                  photos={selectedPhotos}
                  entries={entries}
                  theme={theme}
                  storyFormat={previewMode === 'diary' ? 'diary_page' : previewMode === 'postcard' ? 'postcard' : previewMode === 'recap' ? 'monthly_recap' : storyFormat}
                />
              )}
            </ScrollView>
            <View style={[styles.footer, { backgroundColor: colors.background }]}>
              {previewMode === 'reel' && selectedPhotos.length > 1 ? (
                <TouchableOpacity style={[styles.secondaryExportBtn, { backgroundColor: colors.muted }]} onPress={exportAllStoryFrames}>
                  <Feather name="download-cloud" size={17} color={colors.foreground} />
                  <Text style={[styles.secondaryExportText, { color: colors.foreground }]}>{exporting ? 'Saving...' : `Save ${selectedPhotos.length} frames`}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={exportStory}>
                <Feather name={previewMode === 'reel' ? 'share-2' : 'download'} size={17} color="#fff" />
                <Text style={styles.primaryBtnText}>{exporting ? 'Exporting...' : previewMode === 'reel' ? 'Share Reel Frame' : 'Export Story'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const StoryCollagePreview = React.forwardRef<any, {
  source: StorySource;
  photos: StoryPhoto[];
  entries: StoryEntry[];
  theme: typeof THEMES[number];
  storyFormat: StoryFormat;
}>(({ source, photos, entries, theme, storyFormat }, ref) => {
  const storyW = Math.min(SCREEN_W - 40, 390);
  const storyH = Math.round(storyW * 16 / 9);
  const dark = theme.id === 'cinematic' || theme.id === 'explorer';
  const answered = entries.filter(entry => entry.response.trim());
  const heroEntry = firstAnsweredEntry(entries);
  const heroIndex = Math.max(0, entries.findIndex(entry => entry === heroEntry));
  const heroPhoto = photos[heroIndex] ?? photos[0];
  const moods = Array.from(new Set(entries.flatMap(entry => entry.moodTags ?? []))).slice(0, 5);
  const formatLabel = STORY_FORMATS.find(format => format.id === storyFormat)?.label ?? 'Story';
  const title = generatedTitle(heroPhoto, heroEntry, source, storyFormat);
  const caption = generatedCaption(heroEntry, heroPhoto);

  return (
    <ViewShot ref={ref} options={{ format: 'png', quality: 1 }}>
      <LinearGradient colors={theme.colors as any} style={[styles.storyCanvas, { width: storyW, minHeight: storyH }]}>
        <View style={styles.storyMapGhost}>
          <Feather name="map" size={92} color={dark ? 'rgba(255,255,255,0.06)' : 'rgba(84,44,244,0.06)'} />
        </View>
        <Text style={[styles.storyKicker, { color: dark ? 'rgba(255,255,255,0.72)' : 'rgba(38,40,61,0.58)' }]}>{formatLabel} · {source.destination}</Text>
        <Text style={[styles.storyTitle, { color: dark ? '#fff' : '#11131D' }]}>{title}</Text>
        {source.startDate && source.endDate ? (
          <Text style={[styles.storyDate, { color: dark ? 'rgba(255,255,255,0.62)' : 'rgba(38,40,61,0.58)' }]}>{formatDateRange(source.startDate, source.endDate)}</Text>
        ) : (
          <Text style={[styles.storyDate, { color: dark ? 'rgba(255,255,255,0.62)' : 'rgba(38,40,61,0.58)' }]}>Collected from your Places</Text>
        )}
        {storyFormat === 'postcard' && heroPhoto ? (
          <View style={[styles.postcardStamp, { borderColor: theme.accent }]}>
            <Feather name="send" size={18} color={theme.accent} />
            <Text style={[styles.postcardStampText, { color: dark ? '#fff' : '#11131D' }]}>Place</Text>
          </View>
        ) : null}
        {heroEntry?.response || storyFormat === 'postcard' ? (
          <View style={[styles.pullQuote, { borderColor: theme.accent }]}>
            <Text style={[styles.pullQuoteText, { color: dark ? '#fff' : '#11131D' }]} numberOfLines={4}>“{caption}”</Text>
          </View>
        ) : null}
        {storyFormat === 'diary_page' || storyFormat === 'monthly_recap' ? (
          <View style={[styles.diaryMetaPanel, { backgroundColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.72)' }]}>
            <View style={styles.diaryMetaItem}>
              <Text style={[styles.diaryMetaLabel, { color: dark ? 'rgba(255,255,255,0.58)' : '#7B8193' }]}>Favourite moment</Text>
              <Text style={[styles.diaryMetaText, { color: dark ? '#fff' : '#11131D' }]} numberOfLines={2}>{favoriteMoment(entries, photos)}</Text>
            </View>
            <View style={styles.diaryMetaItem}>
              <Text style={[styles.diaryMetaLabel, { color: dark ? 'rgba(255,255,255,0.58)' : '#7B8193' }]}>Lesson learned</Text>
              <Text style={[styles.diaryMetaText, { color: dark ? '#fff' : '#11131D' }]} numberOfLines={2}>{lessonLine(entries)}</Text>
            </View>
          </View>
        ) : null}
        {moods.length > 0 && (
          <View style={styles.storyMoodRow}>
            {moods.map(mood => (
              <Text key={mood} style={[styles.storyMoodTag, { color: dark ? '#fff' : '#11131D', borderColor: theme.accent }]}>{mood}</Text>
            ))}
          </View>
        )}

        <View style={styles.storyPhotoStack}>
          {photos.slice(0, storyFormat === 'postcard' ? 1 : storyFormat === 'memory_bean' ? 3 : 5).map((photo, index) => (
            <View key={photo.id} style={[styles.storyPhotoCard, index % 2 === 1 && { transform: [{ rotate: '2deg' }] }]}>
              <Image source={{ uri: photo.uri, headers: photo.headers }} style={styles.storyPhoto} contentFit="cover" />
              {entries[index]?.response ? (
                <View style={styles.captionCard}>
                  <View style={styles.captionHeader}>
                    <Text style={styles.captionPrompt}>{entries[index].prompt}</Text>
                    {entries[index].moodTags?.[0] ? <Text style={styles.captionMood}>{entries[index].moodTags?.[0]}</Text> : null}
                  </View>
                  <Text style={styles.captionText}>{entries[index].response}</Text>
                </View>
              ) : entries[index]?.skipped ? (
                <View style={styles.captionCard}>
                  <Text style={styles.captionPrompt}>Skipped memory</Text>
                  <Text style={styles.captionText}>This photo stays in the Story as a quiet visual moment.</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>

        <View style={[styles.storyFooter, { borderTopColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(38,40,61,0.12)' }]}>
          <Feather name="map-pin" size={12} color={theme.accent} />
          <Text style={[styles.storyFooterText, { color: dark ? 'rgba(255,255,255,0.72)' : 'rgba(38,40,61,0.58)' }]}>Made with Travel Bean · {answered.length} remembered moment{answered.length === 1 ? '' : 's'}</Text>
        </View>
      </LinearGradient>
    </ViewShot>
  );
});

const StoryReelPreview = React.forwardRef<any, {
  source: StorySource;
  photos: StoryPhoto[];
  entries: StoryEntry[];
  theme: typeof THEMES[number];
  activeIndex: number;
  onSelect: (index: number) => void;
  storyFormat: StoryFormat;
}>(({ source, photos, entries, theme, activeIndex, onSelect, storyFormat }, ref) => {
  const storyW = Math.min(SCREEN_W - 40, 390);
  const storyH = Math.round(storyW * 16 / 9);
  const dark = theme.id === 'cinematic' || theme.id === 'explorer';
  const activePhoto = photos[activeIndex] ?? photos[0];
  const activeEntry = entries[activeIndex] ?? entries[0];
  const answered = entries.filter(entry => entry.response.trim());
  const moods = Array.from(new Set(entries.flatMap(entry => entry.moodTags ?? []))).slice(0, 4);
  const title = generatedTitle(activePhoto, activeEntry, source, storyFormat);
  const caption = generatedCaption(activeEntry, activePhoto);

  return (
    <ViewShot ref={ref} options={{ format: 'png', quality: 1 }}>
      <LinearGradient colors={theme.colors as any} style={[styles.reelCanvas, { width: storyW, height: storyH }]}>
        <View style={styles.reelOrbitOne} />
        <View style={styles.reelOrbitTwo} />
        <View style={styles.reelTopBar}>
          <View style={styles.reelBrandPill}>
            <Feather name="play-circle" size={13} color={theme.accent} />
            <Text style={styles.reelBrandText}>Story Reel</Text>
          </View>
          <Text style={[styles.reelCounter, { color: dark ? 'rgba(255,255,255,0.72)' : 'rgba(38,40,61,0.58)' }]}>{activeIndex + 1}/{photos.length}</Text>
        </View>

        <View style={styles.reelHeroCard}>
          {activePhoto ? (
            <Image source={{ uri: activePhoto.uri, headers: activePhoto.headers }} style={styles.reelHeroImage} contentFit="cover" />
          ) : (
            <LinearGradient colors={['#542CF4', '#18BBD4']} style={styles.reelHeroImage}>
              <Feather name="image" size={40} color="#fff" />
            </LinearGradient>
          )}
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} style={styles.reelHeroShade} />
          <View style={styles.reelHeroCopy}>
            <Text style={styles.reelKicker}>{source.destination}</Text>
            <Text style={styles.reelTitle} numberOfLines={2}>{title}</Text>
            <Text style={styles.reelMeta} numberOfLines={1}>
              {activePhoto?.placeName || activePhoto?.location || 'Travel memory'}{source.startDate && source.endDate ? ` · ${formatDateRange(source.startDate, source.endDate)}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.reelPanelRow}>
          <View style={styles.reelPanelLarge}>
            <Text style={styles.reelPanelLabel}>Memory cue</Text>
            <Text style={styles.reelPrompt} numberOfLines={2}>{activeEntry?.prompt || 'What made this moment stay with you?'}</Text>
            <Text style={styles.reelResponse} numberOfLines={4}>
              {caption}
            </Text>
          </View>
          <View style={styles.reelPanelSmall}>
            <Text style={styles.reelPanelLabel}>Collection</Text>
            <Text style={styles.reelNumber}>{photos.length}</Text>
            <Text style={styles.reelTiny}>Memories</Text>
            <View style={styles.reelMiniStack}>
              {photos.slice(0, 3).map((photo, index) => (
                <Image key={photo.id} source={{ uri: photo.uri, headers: photo.headers }} style={[styles.reelMiniPhoto, { marginLeft: index === 0 ? 0 : -10 }]} contentFit="cover" />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.reelDashboard}>
          <View style={styles.reelDashboardCard}>
            <Text style={styles.reelPanelLabel}>Mood</Text>
            <View style={styles.reelMoodWrap}>
              {(activeEntry?.moodTags?.length ? activeEntry.moodTags : moods.length ? moods : ['Cinematic']).map(mood => (
                <Text key={mood} style={[styles.reelMood, { borderColor: theme.accent }]}>{mood}</Text>
              ))}
            </View>
          </View>
          <View style={styles.reelDashboardCard}>
            <Text style={styles.reelPanelLabel}>Remembered</Text>
            <Text style={styles.reelNumberSmall}>{answered.length}</Text>
            <Text style={styles.reelTiny}>reflections</Text>
          </View>
        </View>

        <View style={styles.reelScrubber}>
          {photos.map((photo, index) => (
            <TouchableOpacity key={photo.id} style={[styles.reelDot, index === activeIndex && { backgroundColor: theme.accent, flex: 2.2 }]} onPress={() => onSelect(index)} activeOpacity={0.8} />
          ))}
        </View>

        <View style={styles.reelFooter}>
          <Text style={[styles.reelFooterText, { color: dark ? 'rgba(255,255,255,0.68)' : 'rgba(38,40,61,0.6)' }]}>Made with Travel Bean</Text>
        </View>
      </LinearGradient>
    </ViewShot>
  );
});

const styles = StyleSheet.create({
  shell: { flex: 1 },
  selectScreen: { flex: 1 },
  selectHero: { minHeight: 220, paddingHorizontal: 22, paddingTop: Platform.OS === 'ios' ? 58 : 34, justifyContent: 'flex-end', paddingBottom: 26 },
  closeBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  heroKicker: { color: 'rgba(255,255,255,0.66)', fontSize: 13, fontFamily: 'Inter_700Bold', marginTop: 26, marginBottom: 5 },
  heroTitle: { color: '#fff', fontSize: 30, lineHeight: 35, fontFamily: 'Inter_700Bold', maxWidth: 330 },
  heroSub: { color: 'rgba(255,255,255,0.64)', fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 8 },
  storyPromiseRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  storyPromise: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  storyPromiseText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  selectBody: { flex: 1, padding: 18 },
  selectActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  pickBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  pickBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  selectedCount: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  sessionHint: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 18, padding: 12, marginBottom: 14 },
  sessionHintText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold' },
  formatSection: { marginBottom: 14 },
  formatTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 10 },
  formatScroll: { gap: 10, paddingRight: 18 },
  formatCard: { width: 142, minHeight: 132, borderRadius: 22, borderWidth: 1, padding: 12 },
  formatIcon: { width: 38, height: 38, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  formatLabel: { fontSize: 14, lineHeight: 18, fontFamily: 'Inter_700Bold' },
  formatDesc: { fontSize: 11, lineHeight: 15, fontFamily: 'Inter_600SemiBold', marginTop: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9, padding: 34 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  emptyText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', textAlign: 'center' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 120 },
  photoTile: { width: (SCREEN_W - 52) / 3, height: (SCREEN_W - 52) / 3 * 1.25, borderRadius: 18, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden', backgroundColor: '#11131D' },
  photoTileImage: { width: '100%', height: '100%' },
  checkBadge: { position: 'absolute', right: 8, top: 8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18, borderTopWidth: 1, borderTopColor: 'rgba(150,154,170,0.16)', gap: 10 },
  primaryBtn: { minHeight: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  secondaryExportBtn: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  secondaryExportText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  promptScreen: { flex: 1, backgroundColor: '#080B16' },
  promptImage: { ...StyleSheet.absoluteFillObject },
  promptShade: { ...StyleSheet.absoluteFillObject },
  promptTop: { paddingTop: Platform.OS === 'ios' ? 58 : 34, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  promptTopMeta: { alignItems: 'flex-end' },
  progressText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  answeredText: { color: 'rgba(255,255,255,0.66)', fontSize: 11, fontFamily: 'Inter_700Bold', marginTop: 2 },
  promptPanel: { position: 'absolute', left: 18, right: 18, bottom: 26, borderRadius: 28, backgroundColor: 'rgba(8,11,22,0.74)', padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  progressDots: { flexDirection: 'row', gap: 5, marginBottom: 14 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)' },
  dotActive: { backgroundColor: '#fff' },
  promptMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 },
  promptMoodPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  promptMoodText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  promptLocationText: { flex: 1, textAlign: 'right', color: 'rgba(255,255,255,0.68)', fontSize: 11, fontFamily: 'Inter_700Bold' },
  promptText: { color: '#fff', fontSize: 24, lineHeight: 29, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  promptUtilityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  promptUtilityBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  promptUtilityText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  responseInput: { minHeight: 92, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', padding: 14, fontSize: 16, lineHeight: 22, fontFamily: 'Inter_500Medium', textAlignVertical: 'top' },
  moodStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  moodChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  moodChipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  moodChipText: { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontFamily: 'Inter_700Bold' },
  moodChipTextActive: { color: '#11131D' },
  promptActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14 },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 9 },
  ghostBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  nextBtnText: { color: '#11131D', fontSize: 13, fontFamily: 'Inter_700Bold' },
  previewScreen: { flex: 1 },
  previewHeader: { paddingTop: Platform.OS === 'ios' ? 58 : 34, paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  storyStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12 },
  storyStatChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 },
  storyStatText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  themeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, paddingBottom: 12 },
  themeChip: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  themeText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  previewModeSwitch: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 18, marginBottom: 12, borderRadius: 22, padding: 4, gap: 4 },
  previewModeBtn: { minHeight: 38, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10 },
  previewModeText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  previewScroll: { alignItems: 'center', paddingBottom: 110 },
  reelCanvas: { borderRadius: 30, padding: 18, overflow: 'hidden' },
  reelOrbitOne: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)', right: -80, top: -80 },
  reelOrbitTwo: { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(84,44,244,0.16)', left: -62, bottom: 110 },
  reelTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  reelBrandPill: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  reelBrandText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  reelCounter: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  reelHeroCard: { height: 292, borderRadius: 28, overflow: 'hidden', backgroundColor: '#11131D', shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.22, shadowRadius: 22, elevation: 9 },
  reelHeroImage: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  reelHeroShade: { ...StyleSheet.absoluteFillObject },
  reelHeroCopy: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  reelKicker: { color: 'rgba(255,255,255,0.74)', fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1.2 },
  reelTitle: { color: '#fff', fontSize: 28, lineHeight: 32, fontFamily: 'Inter_700Bold', marginTop: 6 },
  reelMeta: { color: 'rgba(255,255,255,0.76)', fontSize: 12, fontFamily: 'Inter_700Bold', marginTop: 7 },
  reelPanelRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  reelPanelLarge: { flex: 1.42, minHeight: 134, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.9)', padding: 14 },
  reelPanelSmall: { flex: 0.88, minHeight: 134, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.9)', padding: 14, overflow: 'hidden' },
  reelPanelLabel: { color: '#8C90A0', fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  reelPrompt: { color: '#11131D', fontSize: 15, lineHeight: 19, fontFamily: 'Inter_700Bold', marginTop: 7 },
  reelResponse: { color: '#626A7C', fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold', marginTop: 8 },
  reelNumber: { color: '#11131D', fontSize: 34, lineHeight: 38, fontFamily: 'Inter_700Bold', marginTop: 7 },
  reelNumberSmall: { color: '#11131D', fontSize: 28, lineHeight: 32, fontFamily: 'Inter_700Bold', marginTop: 6 },
  reelTiny: { color: '#7B8193', fontSize: 11, fontFamily: 'Inter_700Bold' },
  reelMiniStack: { flexDirection: 'row', marginTop: 12 },
  reelMiniPhoto: { width: 34, height: 34, borderRadius: 12, borderWidth: 2, borderColor: '#fff' },
  reelDashboard: { flexDirection: 'row', gap: 10, marginTop: 10 },
  reelDashboardCard: { flex: 1, minHeight: 88, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.86)', padding: 13 },
  reelMoodWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  reelMood: { color: '#11131D', fontSize: 10, fontFamily: 'Inter_700Bold', borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, overflow: 'hidden' },
  reelScrubber: { flexDirection: 'row', gap: 6, marginTop: 14, alignItems: 'center' },
  reelDot: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.26)' },
  reelFooter: { position: 'absolute', left: 18, right: 18, bottom: 14, alignItems: 'center' },
  reelFooterText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  storyCanvas: { borderRadius: 30, padding: 20, overflow: 'hidden' },
  storyMapGhost: { position: 'absolute', right: 18, top: 18 },
  storyKicker: { fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', fontFamily: 'Inter_700Bold' },
  storyTitle: { fontSize: 32, lineHeight: 36, fontFamily: 'Inter_700Bold', marginTop: 6 },
  storyDate: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 5, marginBottom: 16 },
  pullQuote: { borderLeftWidth: 3, paddingLeft: 12, marginBottom: 14 },
  pullQuoteText: { fontSize: 17, lineHeight: 23, fontFamily: 'Inter_700Bold' },
  postcardStamp: { position: 'absolute', right: 18, top: 74, width: 78, height: 78, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '5deg' }] },
  postcardStampText: { fontSize: 9, fontFamily: 'Inter_700Bold', marginTop: 4 },
  diaryMetaPanel: { borderRadius: 22, padding: 13, gap: 10, marginBottom: 14 },
  diaryMetaItem: { gap: 4 },
  diaryMetaLabel: { fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  diaryMetaText: { fontSize: 14, lineHeight: 18, fontFamily: 'Inter_700Bold' },
  storyMoodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  storyMoodTag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontFamily: 'Inter_700Bold', overflow: 'hidden' },
  storyPhotoStack: { gap: 14 },
  storyPhotoCard: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 8 },
  storyPhoto: { width: '100%', height: 210 },
  captionCard: { padding: 14, backgroundColor: 'rgba(255,255,255,0.94)' },
  captionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  captionPrompt: { fontSize: 11, fontFamily: 'Inter_700Bold', color: '#8C8F98', marginBottom: 4 },
  captionMood: { fontSize: 10, fontFamily: 'Inter_700Bold', color: '#542CF4', backgroundColor: '#F1ECFF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  captionText: { fontSize: 15, lineHeight: 21, fontFamily: 'Inter_600SemiBold', color: '#11131D' },
  storyFooter: { marginTop: 18, borderTopWidth: 1, paddingTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  storyFooterText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
});
