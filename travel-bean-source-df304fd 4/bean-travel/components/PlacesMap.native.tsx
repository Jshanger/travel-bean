import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PassportMapPreview from '@/components/PassportMapPreview';
import { resolvePlaceCoordinates } from '@/constants/cityCoords';
import { VisitedPlace } from '@/types';

interface Props {
  places: VisitedPlace[];
  selectedPlaceId?: string | null;
  onPlacePress?: (place: VisitedPlace) => void;
  variant?: 'full' | 'home';
}

export default function PlacesMap({ places, selectedPlaceId, onPlacePress }: Props) {
  const mapped = places
    .map(place => {
      const coords = resolvePlaceCoordinates(place);
      return coords ? { ...place, ...coords } : null;
    })
    .filter((place): place is VisitedPlace & { latitude: number; longitude: number } => Boolean(place));

  return (
    <View style={styles.container}>
      <PassportMapPreview places={mapped} selectedPlaceId={selectedPlaceId} onPlacePress={onPlacePress} />
      <View pointerEvents="none" style={styles.badge}>
        <Text style={styles.badgeTitle}>Passport Map</Text>
        <Text style={styles.badgeMeta}>
          {mapped.length} {mapped.length === 1 ? 'place' : 'places'} pinned
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#D9EFF7' },
  badge: {
    position: 'absolute',
    left: 18,
    bottom: 18,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,253,248,0.94)',
    shadowColor: '#183F4A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  badgeTitle: { color: '#183F4A', fontSize: 14, fontFamily: 'Inter_700Bold' },
  badgeMeta: { color: '#6B7F87', fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
});
