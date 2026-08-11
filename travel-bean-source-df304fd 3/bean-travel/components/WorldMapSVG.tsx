import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { COUNTRY_COORDS, countryToPath } from '@/constants/countryPaths';
import { WORLD_COUNTRIES } from '@/constants/worldCountries';
import { VisitedPlace } from '@/types';

const TOTAL_COUNTRIES = WORLD_COUNTRIES.length;

const OCEAN       = '#EAF1FF';
const OCEAN_LIGHT = '#C9D8FF';
const UNVISITED   = '#AEBEFF';
const UNVISITED_S = '#91A5EA';
const VISITED     = '#542CF4';
const VISITED_S   = '#3F20C5';

interface Props {
  places: VisitedPlace[];
  variant?: 'default' | 'hero' | 'travel';
}

const HERO_VIEWBOX = { x: -8, y: -22, width: 376, height: 230 };
const HERO_CONTAINER_ASPECT = 0.76;
const HERO_VIEWBOX_ASPECT = HERO_VIEWBOX.width / HERO_VIEWBOX.height;
const HERO_SLICE_WIDTH_FACTOR = HERO_VIEWBOX_ASPECT / HERO_CONTAINER_ASPECT;

const AnimatedPath = Animated.createAnimatedComponent(Path);

export default function WorldMapSVG({ places, variant = 'default' }: Props) {
  const isHero = variant === 'hero';
  const isTravel = variant === 'travel';
  const [reduceMotion, setReduceMotion] = useState(false);
  const dash = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const ambient = useRef(new Animated.Value(0)).current;
  const story = useRef(new Animated.Value(0)).current;
  const pulseOne = useRef(new Animated.Value(0)).current;
  const pulseTwo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => subscription?.remove?.();
  }, []);

  useEffect(() => {
    if (!isHero || reduceMotion) {
      dash.setValue(0);
      breathe.setValue(0);
      halo.setValue(0);
      ambient.setValue(0);
      story.setValue(0);
      pulseOne.setValue(0);
      pulseTwo.setValue(0);
      return;
    }

    const loops = [
      Animated.loop(Animated.timing(dash, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: false })),
      Animated.loop(Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 3400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(breathe, { toValue: 0, duration: 3400, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(halo, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(halo, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(ambient, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(ambient, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(story, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(story, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(pulseOne, { toValue: 1, duration: 7600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulseOne, { toValue: 0, duration: 1, easing: Easing.linear, useNativeDriver: false }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.delay(2200),
        Animated.timing(pulseTwo, { toValue: 1, duration: 8200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(pulseTwo, { toValue: 0, duration: 1, easing: Easing.linear, useNativeDriver: false }),
      ])),
    ];
    loops.forEach(loop => loop.start());
    return () => loops.forEach(loop => loop.stop());
  }, [ambient, breathe, dash, halo, isHero, pulseOne, pulseTwo, reduceMotion, story]);

  const visitedSet = useMemo(() => {
    const s = new Set<string>();
    for (const p of places) {
      if (p.country) s.add(p.country);
    }
    return s;
  }, [places]);

  const heroMarkers = useMemo(() =>
    places.slice(0, 6).map((place, index) => {
      const projected = projectHeroPlace(place);
      return {
        id: place.id,
        label: place.city || place.name || place.country || 'Place',
        name: place.name,
        country: place.country,
        meta: [place.city, place.country].filter(Boolean).join(', ') || place.country,
        left: projected.left,
        top: projected.top,
        index: index + 1,
      };
    }),
  [places]);

  const placeMarkers = useMemo(() =>
    places
      .filter(place => typeof place.latitude === 'number' && typeof place.longitude === 'number')
      .slice(0, isTravel ? 10 : 6)
      .map((place, index) => {
        const projected = projectWorldPlace(place);
        return {
          id: place.id,
          label: place.city || place.name || place.country || 'Place',
          country: place.country,
          left: projected.left,
          top: projected.top,
          index: index + 1,
        };
      }),
  [isTravel, places]);

  const countryPaths = useMemo(() =>
    Object.entries(COUNTRY_COORDS).map(([name, rings]) => ({
      name,
      d: countryToPath(rings),
    })),
  []);

  const unvisited = countryPaths.filter(c => !visitedSet.has(c.name));
  const visited   = countryPaths.filter(c =>  visitedSet.has(c.name));

  const totalPlaces    = places.length;
  const totalCountries = visitedSet.size;
  const routeDashOffset = reduceMotion ? 0 : dash.interpolate({ inputRange: [0, 1], outputRange: [0, -28] });
  const pinFloat = reduceMotion ? 0 : breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const pinScale = reduceMotion ? 1 : breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });
  const ambientShift = reduceMotion ? 0 : ambient.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] });
  const storyOpacity = reduceMotion ? 0.92 : story.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.38, 0.94, 0.38] });
  const storyLift = reduceMotion ? 0 : story.interpolate({ inputRange: [0, 1], outputRange: [8, -4] });

  return (
    <View style={styles.wrapper}>
      <View style={[styles.mapContainer, isHero && styles.heroMapContainer, isTravel && styles.travelMapContainer]}>
        {isHero && (
          <>
            <Animated.View style={[styles.ambientGlow, styles.ambientGlowOne, { transform: [{ translateX: ambientShift }] }]} />
            <Animated.View style={[styles.ambientGlow, styles.ambientGlowTwo, { transform: [{ translateX: Animated.multiply(ambientShift, -0.7) }] }]} />
          </>
        )}
        {/* Flat equirectangular map — viewBox 0 0 360 180, full world */}
        <Svg
          viewBox={isHero ? `${HERO_VIEWBOX.x} ${HERO_VIEWBOX.y} ${HERO_VIEWBOX.width} ${HERO_VIEWBOX.height}` : '0 0 360 180'}
          preserveAspectRatio={isTravel ? 'none' : 'xMidYMid slice'}
          width="100%"
          height="100%"
          style={styles.svg}
        >
          <Defs>
            <LinearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={isHero ? '#AFC8FF' : OCEAN_LIGHT} stopOpacity="1" />
              <Stop offset="0.45" stopColor={isHero ? '#D6E3FF' : OCEAN} stopOpacity="1" />
              <Stop offset="1" stopColor={isHero ? '#FFFFFF' : OCEAN} stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="visitedHero" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#6E35FF" stopOpacity="1" />
              <Stop offset="0.62" stopColor="#542CF4" stopOpacity="1" />
              <Stop offset="1" stopColor="#24D6B7" stopOpacity="1" />
            </LinearGradient>
          </Defs>

          {/* Ocean */}
          <Rect x="0" y="0" width="360" height="180" fill="url(#ocean)" />
          {isHero && (
            <G opacity="0.28">
              <Circle cx="178" cy="87" r="118" fill="#FFFFFF" opacity="0.18" />
              <Circle cx="178" cy="87" r="88" fill="none" stroke="#FFFFFF" strokeWidth="0.7" opacity="0.34" />
              <Path d="M22 58 C88 22 142 70 204 41 C262 14 300 42 352 24" stroke="#FFFFFF" strokeWidth="0.55" fill="none" opacity="0.45" />
              <Path d="M26 128 C88 103 125 140 183 118 C244 94 283 132 347 105" stroke="#FFFFFF" strokeWidth="0.55" fill="none" opacity="0.32" />
              <Path d="M45 24 H336 M38 66 H342 M30 108 H350 M42 150 H330" stroke="#FFFFFF" strokeWidth="0.22" opacity="0.32" />
              <Path d="M78 8 V172 M150 2 V176 M222 4 V174 M294 10 V170" stroke="#FFFFFF" strokeWidth="0.22" opacity="0.22" />
            </G>
          )}

          {/* Countries — equirectangular: x = lon+180, y = 90−lat */}
          <G>
            {unvisited.map(({ name, d }) => (
              <Path
                key={name}
                d={d}
                fill={isHero ? '#A8BDF1' : UNVISITED}
                stroke={isHero ? '#DDE7FF' : UNVISITED_S}
                strokeWidth={isHero ? '0.22' : '0.35'}
                opacity={isHero ? 0.7 : 0.66}
              />
            ))}
            {visited.map(({ name, d }) => (
              <Path key={name} d={d} fill={isHero ? 'url(#visitedHero)' : VISITED} stroke={isHero ? '#FFFFFF' : VISITED_S} strokeWidth={isHero ? '0.64' : '0.8'} />
            ))}
          </G>
          {isHero && (
            <G>
              <AnimatedPath d="M70 116 C116 82 172 94 226 74 C270 58 306 72 338 50" stroke="#FFFFFF" strokeWidth="1.25" strokeLinecap="round" strokeDasharray="3 6" strokeDashoffset={routeDashOffset as any} fill="none" opacity="0.7" />
              <AnimatedPath d="M56 134 C126 161 218 148 310 112" stroke="#7B5CFF" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="2 6" strokeDashoffset={routeDashOffset as any} fill="none" opacity="0.45" />
              <Circle cx="70" cy="116" r="3.2" fill="#fff" opacity="0.78" />
              <Circle cx="226" cy="74" r="3.2" fill="#fff" opacity="0.72" />
              <Circle cx="310" cy="112" r="3.2" fill="#fff" opacity="0.72" />
            </G>
          )}
        </Svg>

        {isHero && heroMarkers.length > 0 && (
          <>
            <View style={styles.heroMapHeader}>
              <View style={styles.heroMapBadge}>
                <Feather name="map" size={13} color="#542CF4" />
                <Text style={styles.heroMapBadgeText}>Place Map</Text>
              </View>
              <Text style={styles.heroMapCount}>{totalCountries} countries · {totalPlaces} places</Text>
            </View>
            {heroMarkers.map(marker => (
              <HeroMapMarker
                key={marker.id}
                label={marker.index}
                left={marker.left}
                top={marker.top}
                float={pinFloat}
                scale={pinScale}
              />
            ))}
            {!reduceMotion && (
              <>
                <JourneyPulse delay="one" progress={pulseOne} />
                <JourneyPulse delay="two" progress={pulseTwo} />
              </>
            )}
            <Animated.View style={[styles.heroMapSummary, { opacity: storyOpacity, transform: [{ translateY: storyLift }] }]}>
              <View style={styles.summaryPin}>
                <Text style={styles.summaryPinText}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryKicker}>Latest Place</Text>
                <Text style={styles.summaryTitle} numberOfLines={1}>{heroMarkers[0].name}</Text>
                <Text style={styles.summaryMeta} numberOfLines={1}>{heroMarkers[0].meta}</Text>
              </View>
              <Feather name="arrow-up-right" size={16} color="#542CF4" />
            </Animated.View>
          </>
        )}

        {isHero && heroMarkers.length === 0 && <HeroEmptyState />}

        {!isHero && placeMarkers.length > 0 && (
          <>
            {placeMarkers.map((marker, index) => (
              <WorldBeanMarker
                key={marker.id}
                label={marker.label}
                country={marker.country}
                left={marker.left}
                top={marker.top}
                compact={!isTravel || index > 2}
              />
            ))}
          </>
        )}

        {/* Stats overlay */}
        {!isHero && (totalCountries > 0 || totalPlaces > 0) && (
          <View style={styles.statsOverlay}>
            {totalCountries > 0 && (
              <View style={styles.pill}>
                <Text style={styles.pillNum}>{totalCountries}</Text>
                <Text style={styles.pillDivider}>/</Text>
                <Text style={styles.pillTotal}>{TOTAL_COUNTRIES}</Text>
                <Text style={styles.pillLbl}> countries</Text>
              </View>
            )}
            {totalPlaces > 0 && (
              <View style={styles.pill}>
                <Text style={styles.pillNum}>{totalPlaces}</Text>
                <Text style={styles.pillLbl}> {totalPlaces === 1 ? 'place' : 'places'}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

function HeroMapMarker({ label, left, top, float, scale }: { label: number; left: `${number}%`; top: `${number}%`; float: Animated.AnimatedInterpolation<number> | number; scale: Animated.AnimatedInterpolation<number> | number }) {
  return (
    <Animated.View style={[styles.heroMapMarker, { left, top, transform: [{ translateX: -15 }, { translateY: Animated.add(float as any, -15) as any }, { scale: scale as any }] }]}>
      <View style={styles.heroMapMarkerHalo} />
      <View style={styles.heroMapMarkerCore}>
        <Text style={styles.heroMapMarkerText}>{label}</Text>
      </View>
    </Animated.View>
  );
}

function JourneyPulse({ delay, progress }: { delay: 'one' | 'two'; progress: Animated.Value }) {
  const translateX = delay === 'one'
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [-74, 12] })
    : progress.interpolate({ inputRange: [0, 1], outputRange: [-28, 92] });
  const translateY = delay === 'one'
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [24, -8] })
    : progress.interpolate({ inputRange: [0, 1], outputRange: [-6, 30] });
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.72, 0.72, 0] });
  const scale = progress.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.75, 1.25, 0.85] });

  return (
    <Animated.View pointerEvents="none" style={[styles.journeyPulse, delay === 'one' ? styles.journeyPulseOne : styles.journeyPulseTwo, { opacity, transform: [{ translateX }, { translateY }, { scale }] }]}>
      <View style={styles.journeyPulseCore} />
    </Animated.View>
  );
}

