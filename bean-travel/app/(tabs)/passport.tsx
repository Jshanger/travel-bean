import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PlacesMap from '@/components/PlacesMap';
import { lookupCoords } from '@/constants/cityCoords';
import { useApp } from '@/context/AppContext';
import { VisitedPlace } from '@/types';
import { allBeans, beanTitle, formatDate, primaryPhoto } from '@/utils/travelBeanMvp';

const INK = '#25283D';
const MUTED = '#8A8FA1';
const ORANGE = '#F26A2E';
const BLUE = '#AFC8FF';
const CARD = '#F8FAFF';
const BORDER = '#E0E7F6';

export default function PassportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; placeId?: string }>();
  const insets = useSafeAreaInsets();
  const { places } = useApp();
  const beans = useMemo(() => allBeans(places).map(enrichPlaceCoords), [places]);
  const mappedBeans = useMemo(() => beans.filter(hasCoords), [beans]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? mappedBeans.find(place => place.id === selectedId) : undefined;
  const countries = new Set(mappedBeans.map(place => place.country)).size;
  const top = Platform.OS === 'web' ? 0 : insets.top;
  const bottom = Platform.OS === 'web' ? 96 : 96 + insets.bottom;

  function openInMaps(place: VisitedPlace) {
    const query = encodeURIComponent(`${place.name}, ${place.country}`);
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?q=${query}`
      : `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url);
  }

  function openJournalEntry(place: VisitedPlace) {
    router.push({
      pathname: '/(tabs)/journal',
      params: { id: place.id, from: 'passport' },
    } as any);
  }

  useEffect(() => {
    const requestedId = routeParam(params.id) ?? routeParam(params.placeId);
    if (requestedId && mappedBeans.some(place => place.id === requestedId)) {
      setSelectedId(requestedId);
      return;
    }
    if (selectedId && !mappedBeans.some(place => place.id === selectedId)) setSelectedId(null);
  }, [mappedBeans, params.id, params.placeId, selectedId]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: top, paddingBottom: bottom }} showsVerticalScrollIndicator={false}>
      <View style={styles.mapHero}>
        <PlacesMap
          places={mappedBeans}
          selectedPlaceId={selected?.id ?? null}
          onPlacePress={place => setSelectedId(place.id)}
        />
        <View pointerEvents="none" style={styles.mapBlueWash} />
        <View style={styles.mapHeader}>
          <TouchableOpacity style={styles.passportBadge} onPress={() => router.back()} activeOpacity={0.85}>
            <Feather name="globe" size={18} color="#fff" />
            <Text style={styles.passportBadgeText}>Passport Map</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Go to Home"
            style={styles.homeMapButton}
            onPress={() => router.push('/(tabs)')}
            activeOpacity={0.85}
          >
            <Feather name="home" size={22} color="#183F4A" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.title}>Your Places</Text>
            <Text style={styles.subtitle}>{mappedBeans.length} Places · {countries} {countries === 1 ? 'country' : 'countries'}</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(tabs)/create')} activeOpacity={0.86}>
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {selected ? (
          <View style={styles.featuredCard}>
            <Image source={{ uri: primaryPhoto(selected) }} style={styles.featuredImage} contentFit="cover" />
            <View style={styles.featuredBody}>
              <View style={styles.featuredTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featuredPlace}>{selected.name}, {selected.country}</Text>
                  <Text style={styles.featuredDate}>{formatDate(selected.dateVisited)}</Text>
                </View>
                <View style={styles.livePill}>
                  <Feather name="map-pin" size={12} color={ORANGE} />
                  <Text style={styles.livePillText}>On map</Text>
                </View>
              </View>
              <Text style={styles.featuredStory} numberOfLines={2}>{beanTitle(selected)}</Text>
              <View style={styles.featuredActions}>
                <TouchableOpacity style={styles.secondaryButton} onPress={() => openInMaps(selected)} activeOpacity={0.86}>
                  <Feather name="navigation" size={15} color={INK} />
                  <Text style={styles.secondaryButtonText}>Open Maps</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryButton} onPress={() => openJournalEntry(selected)} activeOpacity={0.86}>
                  <Feather name="book-open" size={15} color="#fff" />
                  <Text style={styles.primaryButtonText}>View Entry</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Feather name="map" size={30} color="#fff" />
            </View>
            <Text style={styles.emptyTitle}>{mappedBeans.length ? 'All visited places' : 'Where have you been?'}</Text>
            <Text style={styles.emptyText}>
              {mappedBeans.length
                ? 'Tap any pin or place below to highlight it on the map and open the matching journal entry.'
                : 'Create a Bean with a place to pin your first memory on the map.'}
            </Text>
          </View>
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionKicker}>Collected places</Text>
          <Text style={styles.sectionCount}>{mappedBeans.length}</Text>
        </View>
        <View style={styles.placeList}>
          {mappedBeans.map(place => {
            const active = place.id === selected?.id;
            return (
              <View
                key={place.id}
                style={[styles.placeRow, active && styles.placeRowActive]}
              >
                <TouchableOpacity style={styles.placeRowSelect} onPress={() => setSelectedId(place.id)} activeOpacity={0.84}>
                  <Image source={{ uri: primaryPhoto(place) }} style={styles.rowImage} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{place.name}</Text>
                    <Text style={styles.rowMeta} numberOfLines={1}>{place.country} · {formatDate(place.dateVisited)}</Text>
                  </View>
                  <Feather name={active ? 'check-circle' : 'map-pin'} size={20} color={active ? ORANGE : MUTED} />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel={`Open ${place.name} journal entry`}
                  style={[styles.rowJournalButton, active && styles.rowJournalButtonActive]}
                  onPress={() => openJournalEntry(place)}
                  activeOpacity={0.84}
                >
                  <Feather name="book-open" size={17} color={active ? '#fff' : ORANGE} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

function enrichPlaceCoords(place: VisitedPlace): VisitedPlace {
  if (typeof place.latitude === 'number' && typeof place.longitude === 'number') return place;
  const coords = lookupCoords(place.name, place.country)
    ?? lookupCoords(place.city ?? '', place.country)
    ?? lookupCoords(place.country, place.country);
  return coords ? { ...place, ...coords } : place;
}

function hasCoords(place: VisitedPlace): place is VisitedPlace & { latitude: number; longitude: number } {
  return typeof place.latitude === 'number' && typeof place.longitude === 'number';
}

function routeParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FF' },
  mapHero: { height: 430, overflow: 'hidden', backgroundColor: BLUE },
  mapBlueWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(128,160,238,0.22)' },
  mapHeader: { position: 'absolute', top: 56, left: 24, right: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  passportBadge: { minHeight: 58, borderRadius: 29, paddingHorizontal: 22, backgroundColor: '#163D47', flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#111827', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.14, shadowRadius: 22, elevation: 8 },
  passportBadgeText: { color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold' },
  homeMapButton: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', shadowColor: '#111827', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 7 },
  sheet: { marginTop: -28, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: CARD, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 28, borderTopWidth: 1, borderColor: BORDER },
  handle: { width: 72, height: 8, borderRadius: 4, backgroundColor: '#DCE5ED', alignSelf: 'center', marginBottom: 24 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title: { color: INK, fontSize: 34, lineHeight: 39, fontFamily: 'Inter_700Bold' },
  subtitle: { color: MUTED, fontSize: 16, fontFamily: 'Inter_700Bold', marginTop: 5 },
  addButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  featuredCard: { borderRadius: 24, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff', overflow: 'hidden', shadowColor: '#66739A', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.1, shadowRadius: 22, elevation: 5 },
  featuredImage: { width: '100%', height: 170, backgroundColor: '#DDE8F3' },
  featuredBody: { padding: 16 },
  featuredTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  featuredPlace: { color: INK, fontSize: 20, fontFamily: 'Inter_700Bold' },
  featuredDate: { color: MUTED, fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 3 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FFF1E6' },
  livePillText: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold' },
  featuredStory: { color: '#4E5366', fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium', marginBottom: 14 },
  featuredActions: { flexDirection: 'row', gap: 10 },
  secondaryButton: { flex: 1, minHeight: 46, borderRadius: 23, borderWidth: 1, borderColor: BORDER, backgroundColor: '#F8FAFF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  secondaryButtonText: { color: INK, fontSize: 14, fontFamily: 'Inter_700Bold' },
  primaryButton: { flex: 1, minHeight: 46, borderRadius: 23, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  emptyCard: { borderRadius: 24, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff', padding: 24 },
  emptyIcon: { width: 74, height: 74, borderRadius: 20, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { color: INK, fontSize: 25, fontFamily: 'Inter_700Bold', marginBottom: 7 },
  emptyText: { color: MUTED, fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 },
  sectionKicker: { color: '#9AA0B2', fontSize: 15, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Inter_700Bold' },
  sectionCount: { color: ORANGE, fontSize: 15, fontFamily: 'Inter_700Bold' },
  placeList: { gap: 10 },
  placeRow: { borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff', padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  placeRowActive: { borderColor: ORANGE, backgroundColor: '#FFF8EF' },
  placeRowSelect: { flex: 1, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowJournalButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#FFD7C1', backgroundColor: '#FFF4EA', alignItems: 'center', justifyContent: 'center' },
  rowJournalButtonActive: { borderColor: ORANGE, backgroundColor: ORANGE },
  rowImage: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#DDE8F3' },
  rowTitle: { color: INK, fontSize: 16, fontFamily: 'Inter_700Bold' },
  rowMeta: { color: MUTED, fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 3 },
});
