import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { PlaceCategory, VisitedPlace } from '@/types';

const CATEGORY_ICONS: Record<PlaceCategory, keyof typeof Feather.glyphMap> = {
  city: 'map-pin',
  landmark: 'camera',
  restaurant: 'coffee',
  coffee_shop: 'coffee',
  hotel: 'home',
  nature: 'sun',
  hidden_spot: 'star',
};

const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  city: 'City',
  landmark: 'Landmark',
  restaurant: 'Restaurant',
  coffee_shop: 'Coffee Shop',
  hotel: 'Hotel',
  nature: 'Nature',
  hidden_spot: 'Hidden Spot',
};

interface Props {
  place: VisitedPlace;
  onEdit: () => void;
  onDelete: () => void;
}

export function PlaceCard({ place, onEdit, onDelete }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
        <Feather name={CATEGORY_ICONS[place.category]} size={20} color={colors.orange} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{place.name}</Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>{place.country} · Place · {CATEGORY_LABELS[place.category]}</Text>
        {place.dateVisited ? <Text style={[styles.date, { color: colors.mutedForeground }]}>{formatDate(place.dateVisited)}</Text> : null}
        {place.notes ? <Text style={[styles.notes, { color: colors.mutedForeground }]} numberOfLines={2}>{place.notes}</Text> : null}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
          <Feather name="edit-2" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
          <Feather name="trash-2" size={15} color={colors.destructive} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  } catch { return d; }
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10, gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1 },
  name: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  meta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 2 },
  date: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 4 },
  notes: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  actions: { gap: 8, flexShrink: 0 },
  actionBtn: { padding: 4 },
});