function projectHeroPlace(place: VisitedPlace): { left: `${number}%`; top: `${number}%` } {
  const latitude = typeof place.latitude === 'number' ? place.latitude : 0;
  const longitude = typeof place.longitude === 'number' ? place.longitude : 0;
  const mapX = longitude + 180;
  const mapY = 90 - latitude;
  const normalizedX = (mapX - HERO_VIEWBOX.x) / HERO_VIEWBOX.width;
  const normalizedY = (mapY - HERO_VIEWBOX.y) / HERO_VIEWBOX.height;
  const slicedX = 0.5 + (normalizedX - 0.5) * HERO_SLICE_WIDTH_FACTOR;
  const left = clampPercent(slicedX * 100, 8, 92);
  const top = clampPercent(normalizedY * 100, 8, 88);
  return {
    left: `${roundPercent(left)}%` as `${number}%`,
    top: `${roundPercent(top)}%` as `${number}%`,
  };
}

function projectWorldPlace(place: VisitedPlace): { left: `${number}%`; top: `${number}%` } {
  const latitude = typeof place.latitude === 'number' ? place.latitude : 0;
  const longitude = typeof place.longitude === 'number' ? place.longitude : 0;
  const left = clampPercent(((longitude + 180) / 360) * 100, 4, 96);
  const top = clampPercent(((90 - latitude) / 180) * 100, 6, 92);
  return {
    left: `${roundPercent(left)}%` as `${number}%`,
    top: `${roundPercent(top)}%` as `${number}%`,
  };
}

