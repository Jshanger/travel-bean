import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface StatItem {
  value: string | number;
  label: string;
}

interface Props {
  stats: StatItem[];
}

export function StatsRow({ stats }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {stats.map((s, i) => (
        <React.Fragment key={s.label}>
          {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
          <View style={styles.stat}>
            <Text style={[styles.value, { color: colors.primary }]}>{s.value}</Text>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>{s.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, paddingVertical: 16, paddingHorizontal: 8 },
  stat: { flex: 1, alignItems: 'center' },
  value: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  label: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  divider: { width: 1, marginVertical: 4 },
});
