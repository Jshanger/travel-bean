import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Alert, ImageBackground, Modal, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, useWindowDimensions, View
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TripCard } from '@/components/TripCard';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { buildJourneyTemplateItinerary } from '@/utils/coreFlows';

interface TripForm {
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  travellers: string;
}

const EMPTY_FORM: TripForm = { name: '', destination: '', startDate: '', endDate: '', travellers: '' };
const TRIP_IDEAS = [
  {
    name: 'Tokyo Food & Design Week',
    destination: 'Tokyo, Japan',
    days: 5,
    theme: 'kissaten cafes, ramen counters, gardens, galleries, tiny design shops',
    mood: 'Electric / soft',
    stops: ['Shibuya', 'Daikanyama', 'Kichijoji', 'Yanaka'],
    colors: ['#542CF4', '#18BBD4'],
    photo: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=900&q=80',
    backupPhotos: [
      'https://images.unsplash.com/photo-1554797589-7241bb691973?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1505069446780-4ef442b5207f?auto=format&fit=crop&w=900&q=80',
    ],
    plan: [
      'Arrive in Shibuya, neon walk, late ramen counter.',
      'Daikanyama design stores, bookshop cafe, Ebisu dinner.',
      'Kichijoji, Inokashira Park, Ghibli-side streets and jazz bar.',
      'Yanaka old Tokyo morning, gallery crawl, kissaten notebook hour.',
      'Tsukiji breakfast, teamLab or museum afternoon, final skyline drink.',
    ],
    dayStops: [
      ['Shibuya Crossing', 'Nonbei Yokocho', 'Ichiran Shibuya ramen'],
      ['Daikanyama T-Site', 'Log Road Daikanyama', 'Ebisu Yokocho'],
      ['Inokashira Park', 'Kichijoji Sunroad', 'Sometime Jazz Club'],
      ['Yanaka Ginza', 'Kayaba Coffee', 'Scai The Bathhouse'],
      ['Tsukiji Outer Market', 'teamLab Borderless', 'Shibuya Sky'],
    ],
  },
  {
    name: 'Portugal Coast Sprint',
    destination: 'Lisbon, Portugal',
    days: 6,
    theme: 'miradouros, tiled streets, beaches, seafood, pastel de nata',
    mood: 'Golden / breezy',
    stops: ['Lisbon', 'Sintra', 'Cascais', 'Comporta'],
    colors: ['#FF8A5B', '#542CF4'],
    photo: 'https://images.unsplash.com/photo-1601399470081-29ab3942fd8b?auto=format&fit=crop&w=900&q=80',
    backupPhotos: [
      'https://images.unsplash.com/photo-1508050919630-b135583b29ab?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?auto=format&fit=crop&w=900&q=80',
    ],
    plan: [
      'Alfama arrival walk, sunset at a miradouro, fado dinner.',
      'Belem, LX Factory, tile museum, custard tart comparison.',
      'Sintra palaces, forest paths, seafood by the coast.',
      'Cascais beach morning, Boca do Inferno, train back at golden hour.',
      'Comporta-style slow day: dunes, rice fields, long lunch.',
      'Final Lisbon cafes, viewpoints, gifts, and airport buffer.',
    ],
    dayStops: [
      ['Alfama lanes', 'Miradouro da Senhora do Monte', 'Clube de Fado'],
      ['Mosteiro dos Jeronimos', 'LX Factory', 'Pastéis de Belém'],
      ['Pena Palace', 'Quinta da Regaleira', 'Azenhas do Mar'],
      ['Praia da Conceição', 'Boca do Inferno', 'Cascais old town'],
      ['Comporta dunes', 'Carrasqueira stilt pier', 'Beach seafood lunch'],
      ['Copenhagen Coffee Lab', 'Principe Real', 'Time Out Market'],
    ],
  },
  {
    name: 'Morocco Medina Route',
    destination: 'Marrakech, Morocco',
    days: 7,
    theme: 'riads, souks, gardens, desert night, tea stops',
    mood: 'Textured / warm',
    stops: ['Medina', 'Majorelle', 'Atlas', 'Agafay'],
    colors: ['#E8825A', '#2500FF'],
    photo: 'https://images.unsplash.com/photo-1547473898-39cbd3a1047f?auto=format&fit=crop&w=900&q=80',
    backupPhotos: [
      'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1489493887464-892be6d1daae?auto=format&fit=crop&w=900&q=80',
    ],
    plan: [
      'Riad arrival, medina orientation, rooftop mint tea.',
      'Souk morning, spice market, hammam reset, Jemaa el-Fnaa night.',
      'Majorelle Garden, design museum, slow lunch, ceramics stop.',
      'Atlas foothills day trip, Berber village lunch, mountain road photos.',
      'Agafay desert camp, sunset camel walk, stars and fire dinner.',
      'Return to Marrakech, hidden courtyards, cafe writing hour.',
      'Final market sweep, garden breakfast, relaxed departure.',
    ],
    dayStops: [
      ['Riad check-in', 'Medina orientation walk', 'Nomad rooftop'],
      ['Souk Semmarine', 'Rahba Kedima spice square', 'Jemaa el-Fnaa'],
      ['Jardin Majorelle', 'Yves Saint Laurent Museum', 'Sidi Ghanem ceramics'],
      ['Ourika Valley', 'Setti Fatma village', 'Atlas viewpoint stop'],
      ['Agafay desert camp', 'Camel sunset trail', 'Firelit camp dinner'],
      ['Le Jardin Secret', 'Cafe des Epices', 'Dar el Bacha courtyard'],
      ['Souk des Teinturiers', 'Bahia Palace', 'Riad breakfast'],
    ],
  },
  {
    name: 'Bali Slow Escape',
    destination: 'Ubud, Indonesia',
    days: 8,
    theme: 'rice terraces, waterfalls, temples, cafes, soft mornings',
    mood: 'Lush / reflective',
    stops: ['Ubud', 'Sidemen', 'Uluwatu', 'Canggu'],
    colors: ['#1EC8A5', '#49B8FF'],
    photo: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=900&q=80',
    backupPhotos: [
      'https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=900&q=80',
    ],
    plan: [
      'Arrive in Ubud, villa settle-in, quiet dinner by rice fields.',
      'Tegallalang sunrise, craft villages, cafe journaling.',
      'Waterfall loop, temple visit, early night recovery.',
      'Sidemen drive, valley walk, cooking class or slow lunch.',
      'Transfer south, Uluwatu cliffs, sunset kecak performance.',
      'Beach morning, seafood, photo walk along the coast.',
      'Canggu cafes, boutiques, spa, farewell dinner.',
      'Final swim, coffee, airport buffer.',
    ],
    dayStops: [
      ['Ubud villa check-in', 'Campuhan Ridge Walk', 'Sari Organik dinner'],
      ['Tegallalang Rice Terrace', 'Tirta Empul Temple', 'Seniman Coffee Studio'],
      ['Tibumana Waterfall', 'Goa Gajah', 'Ubud Market'],
      ['Sidemen rice valley', 'Telaga Waja viewpoint', 'Balinese cooking class'],
      ['Uluwatu Temple', 'Karang Boma Cliff', 'Kecak fire dance'],
      ['Padang Padang Beach', 'Jimbaran seafood', 'Bingin cliff walk'],
      ['Canggu cafes', 'Love Anchor market', 'Spa and farewell dinner'],
      ['Pererenan beach swim', 'BGS Coffee', 'Airport transfer'],
    ],
  },
  {
    name: 'Seoul Memory Weekend',
    destination: 'Seoul, South Korea',
    days: 4,
    theme: 'markets, design shops, palaces, night walks, photo booths',
    mood: 'Neon / nostalgic',
    stops: ['Ikseon', 'Hongdae', 'Seongsu', 'Namsan'],
    colors: ['#11131D', '#8B5CF6'],
    photo: 'https://upload.wikimedia.org/wikipedia/commons/7/79/Streets_of_Seoul_%28Unsplash%29.jpg',
    backupPhotos: [
      'https://images.unsplash.com/photo-1538485399081-7c8ba554c762?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1517154421773-0529f29ea451?auto=format&fit=crop&w=900&q=80',
    ],
    plan: [
      'Ikseon-dong hanok lanes, cafe stop, Gwangjang Market dinner.',
      'Palace morning, Bukchon walk, Insadong tea and stationery.',
      'Seongsu design stores, Seoul Forest, Hongdae night energy.',
      'Namsan view, Myeongdong snacks, final photo booth strip.',
    ],
    dayStops: [
      ['Ikseon-dong Hanok Street', 'Cheongsudang Cafe', 'Gwangjang Market'],
      ['Gyeongbokgung Palace', 'Bukchon Hanok Village', 'Insadong tea house'],
      ['Seongsu design shops', 'Seoul Forest', 'Hongdae street music'],
      ['N Seoul Tower', 'Myeongdong snack street', 'Photo booth studio'],
    ],
  },
] as const;

