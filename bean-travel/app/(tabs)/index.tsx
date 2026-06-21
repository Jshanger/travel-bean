import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Ellipse, G, Path } from 'react-native-svg';
import CreateBeanMascot from '@/components/CreateBeanMascot';
import HomeMap from '@/components/HomeMap';
import PremiumModal from '@/components/PremiumModal';
import { lookupCoords } from '@/constants/cityCoords';
import { useApp } from '@/context/AppContext';
import { VisitedPlace } from '@/types';
import { allBeans, beanTitle, formatDate, isUnfinishedBeanDraft, primaryPhoto, SAMPLE_BEANS } from '@/utils/travelBeanMvp';

const INK = '#2A1714';
const MUTED = '#7B6258';
const ORANGE = '#F26A2E';
const PAPER = '#FFF8EF';
const CARD = '#FFFDF8';
const BORDER = '#F1D7C5';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { places, blogPosts, isPremium, canCreateBean, freeBeansRemaining } = useApp();
  const [premiumVisible, setPremiumVisible] = useState(false);
  const [premiumMode, setPremiumMode] = useState<'general' | 'limit'>('general');
  const beans = allBeans(places);
  const mappedBeans = beans.map(enrichHomePlaceCoords).filter(hasCoords);
  const savedCount = places.length;
  const countries = new Set(places.map(bean => bean.country).filter(Boolean)).size;
  const publishedPosts = blogPosts.filter(post => post.status === 'published').length;
  const draft = places.find(isUnfinishedBeanDraft);
  const top = Platform.OS === 'web' ? 56 : insets.top;
  const bottom = Platform.OS === 'web' ? 110 : 110 + insets.bottom;

  function startBean() {
    if (!canCreateBean) {
      setPremiumMode('limit');
      setPremiumVisible(true);
      return;
    }
    router.push('/(tabs)/create');
  }

  function openPremium() {
    setPremiumMode('general');
    setPremiumVisible(true);
  }

  function openJournalEntry(bean: VisitedPlace) {
    router.push({
      pathname: '/(tabs)/journal',
      params: { id: bean.id },
    } as any);
  }

  function openTravelBlog() {
    router.push('/blog' as any);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: top + 14, paddingBottom: bottom }} showsVerticalScrollIndicator={false}>
      <View style={styles.phoneShell}>
      <View style={styles.heroCard}>
        <Text style={styles.heroKicker}>Hi there!</Text>
        <Text style={styles.heroTitle}>Turn your photos into travel stories.</Text>
        <Text style={styles.heroSub}>Add photos. Capture a memory. Create a Bean.</Text>
        <HomeHeroVisual />
        <TouchableOpacity style={styles.primaryButton} onPress={startBean} activeOpacity={0.86}>
          <Feather name="plus" size={32} color="#fff" />
          <Text style={styles.primaryText}>Create a Bean</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.blogButton} onPress={openTravelBlog} activeOpacity={0.86}>
          <Feather name="globe" size={21} color={ORANGE} />
          <Text style={styles.blogButtonText}>My Travel Blog</Text>
        </TouchableOpacity>
        <View style={[styles.sparkle, styles.sparkleLeft]} />
        <View style={[styles.sparkle, styles.sparkleRight]} />
      </View>

      <View style={styles.mapCard}>
        <View style={styles.mapViewport}>
          <HomeMap places={mappedBeans} />
          <View pointerEvents="box-none" style={styles.mapFloatingHeader}>
            <View style={styles.passportBadge}>
              <Feather name="globe" size={16} color="#fff" />
              <Text style={styles.passportBadgeText}>Passport Map</Text>
            </View>
            <TouchableOpacity style={styles.mapOpenButton} onPress={() => router.push('/(tabs)/passport')} activeOpacity={0.85}>
              <Feather name="maximize-2" size={18} color="#183F4A" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.mapInfoPanel}>
          <View style={{ flex: 1 }}>
            <View style={styles.mapTitleRow}>
              <Text style={styles.mapTitle}>Your Map</Text>
              <Feather name="map" size={18} color={INK} />
            </View>
            <Text style={styles.mapCount}>{savedCount} places collected</Text>
            <Text style={styles.mapCountries}>From {countries} countries</Text>
          </View>
          <View style={styles.mapStamp}>
            <Feather name="map-pin" size={18} color={ORANGE} />
          </View>
        </View>
      </View>

      {draft && (
        <TouchableOpacity style={styles.continueCard} onPress={() => router.push('/(tabs)/create')} activeOpacity={0.9}>
          <View style={styles.continueHead}>
            <Text style={styles.sectionTitle}>Continue your memory</Text>
            <Text style={styles.statusPill}>In Progress</Text>
          </View>
          <Image source={{ uri: primaryPhoto(draft) }} style={styles.widePhoto} contentFit="cover" />
          <View style={styles.continueBody}>
            <View style={{ flex: 1 }}>
              <Text style={styles.beanName}>{draft.name}, {draft.country}</Text>
              <Text style={styles.beanSub}>{beanTitle(draft)}</Text>
              <Text style={styles.beanMeta}>Edited just now</Text>
            </View>
            <TouchableOpacity style={styles.outlineButton} onPress={() => router.push('/(tabs)/create')}>
              <Text style={styles.outlineText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Recent Beans</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/journal')}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentStrip}>
        {beans.slice(0, 6).map(bean => (
          <TouchableOpacity key={bean.id} style={styles.recentItem} onPress={() => openJournalEntry(bean)} activeOpacity={0.86}>
            <Image source={{ uri: primaryPhoto(bean) }} style={styles.recentPhoto} contentFit="cover" />
            <View style={styles.heartBadge}><Feather name="heart" size={13} color="#F37C72" /></View>
            <Text style={styles.recentName} numberOfLines={1}>{bean.name}</Text>
            <Text style={styles.recentDate}>{formatDate(bean.dateVisited)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {(places.length > 0 || isPremium) && (
        <View style={styles.premiumCard}>
          <View style={styles.premiumIcon}>
            <Feather name={isPremium ? 'check' : 'star'} size={19} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.premiumTitle}>{isPremium ? 'Travel Blog publishing is on.' : 'Publish your Travel Bean Blog.'}</Text>
            <Text style={styles.premiumBody}>
              {isPremium
                ? 'Create, edit, and publish blog posts from your saved Beans.'
                : 'Create Beans for free. Your first 2 blog posts are included, then Premium unlocks unlimited publishing.'}
            </Text>
            {!isPremium && <Text style={styles.freeCounter}>{freeBeansRemaining} free Bean{freeBeansRemaining === 1 ? '' : 's'} left this month</Text>}
          </View>
          <TouchableOpacity style={styles.premiumButton} onPress={openPremium} activeOpacity={0.86}>
            <Text style={styles.premiumButtonText}>{isPremium ? 'Manage' : 'See Premium'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isPremium && places.length > 0 && (
        <>
          <View style={styles.benefitsCard}>
            <Text style={styles.benefitsTitle}>Premium is for publishing</Text>
            <View style={styles.benefitsGrid}>
              <PremiumBenefit icon="send" title="Unlimited Blog Posts" body="Publish more than the 2 free Travel Bean blog posts." />
              <PremiumBenefit icon="edit-3" title="Fully Editable Blog" body="Edit titles, stories, photos, captions, tags, and drafts." />
              <PremiumBenefit icon="monitor" title="Web Dashboard" body="Manage posts and publishing from a laptop." />
              <PremiumBenefit icon="globe" title="Public Travel Blog" body="Share a clean blog page people can open in any browser." />
              <PremiumBenefit icon="lock" title="Publishing Control" body="Keep entries private until you choose to publish." />
            </View>
          </View>
        </>
      )}

      <View style={styles.howCard}>
        <Text style={styles.howTitle}>How it works</Text>
        <View style={styles.steps}>
          <Step icon="image" label="Add Photos" />
          <Dash />
          <Step icon="message-square" label="Capture Memory" />
          <Dash />
          <Step icon="star" label="Create Bean" />
          <Dash />
          <Step icon="globe" label="Publish Blog" />
        </View>
      </View>

      <TouchableOpacity style={styles.journalCard} onPress={() => router.push('/(tabs)/journal')} activeOpacity={0.86}>
        <View style={styles.bookIcon}>
          <Feather name="book-open" size={31} color="#7D6A4F" />
          <View style={styles.bookHeart}><Feather name="heart" size={12} color="#F37C72" /></View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Your Journal</Text>
          <Text style={styles.journalText}>You have created <Text style={styles.orangeText}>{savedCount}</Text> Bean{savedCount === 1 ? '' : 's'} across {countries} countr{countries === 1 ? 'y' : 'ies'}.</Text>
          <View style={styles.journalStatsRow}>
            <Text style={styles.journalStat}>{savedCount} Bean{savedCount === 1 ? '' : 's'}</Text>
            <Text style={styles.journalStat}>{countries} Countr{countries === 1 ? 'y' : 'ies'}</Text>
            <Text style={styles.journalStat}>{publishedPosts} Blog Post{publishedPosts === 1 ? '' : 's'}</Text>
          </View>
        </View>
        <Feather name="chevron-right" size={26} color={MUTED} />
      </TouchableOpacity>
      </View>
      <PremiumModal visible={premiumVisible} mode={premiumMode} onClose={() => setPremiumVisible(false)} />
    </ScrollView>
  );
}

function Step({ icon, label }: { icon: keyof typeof Feather.glyphMap; label: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepIcon}><Feather name={icon} size={21} color={ORANGE} /></View>
      <Text style={styles.stepLabel}>{label}</Text>
    </View>
  );
}

function Dash() {
  return <View style={styles.dash} />;
}

function PremiumBenefit({ icon, title, body }: { icon: keyof typeof Feather.glyphMap; title: string; body: string }) {
  return (
    <View style={styles.benefitItem}>
      <View style={styles.benefitIcon}><Feather name={icon} size={15} color={ORANGE} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitBody}>{body}</Text>
      </View>
    </View>
  );
}

function HomeHeroVisual() {
  return (
    <View style={styles.heroVisual}>
      <Svg width="100%" height="100%" viewBox="0 0 320 240" style={styles.heroDecor}>
        <G fill="#F4D7AE" opacity={0.28}>
          <Path d="M30 94C40 78 62 82 67 99H22C22 99 24 98 30 94Z" />
          <Path d="M241 83C249 68 270 70 276 87H294C302 87 307 92 309 99H232C234 91 237 86 241 83Z" />
        </G>
        <G stroke="#EAD8C4" strokeWidth="4" strokeLinecap="round" opacity={0.5}>
          <Path d="M42 190C53 176 62 164 66 147" fill="none" />
          <Path d="M62 162C47 161 39 154 35 143" fill="none" />
          <Path d="M58 174C44 176 36 170 31 160" fill="none" />
          <Path d="M267 190C254 174 248 158 247 141" fill="none" />
          <Path d="M250 160C266 157 274 148 277 136" fill="none" />
          <Path d="M253 175C269 176 278 168 283 156" fill="none" />
        </G>
        <G fill="#F2B56A" opacity={0.72}>
          <Path d="M84 116L88 125L97 129L88 133L84 142L80 133L71 129L80 125Z" />
          <Path d="M246 132L249 139L256 142L249 145L246 152L243 145L236 142L243 139Z" />
          <Path d="M61 149L64 156L71 159L64 162L61 169L58 162L51 159L58 156Z" />
        </G>
        <Ellipse cx="160" cy="214" rx="78" ry="11" fill="#EAD6BE" opacity={0.45} />
      </Svg>
      <CreateBeanMascot size={238} frameless bubble="heart" />
    </View>
  );
}

function enrichHomePlaceCoords(place: VisitedPlace): VisitedPlace {
  if (typeof place.latitude === 'number' && typeof place.longitude === 'number') return place;
  const coords = lookupCoords(place.name, place.country) ?? lookupCoords(place.city ?? '', place.country);
  return coords ? { ...place, ...coords } : place;
}

function hasCoords(place: VisitedPlace): place is VisitedPlace & { latitude: number; longitude: number } {
  return typeof place.latitude === 'number' && typeof place.longitude === 'number';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAPER },
  phoneShell: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  noticeDot: { position: 'absolute', top: 8, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: ORANGE },
  heroCard: { marginHorizontal: 0, marginBottom: 20, minHeight: 676, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 16 },
  heroKicker: { color: '#874716', fontSize: 20, fontFamily: 'Inter_500Medium', marginBottom: 10, textAlign: 'center' },
  heroTitle: { color: INK, fontSize: 39, lineHeight: 45, fontFamily: 'Inter_700Bold', marginBottom: 16, textAlign: 'center', maxWidth: 440 },
  heroSub: { color: MUTED, fontSize: 20, lineHeight: 28, fontFamily: 'Inter_500Medium', marginBottom: 18, textAlign: 'center', maxWidth: 430 },
  heroVisual: { width: '100%', height: 290, alignItems: 'center', justifyContent: 'center', marginTop: 0 },
  heroDecor: { position: 'absolute', left: 0, top: 0 },
  primaryButton: { alignSelf: 'center', width: '100%', maxWidth: 438, height: 78, borderRadius: 39, backgroundColor: ORANGE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 22, marginTop: 16, shadowColor: '#D8491E', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.18, shadowRadius: 22, elevation: 6 },
  primaryText: { color: '#fff', fontSize: 25, fontFamily: 'Inter_700Bold' },
  blogButton: { alignSelf: 'center', width: '100%', maxWidth: 438, minHeight: 58, borderRadius: 29, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18, marginTop: 12 },
  blogButtonText: { color: INK, fontSize: 17, fontFamily: 'Inter_700Bold' },
  sparkle: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#F4B66F' },
  sparkleLeft: { left: 64, top: 362 },
  sparkleRight: { right: 54, top: 432 },
  continueCard: { margin: 20, marginBottom: 18, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD },
  continueHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  sectionTitle: { color: INK, fontSize: 24, fontFamily: 'Inter_700Bold' },
  statusPill: { marginLeft: 'auto', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 13, overflow: 'hidden', backgroundColor: '#DBF1E4', color: '#287451', fontFamily: 'Inter_700Bold' },
  widePhoto: { height: 112, borderRadius: 12, backgroundColor: '#EAD2C2' },
  continueBody: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingTop: 12 },
  beanName: { color: INK, fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 5 },
  beanSub: { color: INK, fontSize: 15, fontFamily: 'Inter_500Medium' },
  beanMeta: { color: MUTED, fontSize: 14, marginTop: 3, fontFamily: 'Inter_400Regular' },
  outlineButton: { borderWidth: 2, borderColor: ORANGE, borderRadius: 22, paddingHorizontal: 22, paddingVertical: 11 },
  outlineText: { color: ORANGE, fontSize: 17, fontFamily: 'Inter_700Bold' },
  mapCard: { marginHorizontal: 20, marginBottom: 28, borderRadius: 28, borderWidth: 1, borderColor: '#D8E6F0', backgroundColor: CARD, overflow: 'hidden', shadowColor: '#456477', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 5 },
  mapViewport: { height: 244, backgroundColor: '#C5E4F2', overflow: 'hidden' },
  mapFloatingHeader: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  passportBadge: { height: 45, borderRadius: 23, paddingHorizontal: 17, backgroundColor: '#183F4A', flexDirection: 'row', alignItems: 'center', gap: 9, shadowColor: '#183F4A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 4 },
  passportBadgeText: { color: '#fff', fontSize: 16, fontFamily: 'Inter_700Bold' },
  mapInfoPanel: { minHeight: 112, paddingHorizontal: 18, paddingVertical: 16, backgroundColor: '#FFFDF8', flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderTopColor: '#E5EFF4' },
  mapTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  mapTitle: { color: INK, fontSize: 24, fontFamily: 'Inter_700Bold' },
  mapCount: { color: ORANGE, fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 8 },
  mapCountries: { color: MUTED, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  mapOpenButton: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: '#DDE8EF', backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center', shadowColor: '#183F4A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 4 },
  mapStamp: { width: 54, height: 54, borderRadius: 19, backgroundColor: '#FFF3E9', borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  sectionRow: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { color: ORANGE, fontSize: 17, fontFamily: 'Inter_700Bold' },
  recentStrip: { paddingHorizontal: 20, gap: 16, paddingTop: 16, paddingBottom: 34 },
  recentItem: { width: 128, borderRadius: 18, backgroundColor: CARD, shadowColor: '#8B5B38', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.08, shadowRadius: 18, elevation: 4, paddingBottom: 14 },
  recentPhoto: { width: 128, height: 126, borderTopLeftRadius: 18, borderTopRightRadius: 18, backgroundColor: '#EAD2C2' },
  heartBadge: { position: 'absolute', top: 8, left: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  recentName: { color: INK, fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 12, paddingHorizontal: 10 },
  recentDate: { color: MUTED, fontSize: 15, fontFamily: 'Inter_400Regular', marginTop: 6, paddingHorizontal: 10 },
  premiumCard: { marginHorizontal: 20, marginBottom: 14, borderRadius: 20, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  premiumIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  premiumTitle: { color: INK, fontSize: 17, lineHeight: 22, fontFamily: 'Inter_700Bold' },
  premiumBody: { color: MUTED, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_500Medium', marginTop: 4 },
  freeCounter: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold', marginTop: 7 },
  premiumButton: { minHeight: 40, borderRadius: 20, paddingHorizontal: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  premiumButtonText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  benefitsCard: { marginHorizontal: 20, marginBottom: 18, borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 15 },
  benefitsTitle: { color: INK, fontSize: 19, fontFamily: 'Inter_700Bold', marginBottom: 11 },
  benefitsGrid: { gap: 10 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitIcon: { width: 31, height: 31, borderRadius: 16, backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center' },
  benefitTitle: { color: INK, fontSize: 13, fontFamily: 'Inter_700Bold' },
  benefitBody: { color: MUTED, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', marginTop: 1 },
  howCard: { marginHorizontal: 20, borderWidth: 1, borderColor: BORDER, borderRadius: 18, backgroundColor: CARD, paddingVertical: 16, paddingHorizontal: 10, marginBottom: 14 },
  howTitle: { textAlign: 'center', color: INK, fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  steps: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  step: { flex: 1, minWidth: 0, alignItems: 'center' },
  stepIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#E2BE9F', backgroundColor: '#FFF7EA', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  stepLabel: { color: INK, fontSize: 12, lineHeight: 15, minHeight: 31, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  dash: { width: 18, marginTop: 24, borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#D6A98F', flexShrink: 0 },
  journalCard: { marginHorizontal: 20, minHeight: 94, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, flexDirection: 'row', alignItems: 'center', gap: 15 },
  bookIcon: { width: 62, height: 62, borderRadius: 14, backgroundColor: '#D7D0A4', alignItems: 'center', justifyContent: 'center' },
  bookHeart: { position: 'absolute', right: -5, bottom: 5, width: 25, height: 25, borderRadius: 13, backgroundColor: '#FFF7EF', alignItems: 'center', justifyContent: 'center' },
  journalText: { color: MUTED, marginTop: 4, fontSize: 16, lineHeight: 22, fontFamily: 'Inter_500Medium' },
  journalStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  journalStat: { overflow: 'hidden', borderRadius: 11, backgroundColor: '#FFF1E6', color: ORANGE, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontFamily: 'Inter_700Bold' },
  orangeText: { color: ORANGE, fontFamily: 'Inter_700Bold' },
});
