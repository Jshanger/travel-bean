import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import { VisitedPlace } from '@/types';

interface Props {
  places: VisitedPlace[];
  topPadding: number;
  onOpenMap: () => void;
  onAddBean: () => void;
}

const LABEL_POSITIONS = [
  { x: '12%', y: '37%' },
  { x: '63%', y: '20%' },
  { x: '72%', y: '62%' },
] as const;

export default function RotatingBeanGlobe({ places, topPadding, onOpenMap, onAddBean }: Props) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 22000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const labels = useMemo(() => {
    return places.slice(0, 3).map((place, index) => ({
      title: place.city || place.name,
      sub: place.country || 'Place',
      x: LABEL_POSITIONS[index]?.x ?? '50%',
      y: LABEL_POSITIONS[index]?.y ?? '48%',
    }));
  }, [places]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const reverse = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });

  return (
    <LinearGradient
      colors={['#DCE8FF', '#F5FAFF', '#EEF2FF']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.wrap}
    >
      <Svg width="100%" height="100%" viewBox="0 0 390 300" style={styles.routeArt}>
        <Path d="M-20 230 C56 170 126 240 204 182 C272 132 316 160 420 96" stroke="#8B6BFF" strokeWidth="3" strokeDasharray="8 13" opacity="0.32" fill="none" />
        <Path d="M18 112 C74 64 126 104 184 70 C236 40 300 56 376 28" stroke="#18BBD4" strokeWidth="2.4" strokeDasharray="6 12" opacity="0.22" fill="none" />
        <Circle cx="342" cy="58" r="46" stroke="#542CF4" strokeWidth="1.5" opacity="0.1" fill="none" />
        <Circle cx="342" cy="58" r="76" stroke="#542CF4" strokeWidth="1.5" opacity="0.07" fill="none" />
      </Svg>

      <View style={[styles.topControls, { paddingTop: topPadding }]}>
        <TouchableOpacity style={styles.beanPill} activeOpacity={0.84} onPress={onOpenMap}>
          <Feather name="globe" size={20} color="#fff" />
          <Text style={styles.beanPillText}>Bean Globe</Text>
        </TouchableOpacity>
        <View style={styles.toolRow}>
          <TouchableOpacity style={styles.roundTool} activeOpacity={0.84}>
            <Feather name="search" size={22} color="#153A46" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.roundTool} activeOpacity={0.84}>
            <Feather name="sliders" size={21} color="#153A46" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.globeStage} activeOpacity={0.92} onPress={onOpenMap}>
        <View style={styles.glowOne} />
        <View style={styles.glowTwo} />
        <Animated.View style={[styles.globe, { transform: [{ rotate }] }]}>
          <Svg width="100%" height="100%" viewBox="0 0 240 240">
            <Defs>
              <RadialGradient id="ocean" cx="34%" cy="24%" r="74%">
                <Stop offset="0%" stopColor="#F7FBFF" />
                <Stop offset="38%" stopColor="#9BD7F3" />
                <Stop offset="72%" stopColor="#2F8FD2" />
                <Stop offset="100%" stopColor="#244AEF" />
              </RadialGradient>
            </Defs>
            <Circle cx="120" cy="120" r="112" fill="url(#ocean)" />
            <Circle cx="120" cy="120" r="112" fill="none" stroke="#FFFFFF" strokeWidth="5" opacity="0.86" />
            <Path d="M32 90 C56 58 86 63 100 86 C116 110 92 128 116 146 C142 168 120 190 82 178 C50 168 34 136 32 90 Z" fill="#7BE0B4" opacity="0.86" />
            <Path d="M116 38 C154 30 194 52 204 84 C184 78 166 86 150 106 C132 128 112 118 108 96 C104 72 86 52 116 38 Z" fill="#B5F0CF" opacity="0.9" />
            <Path d="M142 120 C170 106 204 124 214 154 C190 166 182 192 154 198 C128 182 124 140 142 120 Z" fill="#7FDCA9" opacity="0.9" />
            <Path d="M64 54 C80 44 98 48 108 64 C92 68 76 76 62 92 C50 80 50 64 64 54 Z" fill="#E7F8C8" opacity="0.82" />
            <G opacity="0.28" stroke="#FFFFFF" strokeWidth="1.3" fill="none">
              <Path d="M14 120 H226" />
              <Path d="M34 76 C78 94 162 94 206 76" />
              <Path d="M34 164 C78 146 162 146 206 164" />
              <Path d="M120 8 C88 52 88 188 120 232" />
              <Path d="M120 8 C152 52 152 188 120 232" />
            </G>
          </Svg>
        </Animated.View>
        {places.length > 0 && (
          <Animated.View style={[styles.beanOrbit, { transform: [{ rotate: reverse }] }]}>
            <View style={styles.beanPin}>
              <View style={styles.beanPinCore}>
                <View style={styles.beanShape} />
                <View style={styles.beanCut} />
              </View>
            </View>
          </Animated.View>
        )}
        <View style={styles.globeShine} />
      </TouchableOpacity>

      {labels.length > 0 ? (
        labels.map((label, index) => (
          <View key={`${label.title}-${index}`} style={[styles.floatLabel, { left: label.x as any, top: label.y as any }]}>
            <Text style={styles.floatTitle}>{label.title}</Text>
            <Text style={styles.floatSub}>{label.sub}</Text>
          </View>
        ))
      ) : (
        <View style={styles.emptyCallout}>
          <Text style={styles.emptyTitle}>Your Bean Map is waiting</Text>
          <Text style={styles.emptyText}>Add a real place, photo, and memory to start your personal atlas.</Text>
          <TouchableOpacity style={styles.emptyButton} activeOpacity={0.86} onPress={onAddBean}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.emptyButtonText}>Add your first Bean</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.statGlass}>
        <Text style={styles.statValue}>{places.length}</Text>
        <Text style={styles.statLabel}>{places.length === 0 ? 'Add your first place' : 'Places saved'}</Text>
      </View>

      <TouchableOpacity style={styles.locateBtn} activeOpacity={0.85} onPress={onOpenMap}>
        <Feather name="navigation" size={24} color="#153A46" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.addFab} activeOpacity={0.85} onPress={onAddBean}>
        <Feather name="plus" size={28} color="#fff" />
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  routeArt: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  topControls: { position: 'absolute', top: 0, left: 22, right: 22, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  beanPill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#153A46', paddingHorizontal: 20, paddingVertical: 16, borderRadius: 30, shadowColor: '#153A46', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 8 },
  beanPillText: { color: '#fff', fontSize: 17, fontFamily: 'Inter_700Bold' },
  toolRow: { flexDirection: 'row', gap: 12 },
  roundTool: { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', shadowColor: '#153A46', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 6 },
  globeStage: { position: 'absolute', alignSelf: 'center', top: '10%', width: 286, height: 286, alignItems: 'center', justifyContent: 'center' },
  glowOne: { position: 'absolute', width: 318, height: 318, borderRadius: 159, backgroundColor: '#542CF4', opacity: 0.1 },
  glowTwo: { position: 'absolute', width: 238, height: 238, borderRadius: 119, backgroundColor: '#18BBD4', opacity: 0.14 },
  globe: { width: 222, height: 222, borderRadius: 111, shadowColor: '#2500FF', shadowOffset: { width: 0, height: 22 }, shadowOpacity: 0.32, shadowRadius: 30, elevation: 12 },
  globeShine: { position: 'absolute', left: 66, top: 50, width: 82, height: 52, borderRadius: 41, backgroundColor: 'rgba(255,255,255,0.28)', transform: [{ rotate: '-28deg' }] },
  beanOrbit: { position: 'absolute', width: 272, height: 272, borderRadius: 136, alignItems: 'center', justifyContent: 'flex-start' },
  beanPin: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#2500FF', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  beanPinCore: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#542CF4', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  beanShape: { width: 27, height: 17, borderRadius: 13, backgroundColor: '#fff', transform: [{ rotate: '-12deg' }] },
  beanCut: { position: 'absolute', width: 24, height: 5, borderRadius: 6, backgroundColor: '#542CF4', transform: [{ rotate: '-18deg' }] },
  floatLabel: { position: 'absolute', zIndex: 8, backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#153A46', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 5 },
  floatTitle: { color: '#1B2033', fontSize: 16, fontFamily: 'Inter_700Bold' },
  floatSub: { color: '#7A8297', fontSize: 10, fontFamily: 'Inter_700Bold', marginTop: 1 },
  emptyCallout: { position: 'absolute', left: 32, right: 32, top: '58%', zIndex: 9, backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 30, paddingHorizontal: 20, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#153A46', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.14, shadowRadius: 22, elevation: 8 },
  emptyTitle: { color: '#1B2033', fontSize: 20, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  emptyText: { color: '#687286', fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold', textAlign: 'center', marginTop: 4 },
  emptyButton: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#542CF4', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 22 },
  emptyButtonText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  statGlass: { position: 'absolute', left: 24, bottom: '35%', zIndex: 8, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.82)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#153A46', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 5 },
  statValue: { color: '#542CF4', fontSize: 24, fontFamily: 'Inter_700Bold' },
  statLabel: { color: '#1B2033', fontSize: 11, fontFamily: 'Inter_700Bold' },
  locateBtn: { position: 'absolute', right: 38, bottom: '31%', width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.94)', alignItems: 'center', justifyContent: 'center', shadowColor: '#153A46', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 18, elevation: 8 },
  addFab: { position: 'absolute', right: 38, bottom: '18%', width: 68, height: 68, borderRadius: 34, backgroundColor: '#153A46', alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: 'rgba(255,255,255,0.62)', shadowColor: '#153A46', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 20, elevation: 10 },
});
