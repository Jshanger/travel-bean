import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BucketCard } from '@/components/BucketCard';
import { CountrySearch } from '@/components/CountrySearch';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { BucketItem, BucketSource, BucketStatus, BucketTag } from '@/types';
import { getDestinationInfo, inferCountryFromLocation } from '@/utils/destinationInfo';

const STATUSES: BucketStatus[] = ['Must Go', 'Want to Go', 'Maybe'];
const DESTINATION_IDEAS: Array<{
  name: string;
  location: string;
  country: string;
  imageUrl: string;
  backupImageUrls?: string[];
  tags: BucketTag[];
  note: string;
}> = [
  {
    name: 'Tokyo kissaten crawl',
    location: 'Tokyo, Japan',
    country: 'Japan',
    imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=900&q=80',
    tags: ['Food', 'Culture'],
    note: 'Old-school coffee shops, neon streets and quiet gardens between stops.',
  },
  {
    name: 'Lisbon miradouros',
    location: 'Lisbon, Portugal',
    country: 'Portugal',
    imageUrl: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=900&q=80',
    tags: ['Culture', 'Budget'],
    note: 'Tile streets, viewpoints, seafood and pastel de nata routes.',
  },
  {
    name: 'Marrakech riads',
    location: 'Marrakech, Morocco',
    country: 'Morocco',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Beautiful_riad_in_the_heart_of_Marrakech.jpg/960px-Beautiful_riad_in_the_heart_of_Marrakech.jpg',
    tags: ['Culture', 'Hidden Gem'],
    note: 'Medina lanes, courtyard stays, tea stops and market colors.',
  },
  {
    name: 'Dolomites sunrise',
    location: 'South Tyrol, Italy',
    country: 'Italy',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=900&q=80',
    tags: ['Nature', 'Adventure'],
    note: 'Alpine roads, lake walks, mountain huts and soft morning light.',
  },
  {
    name: 'Paris cafe mornings',
    location: 'Paris, France',
    country: 'France',
    imageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80',
    tags: ['Food', 'Romantic'],
    note: 'Corner cafes, museum afternoons, bakeries and long walks by the Seine.',
  },
  {
    name: 'Bali rice terraces',
    location: 'Ubud, Indonesia',
    country: 'Indonesia',
    imageUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=80',
    tags: ['Nature', 'Relaxing'],
    note: 'Rice terraces, waterfalls, temples, slow mornings and jungle cafes.',
  },
  {
    name: 'Greek island swim',
    location: 'Milos, Greece',
    country: 'Greece',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
    tags: ['Nature', 'Romantic'],
    note: 'Blue coves, whitewashed villages, sunset boats and seaside dinners.',
  },
  {
    name: 'Mexico City food crawl',
    location: 'Mexico City, Mexico',
    country: 'Mexico',
    imageUrl: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?auto=format&fit=crop&w=900&q=80',
    tags: ['Food', 'Culture'],
    note: 'Markets, tacos, museums, coffee bars and colorful neighborhood walks.',
  },
  {
    name: 'Banff lake weekend',
    location: 'Banff, Canada',
    country: 'Canada',
    imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
    tags: ['Nature', 'Adventure'],
    note: 'Turquoise lakes, mountain drives, cabins and clean alpine air.',
  },
  {
    name: 'Seoul design days',
    location: 'Seoul, South Korea',
    country: 'South Korea',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/79/Streets_of_Seoul_%28Unsplash%29.jpg',
    backupImageUrls: [
      'https://images.unsplash.com/photo-1538485399081-7c8ba554c762?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=900&q=80',
    ],
    tags: ['Culture', 'Food'],
    note: 'Design shops, palaces, late-night food, cafes and river walks.',
  },
  {
    name: 'Cape Town coast',
    location: 'Cape Town, South Africa',
    country: 'South Africa',
    imageUrl: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?auto=format&fit=crop&w=900&q=80',
    tags: ['Nature', 'Adventure'],
    note: 'Ocean roads, mountain views, wine country and bright coastal neighborhoods.',
  },
  {
    name: 'Istanbul bazaar route',
    location: 'Istanbul, Turkey',
    country: 'Turkey',
    imageUrl: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=900&q=80',
    tags: ['Culture', 'Food'],
    note: 'Tea stops, ferry rides, bazaars, mosques and layered city views.',
  },
  {
    name: 'Rio beach days',
    location: 'Rio de Janeiro, Brazil',
    country: 'Brazil',
    imageUrl: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=900&q=80',
    tags: ['Nature', 'Relaxing'],
    note: 'Beach mornings, lookout hikes, music, fresh juice and golden sunsets.',
  },
  {
    name: 'Ha Long Bay boat',
    location: 'Ha Long Bay, Vietnam',
    country: 'Vietnam',
    imageUrl: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=900&q=80',
    tags: ['Nature', 'Budget'],
    note: 'Limestone islands, boat decks, seafood, caves and quiet morning mist.',
  },
  {
    name: 'Queenstown thrill trip',
    location: 'Queenstown, New Zealand',
    country: 'New Zealand',
    imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=80',
    tags: ['Adventure', 'Nature'],
    note: 'Lake views, mountain roads, big-sky hikes and adventure day trips.',
  },
  {
    name: 'Reykjavik northern lights',
    location: 'Reykjavik, Iceland',
    country: 'Iceland',
    imageUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=80',
    tags: ['Nature', 'Romantic'],
    note: 'Hot springs, black sand beaches, waterfalls and northern-light nights.',
  },
];

