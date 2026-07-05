import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { DatePickerField } from '@/components/DatePickerField';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { hasPredictivePlaceProvider, ProviderPlaceSuggestion, searchPredictivePlaces } from '@/services/placeSearch';
import { BeanPhoto, PlaceCategory, PromptResponse, VisitedPlace } from '@/types';
import { createTravelBeanDraft } from '@/utils/coreFlows';
import { persistBeanPhotos } from '@/utils/photoPersistence';
import { photoLimitForPremium } from '@/utils/travelBeanMvp';

type Step = 'location' | 'photos' | 'prompts' | 'mood' | 'preview';

interface Suggestion {
  name: string;
  city?: string;
  country: string;
  region?: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
}

interface Props {
  visible: boolean;
  suggestions: Suggestion[];
  initialCountry?: string;
  initialCity?: string;
  onClose: () => void;
  onCreated: (place: VisitedPlace) => void;
}

const PROMPTS = [
  'What was happening here?',
  'What did this place feel like?',
  'What small detail do you remember?',
  'What surprised you most?',
  'What would you relive tomorrow?',
  'What made this moment feel special?',
  'What did this place teach you?',
  'What do you already miss?',
  'What did people here seem to know that visitors usually miss?',
  'What small ritual, routine, or rhythm did you notice?',
  'What version of yourself showed up in this moment?',
  'What should future-you never let this photo flatten or simplify?',
  'Who or what do you want to remember from here?',
  'What felt different from home, and what felt strangely familiar?',
];

const MOODS = ['Peaceful', 'Chaotic', 'Surreal', 'Nostalgic', 'Cinematic', 'Joyful', 'Lonely', 'Adventurous', 'Reflective'];

