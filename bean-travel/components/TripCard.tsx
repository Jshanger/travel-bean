import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Trip } from '@/types';

interface Props {
  trip: Trip;
  onDelete: () => void;
}

export function TripCard({ trip, onDelete }: Props) {
  const colors = useColors();
  const router = useRouter();
  const days = getDays(trip.startDate, trip.endDate);
  const isUpcoming = trip.startDate >= new Date().toISOString().slice(0, 10);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/trip/${trip.id}` as any)}
      activeOpacity={0.8}
    >
      <View style={styles.topRow}>
        <View style={[styles.badge, { backgroundColor: isUpcoming ? colors.primary + '20' : colors.muted }]}>
          <Text style={[styles.badgeTxt, { color: isUpcoming ? colors.primary : colors.mutedForeground }]}>
            {isUpcoming ? 'Upcoming' : 'Past'}
          </Text>
        </View>
        <TouchableOpacity onPress={onDelete} style={styles.delBtn}>
          <Feather name="trash-2" size={14} color={colors.destructive} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.name, { color: colors.foreground }]}>{trip.name}</Text>
      <View style={styles.locRow}>
        <Feather name="map-pin" size={13} color={colors.primary} />
        <Text style={[styles.dest, { color: colors.mutedForeground }]}>{trip.destination}</Text>
      </View>
      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Feather name="calendar" size={13} color={colors.mutedForeground} />
          <Text style={[styles.infoTxt, { color: colors.mutedForeground }]}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
        </View>
        <View style={styles.infoItem}>
          <Feather name="sun" size={13} color={colors.mutedForeground} />
          <Text style={[styles.infoTxt, { color: colors.mutedForeground }]}>{days} day{days !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.infoItem}>
          <Feather name="users" size={13} color={colors.mutedForeground} />
          <Text style={[styles.infoTxt, { color: colors.mutedForeground }]}>{trip.travellers.length}</Text>
        </View>
        <View style={styles.infoItem}>
          <Feather name="list" size={13} color={colors.mutedForeground} />
          <Text style={[styles.infoTxt, { color: colors.mutedForeground }]}>{trip.itinerary.length} stops</Text>
        </View>
      </View>
      <View style={styles.arrowRow}>
        <Text style={[styles.viewTxt, { color: colors.primary }]}>Open trip</Text>
        <Feather name="chevron-right" size={16} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

function getDays(start: string, end: string) {
  try {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  } catch { return 1; }
}

function formatDateRange(start: string, end: string) {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const sStr = s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const eStr = e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${sStr} – ${eStr}`;
  } catch { return `${start} – ${end}`; }
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  delBtn: { padding: 4 },
  name: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  dest: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoTxt: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  arrowRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewTxt: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
