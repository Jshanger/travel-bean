import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CountryMiniMap from '@/components/CountryMiniMap';
import { useColors } from '@/hooks/useColors';
import { BucketItem, BucketStatus } from '@/types';
import { getDestinationInfo } from '@/utils/destinationInfo';
import { getCountryPhotoCandidates } from '@/utils/destinationPhotos';

const STATUS_COLORS: Record<BucketStatus, string> = {
  'Must Go': '#E8825A',
  'Want to Go': '#7DAF8C',
  'Maybe': '#8C857F',
};

const SOURCE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  'Screenshot': 'image',
  'TikTok': 'video',
  'Instagram': 'instagram',
  'Xiaohongshu': 'heart',
  'Google Maps': 'map',
  'Friend': 'user',
  'Article': 'file-text',
  'Own Idea': 'zap',
};

interface Props {
  item: BucketItem;
  onEdit: () => void;
  onDelete: () => void;
}

export function BucketCard({ item, onEdit, onDelete }: Props) {
  const colors = useColors();
  const statusColor = STATUS_COLORS[item.status];
  const destination = getDestinationInfo(item.country, item.location);
  const [imageIndex, setImageIndex] = useState(0);
  const photoCandidates = getCountryPhotoCandidates(destination.country, item.imageUrl);
  const activePhoto = photoCandidates[imageIndex];

  function advancePhoto() {
    setImageIndex(current => {
      if (current >= photoCandidates.length - 1) return current;
      return current + 1;
    });
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {activePhoto ? (
        <View style={styles.heroWrap}>
          <Image source={{ uri: activePhoto }} style={styles.heroImage} resizeMode="cover" onError={advancePhoto} />
          <LinearGradient colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.42)']} style={styles.heroShade} />
          <View style={styles.heroBadge}>
            <Feather name="image" size={13} color="#fff" />
            <Text style={styles.heroBadgeText}>Dream Bean photo</Text>
          </View>
        </View>
      ) : (
        <LinearGradient
          colors={[destination.palette[0], destination.palette[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.generatedHero}
        >
          <View style={styles.heroRings}>
            <View style={styles.ringOne} />
            <View style={styles.ringTwo} />
          </View>
          <View style={styles.countryMapWrap}>
            <CountryMiniMap country={destination.country} color="#FFFFFF" mutedColor="rgba(255,255,255,0.5)" />
          </View>
          <View style={styles.generatedBottom}>
            <View style={styles.countryBadge}>
              <Feather name="map-pin" size={12} color="#fff" />
              <Text style={styles.countryBadgeText}>{destination.country || 'Choose Bean country'}</Text>
            </View>
          </View>
        </LinearGradient>
      )}
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusTxt, { color: statusColor }]}>{item.status}</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity onPress={onEdit} style={styles.btn}>
              <Feather name="edit-2" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete} style={styles.btn}>
              <Feather name="trash-2" size={14} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
        <View style={styles.locRow}>
          <Feather name="map-pin" size={12} color={colors.mutedForeground} />
          <Text style={[styles.loc, { color: colors.mutedForeground }]}>{item.location}</Text>
          <Feather name={SOURCE_ICONS[item.source] ?? 'globe'} size={12} color={colors.mutedForeground} style={{ marginLeft: 8 }} />
          <Text style={[styles.loc, { color: colors.mutedForeground }]}>{item.source}</Text>
        </View>
        {item.tags.length > 0 && (
          <View style={styles.tags}>
            {item.tags.map(tag => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.muted }]}>
                <Text style={[styles.tagTxt, { color: colors.mutedForeground }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={[styles.infoBox, { backgroundColor: colors.muted }]}>
          <Feather name="info" size={13} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]} numberOfLines={2}>{destination.fact}</Text>
        </View>
        {item.notes ? <Text style={[styles.notes, { color: colors.mutedForeground }]} numberOfLines={2}>{item.notes}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#26283D',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 5,
  },
  heroWrap: { height: 172, position: 'relative' },
  heroImage: { width: '100%', height: '100%' },
  heroShade: { ...StyleSheet.absoluteFillObject },
  heroBadge: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.44)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16 },
  heroBadgeText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  generatedHero: { height: 172, overflow: 'hidden', padding: 16, justifyContent: 'center' },
  heroRings: { position: 'absolute', right: -12, top: -18, width: 150, height: 150 },
  ringOne: { position: 'absolute', width: 104, height: 104, borderRadius: 52, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', right: 10, top: 10 },
  ringTwo: { position: 'absolute', width: 148, height: 148, borderRadius: 74, borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)' },
  countryMapWrap: { alignSelf: 'center', width: '78%', height: 116, opacity: 0.92 },
  generatedBottom: { position: 'absolute', left: 14, bottom: 14 },
  countryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16 },
  countryBadgeText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },
  body: { padding: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { padding: 3 },
  name: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  loc: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagTxt: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, padding: 10, borderRadius: 14, marginBottom: 8 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium' },
  notes: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
});