export default function AddPlaceBeanFlow({ visible, suggestions, initialCountry, initialCity, onClose, onCreated }: Props) {
  const colors = useColors();
  const { addPlace, isPremium } = useApp();
  const photoLimit = photoLimitForPremium(isPremium);

  const [step, setStep] = useState<Step>('location');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [providerSuggestions, setProviderSuggestions] = useState<ProviderPlaceSuggestion[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [activePhoto, setActivePhoto] = useState(0);
  const [responses, setResponses] = useState<PromptResponse[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (providerSuggestions.length) {
      return providerSuggestions.map(item => ({
        name: item.name,
        city: item.city ?? item.region,
        country: item.country,
        region: item.address ?? item.region,
        category: item.category ?? 'landmark',
        latitude: item.latitude ?? 25,
        longitude: item.longitude ?? 20,
      })).slice(0, 8);
    }
    if (!q) {
      const contextual = suggestions.filter(s =>
        (initialCountry ? s.country === initialCountry : true) &&
        (initialCity ? s.city === initialCity || s.name === initialCity : true),
      );
      return contextual.length ? contextual.slice(0, 6) : suggestions.slice(0, 6);
    }
    return suggestions.filter(s => `${s.name} ${s.city ?? ''} ${s.country} ${s.region ?? ''}`.toLowerCase().includes(q)).slice(0, 8);
  }, [initialCity, initialCountry, providerSuggestions, query, suggestions]);

  async function searchLocation(text: string) {
    setQuery(text);
    setSelected(null);
    if (text.trim().length < 2) {
      setProviderSuggestions([]);
      return;
    }
    setSearchingPlaces(true);
    const results = await searchPredictivePlaces(text, initialCountry);
    setProviderSuggestions(results);
    setSearchingPlaces(false);
  }

  function reset() {
    setStep('location');
    setQuery('');
    setSelected(null);
    setProviderSuggestions([]);
    setDate('');
    setNotes('');
    setPhotos([]);
    setActivePhoto(0);
    setResponses([]);
    setMoods([]);
    setSaving(false);
  }

  function close() {
    reset();
    onClose();
  }

  function useTypedLocation() {
    const parts = query.split(',').map(p => p.trim()).filter(Boolean);
    const name = parts[0] || initialCity || initialCountry || 'New Place';
    setSelected({
      name,
      city: initialCity || (parts.length > 2 ? parts[1] : undefined),
      country: initialCountry || parts[parts.length - 1] || 'Unknown',
      category: initialCity ? 'landmark' : 'city',
      latitude: 25,
      longitude: 20,
    });
    setStep('photos');
  }

  async function pickPhotos() {
    const slotsLeft = photoLimit - photos.length;
    if (slotsLeft <= 0) {
      Alert.alert(`${photoLimit} photos selected`, 'Remove a photo before adding another.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to add Memories.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: slotsLeft,
      quality: 0.78,
    });
    if (!result.canceled) {
      const existing = new Set(photos.flatMap(photo => [photo.assetId, photo.uri].filter(Boolean)));
      const next = [
        ...photos,
        ...result.assets.filter(asset => {
          const key = asset.assetId ?? asset.uri;
          if (existing.has(key)) return false;
          existing.add(key);
          return true;
        }),
      ].slice(0, photoLimit);
      setPhotos(next);
      setResponses(next.map((asset, index) => ({
        id: `${asset.assetId ?? asset.uri}-${index}`,
        photoId: asset.assetId ?? asset.uri,
        prompt: PROMPTS[index % PROMPTS.length],
        response: responses[index]?.response ?? '',
      })));
      Haptics.selectionAsync();
    }
  }

  function removePhoto(uri: string) {
    const next = photos.filter(p => p.uri !== uri);
    setPhotos(next);
    setResponses(prev => prev.filter((_, index) => photos[index]?.uri !== uri));
    setActivePhoto(0);
  }

  function setResponse(text: string) {
    setResponses(prev => prev.map((r, i) => i === activePhoto ? { ...r, response: text } : r));
  }

  function toggleMood(mood: string) {
    Haptics.selectionAsync();
    setMoods(prev => prev.includes(mood) ? prev.filter(m => m !== mood) : [...prev, mood]);
  }

  async function saveBean() {
    if (!selected) return;
    setSaving(true);
    try {
      const draft = createTravelBeanDraft({
        name: selected.name,
        country: selected.country,
        city: selected.city,
        category: selected.category,
        dateVisited: date,
        notes,
        latitude: selected.latitude,
        longitude: selected.longitude,
        moodTags: moods,
        promptResponses: responses,
      });
      const beanPhotos: BeanPhoto[] = photos.map((asset, index) => ({
        id: asset.assetId ?? `${asset.uri}-${index}`,
        imageUrl: asset.uri,
        originalFileName: asset.fileName ?? undefined,
        uploadStatus: 'uploading',
        order: index,
      }));
      const persistedPhotos = await persistBeanPhotos(beanPhotos);
      const created = await addPlace({ ...draft, photos: persistedPhotos });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onCreated(created);
      close();
    } catch (err: any) {
      Alert.alert('Could not create place', err?.message ?? 'Please try again.');
      setSaving(false);
    }
  }

  const active = photos[activePhoto];
  const canContinueLocation = selected || query.trim();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={close}>
      <KeyboardAvoidingView style={[styles.modal, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={close}><Text style={[styles.headerAction, { color: colors.mutedForeground }]}>Cancel</Text></TouchableOpacity>
          <StepPips step={step} colors={colors} />
          {step !== 'preview' ? (
            <TouchableOpacity
              disabled={step === 'location' && !canContinueLocation}
              onPress={() => {
                if (step === 'location') selected ? setStep('photos') : useTypedLocation();
                else if (step === 'photos') setStep(photos.length ? 'prompts' : 'mood');
                else if (step === 'prompts') setStep('mood');
                else setStep('preview');
              }}
            >
              <Text style={[styles.headerAction, { color: step === 'location' && !canContinueLocation ? colors.mutedForeground : colors.primary }]}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity disabled={saving} onPress={saveBean}>
              <Text style={[styles.headerAction, { color: colors.primary }]}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {step === 'location' && (
          <ScrollView
            contentContainerStyle={styles.body}
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.title, { color: colors.foreground }]}>Where is this Place?</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>Search a city, cafe, landmark, hotel, viewpoint, or hidden corner.</Text>
            <View style={[styles.searchBox, { backgroundColor: colors.card, shadowColor: colors.foreground }]}>
              <Feather name="search" size={25} color="#153A46" />
              <TextInput value={query} onChangeText={searchLocation} placeholder="Search a real place..." placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} autoFocus />
            </View>
            <Text style={[styles.providerCopy, { color: colors.mutedForeground }]}>
              {hasPredictivePlaceProvider() ? 'Predictive map search is on. Results include live place data and coordinates.' : 'Add a Mapbox or Google Places key to turn this into live predictive map search. Local suggestions are active for preview.'}
            </Text>
            {searchingPlaces && <ActivityIndicator color={colors.primary} />}
            <View style={styles.results}>
              {filtered.map(item => {
                const isSelected = selected?.name === item.name && selected?.country === item.country;
                return (
                  <TouchableOpacity key={`${item.name}-${item.country}`} style={[styles.resultRow, { backgroundColor: isSelected ? '#EEF7FA' : colors.card, borderColor: colors.border }]} onPress={() => { setSelected(item); setQuery(item.name); }}>
                    <View style={[styles.resultIcon, { backgroundColor: isSelected ? colors.primary : colors.muted }]}>
                      <Feather name={item.category === 'coffee_shop' ? 'coffee' : 'map-pin'} size={18} color={isSelected ? '#fff' : '#153A46'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resultName, { color: colors.foreground }]}>{item.name}</Text>
                      <Text style={[styles.resultMeta, { color: colors.mutedForeground }]}>{[item.city, item.region, item.country].filter(Boolean).join(', ')}</Text>
                    </View>
                    <Feather name={isSelected ? 'check-circle' : 'chevron-right'} size={18} color={isSelected ? colors.primary : colors.mutedForeground} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {step === 'photos' && (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, { color: colors.foreground }]}>Add photos</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>Photos turn this location into a Memory, not just a pin.</Text>
            <TouchableOpacity style={[styles.photoDrop, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={pickPhotos}>
              <LinearGradient colors={['#542CF4', '#18BBD4']} style={styles.photoDropIcon}>
                <Feather name="image" size={24} color="#fff" />
              </LinearGradient>
              <Text style={[styles.photoDropTitle, { color: colors.foreground }]}>Choose trip photos</Text>
              <Text style={[styles.photoDropSub, { color: colors.mutedForeground }]}>Select up to {photoLimit} photos for this Place.</Text>
            </TouchableOpacity>
            <View style={styles.photoGrid}>
              {photos.map(asset => (
                <TouchableOpacity key={asset.uri} style={styles.thumb} onLongPress={() => removePhoto(asset.uri)}>
                  <Image source={{ uri: asset.uri }} style={styles.thumbImage} contentFit="cover" />
                  <TouchableOpacity style={styles.removePhoto} onPress={() => removePhoto(asset.uri)}>
                    <Feather name="x" size={12} color="#fff" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {step === 'prompts' && (
          <View style={styles.promptScreen}>
            {active ? <Image source={{ uri: active.uri }} style={styles.promptImage} contentFit="cover" /> : null}
            <LinearGradient colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.78)']} style={styles.promptOverlay} />
            <View style={styles.promptTop}>
              <Text style={styles.promptProgress}>{activePhoto + 1}/{Math.max(photos.length, 1)}</Text>
              <TouchableOpacity onPress={() => setStep('mood')}><Text style={styles.skipText}>Skip</Text></TouchableOpacity>
            </View>
            <View style={styles.promptPanel}>
              <Text style={styles.promptText}>{responses[activePhoto]?.prompt ?? PROMPTS[0]}</Text>
              <TextInput
                value={responses[activePhoto]?.response ?? ''}
                onChangeText={setResponse}
                placeholder="A sentence, a feeling, a tiny detail..."
                placeholderTextColor="rgba(255,255,255,0.58)"
                style={styles.promptInput}
                multiline
                scrollEnabled={false}
              />
              <View style={styles.promptNav}>
                <TouchableOpacity disabled={activePhoto === 0} onPress={() => setActivePhoto(i => Math.max(0, i - 1))} style={styles.promptNavBtn}>
                  <Feather name="arrow-left" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => activePhoto >= photos.length - 1 ? setStep('mood') : setActivePhoto(i => i + 1)} style={styles.promptNext}>
                  <Text style={styles.promptNextText}>{activePhoto >= photos.length - 1 ? 'Mood tags' : 'Next photo'}</Text>
                  <Feather name="arrow-right" size={18} color="#11131D" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {step === 'mood' && (
          <ScrollView
            contentContainerStyle={styles.body}
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.title, { color: colors.foreground }]}>What did it feel like?</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>Pick the atmosphere tags that belong with this memory.</Text>
            <View style={styles.moodGrid}>
              {MOODS.map(mood => (
                <TouchableOpacity key={mood} style={[styles.moodChip, { backgroundColor: moods.includes(mood) ? colors.primary : colors.muted }]} onPress={() => toggleMood(mood)}>
                  <Text style={[styles.moodText, { color: moods.includes(mood) ? '#fff' : colors.foreground }]}>{mood}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={[styles.noteInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} value={notes} onChangeText={setNotes} placeholder="Optional note about this Place..." placeholderTextColor={colors.mutedForeground} multiline scrollEnabled={false} />
            <DatePickerField value={date} onChange={setDate} colors={colors} placeholder="Visited date (optional)" />
          </ScrollView>
        )}

        {step === 'preview' && selected && (
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={[styles.title, { color: colors.foreground }]}>Preview Place</Text>
            <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <LinearGradient colors={['#11131D', '#542CF4']} style={styles.previewHero}>
                {photos[0] ? <Image source={{ uri: photos[0].uri }} style={styles.previewImage} contentFit="cover" /> : <Feather name="map-pin" size={46} color="#fff" />}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={StyleSheet.absoluteFillObject} />
                <View style={styles.previewCopy}>
                  <Text style={styles.previewName}>{selected.name}</Text>
                  <Text style={styles.previewMeta}>{[selected.city, selected.country].filter(Boolean).join(', ')}</Text>
                </View>
              </LinearGradient>
              <View style={styles.previewBody}>
                <View style={styles.previewStats}>
                  <Text style={[styles.previewStat, { color: colors.foreground }]}>{photos.length} photos</Text>
                  <Text style={[styles.previewStat, { color: colors.foreground }]}>{responses.filter(r => r.response.trim()).length} reflections</Text>
                  <Text style={[styles.previewStat, { color: colors.foreground }]}>{moods.length} moods</Text>
                </View>
                <View style={styles.moodGrid}>
                  {moods.map(mood => <Text key={mood} style={[styles.previewMood, { color: colors.primary, backgroundColor: colors.primary + '12' }]}>{mood}</Text>)}
                </View>
              </View>
            </View>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} disabled={saving} onPress={saveBean}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Create Place</Text>}
              {!saving && <Feather name="check-circle" size={18} color="#fff" />}
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function StepPips({ step, colors }: { step: Step; colors: any }) {
  const steps: Step[] = ['location', 'photos', 'prompts', 'mood', 'preview'];
  const current = steps.indexOf(step);
  return (
    <View style={styles.pips}>
      {steps.map((s, index) => (
        <View key={s} style={[styles.pip, { width: index === current ? 18 : 7, backgroundColor: index <= current ? colors.primary : colors.border }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1 },
  header: { height: 62, borderBottomWidth: 1, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerAction: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  pips: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pip: { height: 7, borderRadius: 999 },
  body: { padding: 22, gap: 18, paddingBottom: 44 },
  title: { fontSize: 28, lineHeight: 33, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 30, paddingHorizontal: 18, paddingVertical: 16, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 5 },
  searchInput: { flex: 1, fontSize: 18, fontFamily: 'Inter_700Bold' },
  providerCopy: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold', marginTop: -8 },
  results: { gap: 10 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, padding: 13 },
  resultIcon: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  resultName: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  resultMeta: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  photoDrop: { alignItems: 'center', justifyContent: 'center', borderRadius: 28, borderWidth: 1, minHeight: 220, padding: 20 },
  photoDropIcon: { width: 68, height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  photoDropTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  photoDropSub: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 4, textAlign: 'center' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 104, height: 124, borderRadius: 20, overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  removePhoto: { position: 'absolute', right: 7, top: 7, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  promptScreen: { flex: 1, backgroundColor: '#11131D' },
  promptImage: { ...StyleSheet.absoluteFillObject },
  promptOverlay: { ...StyleSheet.absoluteFillObject },
  promptTop: { padding: 18, paddingTop: Platform.OS === 'ios' ? 58 : 22, flexDirection: 'row', justifyContent: 'space-between', zIndex: 2 },
  promptProgress: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  skipText: { color: 'rgba(255,255,255,0.76)', fontSize: 13, fontFamily: 'Inter_700Bold' },
  promptPanel: { marginTop: 'auto', padding: 22, gap: 14 },
  promptText: { color: '#fff', fontSize: 27, lineHeight: 32, fontFamily: 'Inter_700Bold' },
  promptInput: { minHeight: 110, borderRadius: 24, padding: 16, color: '#fff', backgroundColor: 'rgba(255,255,255,0.14)', fontSize: 16, lineHeight: 22, fontFamily: 'Inter_500Medium' },
  promptNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  promptNavBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  promptNext: { flex: 1, height: 54, borderRadius: 27, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  promptNextText: { color: '#11131D', fontSize: 15, fontFamily: 'Inter_700Bold' },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  moodText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  noteInput: { minHeight: 112, borderWidth: 1, borderRadius: 22, padding: 15, fontSize: 15, lineHeight: 21, fontFamily: 'Inter_500Medium' },
  previewCard: { borderWidth: 1, borderRadius: 28, overflow: 'hidden' },
  previewHero: { height: 320, justifyContent: 'flex-end', alignItems: 'center' },
  previewImage: { ...StyleSheet.absoluteFillObject },
  previewCopy: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  previewName: { color: '#fff', fontSize: 28, lineHeight: 32, fontFamily: 'Inter_700Bold' },
  previewMeta: { color: 'rgba(255,255,255,0.78)', fontSize: 14, fontFamily: 'Inter_700Bold', marginTop: 4 },
  previewBody: { padding: 16, gap: 12 },
  previewStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  previewStat: { backgroundColor: 'rgba(150,154,170,0.12)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontFamily: 'Inter_700Bold' },
  previewMood: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontFamily: 'Inter_700Bold' },
  saveBtn: { height: 58, borderRadius: 29, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  saveText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
});
