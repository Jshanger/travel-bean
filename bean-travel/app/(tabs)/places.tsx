import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { createElement, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useAuth } from '@clerk/expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CountrySearch } from '@/components/CountrySearch';
import { DatePickerField } from '@/components/DatePickerField';
import { EmptyState } from '@/components/EmptyState';
import AddPlaceBeanFlow from '@/components/AddPlaceBeanFlow';
import DiaryStoryGenerator from '@/components/DiaryStoryGenerator';
import PlacePhotosModal from '@/components/PlacePhotosModal';
import VoiceDictation from '@/components/VoiceDictation';
import CountryMiniMap from '@/components/CountryMiniMap';
import PlacesMap from '@/components/PlacesMap';
import WorldMapSVG from '@/components/WorldMapSVG';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { PlaceCategory, VisitedPlace } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: PlaceCategory; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'city',        label: 'City',        icon: 'map' },
  { value: 'landmark',    label: 'Landmark',    icon: 'camera' },
  { value: 'restaurant',  label: 'Restaurant',  icon: 'coffee' },
  { value: 'coffee_shop', label: 'Coffee Shop', icon: 'coffee' },
  { value: 'hotel',       label: 'Hotel',       icon: 'home' },
  { value: 'nature',      label: 'Nature',      icon: 'sun' },
  { value: 'hidden_spot', label: 'Hidden Spot', icon: 'eye' },
];

// Exclude 'city' from sub-place categories (cities go in step 2)
const SUB_CATEGORIES = CATEGORIES.filter(c => c.value !== 'city');

const CAT = Object.fromEntries(CATEGORIES.map(c => [c.value, c])) as Record<PlaceCategory, typeof CATEGORIES[0]>;