function WorldBeanMarker({
  label,
  country,
  left,
  top,
  compact,
}: {
  label: string;
  country?: string;
  left: `${number}%`;
  top: `${number}%`;
  compact: boolean;
}) {
  return (
    <View pointerEvents="none" style={[styles.worldBeanMarker, { left, top }]}>
      {!compact && (
        <View style={styles.worldBeanLabel}>
          <Text style={styles.worldBeanTitle} numberOfLines={1}>{label}</Text>
          {!!country && <Text style={styles.worldBeanSub} numberOfLines={1}>{country}</Text>}
        </View>
      )}
      <View style={styles.worldBeanPin}>
        <View style={styles.worldBeanHalo} />
        <View style={styles.worldBeanCore}>
          <View style={styles.worldBeanShape} />
          <View style={styles.worldBeanCut} />
        </View>
        <View style={styles.worldBeanTip} />
      </View>
    </View>
  );
}

function clampPercent(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

function HeroEmptyState() {
  return (
    <View style={styles.heroEmptyState}>
      <View style={styles.heroEmptyIcon}>
        <Feather name="map-pin" size={18} color="#542CF4" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.heroEmptyTitle}>Your world starts here</Text>
        <Text style={styles.heroEmptyText}>Add a real Place to light up your map.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  mapContainer: {
    width: '100%',
    aspectRatio: 2,
    borderRadius: 28,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#542CF4',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.13,
    shadowRadius: 26,
    elevation: 8,
    backgroundColor: '#DCE7FF',
  },
  heroMapContainer: {
    aspectRatio: 0.76,
    borderRadius: 0,
    borderWidth: 0,
    shadowOpacity: 0,
    backgroundColor: '#DCE7FF',
  },
  travelMapContainer: {
    flex: 1,
    aspectRatio: undefined,
    borderRadius: 0,
    borderWidth: 0,
    shadowOpacity: 0,
    backgroundColor: '#DCE7FF',
  },
  ambientGlow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    opacity: Platform.OS === 'web' ? 0.18 : 0.12,
    zIndex: 0,
  },
  ambientGlowOne: {
    left: -48,
    top: 46,
    backgroundColor: '#542CF4',
  },
  ambientGlowTwo: {
    right: -38,
    bottom: 90,
    backgroundColor: '#24D6B7',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  statsOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
    zIndex: 7,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pillNum: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#26283D',
  },
  pillDivider: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#969AAA',
    marginHorizontal: 1,
  },
  pillTotal: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#969AAA',
  },
  pillLbl: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: '#969AAA',
  },
  heroMapHeader: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 14,
    zIndex: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroMapBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#1B2033',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  heroMapBadgeText: {
    color: '#1B2033',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  heroMapCount: {
    color: '#4F5873',
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  heroMapMarker: {
    position: 'absolute',
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  heroMapMarkerHalo: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.48)',
    shadowColor: '#542CF4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  heroMapMarkerCore: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#542CF4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B2033',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 7,
  },
  heroMapMarkerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  worldBeanMarker: {
    position: 'absolute',
    zIndex: 8,
    alignItems: 'center',
    transform: [{ translateX: -22 }, { translateY: -54 }],
  },
  worldBeanLabel: {
    maxWidth: 126,
    marginBottom: 7,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 17,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: '#1B2033',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.13,
    shadowRadius: 14,
    elevation: 6,
  },
  worldBeanTitle: {
    color: '#1B2033',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  worldBeanSub: {
    color: '#737B91',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    marginTop: 1,
  },
  worldBeanPin: {
    width: 44,
    height: 54,
    alignItems: 'center',
  },
  worldBeanHalo: {
    position: 'absolute',
    top: -8,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(84,44,244,0.14)',
  },
  worldBeanCore: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#542CF4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B2033',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 7,
    overflow: 'hidden',
  },
  worldBeanShape: {
    width: 25,
    height: 16,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-13deg' }],
  },
  worldBeanCut: {
    position: 'absolute',
    width: 23,
    height: 5,
    borderRadius: 5,
    backgroundColor: '#542CF4',
    transform: [{ rotate: '-17deg' }],
  },
  worldBeanTip: {
    marginTop: -5,
    width: 15,
    height: 15,
    borderRadius: 3,
    backgroundColor: '#24D6B7',
    transform: [{ rotate: '45deg' }],
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroMapSummary: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    zIndex: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.86)',
    borderRadius: 22,
    padding: 12,
    shadowColor: '#1B2033',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 8,
  },
  summaryPin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#542CF4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  summaryPinText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  summaryKicker: {
    color: '#8B5CF6',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  summaryTitle: {
    color: '#11131D',
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  summaryMeta: {
    color: '#73788A',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 2,
  },
  heroLabel: {
    position: 'absolute',
    minWidth: 92,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  heroLabelFeatured: {
    minWidth: 86,
    paddingVertical: 9,
  },
  heroLabelText: {
    fontSize: 20,
    fontFamily: 'Inter_500Medium',
    color: '#26283D',
  },
  heroBeanPin: {
    position: 'absolute',
    width: 58,
    height: 74,
    marginLeft: -29,
    marginTop: -56,
  },
  heroBeanPinFeatured: {
    width: 76,
    height: 94,
    marginLeft: -38,
    marginTop: -74,
  },
  heroPinHalo: {
    position: 'absolute',
    left: -18,
    top: -18,
    right: -18,
    bottom: -18,
    borderRadius: 64,
    backgroundColor: '#FFFFFF',
    shadowColor: '#542CF4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.48,
    shadowRadius: 24,
  },
  heroPinCaption: {
    position: 'absolute',
    left: -20,
    right: -20,
    bottom: -18,
    alignItems: 'center',
  },
  heroPinCaptionText: {
    color: '#542CF4',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  journeyPulse: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.38)',
    shadowColor: '#24D6B7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
  },
  journeyPulseOne: {
    left: '39%',
    top: '55%',
  },
  journeyPulseTwo: {
    left: '68%',
    top: '62%',
  },
  journeyPulseCore: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#24D6B7',
  },
  heroEmptyState: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.88)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 7,
  },
  heroEmptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1ECFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmptyTitle: {
    color: '#1B2033',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    textAlign: 'left',
  },
  heroEmptyText: {
    color: '#717789',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'left',
  },
});
