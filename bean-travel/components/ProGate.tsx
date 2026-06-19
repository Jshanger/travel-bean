import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';

interface Props {
  children: React.ReactNode;
  feature?: {
    icon: keyof typeof Feather.glyphMap;
    label: string;
  };
}

/**
 * Wraps any Pro-only section. Free users see faded content with a clear
 * locked banner at the bottom — tapping navigates to the More tab where
 * the upgrade card lives.
 */
export default function ProGate({ children, feature }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { isPro } = useApp();

  if (isPro) return <>{children}</>;

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/more');
  }

  return (
    <View style={styles.wrapper}>
      <View pointerEvents="none" style={styles.faded}>
        {children}
      </View>

      {/* Tappable lock overlay */}
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handlePress} activeOpacity={1} />

      {/* Locked banner */}
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
          <Feather name={feature?.icon ?? 'lock'} size={15} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>
            {feature?.label ?? 'Bean Pro feature'}
          </Text>
          <Text style={[styles.bannerSub, { color: colors.mutedForeground }]}>Unlock in More →</Text>
        </View>
        <View style={[styles.lockBadge, { backgroundColor: colors.primary }]}>
          <Feather name="lock" size={11} color="#fff" />
          <Text style={styles.lockBadgeTxt}>Pro</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  faded: { opacity: 0.28 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 1,
  },
  bannerSub: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lockBadgeTxt: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
});