type TripIdea = typeof TRIP_IDEAS[number];

export default function TripsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { trips, addTrip, deleteTrip } = useApp();

  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<TripForm>(EMPTY_FORM);
  const [selectedIdea, setSelectedIdea] = useState<TripIdea | null>(null);
  const [ideaImageIndex, setIdeaImageIndex] = useState<Record<string, number>>({});
  const [planPickerVisible, setPlanPickerVisible] = useState(false);

  const todayKey = toYMD(new Date());
  const upcoming = trips.filter(t => t.startDate >= todayKey);
  const past = trips.filter(t => t.startDate < todayKey);
  const activeTrips = trips.filter(t => t.itinerary.length > 0).length;
  const savedStops = trips.reduce((sum, trip) => sum + trip.itinerary.length, 0);
  const isWide = width >= 840;

  const topPt = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPb = Platform.OS === 'web' ? 34 + 84 : 84 + insets.bottom;

  async function handleSave() {
    if (!form.name.trim() || !form.destination.trim()) return;
    const travellers = form.travellers ? form.travellers.split(',').map(s => s.trim()).filter(Boolean) : ['You'];
    await addTrip({
      name: form.name,
      destination: form.destination,
      startDate: form.startDate,
      endDate: form.endDate,
      travellers,
      itinerary: selectedIdea ? buildIdeaItinerary(selectedIdea) : [],
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModalVisible(false);
    setForm(EMPTY_FORM);
    setSelectedIdea(null);
  }
  function handleDelete(id: string) {
    Alert.alert('Delete Trip', 'Remove this Trip and its itinerary?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteTrip(id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } },
    ]);
  }
  function openIdea(idea: typeof TRIP_IDEAS[number]) {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + idea.days - 1);
    setPlanPickerVisible(false);
    setSelectedIdea(idea);
    setForm({ name: idea.name, destination: idea.destination, startDate: toYMD(start), endDate: toYMD(end), travellers: 'You' });
    setModalVisible(true);
  }

  function ideaPhotoSource(idea: TripIdea, indexes: Record<string, number>) {
    const photos = [idea.photo, ...(idea.backupPhotos ?? [])];
    const index = indexes[idea.name] ?? 0;
    const uri = photos[index] ?? idea.photo;
    return { uri };
  }

  function advanceIdeaPhoto(idea: TripIdea) {
    setIdeaImageIndex(previous => {
      const currentIndex = previous[idea.name] ?? 0;
      const remotePhotoCount = [idea.photo, ...(idea.backupPhotos ?? [])].length;
      if (currentIndex >= remotePhotoCount - 1) return previous;
      return { ...previous, [idea.name]: currentIndex + 1 };
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: bottomPb }} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#10002B', '#4626F2', '#16BBD8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: topPt + 12 }, isWide && styles.heroWide]}
        >
          <Svg width="100%" height="100%" viewBox="0 0 360 260" style={styles.heroArt}>
            <Path d="M-20 188 C56 130 126 222 206 170 C278 124 316 158 390 120 L390 300 L-20 300 Z" fill="#FFFFFF" opacity="0.95" />
            <Circle cx="282" cy="64" r="42" stroke="#FFFFFF" strokeWidth="1.6" opacity="0.2" fill="none" />
            <Circle cx="282" cy="64" r="64" stroke="#FFFFFF" strokeWidth="1.4" opacity="0.12" fill="none" />
            <Path d="M42 78 C92 36 144 80 198 48 C242 22 286 42 336 28" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="5 9" opacity="0.36" fill="none" />
            <Path d="M58 154 C112 110 166 142 218 108 C260 80 298 94 342 74" stroke="#F6C85F" strokeWidth="2.4" strokeDasharray="4 9" opacity="0.62" fill="none" />
          </Svg>

          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroKicker}>Trips</Text>
              <Text style={styles.heroTitle}>Build the route before you go</Text>
              <Text style={styles.heroText}>Plan days, stops, notes, travellers, and itinerary ideas in one focused travel workspace.</Text>
            </View>
            <TouchableOpacity style={styles.heroAddBtn} onPress={() => { setSelectedIdea(null); setForm(EMPTY_FORM); setModalVisible(true); }} activeOpacity={0.86}>
              <Feather name="plus" size={24} color="#11131D" />
            </TouchableOpacity>
          </View>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}><Text style={styles.heroStatValue}>{upcoming.length}</Text><Text style={styles.heroStatLabel}>Upcoming</Text></View>
            <View style={styles.heroStat}><Text style={styles.heroStatValue}>{savedStops}</Text><Text style={styles.heroStatLabel}>Stops</Text></View>
            <View style={styles.heroStat}><Text style={styles.heroStatValue}>{activeTrips}</Text><Text style={styles.heroStatLabel}>Trips</Text></View>
          </View>
        </LinearGradient>

        <View style={styles.ideaSection}>
          <View style={styles.ideaHead}>
            <Text style={[styles.ideaTitle, { color: colors.foreground }]}>Trip Suggestions</Text>
            <Text style={[styles.ideaSub, { color: colors.mutedForeground }]}>Full starter itineraries with day-by-day stops and room to make them yours.</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingRight: 20 }} style={{ marginRight: -20 }}>
            {TRIP_IDEAS.map(idea => {
              const photoContent = (
                <LinearGradient colors={['rgba(7,10,22,0.05)', 'rgba(7,10,22,0.88)']} style={styles.ideaPhotoShade}>
                  <View style={styles.ideaTopRow}>
                    <View style={styles.ideaIcon}>
                      <Feather name="map" size={18} color="#fff" />
                    </View>
                    <Text style={styles.ideaDays}>{idea.days} days</Text>
                  </View>
                  <Text style={styles.ideaBean}>Trip plan</Text>
                  <Text style={styles.ideaName}>{idea.name}</Text>
                  <Text style={styles.ideaMeta}>{idea.destination} · {idea.mood}</Text>
                </LinearGradient>
              );
              return (
                <TouchableOpacity key={idea.name} activeOpacity={0.86} onPress={() => openIdea(idea)}>
                  <View style={[styles.ideaCard, { backgroundColor: colors.card }]}>
                    <ImageBackground
                      source={ideaPhotoSource(idea, ideaImageIndex)}
                      style={styles.ideaPhoto}
                      imageStyle={styles.ideaPhotoImage}
                      onError={() => advanceIdeaPhoto(idea)}
                    >
                      {photoContent}
                    </ImageBackground>

                    <View style={styles.ideaBody}>
                      <Text style={[styles.ideaTheme, { color: colors.foreground }]}>{idea.theme}</Text>
                      <View style={styles.stopRow}>
                        {idea.stops.map(stop => <Text key={stop} style={styles.stopChip}>{stop}</Text>)}
                      </View>
                      <View style={styles.planList}>
                        {idea.plan.map((day, index) => (
                          <View key={day} style={styles.planRow}>
                            <LinearGradient colors={idea.colors} style={styles.planDayDot}>
                              <Text style={styles.planDayText}>{index + 1}</Text>
                            </LinearGradient>
                            <Text style={[styles.planDayCopy, { color: colors.mutedForeground }]} numberOfLines={2}>{day}</Text>
                          </View>
                        ))}
                      </View>
                      <View style={styles.ideaFooter}>
                        <View style={styles.routeMini}>
                          {idea.stops.slice(0, 4).map((stop, index) => (
                            <React.Fragment key={stop}>
                              <View style={[styles.routeDot, { backgroundColor: idea.colors[index % idea.colors.length] }]} />
                              {index < Math.min(idea.stops.length, 4) - 1 && <View style={styles.routeLine} />}
                            </React.Fragment>
                          ))}
                        </View>
                        <LinearGradient colors={idea.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ideaAction}>
                          <Text style={styles.ideaActionText}>Start Trip</Text>
                          <Feather name="arrow-right" size={13} color="#fff" />
                        </LinearGradient>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        {trips.length === 0 ? (
          <View style={styles.emptyStudio}>
            <View style={styles.emptyIconStack}>
              <LinearGradient colors={['#6E35FF', '#24D6B7']} style={styles.emptyIconMain}>
                <Feather name="briefcase" size={28} color="#fff" />
              </LinearGradient>
              <View style={styles.emptySpark}><Feather name="map-pin" size={14} color="#542CF4" /></View>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Trips yet</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Start with a suggested itinerary or create a blank Trip to plan routes, days, notes, places, and travellers.</Text>
            <View style={styles.emptyActions}>
              <TouchableOpacity style={[styles.emptyPrimary, { backgroundColor: colors.primary }]} onPress={() => { setSelectedIdea(null); setForm(EMPTY_FORM); setModalVisible(true); }}>
                <Feather name="plus" size={16} color="#fff" />
                <Text style={styles.emptyPrimaryText}>Create Trip</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.emptySecondary, { borderColor: colors.border }]} onPress={() => setPlanPickerVisible(true)}>
                <Text style={[styles.emptySecondaryText, { color: colors.foreground }]}>Use trip plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <Text style={[styles.section, { color: colors.mutedForeground }]}>Upcoming Trips</Text>
                {upcoming.map(t => <TripCard key={t.id} trip={t} onDelete={() => handleDelete(t.id)} />)}
              </>
            )}
            {past.length > 0 && (
              <>
                <Text style={[styles.section, { color: colors.mutedForeground }]}>Past Trips</Text>
                {past.map(t => <TripCard key={t.id} trip={t} onDelete={() => handleDelete(t.id)} />)}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={planPickerVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setPlanPickerVisible(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setPlanPickerVisible(false)}>
              <Text style={[styles.cancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Choose a trip plan</Text>
            <View style={{ width: 52 }} />
          </View>
          <ScrollView contentContainerStyle={styles.planPickerContent} showsVerticalScrollIndicator={false}>
            <Text style={[styles.planPickerIntro, { color: colors.mutedForeground }]}>
              Pick a starter itinerary. Each one creates real day-by-day stops, notes, and route items.
            </Text>
            {TRIP_IDEAS.map(idea => {
              return (
                <TouchableOpacity key={idea.name} activeOpacity={0.88} onPress={() => openIdea(idea)}>
                  <View style={[styles.planPickCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <ImageBackground
                      source={ideaPhotoSource(idea, ideaImageIndex)}
                      style={styles.planPickCover}
                      imageStyle={styles.planPickCoverImage}
                      onError={() => advanceIdeaPhoto(idea)}
                    >
                      <LinearGradient colors={['rgba(7,10,22,0.08)', 'rgba(7,10,22,0.58)']} style={styles.planPickCoverShade} />
                    </ImageBackground>
                    <View style={styles.planPickBody}>
                      <View style={styles.planPickTop}>
                        <Text style={[styles.planPickName, { color: colors.foreground }]} numberOfLines={2}>{idea.name}</Text>
                        <Text style={styles.planPickDays}>{idea.days} days</Text>
                      </View>
                      <Text style={[styles.planPickMeta, { color: colors.mutedForeground }]}>{idea.destination} · {idea.mood}</Text>
                      <Text style={[styles.planPickTheme, { color: colors.foreground }]} numberOfLines={2}>{idea.theme}</Text>
                      <View style={styles.planPickStops}>
                        {idea.stops.slice(0, 4).map(stop => (
                          <Text key={stop} style={styles.stopChip}>{stop}</Text>
                        ))}
                      </View>
                      <View style={styles.planPickAction}>
                        <Text style={styles.planPickActionText}>Use this trip plan</Text>
                        <Feather name="arrow-right" size={15} color="#542CF4" />
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={[styles.cancel, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Trip</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={[styles.save, { color: colors.primary }]}>Create</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            {([
              { label: 'Trip Name *', key: 'name', placeholder: 'e.g. Japan Spring Trip' },
              { label: 'Destination *', key: 'destination', placeholder: 'e.g. Japan' },
              { label: 'Start Date', key: 'startDate', placeholder: 'YYYY-MM-DD' },
              { label: 'End Date', key: 'endDate', placeholder: 'YYYY-MM-DD' },
              { label: 'Travellers (comma separated)', key: 'travellers', placeholder: 'You, Sarah, Marco' },
            ] as Array<{ label: string; key: keyof TripForm; placeholder: string }>).map(({ label, key, placeholder }) => (
              <View key={key} style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground }}>{label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]}
                  placeholder={placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  value={form[key]}
                  onChangeText={v => setForm(f => ({ ...f, [key]: v }))}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function toYMD(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildIdeaItinerary(idea: TripIdea) {
  return buildJourneyTemplateItinerary(idea);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { fontSize: 13, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },
  hero: {
    minHeight: 330,
    borderRadius: 34,
    padding: 20,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: '#2500FF',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 8,
  },
  heroWide: { minHeight: 300, padding: 26 },
  heroArt: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 18, zIndex: 2 },
  heroKicker: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  heroTitle: { color: '#fff', fontSize: 34, lineHeight: 39, fontFamily: 'Inter_700Bold', maxWidth: 520, marginTop: 6 },
  heroText: { color: 'rgba(255,255,255,0.76)', fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium', marginTop: 10, maxWidth: 470 },
  heroAddBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  heroStats: { zIndex: 2, flexDirection: 'row', gap: 10, marginTop: 28, flexWrap: 'wrap' },
  heroStat: {
    minWidth: 102,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroStatValue: { color: '#fff', fontSize: 24, fontFamily: 'Inter_700Bold' },
  heroStatLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontFamily: 'Inter_700Bold', marginTop: 2 },
  ideaSection: { marginBottom: 24 },
  ideaHead: { marginBottom: 10 },
  ideaTitle: { fontSize: 19, fontFamily: 'Inter_700Bold' },
  ideaSub: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_500Medium', marginTop: 2 },
  ideaCard: {
    width: 360,
    height: 650,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#2500FF',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 6,
  },
  ideaPhoto: { height: 188, justifyContent: 'flex-end' },
  ideaPhotoImage: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  ideaPhotoShade: { flex: 1, justifyContent: 'flex-end', padding: 18 },
  ideaTopRow: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ideaIcon: { width: 44, height: 44, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  ideaDays: {
    color: '#11131D',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    overflow: 'hidden',
  },
  ideaBean: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 7 },
  ideaName: { fontSize: 24, lineHeight: 28, fontFamily: 'Inter_700Bold', color: '#fff' },
  ideaMeta: { fontSize: 12, fontFamily: 'Inter_700Bold', color: 'rgba(255,255,255,0.78)', marginTop: 5 },
  ideaBody: { flex: 1, padding: 16, gap: 12 },
  ideaTheme: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_700Bold' },
  stopRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  stopChip: { color: '#1B2033', fontSize: 11, fontFamily: 'Inter_700Bold', backgroundColor: 'rgba(84,44,244,0.08)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  planList: { flex: 1, gap: 8 },
  planRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  planDayDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  planDayText: { color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' },
  planDayCopy: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold' },
  ideaFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  routeMini: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  routeDot: { width: 8, height: 8, borderRadius: 4 },
  routeLine: { height: 2, flex: 1, backgroundColor: 'rgba(150,154,170,0.28)' },
  ideaAction: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  ideaActionText: { fontSize: 12, fontFamily: 'Inter_700Bold', color: '#fff' },
  emptyStudio: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 32,
    padding: 26,
    minHeight: 320,
    backgroundColor: 'rgba(255,255,255,0.54)',
    borderWidth: 1,
    borderColor: 'rgba(150,154,170,0.18)',
  },
  emptyIconStack: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyIconMain: { width: 74, height: 74, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  emptySpark: {
    position: 'absolute',
    right: 4,
    top: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  emptyTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', textAlign: 'center', marginTop: 2 },
  emptyText: { fontSize: 14, lineHeight: 21, fontFamily: 'Inter_500Medium', textAlign: 'center', maxWidth: 430, marginTop: 8 },
  emptyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 18 },
  emptyPrimary: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12 },
  emptyPrimaryText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  emptySecondary: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12 },
  emptySecondaryText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  cancel: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  save: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  planPickerContent: { padding: 18, paddingBottom: 36, gap: 14 },
  planPickerIntro: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', marginBottom: 2 },
  planPickCard: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#2500FF',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 5,
  },
  planPickCover: { height: 132, overflow: 'hidden' },
  planPickCoverImage: { borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  planPickCoverShade: { flex: 1 },
  planPickBody: { padding: 16, gap: 9 },
  planPickTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planPickName: { flex: 1, fontSize: 20, lineHeight: 24, fontFamily: 'Inter_700Bold' },
  planPickDays: {
    color: '#11131D',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  planPickMeta: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  planPickTheme: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_600SemiBold' },
  planPickStops: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  planPickAction: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  planPickActionText: { color: '#542CF4', fontSize: 13, fontFamily: 'Inter_700Bold' },
});
