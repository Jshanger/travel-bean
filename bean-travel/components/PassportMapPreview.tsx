import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { COUNTRY_COORDS, countryToPath } from '@/constants/countryPaths';
import { resolvePlaceCoordinates } from '@/constants/cityCoords';
import { VisitedPlace } from '@/types';

interface Props {
  places: VisitedPlace[];
  selectedPlaceId?: string | null;
  onPlacePress?: (place: VisitedPlace) => void;
}

export default function PassportMapPreview({ places, selectedPlaceId, onPlacePress }: Props) {
  const countries = useMemo(
    () => Object.entries(COUNTRY_COORDS).map(([name, rings]) => ({ name, path: countryToPath(rings) })),
    [],
  );
  const markers = useMemo(() => places
    .map(place => {
      const coords = resolvePlaceCoordinates(place);
      return coords ? { ...place, ...coords } : null;
    })
    .filter((place): place is VisitedPlace & { latitude: number; longitude: number } => Boolean(place))
    .slice(0, 36), [places]);
  const markerPositions = useMemo(() => projectMarkers(markers), [markers]);
  const markerItems = useMemo(() => markers
    .map((place, index) => ({
      place,
      active: place.id === selectedPlaceId,
      position: markerPositions[index],
    }))
    .filter(item => Boolean(item.position))
    .sort((a, b) => Number(a.active) - Number(b.active)), [markerPositions, markers, selectedPlaceId]);
  const selectedMarker = markerItems.find(item => item.active);
  const viewBox = selectedMarker ? focusViewBox(selectedMarker.position) : '0 0 360 180';
  const mapKey = selectedPlaceId ?? 'all-places';

  return (
    <View style={styles.container}>
      <Svg key={mapKey} width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
        <Rect x="0" y="0" width="360" height="180" fill="#D9EFF7" />
        <G opacity={0.72}>
          <Path d="M0 34H360M0 90H360M0 146H360" stroke="#FFFFFF" strokeWidth="0.45" />
          <Path d="M60 0V180M180 0V180M300 0V180" stroke="#FFFFFF" strokeWidth="0.45" />
        </G>
        <G>
          {countries.map(country => (
            <Path
              key={country.name}
              d={country.path}
              fill="#AFC8BE"
              stroke="#F7FBF7"
              strokeWidth="0.42"
            />
          ))}
        </G>
        {markerItems.map(({ place, active, position }) => {
          const { x, y } = position;
          return (
            <G key={place.id} transform={`translate(${x} ${y})`} onPress={() => onPlacePress?.(place)}>
              {active && (
                <>
                  <Circle cx="0" cy="-1" r="16" fill="#F26A2E" opacity={0.18} />
                  <Circle cx="0" cy="-1" r="11.5" fill="none" stroke="#FFFDF8" strokeWidth="2.6" opacity={0.95} />
                  <Rect x="-24" y="-29" width="48" height="12" rx="6" fill="#FFFDF8" opacity={0.95} />
                  <Path d="M-3 -17L0 -13L3 -17Z" fill="#FFFDF8" opacity={0.95} />
                  <Path d="M-13.5 -22H13.5" stroke="#F26A2E" strokeWidth="2.2" strokeLinecap="round" />
                </>
              )}
              <Circle cx="0" cy="0" r={active ? 8.8 : 7.2} fill="#FFFFFF" opacity={active ? 0.96 : 0.78} />
              <Path
                d="M0 8C-1.8 4.8-6.2 1.4-6.2-3.5A6.2 6.2 0 0 1 6.2-3.5C6.2 1.4 1.8 4.8 0 8Z"
                fill={active ? '#183F4A' : '#F26A2E'}
                stroke="#FFFFFF"
                strokeWidth={active ? '1.7' : '1.25'}
              />
              <Circle cx="0" cy="-3.3" r={active ? '2.45' : '2.1'} fill="#FFFFFF" />
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function projectMarkers(places: Array<VisitedPlace & { latitude: number; longitude: number }>) {
  const groups = new Map<string, Array<{ place: VisitedPlace & { latitude: number; longitude: number }; index: number }>>();

  places.forEach((place, index) => {
    const key = `${place.latitude.toFixed(3)}:${place.longitude.toFixed(3)}`;
    const group = groups.get(key) ?? [];
    group.push({ place, index });
    groups.set(key, group);
  });

  return places.map((place, index) => {
    const key = `${place.latitude.toFixed(3)}:${place.longitude.toFixed(3)}`;
    const group = groups.get(key) ?? [];
    const groupIndex = Math.max(0, group.findIndex(item => item.index === index));
    const groupCount = group.length;
    const radius = groupCount > 1 ? Math.min(6.2, 2.4 + groupCount * 0.45) : 0;
    const angle = groupCount > 1 ? ((Math.PI * 2) / groupCount) * groupIndex - Math.PI / 2 : 0;
    const hash = hashString(`${place.id}-${place.name}-${index}`);
    const jitterX = groupCount > 1 ? Math.cos(angle) * radius : ((hash % 5) - 2) * 0.75;
    const jitterY = groupCount > 1 ? Math.sin(angle) * radius : (((Math.floor(hash / 5) % 5) - 2) * 0.65);
    const x = clamp(((place.longitude + 180) / 360) * 360 + jitterX, 8, 352);
    const y = clamp(((90 - place.latitude) / 180) * 180 + jitterY, 8, 172);
    return { x, y };
  });
}

function hashString(value: string) {
  return value.split('').reduce((total, char) => ((total << 5) - total + char.charCodeAt(0)) >>> 0, 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function focusViewBox(position: { x: number; y: number }) {
  const width = 190;
  const height = 118;
  const x = clamp(position.x - width / 2, 0, 360 - width);
  const y = clamp(position.y - height / 2 - 10, 0, 180 - height);
  return `${x} ${y} ${width} ${height}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#D9EFF7',
  },
});