const PLACE_SUGGESTIONS: Array<{
  name: string;
  city?: string;
  country: string;
  region?: string;
  category: PlaceCategory;
  latitude: number;
  longitude: number;
}> = [
  { name: 'Würzburg', country: 'Germany', region: 'Bavaria', category: 'city', latitude: 49.7913, longitude: 9.9534 },
  { name: 'Wuppertal', country: 'Germany', region: 'North Rhine-Westphalia', category: 'city', latitude: 51.2562, longitude: 7.1508 },
  { name: 'Wunstorf', country: 'Germany', region: 'Lower Saxony', category: 'city', latitude: 52.4238, longitude: 9.4359 },
  { name: 'Wuhan', country: 'China', region: 'Hubei', category: 'city', latitude: 30.5928, longitude: 114.3055 },
  { name: 'Würselen', country: 'Germany', region: 'North Rhine-Westphalia', category: 'city', latitude: 50.8181, longitude: 6.1347 },
  { name: 'Tokyo', country: 'Japan', category: 'city', latitude: 35.6762, longitude: 139.6503 },
  { name: 'Shibuya Crossing', city: 'Tokyo', country: 'Japan', category: 'landmark', latitude: 35.6595, longitude: 139.7005 },
  { name: 'Blue Bottle Coffee Shibuya', city: 'Tokyo', country: 'Japan', category: 'coffee_shop', latitude: 35.6628, longitude: 139.7038 },
  { name: 'Fushimi Inari Taisha', city: 'Kyoto', country: 'Japan', category: 'landmark', latitude: 34.9671, longitude: 135.7727 },
  { name: 'Shanghai', country: 'China', category: 'city', latitude: 31.2304, longitude: 121.4737 },
  { name: 'The Bund', city: 'Shanghai', country: 'China', category: 'landmark', latitude: 31.2400, longitude: 121.4900 },
  { name: 'Marrakech', country: 'Morocco', category: 'city', latitude: 31.6295, longitude: -7.9811 },
  { name: 'Jemaa el-Fnaa', city: 'Marrakech', country: 'Morocco', category: 'landmark', latitude: 31.6258, longitude: -7.9891 },
  { name: 'Istanbul', country: 'Turkey', category: 'city', latitude: 41.0082, longitude: 28.9784 },
  { name: 'Hagia Sophia', city: 'Istanbul', country: 'Turkey', category: 'landmark', latitude: 41.0086, longitude: 28.9802 },
  { name: 'Paris', country: 'France', category: 'city', latitude: 48.8566, longitude: 2.3522 },
  { name: 'Eiffel Tower', city: 'Paris', country: 'France', category: 'landmark', latitude: 48.8584, longitude: 2.2945 },
  { name: 'Lisbon', country: 'Portugal', category: 'city', latitude: 38.7223, longitude: -9.1393 },
  { name: 'Pastéis de Belém', city: 'Lisbon', country: 'Portugal', category: 'restaurant', latitude: 38.6976, longitude: -9.2032 },
  { name: 'New York', country: 'United States', category: 'city', latitude: 40.7128, longitude: -74.0060 },
  { name: 'Central Park', city: 'New York', country: 'United States', category: 'nature', latitude: 40.7829, longitude: -73.9654 },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftPlace {
  tempId: string;
  name: string;
  category: PlaceCategory;
  city: string;
  notes: string;
}

type ViewMode = 'list' | 'map';
type SheetMode = 'collections' | 'gallery';
// step1=country, step2=city, step3=places, edit=edit form
type ModalStep = 'closed' | 'quick' | 'step1' | 'step2' | 'step3' | 'edit';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PlacesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { places, addPlace, editPlace, deletePlace } = useApp();
  const { getToken } = useAuth();
  const nameRef = useRef<TextInput>(null);
  const cityInputRef = useRef<TextInput>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sheetMode, setSheetMode] = useState<SheetMode>('collections');
  const [catFilter, setCatFilter] = useState<string>('All');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [detailPlace, setDetailPlace] = useState<VisitedPlace | null>(null);

  // ── Add flow state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<ModalStep>('closed');
  const [draftCountry, setDraftCountry] = useState('');
  const [draftCity, setDraftCity] = useState('');     // selected city for step2
  const [cityInput, setCityInput] = useState('');    // typed city name in step2
  const [draftPlaces, setDraftPlaces] = useState<DraftPlace[]>([]);
  const [entryName, setEntryName] = useState('');
  const [entryCategory, setEntryCategory] = useState<PlaceCategory>('landmark');
  const [entryNotes, setEntryNotes] = useState('');
  const [quickQuery, setQuickQuery] = useState('');
  const [quickCategory, setQuickCategory] = useState<PlaceCategory>('city');
  const [quickSelected, setQuickSelected] = useState<typeof PLACE_SUGGESTIONS[number] | null>(null);
  const [quickContextCountry, setQuickContextCountry] = useState('');
  const [quickContextCity, setQuickContextCity] = useState('');

  // ── Edit state ─────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '', country: '', city: '', category: 'city' as PlaceCategory, dateVisited: '', notes: '',
  });

  // ── Derived ─────────────────────────────────────────────────────────────────
  const visitedCountries = useMemo(
    () => [...new Set(places.map(p => p.country).filter(Boolean))].sort(),
    [places],
  );
  // Cities already logged for the draft country (from DB + current session)
  const existingCities = useMemo(() => {
    const fromDb = places.filter(p => p.country === draftCountry && p.category === 'city').map(p => p.name);
    const fromDraft = draftPlaces.filter(d => d.category === 'city').map(d => d.name);
    return [...new Set([...fromDb, ...fromDraft])];
  }, [places, draftCountry, draftPlaces]);

  // Group: country → city → places
  const grouped = useMemo(() => {
    const pool = catFilter === 'All' ? places : places.filter(p => p.category === catFilter);
    const map = new Map<string, Map<string, VisitedPlace[]>>();
    for (const p of pool) {
      const co = p.country || 'Unknown';
      if (!map.has(co)) map.set(co, new Map());
      const cityKey = p.category === 'city' ? '' : (p.city || '');
      const cityMap = map.get(co)!;
      if (!cityMap.has(cityKey)) cityMap.set(cityKey, []);
      cityMap.get(cityKey)!.push(p);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [places, catFilter]);
  const selectedCountryPlaces = useMemo(() => {
    if (!selectedCountry) return [];
    const entry = grouped.find(([country]) => country === selectedCountry);
    return entry ? [...entry[1].values()].flat() : [];
  }, [grouped, selectedCountry]);
  const galleryGroups = useMemo(() => {
    return grouped.map(([country, cityMap]) => ({
      country,
      cities: [...cityMap.entries()].map(([city, items]) => ({
        city: city || country,
        items,
      })),
    }));
  }, [grouped]);

  const topPt = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPb = Platform.OS === 'web' ? 34 + 84 : 84 + insets.bottom;

  // ── Open add (with optional prefills) ────────────────────────────────────────
  function openAdd(preCountry?: string, preCity?: string) {
    setDraftCountry(preCountry ?? '');
    setDraftCity(preCity ?? '');
    setQuickContextCountry(preCountry ?? '');
    setQuickContextCity(preCity ?? '');
    setQuickQuery('');
    setQuickSelected(null);
    setQuickCategory(preCity ? 'landmark' : 'city');
    setCityInput('');
    setDraftPlaces([]);
    setEntryName('');
    setEntryCategory('landmark');
    setStep('quick');
    setTimeout(() => nameRef.current?.focus(), 300);
  }

  const quickSuggestions = useMemo(() => {
    const query = quickQuery.trim().toLowerCase();
    const scoped = PLACE_SUGGESTIONS.filter(s => {
      if (quickContextCountry && s.country !== quickContextCountry) return false;
      if (quickContextCity && s.city && s.city !== quickContextCity) return false;
      return true;
    });
    const source = scoped.length > 0 ? scoped : PLACE_SUGGESTIONS;
    if (!query) return source.slice(0, 7);
    return source
      .filter(s => [s.name, s.city, s.region, s.country, CAT[s.category]?.label].filter(Boolean).join(' ').toLowerCase().includes(query))
      .slice(0, 8);
  }, [quickQuery, quickContextCountry, quickContextCity]);

  function selectQuickSuggestion(suggestion: typeof PLACE_SUGGESTIONS[number]) {
    setQuickSelected(suggestion);
    setQuickQuery(suggestion.name);
    setQuickCategory(suggestion.category);
    setDraftCountry(suggestion.country);
    setDraftCity(suggestion.category === 'city' ? '' : (suggestion.city ?? quickContextCity));
    Haptics.selectionAsync();
  }

  async function saveQuickPlace() {
    const name = (quickSelected?.name ?? quickQuery).trim();
    if (!name) return;
    const parsed = name.split(',').map(part => part.trim()).filter(Boolean);
    const country = quickSelected?.country || quickContextCountry || (parsed.length > 1 ? parsed[parsed.length - 1] : draftCountry);
    if (!country) {
      Alert.alert('Add a country', 'Choose a suggestion or type the place as “Name, Country”.');
      return;
    }
    const city = quickSelected
      ? (quickSelected.category === 'city' ? undefined : quickSelected.city)
      : quickContextCity || (quickCategory === 'city' ? undefined : draftCity || undefined);
    await addPlace({
      name: quickSelected ? quickSelected.name : parsed[0],
      country,
      city,
      category: quickCategory,
      dateVisited: entryDate,
      notes: entryNotes,
      latitude: quickSelected?.latitude,
      longitude: quickSelected?.longitude,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEntryDate('');
    setEntryNotes('');
    setStep('closed');
  }

  function openQuickInMaps() {
    const q = quickSelected
      ? `${quickSelected.name}, ${quickSelected.city ? `${quickSelected.city}, ` : ''}${quickSelected.country}`
      : quickQuery;
    if (!q.trim()) return;
    const encoded = encodeURIComponent(q);
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?q=${encoded}`
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
    Linking.openURL(url);
  }

  // ── Step 1 → 2 ──────────────────────────────────────────────────────────────
  function goStep2() {
    if (!draftCountry.trim()) return;
    setDraftCity('');
    setCityInput('');
    setStep('step2');
    setTimeout(() => cityInputRef.current?.focus(), 300);
  }

  // ── Step 2 → 3 (with chosen city, or skip) ──────────────────────────────────
  function goStep3(city: string) {
    const resolved = city.trim();
    setDraftCity(resolved);
    setCityInput('');
    // If a new city name was typed (not an existing one), add it as a draft place
    if (resolved && !existingCities.includes(resolved)) {
      setDraftPlaces(prev => [...prev, {
        tempId: Math.random().toString(36).slice(2),
        name: resolved,
        category: 'city',
        city: '',
        notes: '',
      }]);
    }
    setEntryName('');
    setEntryCategory('landmark');
    setStep('step3');
    setTimeout(() => nameRef.current?.focus(), 300);
  }

  // ── Draft place management ─────────────────────────────────────────────────
  function addDraftPlace() {
    if (!entryName.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDraftPlaces(prev => [...prev, {
      tempId: Math.random().toString(36).slice(2),
      name: entryName.trim(),
      category: entryCategory,
      city: draftCity,
      notes: entryNotes.trim(),
    }]);
    setEntryName('');
    setEntryNotes('');
    nameRef.current?.focus();
  }

  function removeDraftPlace(tempId: string) {
    setDraftPlaces(prev => prev.filter(p => p.tempId !== tempId));
  }

  // ── Save all drafts ───────────────────────────────────────────────────────
  async function saveAll() {
    const flush: DraftPlace[] = entryName.trim()
      ? [...draftPlaces, { tempId: 'last', name: entryName.trim(), category: entryCategory, city: draftCity, notes: entryNotes.trim() }]
      : draftPlaces;
    if (flush.length === 0) return;
    for (const d of flush) {
      await addPlace({
        name: d.name,
        country: draftCountry,
        city: d.city || undefined,
        category: d.category,
        dateVisited: entryDate,
        notes: d.notes,
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEntryDate('');
    setEntryNotes('');
    setStep('closed');
  }

  // ── Edit flow ──────────────────────────────────────────────────────────────
  function openEdit(p: VisitedPlace) {
    setEditingId(p.id);
    setEditForm({ name: p.name, country: p.country, city: p.city ?? '', category: p.category, dateVisited: p.dateVisited, notes: p.notes });
    setStep('edit');
  }

  function saveEdit() {
    if (!editingId || !editForm.name.trim()) return;
    editPlace(editingId, { ...editForm, city: editForm.city || undefined });
    setStep('closed');
  }

  function handleDelete(id: string) {
    Alert.alert('Delete Place', 'Remove this Place?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deletePlace(id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } },
    ]);
  }

  const saveCount = draftPlaces.length + (entryName.trim() ? 1 : 0);

  // ── Photos modal ────────────────────────────────────────────────────────────
  const [photoPlace, setPhotoPlace] = useState<VisitedPlace | null>(null);
  const [storyVisible, setStoryVisible] = useState(false);
  const [storyPlaces, setStoryPlaces] = useState<VisitedPlace[]>([]);
  const [storySource, setStorySource] = useState({
    id: 'all-place-beans',
    title: 'My Place Story',
    destination: 'My Places',
    startDate: undefined as string | undefined,
    endDate: undefined as string | undefined,
  });

  // ── Edit modal photo thumbnails ──────────────────────────────────────────────
  const [editPhotos, setEditPhotos] = useState<Array<{ id: string }>>([]);
  const [editPhotosLoading, setEditPhotosLoading] = useState(false);
  const [editPhotosToken, setEditPhotosToken] = useState<string | null>(null);
  const [galleryThumbs, setGalleryThumbs] = useState<Record<string, string>>({});
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());
  const [galleryToken, setGalleryToken] = useState<string | null>(null);

  useEffect(() => {
    if (step === 'edit' && editingId) {
      setEditPhotosLoading(true);
      const load = async () => {
        try {
          const token = await getToken();
          setEditPhotosToken(token);
          const domain = process.env.EXPO_PUBLIC_DOMAIN;
          const base = domain ? `https://${domain}/api/bean` : '/api/bean';
          const res = await fetch(`${base}/photos?placeId=${editingId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) setEditPhotos(await res.json());
        } catch {}
        finally { setEditPhotosLoading(false); }
      };
      load();
    } else {
      setEditPhotos([]);
    }
  }, [step, editingId]);

  useEffect(() => {
    const loadGalleryThumbs = async () => {
      const sample = places.slice(0, 12);
      if (sample.length === 0) {
        setGalleryThumbs({});
        return;
      }
      try {
        const token = await getToken();
        setGalleryToken(token);
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        const base = domain ? `https://${domain}/api/bean` : '/api/bean';
        const pairs = await Promise.all(sample.map(async p => {
          try {
            const res = await fetch(`${base}/photos?placeId=${p.id}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!res.ok) return null;
            const photos = await res.json();
            return photos?.[0]?.id ? [p.id, photos[0].id] as const : null;
          } catch {
            return null;
          }
        }));
        setGalleryThumbs(Object.fromEntries(pairs.filter(Boolean) as Array<readonly [string, string]>));
      } catch {
        setGalleryThumbs({});
      }
    };
    loadGalleryThumbs();
  }, [places, getToken]);

  const [entryDate, setEntryDate] = useState('');

  const editCountryCities = useMemo(() =>
    [...new Set(places.filter(p => p.country === editForm.country && p.category === 'city').map(p => p.name))],
    [places, editForm.country],
  );

  function openStoryBean(sourcePlaces: VisitedPlace[], title?: string, destination?: string) {
    const pool = sourcePlaces.length > 0 ? sourcePlaces : places;
    const dates = pool.map(p => p.dateVisited).filter(Boolean).sort();
    setStoryPlaces(pool);
    setStorySource({
      id: `places-${destination || selectedCountry || detailPlace?.id || 'all'}-${pool.length}`,
      title: title || (destination ? `${destination} Story` : 'My Place Story'),
      destination: destination || selectedCountry || 'My Places',
      startDate: dates[0],
      endDate: dates[dates.length - 1],
    });
    setStoryVisible(true);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      {/* ── Header ── */}
      {viewMode === 'map' && (
      <View style={[styles.header, { paddingTop: topPt + 12 }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>Places</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              {places.length} Place{places.length !== 1 ? 's' : ''} · {visitedCountries.length} Country{visitedCountries.length === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={styles.headerBtns}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: viewMode === 'map' ? colors.primary : colors.muted }]}
              onPress={() => { Haptics.selectionAsync(); setViewMode(v => v === 'list' ? 'map' : 'list'); }}
            >
              <Feather name={viewMode === 'map' ? 'list' : 'map'} size={18} color={viewMode === 'map' ? '#fff' : colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={() => openAdd()}>
              <Feather name="plus" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      )}

      {/* ── Content ── */}
      {viewMode === 'map' ? (
        <View style={{ flex: 1 }}><PlacesMap places={places} /></View>
      ) : (
        <View style={styles.mapFirstScreen}>
          <View style={styles.mapHeroPane}>
            <WorldMapSVG places={places} variant="travel" />
            <View style={[styles.travelMapTopControls, { paddingTop: topPt + 10 }]}>
              <TouchableOpacity style={styles.travelMapPill} activeOpacity={0.86} onPress={() => setViewMode('map')}>
                <Feather name="globe" size={18} color="#fff" />
                <Text style={styles.travelMapPillText}>Passport Map</Text>
              </TouchableOpacity>
              <View style={styles.mapToolRow}>
                <TouchableOpacity style={styles.roundMapTool} activeOpacity={0.84} onPress={() => openAdd()}>
                  <Feather name="search" size={22} color="#153A46" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.roundMapTool} activeOpacity={0.84} onPress={() => setViewMode('map')}>
                  <Feather name="maximize-2" size={21} color="#153A46" />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity style={styles.locateBtn} activeOpacity={0.85} onPress={() => setViewMode('map')}>
              <Feather name="navigation" size={24} color="#153A46" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.mapAddFab} activeOpacity={0.85} onPress={() => openAdd()}>
              <Feather name="plus" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={[styles.placeSheet, { backgroundColor: colors.background }]}>
            <View style={styles.sheetHandle} />
            {!selectedCountry ? (
              <>
                <View style={styles.sheetTitleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Your Places</Text>
                    <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>{places.length} Places · {visitedCountries.length} collections</Text>
                  </View>
                  {places.length > 0 && (
                    <TouchableOpacity style={[styles.newListBtn, { borderColor: colors.border }]} onPress={() => openStoryBean(places, 'My Place Story', 'My Places')}>
                      <Feather name="film" size={15} color={colors.primary} />
                      <Text style={[styles.newListText, { color: colors.primary }]}>Story</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.newListBtn, { borderColor: colors.border }]} onPress={() => openAdd()}>
                    <Feather name="plus" size={15} color={colors.primary} />
                    <Text style={[styles.newListText, { color: colors.primary }]}>Add Place</Text>
                  </TouchableOpacity>
                </View>
                {grouped.length > 0 && (
                  <View style={[styles.sheetModeSwitch, { backgroundColor: colors.muted }]}>
                    <TouchableOpacity
                      style={[styles.sheetModeBtn, sheetMode === 'collections' && { backgroundColor: colors.foreground }]}
                      onPress={() => setSheetMode('collections')}
                    >
                      <Feather name="map-pin" size={13} color={sheetMode === 'collections' ? '#fff' : colors.mutedForeground} />
                      <Text style={[styles.sheetModeText, { color: sheetMode === 'collections' ? '#fff' : colors.mutedForeground }]}>Collections</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sheetModeBtn, sheetMode === 'gallery' && { backgroundColor: colors.foreground }]}
                      onPress={() => setSheetMode('gallery')}
                    >
                      <Feather name="image" size={13} color={sheetMode === 'gallery' ? '#fff' : colors.mutedForeground} />
                      <Text style={[styles.sheetModeText, { color: sheetMode === 'gallery' ? '#fff' : colors.mutedForeground }]}>Gallery</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={[styles.sheetSectionLabel, { color: colors.mutedForeground }]}>
                  {grouped.length === 0 ? 'YOUR FIRST TRAVEL BEAN' : sheetMode === 'gallery' ? 'PLACE GALLERY' : 'YOUR BEAN COLLECTIONS'}
                </Text>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPb + 24, gap: 12 }}>
                  {grouped.length === 0 ? (
                    <View style={[styles.onboardingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <LinearGradient colors={['#542CF4', '#16BFD0']} style={styles.onboardingIcon}>
                        <Feather name="map" size={25} color="#fff" />
                      </LinearGradient>
                      <Text style={[styles.onboardingTitle, { color: colors.foreground }]}>Where have you been?</Text>
                      <Text style={[styles.onboardingText, { color: colors.mutedForeground }]}>Add 3 countries or cities and Travel Bean will turn them into your first passport, map, and memory gallery.</Text>
                      <View style={styles.onboardingActions}>
                        <TouchableOpacity style={[styles.onboardingBtn, { backgroundColor: colors.primary }]} onPress={() => openAdd()}>
                          <Text style={styles.onboardingBtnText}>Add first place</Text>
                          <Feather name="arrow-right" size={16} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.onboardingBtnGhost, { borderColor: colors.border }]} onPress={() => setStep('step1')}>
                          <Text style={[styles.onboardingBtnGhostText, { color: colors.foreground }]}>Add 3 quickly</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : sheetMode === 'gallery' ? (
                    <PlaceGallery
                      groups={galleryGroups}
                      galleryThumbs={galleryThumbs}
                      galleryToken={galleryToken}
                      failedThumbs={failedThumbs}
                      onThumbError={id => setFailedThumbs(prev => new Set(prev).add(id))}
                      colors={colors}
                      onOpen={setDetailPlace}
                      onPhotos={setPhotoPlace}
                      onStory={(items, label) => openStoryBean(items, `${label} Story`, label)}
                    />
                  ) : grouped.map(([country, cityMap]) => {
                    const total = [...cityMap.values()].reduce((s, arr) => s + arr.length, 0);
                    return (
                      <TouchableOpacity key={country} style={[styles.listCard, { backgroundColor: colors.card }]} activeOpacity={0.84} onPress={() => setSelectedCountry(country)}>
                        <CountryBeanIcon />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.listTitle, { color: colors.foreground }]} numberOfLines={1}>{country}</Text>
                          <Text style={[styles.listMeta, { color: colors.mutedForeground }]}>You · {total} Place{total === 1 ? '' : 's'}</Text>
                        </View>
                        <Feather name="more-horizontal" size={22} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : (
              <>
                <View style={styles.listDetailHeader}>
                  <TouchableOpacity style={styles.sheetBackBtn} onPress={() => setSelectedCountry(null)}>
                    <Feather name="chevron-left" size={28} color="#153A46" />
                  </TouchableOpacity>
                  <CountryBeanIcon large />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailTitle, { color: colors.foreground }]} numberOfLines={1}>{selectedCountry}</Text>
                    <Text style={[styles.listMeta, { color: colors.mutedForeground }]}>You · {selectedCountryPlaces.length} Place{selectedCountryPlaces.length === 1 ? '' : 's'}</Text>
                  </View>
                  <TouchableOpacity style={styles.detailIconBtn}><Feather name="share" size={22} color="#153A46" /></TouchableOpacity>
                  <TouchableOpacity style={styles.detailIconBtn} onPress={() => openStoryBean(selectedCountryPlaces, `${selectedCountry} Story`, selectedCountry || undefined)}>
                    <Feather name="film" size={22} color="#153A46" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.detailIconBtn}><Feather name="settings" size={22} color="#153A46" /></TouchableOpacity>
                  <TouchableOpacity style={styles.darkSmallBtn} onPress={() => openAdd(selectedCountry)}><Feather name="plus" size={22} color="#fff" /></TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottomPb + 24 }}>
                  {selectedCountryPlaces.map(p => {
                    const thumbId = galleryThumbs[p.id];
                    const domain = process.env.EXPO_PUBLIC_DOMAIN;
                    const base = domain ? `https://${domain}/api/bean` : '/api/bean';
                    return (
                      <TouchableOpacity key={p.id} style={styles.savedPlaceRow} activeOpacity={0.84} onPress={() => setDetailPlace(p)}>
                        <View style={styles.placeThumb}>
                          {thumbId && !failedThumbs.has(thumbId) ? (
                            <Image
                              source={{ uri: `${base}/photos/img/${encodeURIComponent(thumbId)}`, headers: galleryToken ? { Authorization: `Bearer ${galleryToken}` } : {} }}
                              style={styles.placeThumbImage}
                              contentFit="cover"
                              onError={() => setFailedThumbs(prev => new Set(prev).add(thumbId))}
                            />
                          ) : (
                            <LinearGradient colors={['#542CF4', '#18BBD4']} style={styles.placeThumbImage}>
                              <Feather name={CAT[p.category]?.icon ?? 'map-pin'} size={22} color="#fff" />
                            </LinearGradient>
                          )}
                          <View style={styles.thumbBadge}>
                            <Feather name={CAT[p.category]?.icon ?? 'map-pin'} size={16} color="#fff" />
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.savedPlaceName, { color: colors.foreground }]} numberOfLines={1}>{p.name}</Text>
                          <Text style={[styles.savedPlaceAddress, { color: colors.mutedForeground }]} numberOfLines={1}>{p.city ? `${p.city}, ` : ''}{p.country}</Text>
                          <View style={[styles.savedCategoryPill, { backgroundColor: colors.muted }]}>
                            <Text style={[styles.savedCategoryText, { color: colors.foreground }]}>{CAT[p.category]?.label ?? p.category}</Text>
                          </View>
                        </View>
                        <Feather name="heart" size={22} color="#8B5CF6" />
                        <Feather name="chevron-down" size={20} color="#153A46" />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      )}

      <AddPlaceBeanFlow
        visible={step === 'quick'}
        suggestions={PLACE_SUGGESTIONS}
        initialCountry={quickContextCountry}
        initialCity={quickContextCity}
        onClose={() => setStep('closed')}
        onCreated={(place) => {
          setDetailPlace(place);
          setSelectedCountry(place.country);
        }}
      />

      {/* ══════════════════════════════════════════════════════════════
          QUICK ADD — Predictive map search
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={false && step === 'quick'} transparent animationType="slide" onRequestClose={() => setStep('closed')}>
        <KeyboardAvoidingView style={styles.quickOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.quickBackdrop} activeOpacity={1} onPress={() => setStep('closed')} />
          <View style={[styles.quickSheet, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.quickHandle} />
            <View style={styles.quickIntro}>
              <Text style={[styles.quickTitle, { color: colors.foreground }]} numberOfLines={1}>
                Add a Place{quickContextCountry ? ` to ${quickContextCity || quickContextCountry}` : ''}
              </Text>
              <Text style={[styles.quickSub, { color: colors.mutedForeground }]}>Search a city, cafe, landmark or hidden gem and save it to your places.</Text>
            </View>

            <View style={[styles.quickSearchBox, { backgroundColor: colors.card, shadowColor: colors.foreground }]}>
              <Feather name="search" size={27} color="#153A46" />
              <TextInput
                ref={nameRef}
                style={[styles.quickSearchInput, { color: colors.foreground }]}
                placeholder={quickContextCity ? `Search near ${quickContextCity}...` : 'Search a place...'}
                placeholderTextColor={colors.mutedForeground}
                value={quickQuery}
                onChangeText={(value) => { setQuickQuery(value); setQuickSelected(null); }}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={saveQuickPlace}
              />
              {quickQuery.trim() ? (
                <TouchableOpacity onPress={() => { setQuickQuery(''); setQuickSelected(null); }}>
                  <Feather name="x" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              ) : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickCategoryRow}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.quickCatChip, { backgroundColor: quickCategory === c.value ? colors.primary : colors.muted }]}
                  onPress={() => setQuickCategory(c.value)}
                >
                  <Feather name={c.icon} size={14} color={quickCategory === c.value ? '#fff' : colors.mutedForeground} />
                  <Text style={[styles.quickCatText, { color: quickCategory === c.value ? '#fff' : colors.foreground }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.quickResults}>
              {quickSuggestions.map(s => {
                const selected = quickSelected?.name === s.name && quickSelected?.country === s.country;
                return (
                  <TouchableOpacity
                    key={`${s.name}-${s.country}`}
                    style={[styles.quickSuggestionRow, { backgroundColor: selected ? '#EEF7FA' : colors.background, borderBottomColor: colors.border }]}
                    onPress={() => selectQuickSuggestion(s)}
                    activeOpacity={0.78}
                  >
                    <View style={[styles.quickSuggestionIcon, { backgroundColor: selected ? colors.primary : colors.muted }]}>
                      <Feather name={CAT[s.category]?.icon ?? 'map-pin'} size={18} color={selected ? '#fff' : '#153A46'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.quickSuggestionName, { color: colors.foreground }]}>{s.name}</Text>
                      <Text style={[styles.quickSuggestionMeta, { color: colors.mutedForeground }]}>
                        {[s.city, s.region, s.country].filter(Boolean).join(', ')} · {CAT[s.category]?.label}
                      </Text>
                    </View>
                    <Feather name={selected ? 'check-circle' : 'map-pin'} size={18} color={selected ? colors.primary : colors.mutedForeground} />
                  </TouchableOpacity>
                );
              })}
              {quickQuery.trim() && quickSuggestions.length === 0 ? (
                <View style={styles.quickNoResults}>
                  <Text style={[styles.quickSuggestionName, { color: colors.foreground }]}>Save “{quickQuery.trim()}”</Text>
                  <Text style={[styles.quickSuggestionMeta, { color: colors.mutedForeground }]}>Tip: type “Place, Country” for better map grouping.</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.quickMetaPanel}>
              <DatePickerField value={entryDate} onChange={setEntryDate} colors={colors} placeholder="Visited date (optional)" />
              <View style={{ marginTop: 10 }}>
                <TextInput
                  style={[styles.quickNotes, { backgroundColor: colors.muted, color: colors.foreground }]}
                  placeholder="Short memory note (optional)"
                  placeholderTextColor={colors.mutedForeground}
                  value={entryNotes}
                  onChangeText={setEntryNotes}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </View>

            <View style={styles.quickActions}>
              <TouchableOpacity style={[styles.quickMapBtn, { borderColor: colors.border }]} onPress={openQuickInMaps} disabled={!quickQuery.trim() && !quickSelected}>
                <Feather name="navigation" size={18} color="#153A46" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.quickSaveBtn, { backgroundColor: quickQuery.trim() || quickSelected ? colors.primary : colors.muted }]} onPress={saveQuickPlace} disabled={!quickQuery.trim() && !quickSelected}>
                <Text style={[styles.quickSaveText, { color: quickQuery.trim() || quickSelected ? '#fff' : colors.mutedForeground }]}>Save place</Text>
                <Feather name="arrow-right" size={18} color={quickQuery.trim() || quickSelected ? '#fff' : colors.mutedForeground} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.quickAdvancedBtn, { borderColor: colors.border }]} onPress={() => setStep('step1')}>
                <Text style={[styles.quickAdvancedText, { color: colors.mutedForeground }]}>Advanced</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          STEP 1 — Country
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={step === 'step1'} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setStep('closed')}>
        <KeyboardAvoidingView style={[styles.modal, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          <View style={[styles.mHead, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setStep('closed')}>
              <Text style={[styles.mAction, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <StepPips current={1} total={3} colors={colors} />
            <TouchableOpacity onPress={goStep2} disabled={!draftCountry.trim()}>
              <Text style={[styles.mAction, { color: draftCountry.trim() ? colors.primary : colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>Next</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 28 }}>
            <View style={{ gap: 6 }}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>Which Country?</Text>
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>You'll pick a City next, then add specific Places inside it.</Text>
            </View>
            <View style={{ zIndex: 50 }}>
              <CountrySearch value={draftCountry} onChange={setDraftCountry} placeholder="Search country…" />
            </View>
            {visitedCountries.length > 0 && (
              <View style={{ gap: 10 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Previously visited</Text>
                <View style={styles.chipGrid}>
                  {visitedCountries.map(c => (
                    <TouchableOpacity key={c} style={[styles.prevChip, { backgroundColor: draftCountry === c ? colors.primary : colors.muted }]} onPress={() => setDraftCountry(c)}>
                      <Text style={[styles.prevChipTxt, { color: draftCountry === c ? '#fff' : colors.foreground }]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          STEP 2 — City
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={step === 'step2'} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setStep('closed')}>
        <KeyboardAvoidingView style={[styles.modal, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          <View style={[styles.mHead, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setStep('step1')}>
              <Feather name="chevron-left" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
            <StepPips current={2} total={3} colors={colors} />
            <TouchableOpacity onPress={() => goStep3('')}>
              <Text style={[styles.mAction, { color: colors.mutedForeground }]}>Skip</Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 28 }}>
            <View style={{ gap: 6 }}>
              <Text style={[styles.stepTitle, { color: colors.foreground }]}>Which city in {draftCountry}?</Text>
              <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>Landmarks, food spots, cafes, and stays will be nested under this city. Skip if you want to log the country only.</Text>
            </View>

            {/* City text input */}
            <View style={[styles.cityInputBox, { backgroundColor: colors.muted }]}>
              <Feather name="map-pin" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
              <TextInput
                ref={cityInputRef}
                style={[styles.cityInputField, { color: colors.foreground }]}
                placeholder="Type a city name…"
                placeholderTextColor={colors.mutedForeground}
                value={cityInput}
                onChangeText={setCityInput}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => { if (cityInput.trim()) goStep3(cityInput); }}
              />
              {cityInput.trim().length > 0 && (
                <TouchableOpacity style={[styles.cityGoBtn, { backgroundColor: colors.primary }]} onPress={() => goStep3(cityInput)}>
                  <Feather name="arrow-right" size={16} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            {/* Existing cities chips */}
            {existingCities.length > 0 && (
              <View style={{ gap: 10 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Already logged</Text>
                <View style={styles.chipGrid}>
                  {existingCities.map(c => (
                    <TouchableOpacity key={c} style={[styles.prevChip, { backgroundColor: colors.muted }]} onPress={() => goStep3(c)}>
                      <Feather name="map" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.prevChipTxt, { color: colors.foreground }]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Skip option */}
            <TouchableOpacity style={[styles.skipRow, { borderColor: colors.border }]} onPress={() => goStep3('')}>
              <Feather name="globe" size={18} color={colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.skipTitle, { color: colors.foreground }]}>No specific city</Text>
                <Text style={[styles.skipSub, { color: colors.mutedForeground }]}>Log country-level places like national parks or coastlines.</Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          STEP 3 — Add Places
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={step === 'step3'} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setStep('closed')}>
        <KeyboardAvoidingView style={[styles.modal, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          <View style={[styles.mHead, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setStep('step2')}>
              <Feather name="chevron-left" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center', gap: 2 }}>
              <Text style={[styles.mTitle, { color: colors.foreground }]}>
                {draftCity ? draftCity : draftCountry}
              </Text>
              <Text style={[styles.mSub, { color: colors.mutedForeground }]}>
                {draftCity ? `${draftCountry} · add Places` : 'Country-level Places'}
              </Text>
            </View>
            <TouchableOpacity onPress={saveAll} disabled={saveCount === 0}>
              <Text style={[styles.mAction, { color: saveCount > 0 ? colors.primary : colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>
                Save{saveCount > 0 ? ` ${saveCount}` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14 }}>

            {/* Queued draft rows */}
            {draftPlaces.filter(d => d.category !== 'city').length > 0 && (
              <View style={{ gap: 6 }}>
                {draftPlaces.filter(d => d.category !== 'city').map(d => (
                  <View key={d.tempId} style={[styles.draftRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.draftBadge, { backgroundColor: colors.primary + '15' }]}>
                      <Feather name={CAT[d.category]?.icon ?? 'map-pin'} size={17} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.draftName, { color: colors.foreground }]}>{d.name}</Text>
                      <Text style={[styles.draftMeta, { color: colors.mutedForeground }]}>{CAT[d.category]?.label}</Text>
                    </View>
                    <TouchableOpacity onPress={() => removeDraftPlace(d.tempId)} style={{ padding: 6 }}>
                      <Feather name="x" size={15} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Entry form */}
            <View style={[styles.entryBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                ref={nameRef}
                style={[styles.entryInput, { color: colors.foreground }]}
                placeholder={draftCity ? `Add a place in ${draftCity}…` : `Add a place in ${draftCountry}…`}
                placeholderTextColor={colors.mutedForeground}
                value={entryName}
                onChangeText={setEntryName}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={addDraftPlace}
              />

              {/* Category chips — only non-city types */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingTop: 12 }}>
                {SUB_CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.value}
                    style={[styles.catChip, { backgroundColor: entryCategory === c.value ? colors.primary : colors.muted }]}
                    onPress={() => setEntryCategory(c.value)}
                  >
                    <Feather name={c.icon} size={12} color={entryCategory === c.value ? '#fff' : colors.mutedForeground} />
                    <Text style={[styles.catTxt, { color: entryCategory === c.value ? '#fff' : colors.mutedForeground }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Visit date */}
              <View style={{ marginTop: 14 }}>
                <DatePickerField value={entryDate} onChange={setEntryDate} colors={colors} placeholder="When did you visit? (optional)" />
              </View>

              {/* Notes + voice + camera */}
              <View style={{ marginTop: 14, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Note (optional)</Text>
                  <VoiceDictation
                    onResult={text => setEntryNotes(n => (n ? n.trimEnd() + ' ' : '') + text)}
                  />
                </View>
                <TextInput
                  style={[styles.input, styles.textarea, { backgroundColor: colors.muted, color: colors.foreground }]}
                  placeholder="Add a note about this place…"
                  placeholderTextColor={colors.mutedForeground}
                  value={entryNotes}
                  onChangeText={setEntryNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Add button */}
              <TouchableOpacity
                style={[styles.addRowBtn, { backgroundColor: entryName.trim() ? colors.primary : colors.muted, marginTop: 12 }]}
                onPress={addDraftPlace}
                disabled={!entryName.trim()}
              >
                <Feather name="plus" size={16} color={entryName.trim() ? '#fff' : colors.mutedForeground} />
                <Text style={[styles.addRowBtnTxt, { color: entryName.trim() ? '#fff' : colors.mutedForeground }]}>
                  Add{draftPlaces.filter(d => d.category !== 'city').length > 0 ? ' another' : ''}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Add another city hint */}
            {draftCity && (
              <TouchableOpacity style={[styles.anotherCityRow, { borderColor: colors.border }]} onPress={() => setStep('step2')}>
                <Feather name="map-pin" size={15} color={colors.primary} />
                <Text style={[styles.anotherCityTxt, { color: colors.primary }]}>Add Places in a different city</Text>
                <Feather name="chevron-right" size={14} color={colors.primary} />
              </TouchableOpacity>
            )}

          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════
          EDIT modal
      ══════════════════════════════════════════════════════════════ */}
      <Modal visible={step === 'edit'} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setStep('closed')}>
        <KeyboardAvoidingView style={[styles.modal, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.mHead, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setStep('closed')}>
              <Text style={[styles.mAction, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.mTitle, { color: colors.foreground }]}>Edit Place</Text>
            <TouchableOpacity onPress={saveEdit} disabled={!editForm.name.trim()}>
              <Text style={[styles.mAction, { color: editForm.name.trim() ? colors.primary : colors.mutedForeground, fontFamily: 'Inter_600SemiBold' }]}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
            <Field label="Place name">
              <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]} value={editForm.name} onChangeText={v => setEditForm(f => ({ ...f, name: v }))} autoCapitalize="words" autoCorrect={false} />
            </Field>
            <View style={{ gap: 6, zIndex: 50 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Country</Text>
              <CountrySearch value={editForm.country} onChange={c => setEditForm(f => ({ ...f, country: c, city: '' }))} />
            </View>
            {editForm.category !== 'city' && (
              <View style={{ gap: 8 }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Under which city? <Text style={{ fontFamily: 'Inter_400Regular', fontWeight: '400' }}>(optional)</Text></Text>
                {editCountryCities.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }}>
                    {editCountryCities.map(c => (
                      <TouchableOpacity key={c}
                        style={[styles.cityChip, { backgroundColor: editForm.city === c ? colors.secondary + '28' : colors.muted, borderColor: editForm.city === c ? colors.secondary : 'transparent' }]}
                        onPress={() => setEditForm(f => ({ ...f, city: f.city === c ? '' : c }))}
                      >
                        <Text style={[styles.cityChipTxt, { color: editForm.city === c ? colors.secondary : colors.mutedForeground }]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]} placeholder="City name…" placeholderTextColor={colors.mutedForeground} value={editForm.city} onChangeText={v => setEditForm(f => ({ ...f, city: v }))} autoCapitalize="words" />
                )}
              </View>
            )}
            <View style={{ gap: 8 }}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Type</Text>
              <View style={styles.chipGrid}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity key={c.value} style={[styles.catChip, { backgroundColor: editForm.category === c.value ? colors.primary : colors.muted }]}
                    onPress={() => setEditForm(f => ({ ...f, category: c.value, city: c.value === 'city' ? '' : f.city }))}>
                    <Feather name={c.icon} size={12} color={editForm.category === c.value ? '#fff' : colors.mutedForeground} />
                    <Text style={[styles.catTxt, { color: editForm.category === c.value ? '#fff' : colors.mutedForeground }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Field label="When did you visit?">
              <DatePickerField value={editForm.dateVisited} onChange={v => setEditForm(f => ({ ...f, dateVisited: v }))} colors={colors} />
            </Field>
            <View style={{ gap: 6 }}>
              {/* Notes header: label + camera + voice */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Notes</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.noteIconBtn, { backgroundColor: colors.muted }]}
                    onPress={() => {
                      const p = places.find(pl => pl.id === editingId);
                      if (p) setPhotoPlace(p);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Feather name="camera" size={14} color={colors.primary} />
                    {editPhotos.length > 0 && (
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: colors.primary }}>{editPhotos.length}</Text>
                    )}
                  </TouchableOpacity>
                  <VoiceDictation
                    onResult={text => setEditForm(f => ({ ...f, notes: (f.notes ? f.notes.trimEnd() + ' ' : '') + text }))}
                  />
                </View>
              </View>
              {/* Photo thumbnails strip */}
              {editPhotos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 2 }}>
                  {editPhotos.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => {
                        const place = places.find(pl => pl.id === editingId);
                        if (place) setPhotoPlace(place);
                      }}
                    >
                      <Image
                        source={{
                          uri: `${process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/bean` : '/api/bean'}/photos/img/${encodeURIComponent(p.id)}`,
                          headers: editPhotosToken ? { Authorization: `Bearer ${editPhotosToken}` } : {},
                        }}
                        style={styles.editPhotoThumb}
                        contentFit="cover"
                      />
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[styles.editPhotoThumb, { backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }]}
                    onPress={() => {
                      const place = places.find(pl => pl.id === editingId);
                      if (place) setPhotoPlace(place);
                    }}
                  >
                    <Feather name="plus" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </ScrollView>
              )}
              <TextInput
                style={[styles.input, styles.textarea, { backgroundColor: colors.muted, color: colors.foreground }]}
                placeholder="What made this place special?"
                placeholderTextColor={colors.mutedForeground}
                value={editForm.notes}
                onChangeText={v => setEditForm(f => ({ ...f, notes: v }))}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Photos modal ── */}
      <PlacePhotosModal
        place={photoPlace}
        visible={photoPlace !== null}
        onClose={() => setPhotoPlace(null)}
      />

      <DiaryStoryGenerator
        visible={storyVisible}
        storySource={storySource}
        places={storyPlaces.length > 0 ? storyPlaces : places}
        onClose={() => setStoryVisible(false)}
      />

      <Modal visible={detailPlace !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailPlace(null)}>
        {detailPlace && (
          <View style={[styles.detailModal, { backgroundColor: colors.background }]}>
            <View style={styles.detailHero}>
              {galleryThumbs[detailPlace.id] && !failedThumbs.has(galleryThumbs[detailPlace.id]) ? (
                <Image
                  source={{
                    uri: `${process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/bean` : '/api/bean'}/photos/img/${encodeURIComponent(galleryThumbs[detailPlace.id])}`,
                    headers: galleryToken ? { Authorization: `Bearer ${galleryToken}` } : {},
                  }}
                  style={styles.detailHeroImage}
                  contentFit="cover"
                  onError={() => {
                    const failed = galleryThumbs[detailPlace.id];
                    if (failed) setFailedThumbs(prev => new Set(prev).add(failed));
                  }}
                />
              ) : (
                <LinearGradient colors={['#153A46', '#542CF4']} style={styles.detailHeroImage}>
                  <Feather name={CAT[detailPlace.category]?.icon ?? 'map-pin'} size={54} color="rgba(255,255,255,0.88)" />
                </LinearGradient>
              )}
              <LinearGradient colors={['rgba(0,0,0,0.56)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.38)']} style={styles.detailHeroShade} />
              <TouchableOpacity style={styles.detailCloseBtn} onPress={() => setDetailPlace(null)}>
                <Feather name="x" size={30} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.detailHeroTitle} numberOfLines={1}>{detailPlace.name}</Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: bottomPb + 28 }}>
              <View style={styles.detailBody}>
              <View style={styles.detailActionRow}>
                  <View style={[styles.detailTypePill, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.detailTypeText, { color: colors.foreground }]}>Place · {CAT[detailPlace.category]?.label ?? detailPlace.category}</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity><Feather name="heart" size={25} color="#8B5CF6" /></TouchableOpacity>
                  <TouchableOpacity><Feather name="chevron-down" size={24} color="#153A46" /></TouchableOpacity>
                </View>
                <View style={styles.detailInfoBlock}>
                  <Feather name="bookmark" size={22} color="#153A46" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailBlockTitle, { color: colors.foreground }]}>Saved as</Text>
                    <View style={[styles.detailListChip, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.detailListChipText, { color: colors.foreground }]}>{detailPlace.country}</Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />
                <View style={styles.detailInfoBlock}>
                  <Feather name="map-pin" size={24} color="#153A46" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.detailBlockTitle, { color: colors.foreground }]}>Address</Text>
                    <Text style={styles.detailAddress}>
                      {detailPlace.city ? `${detailPlace.city}, ` : ''}{detailPlace.country}
                    </Text>
                  </View>
                </View>
                {detailPlace.notes ? (
                  <>
                    <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />
                    <BeanMemoryDetails notes={detailPlace.notes} colors={colors} />
                  </>
                ) : null}
              </View>
            </ScrollView>
            <View style={[styles.detailFooter, { backgroundColor: colors.background }]}>
              <TouchableOpacity style={[styles.savedButton, { backgroundColor: colors.primary + '12' }]} onPress={() => setPhotoPlace(detailPlace)}>
                <Feather name="image" size={20} color={colors.primary} />
                <Text style={[styles.savedButtonText, { color: colors.primary }]}>Memories</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.savedButton, { backgroundColor: '#11131D' }]} onPress={() => { setDetailPlace(null); openStoryBean([detailPlace], `${detailPlace.name} Story`, detailPlace.name); }}>
                <Feather name="film" size={20} color="#fff" />
                <Text style={[styles.savedButtonText, { color: '#fff' }]}>Story</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.footerCircle}><Feather name="navigation" size={21} color="#153A46" /></TouchableOpacity>
              <TouchableOpacity style={styles.footerCircle} onPress={() => openEdit(detailPlace)}><Feather name="more-horizontal" size={22} color="#153A46" /></TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

    </View>
  );
}

// ─── Step pip indicator ───────────────────────────────────────────────────────

function StepPips({ current, total, colors }: { current: number; total: number; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.pip, {
          width: i + 1 === current ? 18 : 7,
          backgroundColor: i + 1 <= current ? colors.primary : colors.border,
        }]} />
      ))}
    </View>
  );
}

function parseBeanNotes(notes: string) {
  const lines = notes.split('\n').map(line => line.trim()).filter(Boolean);
  const moodLine = lines.find(line => line.startsWith('Mood:'));
  const reflectionStart = lines.findIndex(line => line === 'Reflections:');
  const intro = lines.filter((line, index) =>
    !line.startsWith('Mood:') &&
    line !== 'Reflections:' &&
    (reflectionStart === -1 || index < reflectionStart)
  ).join('\n');
  const moods = moodLine ? moodLine.replace('Mood:', '').split(',').map(m => m.trim()).filter(Boolean) : [];
  const reflections = reflectionStart >= 0
    ? lines.slice(reflectionStart + 1).map(line => line.replace(/^•\s*/, '')).filter(Boolean)
    : [];
  return { intro, moods, reflections };
}

function BeanMemoryDetails({ notes, colors }: { notes: string; colors: any }) {
  const parsed = parseBeanNotes(notes);
  return (
    <View style={styles.memoryDetails}>
      {parsed.moods.length > 0 ? (
        <View style={styles.detailMoodWrap}>
          {parsed.moods.map(mood => (
            <View key={mood} style={[styles.detailMoodChip, { backgroundColor: colors.primary + '12' }]}>
              <Text style={[styles.detailMoodText, { color: colors.primary }]}>{mood}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {parsed.intro ? <Text style={[styles.detailNotes, { color: colors.mutedForeground }]}>{parsed.intro}</Text> : null}
      {parsed.reflections.length > 0 ? (
        <View style={styles.reflectionList}>
          <Text style={[styles.reflectionTitle, { color: colors.foreground }]}>Journal reflections</Text>
          {parsed.reflections.map((reflection, index) => (
            <View key={`${reflection}-${index}`} style={[styles.reflectionCard, { backgroundColor: colors.muted }]}>
              <Feather name="book-open" size={15} color={colors.primary} />
              <Text style={[styles.reflectionText, { color: colors.foreground }]}>{reflection}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CountryBeanIcon({ large = false }: { large?: boolean }) {
  return (
    <LinearGradient
      colors={['#F2FBFF', '#EAF3FF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={large ? styles.detailListIcon : styles.listIconBox}
    >
      <LinearGradient
        colors={['#542CF4', '#16BFD0']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.beanGlyphRing}
      >
        <View style={styles.beanGlyphCore}>
          <View style={styles.beanGlyphBean} />
          <View style={styles.beanGlyphCut} />
        </View>
      </LinearGradient>
    </LinearGradient>
  );
}

function PlaceGallery({
  groups,
  galleryThumbs,
  galleryToken,
  failedThumbs,
  onThumbError,
  colors,
  onOpen,
  onPhotos,
  onStory,
}: {
  groups: Array<{ country: string; cities: Array<{ city: string; items: VisitedPlace[] }> }>;
  galleryThumbs: Record<string, string>;
  galleryToken: string | null;
  failedThumbs: Set<string>;
  onThumbError: (photoId: string) => void;
  colors: any;
  onOpen: (place: VisitedPlace) => void;
  onPhotos: (place: VisitedPlace) => void;
  onStory: (places: VisitedPlace[], label: string) => void;
}) {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  const base = domain ? `https://${domain}/api/bean` : '/api/bean';
  return (
    <View style={styles.placeGalleryWrap}>
      {groups.map(group => (
        <View key={group.country} style={styles.galleryGroup}>
          <View style={styles.galleryGroupHead}>
            <View>
              <Text style={[styles.galleryGroupTitle, { color: colors.foreground }]}>{group.country}</Text>
              <Text style={[styles.galleryGroupSub, { color: colors.mutedForeground }]}>
                {group.cities.reduce((sum, city) => sum + city.items.length, 0)} Places
              </Text>
            </View>
            <TouchableOpacity style={[styles.galleryStoryBtn, { backgroundColor: colors.primary + '12' }]} onPress={() => onStory(group.cities.flatMap(city => city.items), group.country)}>
              <Feather name="film" size={14} color={colors.primary} />
              <Text style={[styles.galleryStoryText, { color: colors.primary }]}>Story</Text>
            </TouchableOpacity>
          </View>
          {group.cities.map(city => (
            <View key={`${group.country}-${city.city}`} style={styles.galleryCityBlock}>
              <Text style={[styles.galleryCityTitle, { color: colors.mutedForeground }]}>{city.city}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryStrip}>
                {city.items.map(place => {
                  const thumbId = galleryThumbs[place.id];
                  return (
                    <TouchableOpacity key={place.id} style={styles.galleryMemoryCard} activeOpacity={0.84} onPress={() => onOpen(place)}>
                      {thumbId && !failedThumbs.has(thumbId) ? (
                        <Image
                          source={{ uri: `${base}/photos/img/${encodeURIComponent(thumbId)}`, headers: galleryToken ? { Authorization: `Bearer ${galleryToken}` } : {} }}
                          style={styles.galleryMemoryImage}
                          contentFit="cover"
                          onError={() => onThumbError(thumbId)}
                        />
                      ) : (
                        <LinearGradient colors={['#11131D', '#542CF4']} style={styles.galleryMemoryImage}>
                          <Feather name={CAT[place.category]?.icon ?? 'map-pin'} size={32} color="#fff" />
                        </LinearGradient>
                      )}
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={styles.galleryMemoryShade} />
                      <View style={styles.galleryMemoryCopy}>
                        <Text style={styles.galleryMemoryName} numberOfLines={1}>{place.name}</Text>
                        <Text style={styles.galleryMemoryMeta} numberOfLines={1}>{CAT[place.category]?.label ?? 'Place'}</Text>
                      </View>
                      <TouchableOpacity style={styles.galleryAddMemory} onPress={() => onPhotos(place)}>
                        <Feather name="image" size={13} color="#fff" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ─── Country section ──────────────────────────────────────────────────────────

function CountrySection({ country, cityMap, colors, onEdit, onDelete, onAddToCountry, onAddToCity, onPhotos }: {
  country: string;
  cityMap: Map<string, VisitedPlace[]>;
  colors: any;
  onEdit: (p: VisitedPlace) => void;
  onDelete: (id: string) => void;
  onAddToCountry: () => void;
  onAddToCity: (city: string) => void;
  onPhotos: (p: VisitedPlace) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const cityPlaces = cityMap.get('') ?? [];
  const subGroups = [...cityMap.entries()].filter(([k]) => k !== '');
  const total = [...cityMap.values()].reduce((s, a) => s + a.length, 0);
  const cityCount = cityPlaces.filter(p => p.category === 'city').length + subGroups.length;

  return (
    <View style={[styles.countryCardWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity style={styles.coHead} onPress={() => setCollapsed(c => !c)} activeOpacity={0.78}>
        <LinearGradient
          colors={['#542CF4', '#16BFD0']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.countryMapHero}
        >
          <CountryMiniMap country={country} color="#FFFFFF" mutedColor="rgba(255,255,255,0.5)" />
        </LinearGradient>
        <View style={styles.countryInfo}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.coName, { color: colors.foreground }]}>{country}</Text>
            <Text style={[styles.coCount, { color: colors.mutedForeground }]}>{total} place{total !== 1 ? 's' : ''} · {cityCount} cit{cityCount === 1 ? 'y' : 'ies'}</Text>
          </View>
          <TouchableOpacity style={[styles.addCoBtn, { backgroundColor: colors.primary + '18' }]} onPress={onAddToCountry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="plus" size={14} color={colors.primary} />
            <Text style={[styles.addCoBtnTxt, { color: colors.primary }]}>Add</Text>
          </TouchableOpacity>
          <Feather name={collapsed ? 'chevron-right' : 'chevron-down'} size={18} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
        </View>
      </TouchableOpacity>

      {!collapsed && (
        <View style={styles.countryExpanded}>
          {cityPlaces.map(p => (
            <View key={p.id}>
              {p.category === 'city' ? (
                <CityHeader
                  city={p}
                  colors={colors}
                  onEdit={() => onEdit(p)}
                  onDelete={() => onDelete(p.id)}
                  onAddToCity={() => onAddToCity(p.name)}
                  subPlaces={subGroups.find(([k]) => k === p.name)?.[1] ?? []}
                  onEditSub={onEdit}
                  onDeleteSub={onDelete}
                  onPhotos={onPhotos}
                />
              ) : (
                <View style={{ paddingLeft: 20 }}>
                  <PlaceRow place={p} colors={colors} onEdit={() => onEdit(p)} onDelete={() => onDelete(p.id)} onPhotos={() => onPhotos(p)} />
                </View>
              )}
            </View>
          ))}
          {subGroups
            .filter(([cityName]) => !cityPlaces.some(p => p.name === cityName && p.category === 'city'))
            .map(([cityName, subs]) => (
              <View key={cityName}>
                <View style={[styles.orphanCityRow, { borderBottomColor: colors.border }]}>
                  <Feather name="map" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.orphanCityName, { color: colors.foreground }]}>{cityName}</Text>
                  <TouchableOpacity style={[styles.addCoBtn, { backgroundColor: colors.primary + '18' }]} onPress={() => onAddToCity(cityName)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="plus" size={12} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                {subs.map(p => (
                  <View key={p.id} style={{ paddingLeft: 44 }}>
                    <PlaceRow place={p} colors={colors} onEdit={() => onEdit(p)} onDelete={() => onDelete(p.id)} onPhotos={() => onPhotos(p)} />
                  </View>
                ))}
              </View>
            ))}
        </View>
      )}
    </View>
  );
}

// ─── Inline modal date picker (no modal-in-modal) ────────────────────────────

function ModalDatePicker({ visible, value, name, onConfirm, onClose, colors }: {
  visible: boolean; value: string; name: string;
  onConfirm: (d: string) => void; onClose: () => void; colors: any;
}) {
  const [pending, setPending] = useState(value || toYMD(new Date()));
  useEffect(() => { if (visible) setPending(value || toYMD(new Date())); }, [visible, value]);
  if (!visible) return null;

  // Web: handled inline in CityHeader/PlaceRow directly — no Modal needed.

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ fontSize: 16, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>Cancel</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>{name}</Text>
          <TouchableOpacity onPress={() => { onConfirm(pending); onClose(); }}>
            <Text style={{ fontSize: 16, color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Done</Text>
          </TouchableOpacity>
        </View>
        <DateTimePicker
          value={toDate(pending)}
          mode="date"
          display="spinner"
          maximumDate={new Date()}
          onChange={(_, d) => { if (d) setPending(toYMD(d)); }}
          style={{ height: 200 }}
        />
      </View>
    </Modal>
  );
}

function toDate(val: string): Date {
  if (!val) return new Date();
  const d = new Date(val + 'T12:00:00');
  return isNaN(d.getTime()) ? new Date() : d;
}
function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── City header ──────────────────────────────────────────────────────────────

function CityHeader({ city, colors, onEdit, onDelete, onAddToCity, subPlaces, onEditSub, onDeleteSub, onPhotos }: {
  city: VisitedPlace; colors: any;
  onEdit: () => void; onDelete: () => void; onAddToCity: () => void;
  subPlaces: VisitedPlace[]; onEditSub: (p: VisitedPlace) => void; onDeleteSub: (id: string) => void;
  onPhotos: (p: VisitedPlace) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [editingDate, setEditingDate] = useState(false);
  const { editPlace } = useApp();

  function openEditDelete() {
    Alert.alert(city.name, undefined, [
      { text: '✏️  Edit', onPress: onEdit },
      { text: '🗑️  Delete', style: 'destructive', onPress: onDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View>
      {Platform.OS !== 'web' && (
        <ModalDatePicker
          visible={editingDate}
          value={city.dateVisited}
          name={city.name}
          onConfirm={date => editPlace(city.id, { dateVisited: date })}
          onClose={() => setEditingDate(false)}
          colors={colors}
        />
      )}
      <View style={[styles.cityHead, { borderBottomColor: colors.border }]}>
        {/* Left column: name touchable (collapse) + date touchable (edit) as siblings — no nesting */}
        <View style={{ flex: 1, flexDirection: 'column' }}>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => setCollapsed(c => !c)} activeOpacity={0.7}>
            <View style={[styles.cityIcon, { backgroundColor: colors.muted }]}>
              <Feather name="map" size={15} color={colors.foreground} />
            </View>
            <Text style={[styles.cityName, { color: colors.foreground }]}>{city.name}</Text>
          </TouchableOpacity>
          {Platform.OS === 'web' && editingDate
            ? createElement('input', {
                type: 'date',
                autoFocus: true,
                defaultValue: city.dateVisited || toYMD(new Date()),
                max: toYMD(new Date()),
                onChange: (e: any) => { editPlace(city.id, { dateVisited: e.target.value }); setEditingDate(false); },
                onBlur: () => setEditingDate(false),
                style: { marginLeft: '44px', fontSize: '11px', fontFamily: 'inherit', border: '1px solid #E8825A', borderRadius: '6px', padding: '2px 8px', color: '#E8825A', backgroundColor: 'transparent', outline: 'none', width: '120px' },
              })
            : <TouchableOpacity onPress={() => setEditingDate(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ paddingLeft: 44 }}>
                <Text style={[styles.cityDate, { color: city.dateVisited ? colors.primary : colors.mutedForeground }]}>
                  {city.dateVisited ? formatDate(city.dateVisited) : '+ Add date'}
                </Text>
              </TouchableOpacity>
          }
        </View>
        <TouchableOpacity style={[styles.addCoBtn, { backgroundColor: colors.muted, marginLeft: 4 }]} onPress={onAddToCity} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="plus" size={13} color={colors.mutedForeground} />
          <Text style={[styles.addCoBtnTxt, { color: colors.mutedForeground }]}>Add</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={openEditDelete} style={styles.moreBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="more-horizontal" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCollapsed(c => !c)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name={collapsed ? 'chevron-right' : 'chevron-down'} size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      {!collapsed && subPlaces.map(p => (
        <View key={p.id} style={{ paddingLeft: 44 }}>
          <PlaceRow place={p} colors={colors} onEdit={() => onEditSub(p)} onDelete={() => onDeleteSub(p.id)} onPhotos={() => onPhotos(p)} />
        </View>
      ))}
    </View>
  );
}

// ─── Place row ────────────────────────────────────────────────────────────────

function PlaceRow({ place, colors, onEdit, onDelete, onPhotos }: { place: VisitedPlace; colors: any; onEdit: () => void; onDelete: () => void; onPhotos: () => void }) {
  const cat = CAT[place.category];
  const [editingDate, setEditingDate] = useState(false);
  const { editPlace } = useApp();

  function openEditDelete() {
    Alert.alert(place.name, undefined, [
      { text: '✏️  Edit', onPress: onEdit },
      { text: '🗑️  Delete', style: 'destructive', onPress: onDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <>
      {Platform.OS !== 'web' && (
        <ModalDatePicker
          visible={editingDate}
          value={place.dateVisited}
          name={place.name}
          onConfirm={date => editPlace(place.id, { dateVisited: date })}
          onClose={() => setEditingDate(false)}
          colors={colors}
        />
      )}
      {/* Flat View — no nesting of touchables */}
      <View style={[styles.placeRow, { borderBottomColor: colors.border }]}>
        <View style={[styles.placeIcon, { backgroundColor: colors.muted }]}>
          <Feather name={cat?.icon ?? 'map-pin'} size={15} color={colors.mutedForeground} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.placeName, { color: colors.foreground }]}>{place.name}</Text>
          {Platform.OS === 'web' && editingDate
            ? createElement('input', {
                type: 'date',
                autoFocus: true,
                defaultValue: place.dateVisited || toYMD(new Date()),
                max: toYMD(new Date()),
                onChange: (e: any) => { editPlace(place.id, { dateVisited: e.target.value }); setEditingDate(false); },
                onBlur: () => setEditingDate(false),
                style: { fontSize: '12px', fontFamily: 'inherit', border: '1px solid #E8825A', borderRadius: '6px', padding: '2px 8px', color: '#E8825A', backgroundColor: 'transparent', outline: 'none', width: '140px' },
              })
            : <TouchableOpacity onPress={() => setEditingDate(true)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={[styles.placeMeta, { color: place.dateVisited ? colors.primary : colors.mutedForeground }]}>
                  {cat?.label ?? place.category}{place.dateVisited ? ` · ${formatDate(place.dateVisited)}` : ' · + add date'}
                </Text>
              </TouchableOpacity>
          }
          {place.notes ? (
            <Text style={[styles.placeNotes, { color: colors.mutedForeground }]} numberOfLines={2}>{place.notes}</Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={openEditDelete} style={styles.moreBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="more-horizontal" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onPhotos} style={[styles.memoryBeanBtn, { backgroundColor: colors.primary + '12' }]} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="image" size={15} color={colors.primary} />
          <Text style={[styles.memoryBeanBtnText, { color: colors.primary }]}>Memories</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }); }
  catch { return d; }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  headerBtns: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  filterRow: { marginHorizontal: -20 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  chipTxt: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mapFirstScreen: { flex: 1, position: 'relative', overflow: 'hidden' },
  mapHeroPane: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  travelMapTopControls: { position: 'absolute', top: 0, left: 22, right: 22, zIndex: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  travelMapPill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#153A46', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 30, shadowColor: '#153A46', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 8 },
  travelMapPillText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  mapSheen: { ...StyleSheet.absoluteFillObject },
  statusTop: { position: 'absolute', left: 20, right: 20, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scratchPill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#153A46', paddingHorizontal: 22, paddingVertical: 16, borderRadius: 34, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 8 },
  scratchText: { fontSize: 20, fontFamily: 'Inter_700Bold', color: '#fff' },
  mapToolRow: { flexDirection: 'row', gap: 12 },
  roundMapTool: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 8 },
  locateBtn: { position: 'absolute', right: 28, bottom: '43%', width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 8 },
  mapAddFab: { position: 'absolute', right: 28, bottom: '34%', width: 66, height: 66, borderRadius: 33, backgroundColor: '#153A46', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: 'rgba(255,255,255,0.62)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 8 },
  placeSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingTop: 10, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 8 },
  sheetHandle: { width: 58, height: 7, borderRadius: 4, backgroundColor: '#DCE7EA', alignSelf: 'center', marginBottom: 14 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 },
  sheetTitle: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  sheetSub: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 3 },
  newListBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 24, borderWidth: 1 },
  newListText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  sheetModeSwitch: { flexDirection: 'row', borderRadius: 999, padding: 4, gap: 4, marginBottom: 14 },
  sheetModeBtn: { flex: 1, minHeight: 38, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sheetModeText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  sheetSectionLabel: { fontSize: 14, fontFamily: 'Inter_700Bold', letterSpacing: 2, marginBottom: 10 },
  onboardingCard: { borderWidth: 1, borderRadius: 26, padding: 16, gap: 9 },
  onboardingIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  onboardingTitle: { fontSize: 24, lineHeight: 29, fontFamily: 'Inter_700Bold' },
  onboardingText: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium' },
  onboardingActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  onboardingBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12 },
  onboardingBtnText: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#fff' },
  onboardingBtnGhost: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12 },
  onboardingBtnGhostText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  placeGalleryWrap: { gap: 18 },
  galleryGroup: { gap: 10 },
  galleryGroupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  galleryGroupTitle: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  galleryGroupSub: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 2 },
  galleryStoryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  galleryStoryText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  galleryCityBlock: { gap: 8 },
  galleryCityTitle: { fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1.3 },
  galleryStrip: { gap: 10, paddingRight: 20 },
  galleryMemoryCard: { width: 152, height: 188, borderRadius: 24, overflow: 'hidden', backgroundColor: '#11131D' },
  galleryMemoryImage: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  galleryMemoryShade: { ...StyleSheet.absoluteFillObject },
  galleryMemoryCopy: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  galleryMemoryName: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  galleryMemoryMeta: { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontFamily: 'Inter_700Bold', marginTop: 3 },
  galleryAddMemory: { position: 'absolute', right: 10, top: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  listCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 24 },
  listIconBox: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  beanGlyphRing: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', shadowColor: '#542CF4', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
  beanGlyphCore: { width: 25, height: 25, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transform: [{ rotate: '-16deg' }] },
  beanGlyphBean: { width: 18, height: 12, borderRadius: 10, backgroundColor: '#542CF4', transform: [{ rotate: '14deg' }] },
  beanGlyphCut: { position: 'absolute', width: 19, height: 5, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.72)', transform: [{ rotate: '-18deg' }] },
  listTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  listMeta: { fontSize: 15, fontFamily: 'Inter_500Medium', marginTop: 4 },
  listDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDE7EA' },
  sheetBackBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  detailListIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { fontSize: 23, fontFamily: 'Inter_700Bold' },
  detailIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  darkSmallBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#153A46', alignItems: 'center', justifyContent: 'center' },
  savedPlaceRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#DDE7EA' },
  placeThumb: { width: 86, height: 86, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  placeThumbImage: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  thumbBadge: { position: 'absolute', left: 7, top: 7, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(139,92,246,0.88)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  savedPlaceName: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  savedPlaceAddress: { fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 5 },
  savedCategoryPill: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 10 },
  savedCategoryText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  detailModal: { flex: 1 },
  detailHero: { height: 330, position: 'relative', backgroundColor: '#153A46' },
  detailHeroImage: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  detailHeroShade: { ...StyleSheet.absoluteFillObject },
  detailCloseBtn: { position: 'absolute', left: 20, top: 48, width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  detailHeroTitle: { position: 'absolute', left: 76, right: 20, top: 55, fontSize: 21, fontFamily: 'Inter_700Bold', color: '#fff' },
  detailBody: { paddingHorizontal: 22, paddingTop: 24 },
  detailActionRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 28 },
  detailTypePill: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  detailTypeText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  detailInfoBlock: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', paddingVertical: 12 },
  detailBlockTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  detailListChip: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 10 },
  detailListChipText: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  detailDivider: { height: 1, marginVertical: 10, marginHorizontal: -22 },
  detailAddress: { fontSize: 18, lineHeight: 26, fontFamily: 'Inter_700Bold', color: '#5BCF9A', textDecorationLine: 'underline' },
  memoryDetails: { gap: 12, paddingVertical: 12 },
  detailMoodWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailMoodChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  detailMoodText: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  detailNotes: { fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium', paddingVertical: 12 },
  reflectionList: { gap: 8 },
  reflectionTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', marginTop: 4 },
  reflectionCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 18, padding: 13 },
  reflectionText: { flex: 1, fontSize: 13, lineHeight: 19, fontFamily: 'Inter_600SemiBold' },
  detailFooter: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 10 },
  savedButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 28, paddingVertical: 15 },
  savedButtonText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  footerCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4EEF1', alignItems: 'center', justifyContent: 'center' },
  quickOverlay: { flex: 1, justifyContent: 'flex-end' },
  quickBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,35,45,0.46)' },
  quickSheet: { maxHeight: '88%', borderTopLeftRadius: 34, borderTopRightRadius: 34, paddingTop: 12, paddingHorizontal: 18, shadowColor: '#000', shadowOffset: { width: 0, height: -14 }, shadowOpacity: 0.18, shadowRadius: 28, elevation: 14 },
  quickHandle: { width: 58, height: 7, borderRadius: 4, backgroundColor: '#DCE7EA', alignSelf: 'center', marginBottom: 26 },
  quickIntro: { paddingHorizontal: 6, marginBottom: 18 },
  quickTitle: { fontSize: 24, lineHeight: 29, fontFamily: 'Inter_700Bold' },
  quickSub: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', marginTop: 6 },
  quickSearchBox: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 34, paddingHorizontal: 20, minHeight: 72, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 6 },
  quickSearchInput: { flex: 1, fontSize: 24, fontFamily: 'Inter_700Bold', paddingVertical: 12 },
  quickCategoryRow: { gap: 8, paddingVertical: 14 },
  quickCatChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  quickCatText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  quickResults: { maxHeight: 300, marginHorizontal: -18 },
  quickSuggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 26, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  quickSuggestionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quickSuggestionName: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  quickSuggestionMeta: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 3 },
  quickNoResults: { paddingHorizontal: 26, paddingVertical: 18 },
  quickMetaPanel: { paddingTop: 12 },
  quickNotes: { minHeight: 58, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, lineHeight: 19, fontFamily: 'Inter_500Medium', textAlignVertical: 'top' },
  quickActions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 14 },
  quickMapBtn: { width: 54, height: 54, borderRadius: 27, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  quickSaveBtn: { flex: 1, height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  quickSaveText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  quickAdvancedBtn: { height: 54, borderRadius: 27, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  quickAdvancedText: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  atlasWrap: { paddingHorizontal: 20, marginBottom: 18 },
  atlasCard: {
    borderRadius: 30,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#2500FF',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 8,
  },
  atlasHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  atlasKicker: { fontSize: 12, fontFamily: 'Inter_700Bold', color: 'rgba(255,255,255,0.78)', marginBottom: 3 },
  atlasTitle: { fontSize: 24, lineHeight: 29, fontFamily: 'Inter_700Bold', color: '#fff' },
  atlasModeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  atlasMapPanel: { borderRadius: 26, overflow: 'hidden', borderWidth: 4, borderColor: '#fff', backgroundColor: '#DDE8FF' },
  atlasStats: { flexDirection: 'row', gap: 8, marginTop: 12 },
  atlasStatPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 18, paddingVertical: 10, alignItems: 'center' },
  atlasStatValue: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff' },
  atlasStatLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: 'rgba(255,255,255,0.74)', marginTop: 1 },
  gallerySection: { paddingLeft: 20, marginBottom: 18 },
  galleryHead: { paddingRight: 20, marginBottom: 10 },
  galleryTitle: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  gallerySub: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', marginTop: 2 },
  galleryCard: { width: 156, height: 186, borderRadius: 24, overflow: 'hidden', backgroundColor: '#10131F' },
  galleryImage: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  galleryShade: { ...StyleSheet.absoluteFillObject },
  galleryCardText: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  galleryPlaceName: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' },
  galleryPlaceMeta: { fontSize: 11, fontFamily: 'Inter_700Bold', color: 'rgba(255,255,255,0.78)', marginTop: 2 },

  // Country
  countryCardWrap: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#26283D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  coHead: { flexDirection: 'column' },
  countryMapHero: { height: 128, padding: 14, justifyContent: 'center', overflow: 'hidden' },
  countryInfo: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  coName: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  coCount: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },
  addCoBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  addCoBtnTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  countryExpanded: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(150,154,170,0.24)' },

  // City header
  cityHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  cityIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cityName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  cityDate: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },

  // Orphan city (sub-places without a matching city-type place)
  orphanCityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  orphanCityName: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  // Place row
  placeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  placeIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cameraBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  memoryBeanBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 6 },
  memoryBeanBtnText: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  moreBtn: { padding: 6 },
  photoHint: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  placeName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 1 },
  placeMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  placeNotes: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },

  // Modal shell
  modal: { flex: 1 },
  mHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  mTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  mSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  mAction: { fontSize: 15, fontFamily: 'Inter_400Regular' },

  // Step pip
  pip: { height: 7, borderRadius: 4 },

  // Step headings
  stepTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  stepSub: { fontSize: 14, fontFamily: 'Inter_400Regular', lineHeight: 20 },

  // Step 1 chips
  prevChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  prevChipTxt: { fontSize: 14, fontFamily: 'Inter_500Medium' },

  // Step 2 — city input
  cityInputBox: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  cityInputField: { flex: 1, fontSize: 16, fontFamily: 'Inter_400Regular' },
  cityGoBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  cityChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5 },
  cityChipTxt: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  // Step 2 — skip
  skipRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  skipTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  skipSub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },

  // Step 3 — drafts
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  draftBadge: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  draftName: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  draftMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 1 },

  // Step 3 — entry box
  entryBox: { borderRadius: 14, borderWidth: 1, padding: 14 },
  entryInput: { fontSize: 16, fontFamily: 'Inter_400Regular', paddingVertical: 2 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  catTxt: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  addRowBtnTxt: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  // Step 3 — another city hint
  anotherCityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12 },
  anotherCityTxt: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },

  // Edit
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  textarea: { minHeight: 100 },

  // Notes section
  noteIconBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  editPhotoThumb: { width: 72, height: 72, borderRadius: 10 },
});