interface BucketForm {
  name: string;
  location: string;
  country: string;
  source: BucketSource;
  tags: BucketTag[];
  status: BucketStatus;
  notes: string;
}
const EMPTY_FORM: BucketForm = { name: '', location: '', country: '', source: 'Own Idea', tags: [], status: 'Want to Go', notes: '' };

const STATUS_FILTER = ['All', ...STATUSES];

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api/bean`;
  return '/api/bean';
}

export default function BucketScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { bucketItems, addBucketItem, editBucketItem, deleteBucketItem } = useApp();

  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<BucketForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [suggestedImageUrl, setSuggestedImageUrl] = useState<string | null>(null);
  const [newImageObjectPath, setNewImageObjectPath] = useState<string | null>(null);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [ideaImageIndex, setIdeaImageIndex] = useState<Record<string, number>>({});

  const countryChoices = [...new Set(bucketItems.map(b => b.country || inferCountryFromLocation(b.location)).filter((country): country is string => Boolean(country)))].sort();
  const [countryFilter, setCountryFilter] = useState<string>('All');

  const filtered = bucketItems.filter(b => {
    const statusOk = statusFilter === 'All' || b.status === statusFilter;
    const country = b.country || inferCountryFromLocation(b.location);
    const countryOk = countryFilter === 'All' || country === countryFilter;
    return statusOk && countryOk;
  });

  const topPt = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPb = Platform.OS === 'web' ? 34 + 84 : 84 + insets.bottom;

  function getIdeaPhotos(idea: (typeof DESTINATION_IDEAS)[number]) {
    return [idea.imageUrl, ...(idea.backupImageUrls ?? [])];
  }
  function getIdeaPhotoUrl(idea: (typeof DESTINATION_IDEAS)[number]) {
    const photos = getIdeaPhotos(idea);
    const index = ideaImageIndex[idea.name] ?? 0;
    return photos[index] ?? idea.imageUrl;
  }
  function advanceIdeaPhoto(idea: (typeof DESTINATION_IDEAS)[number]) {
    setIdeaImageIndex(previous => {
      const currentIndex = previous[idea.name] ?? 0;
      const photos = getIdeaPhotos(idea);
      if (currentIndex >= photos.length - 1) return previous;
      return { ...previous, [idea.name]: currentIndex + 1 };
    });
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setEditingImageUrl(null);
    setSuggestedImageUrl(null);
    setNewImageObjectPath(null);
    setLocalImageUri(null);
    setModalVisible(true);
  }
  function openIdea(idea: (typeof DESTINATION_IDEAS)[number]) {
    const currentPhotoUrl = getIdeaPhotoUrl(idea);
    setForm({
      name: idea.name,
      location: idea.location,
      country: idea.country,
      source: 'Own Idea',
      tags: idea.tags,
      status: 'Want to Go',
      notes: idea.note,
    });
    setEditingId(null);
    setEditingImageUrl(currentPhotoUrl);
    setSuggestedImageUrl(currentPhotoUrl);
    setNewImageObjectPath(null);
    setLocalImageUri(null);
    setModalVisible(true);
  }
  function openEdit(b: BucketItem) {
    setForm({ name: b.name, location: b.location, country: b.country || inferCountryFromLocation(b.location), source: b.source, tags: b.tags, status: b.status, notes: b.notes });
    setEditingId(b.id);
    setEditingImageUrl(b.imageUrl ?? null);
    setSuggestedImageUrl(null);
    setNewImageObjectPath(null);
    setLocalImageUri(null);
    setModalVisible(true);
  }
  function handleSave() {
    if (!form.name.trim()) return;
    const payload: Omit<BucketItem, 'id' | 'createdAt'> = {
      ...form,
      country: form.country || inferCountryFromLocation(form.location) || undefined,
      ...(suggestedImageUrl && !newImageObjectPath ? { imageUrl: suggestedImageUrl } : {}),
      ...(newImageObjectPath ? { imageObjectPath: newImageObjectPath } : {}),
    };
    if (editingId) {
      editBucketItem(editingId, payload);
    } else {
      addBucketItem(payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setModalVisible(false);
  }
  function handleDelete(id: string) {
    Alert.alert('Remove Trip Idea', 'Remove this Trip Idea from your collection?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { deleteBucketItem(id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } },
    ]);
  }
  async function pickAndUploadImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to add a Trip Idea photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setUploadingImage(true);
    try {
      const token = await getToken();
      const base = getApiBase();
      const { uploadUrl, objectPath } = await fetch(`${base}/photos/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ contentType: 'image/jpeg' }),
      }).then(r => r.json());
      const imageBlob = await fetch(asset.uri).then(r => r.blob());
      await fetch(uploadUrl, { method: 'PUT', body: imageBlob, headers: { 'Content-Type': 'image/jpeg' } });
      setLocalImageUri(asset.uri);
      setSuggestedImageUrl(null);
      setNewImageObjectPath(objectPath);
    } catch {
      Alert.alert('Upload failed', 'Could not upload the trip idea photo. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  }

  const previewUri = localImageUri ?? suggestedImageUrl ?? editingImageUrl;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPt + 12 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.title, { color: colors.foreground }]}>Trip Ideas</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>{bucketItems.length} future place{bucketItems.length !== 1 ? 's' : ''} saved</Text>
          </View>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.secondary }]} onPress={openAdd}>
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }} style={{ marginHorizontal: -20 }}>
          {STATUS_FILTER.map(s => (
            <TouchableOpacity key={s} style={[styles.chip, { backgroundColor: statusFilter === s ? colors.secondary : colors.muted }]} onPress={() => setStatusFilter(s)}>
              <Text style={[styles.chipTxt, { color: statusFilter === s ? '#fff' : colors.mutedForeground }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {countryChoices.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }} style={{ marginHorizontal: -20, marginTop: 10 }}>
            {['All', ...countryChoices].map(c => (
              <TouchableOpacity key={c} style={[styles.countryFilterChip, { backgroundColor: countryFilter === c ? colors.primary : colors.muted }]} onPress={() => setCountryFilter(c)}>
                <Feather name={c === 'All' ? 'globe' : 'flag'} size={12} color={countryFilter === c ? '#fff' : colors.mutedForeground} />
                <Text style={[styles.chipTxt, { color: countryFilter === c ? '#fff' : colors.mutedForeground }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: bottomPb }} showsVerticalScrollIndicator={false}>
        <View style={styles.ideaSection}>
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Trip Idea Ideas</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>Tap to collect</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 20 }} style={{ marginRight: -20 }}>
            {DESTINATION_IDEAS.map(idea => {
              const ideaInfo = getDestinationInfo(idea.country, idea.location);
              return (
                <TouchableOpacity key={idea.name} style={styles.ideaCard} activeOpacity={0.88} onPress={() => openIdea(idea)}>
                  <Image
                    source={{ uri: getIdeaPhotoUrl(idea) }}
                    style={styles.ideaImage}
                    resizeMode="cover"
                    onError={() => advanceIdeaPhoto(idea)}
                  />
                  <LinearGradient colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.66)']} style={styles.ideaShade} />
                  <View style={styles.ideaContent}>
                    <View style={styles.ideaCountry}>
                      <Feather name="map-pin" size={11} color="#fff" />
                      <Text style={styles.ideaCountryText}>{idea.country}</Text>
                    </View>
                    <Text style={styles.ideaName}>{idea.name}</Text>
                    <Text style={styles.ideaFact} numberOfLines={2}>{ideaInfo.fact}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {filtered.length === 0 ? (
          <>
            <View style={[styles.inspirationBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <LinearGradient
                colors={['#2500FF', '#18BBD4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.inspirationIcon}
              >
                <Feather name="bookmark" size={20} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inspirationTitle, { color: colors.foreground }]}>Start with a Trip Idea</Text>
                <Text style={[styles.inspirationText, { color: colors.mutedForeground }]}>Pick a future place, then add notes, photos, and turn it into a Trip later.</Text>
              </View>
            </View>

            <View style={styles.popularSection}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Popular Trip Ideas</Text>
                <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>Quick collect</Text>
              </View>
              <View style={styles.pickGrid}>
                {DESTINATION_IDEAS.slice(4).map(idea => (
                  <TouchableOpacity key={idea.name} style={styles.pickCard} activeOpacity={0.86} onPress={() => openIdea(idea)}>
                    <Image
                      source={{ uri: getIdeaPhotoUrl(idea) }}
                      style={styles.pickImage}
                      resizeMode="cover"
                      onError={() => advanceIdeaPhoto(idea)}
                    />
                    <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} style={styles.pickShade} />
                    <View style={styles.pickContent}>
                      <Text style={styles.pickName} numberOfLines={2}>{idea.name}</Text>
                      <Text style={styles.pickCountry} numberOfLines={1}>{idea.country}</Text>
                    </View>
                    <View style={styles.pickPlus}>
                      <Feather name="plus" size={13} color="#fff" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        ) : (
          filtered.map(b => <BucketCard key={b.id} item={b} onEdit={() => openEdit(b)} onDelete={() => handleDelete(b.id)} />)
        )}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={{ fontSize: 15, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingId ? 'Edit Trip Idea' : 'Add Trip Idea'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={{ fontSize: 15, color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {/* Photo picker */}
            <TouchableOpacity
              style={[styles.photoPicker, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={pickAndUploadImage}
              disabled={uploadingImage}
              activeOpacity={0.8}
            >
              {uploadingImage ? (
                <ActivityIndicator color={colors.primary} />
              ) : previewUri ? (
                <Image source={{ uri: previewUri }} style={styles.photoPreview} resizeMode="cover" />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Feather name="camera" size={24} color={colors.mutedForeground} />
                  <Text style={[styles.photoPlaceholderTxt, { color: colors.mutedForeground }]}>Add Place photo</Text>
                </View>
              )}
              {previewUri && !uploadingImage ? (
                <View style={styles.photoOverlay}>
                  <Feather name="camera" size={16} color="#fff" />
                  <Text style={styles.photoOverlayTxt}>Change</Text>
                </View>
              ) : null}
            </TouchableOpacity>

            <FieldLabel label="Trip Idea Name *" colors={colors}>
              <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]} placeholder="e.g. Shinjuku Gyoen" placeholderTextColor={colors.mutedForeground} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} />
            </FieldLabel>
            <FieldLabel label="Location" colors={colors}>
              <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]} placeholder="e.g. Tokyo, Japan" placeholderTextColor={colors.mutedForeground} value={form.location} onChangeText={v => setForm(f => ({ ...f, location: v }))} />
            </FieldLabel>
            <FieldLabel label="Country" colors={colors}>
              <CountrySearch
                value={form.country}
                onChange={country => setForm(f => ({
                  ...f,
                  country,
                  location: f.location || country,
                }))}
                placeholder="Choose country..."
              />
            </FieldLabel>
            <FieldLabel label="Notes" colors={colors}>
              <TextInput style={[styles.input, styles.textarea, { backgroundColor: colors.muted, color: colors.foreground }]} placeholder="Why does this place call to you?" placeholderTextColor={colors.mutedForeground} value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} multiline numberOfLines={3} textAlignVertical="top" />
            </FieldLabel>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function FieldLabel({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground }}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 14 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  title: { fontSize: 26, fontFamily: 'Inter_700Bold' },
  sub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  addBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20 },
  countryFilterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20 },
  chipTxt: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ideaSection: { marginBottom: 18 },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  sectionSub: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  ideaCard: {
    width: 232,
    height: 184,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#10131F',
    shadowColor: '#26283D',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 5,
  },
  ideaImage: { width: '100%', height: '100%' },
  ideaShade: { ...StyleSheet.absoluteFillObject },
  ideaContent: { position: 'absolute', left: 14, right: 14, bottom: 14 },
  ideaCountry: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14, marginBottom: 7 },
  ideaCountryText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  ideaName: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 3 },
  ideaFact: { color: 'rgba(255,255,255,0.86)', fontSize: 11, lineHeight: 15, fontFamily: 'Inter_600SemiBold' },
  inspirationBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 22, padding: 14, marginBottom: 18 },
  inspirationIcon: { width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  inspirationTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 3 },
  inspirationText: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium' },
  popularSection: { marginBottom: 8 },
  pickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pickCard: { width: '48%', height: 158, borderRadius: 22, overflow: 'hidden', backgroundColor: '#10131F' },
  pickImage: { width: '100%', height: '100%' },
  pickShade: { ...StyleSheet.absoluteFillObject },
  pickContent: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  pickName: { color: '#fff', fontSize: 14, lineHeight: 17, fontFamily: 'Inter_700Bold', marginBottom: 3 },
  pickCountry: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontFamily: 'Inter_700Bold' },
  pickPlus: { position: 'absolute', right: 9, top: 9, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  textarea: { minHeight: 90 },
  photoPicker: { borderRadius: 14, borderWidth: 1, height: 160, overflow: 'hidden' },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoPlaceholderTxt: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  photoOverlay: { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  photoOverlayTxt: { fontSize: 12, color: '#fff', fontFamily: 'Inter_500Medium' },
});
