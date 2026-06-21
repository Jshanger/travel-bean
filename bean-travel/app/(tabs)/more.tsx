import { Feather } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/expo';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import PaywallModal from '@/components/PaywallModal';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const PRO_FEATURES = [
  { icon: 'users' as const, label: 'Journey collaboration', body: 'Plan future Trips with friends.' },
  { icon: 'share-2' as const, label: 'Shareable links', body: 'Send trips, passports, and stories beautifully.' },
  { icon: 'file-text' as const, label: 'PDF trip export', body: 'Take your itinerary offline.' },
  { icon: 'image' as const, label: 'Unlimited Memories', body: 'Save every photo, note, mood, and moment.' },
  { icon: 'mic' as const, label: 'Voice-to-text notes', body: 'Talk your memories into Place.' },
  { icon: 'map' as const, label: 'Full Passport', body: 'Countries, Cities, and travel progress.' },
];

const MAGIC_TILES = [
  { icon: 'globe' as const, title: 'Passport', body: 'Watch your world fill with countries, cities, and stories.', colors: ['#542CF4', '#18BBD4'] as const },
  { icon: 'film' as const, title: 'Stories', body: 'Turn photos and reflections into shareable travel collages.', colors: ['#FF8A5B', '#542CF4'] as const },
  { icon: 'coffee' as const, title: 'Places', body: 'Save cafes, viewpoints, hidden corners, and tiny details.', colors: ['#1EC8A5', '#49B8FF'] as const },
];

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isPro, userProfile, updateMarketingConsent } = useApp();
  const { signOut } = useAuth();
  const { user } = useUser();
  const [showPaywall, setShowPaywall] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  async function handleMarketingConsent(nextValue: boolean) {
    setSavingConsent(true);
    try {
      await updateMarketingConsent(nextValue);
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSavingConsent(false);
    }
  }

  const topPt = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPb = Platform.OS === 'web' ? 34 + 84 : 84 + insets.bottom;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: topPt + 18, paddingBottom: bottomPb + 18, paddingHorizontal: 18 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['#2500FF', '#542CF4', '#18BBD4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Svg width="100%" height="100%" viewBox="0 0 360 260" style={styles.heroArt}>
          <Circle cx="296" cy="58" r="46" stroke="#FFFFFF" strokeWidth="1.6" opacity="0.2" fill="none" />
          <Circle cx="296" cy="58" r="76" stroke="#FFFFFF" strokeWidth="1.4" opacity="0.12" fill="none" />
          <Path d="M-18 210 C56 142 118 226 196 164 C254 118 302 146 380 96 L380 300 L-18 300 Z" fill="#FFFFFF" opacity="0.96" />
          <Path d="M34 92 C84 48 132 86 186 52 C230 24 280 42 336 26" stroke="#FFFFFF" strokeWidth="2.2" strokeDasharray="5 9" opacity="0.42" fill="none" />
          <Path d="M44 160 C92 124 140 152 188 120 C238 86 286 102 340 72" stroke="#F6C85F" strokeWidth="2.8" strokeLinecap="round" opacity="0.72" fill="none" />
        </Svg>

        <View style={styles.heroTopRow}>
          <View style={styles.heroLogo}>
            <View style={styles.beanMarkCore}>
              <View style={styles.beanMarkShape} />
              <View style={styles.beanMarkCut} />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroKicker}>{isPro ? 'Bean Pro is active' : 'Travel Bean'}</Text>
            <Text style={styles.heroTitle}>Collect the places that made you feel alive</Text>
          </View>
          {user ? (
            <TouchableOpacity onPress={handleSignOut} style={styles.heroSignOut}>
              <Feather name="log-out" size={16} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.heroText}>Build your Passport, save Memories, and turn trip photos into beautiful stories worth sharing.</Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{isPro ? '∞' : '3'}</Text>
            <Text style={styles.heroStatLabel}>Memories</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>4</Text>
            <Text style={styles.heroStatLabel}>Story themes</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>194</Text>
            <Text style={styles.heroStatLabel}>Country atlas</Text>
          </View>
        </View>

        <View style={styles.heroActions}>
          <TouchableOpacity
            style={styles.heroPrimary}
            onPress={() => !isPro && setShowPaywall(true)}
            activeOpacity={0.9}
          >
            <Text style={styles.heroPrimaryText}>{isPro ? 'All Pro magic unlocked' : 'Unlock Bean Pro'}</Text>
            <Feather name={isPro ? 'check-circle' : 'arrow-right'} size={17} color="#11131D" />
          </TouchableOpacity>
          <View style={styles.heroPill}>
            <Feather name="star" size={14} color="#F6C85F" />
            <Text style={styles.heroPillText}>Made for memories</Text>
          </View>
        </View>
      </LinearGradient>

      {user && (
        <>
          <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{(user.primaryEmailAddress?.emailAddress?.[0] ?? 'U').toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.accountEmail, { color: colors.foreground }]} numberOfLines={1}>
                  {user.primaryEmailAddress?.emailAddress}
                </Text>
                {isPro && (
                  <View style={[styles.proBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.proBadgeTxt}>PRO</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.accountSub, { color: colors.mutedForeground }]}>
                {isPro ? 'Bean Pro · Active' : 'Your Bean journal'}
              </Text>
            </View>
          </View>

          <View style={[styles.emailConsentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.emailConsentIcon}>
              <Feather name="mail" size={18} color="#153A46" />
            </View>
            <View style={styles.emailConsentCopy}>
              <Text style={[styles.emailConsentTitle, { color: colors.foreground }]}>Email updates</Text>
              <Text style={[styles.emailConsentText, { color: colors.mutedForeground }]}>
                Travel Bean can save your signup email and, if you choose, send product updates, travel tips, and offers.
              </Text>
              <Text style={[styles.emailConsentEmail, { color: colors.primary }]} numberOfLines={1}>
                {userProfile?.email || user.primaryEmailAddress?.emailAddress}
              </Text>
            </View>
            <Switch
              value={Boolean(userProfile?.marketingConsent)}
              onValueChange={handleMarketingConsent}
              disabled={savingConsent}
              trackColor={{ false: '#E0C5B4', true: '#9CE1D0' }}
              thumbColor={userProfile?.marketingConsent ? '#153A46' : '#FFF8EF'}
            />
          </View>
        </>
      )}

      <View style={styles.magicGrid}>
        {MAGIC_TILES.map(tile => (
          <LinearGradient
            key={tile.title}
            colors={tile.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.magicTile}
          >
            <View style={styles.magicIcon}>
              <Feather name={tile.icon} size={18} color="#fff" />
            </View>
            <Text style={styles.magicTitle}>{tile.title}</Text>
            <Text style={styles.magicText}>{tile.body}</Text>
          </LinearGradient>
        ))}
      </View>

      {/* Bean Pro card */}
      {isPro ? (
        <View style={[styles.proUnlockedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <LinearGradient colors={['#7DAF8C', '#5BCF9A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.proActiveCard}>
            <View style={styles.proActiveLeft}>
              <View style={styles.proActiveStar}>
                <Feather name="star" size={18} color="#fff" />
              </View>
              <View>
                <Text style={styles.proActiveTitle}>Your Bean Pro toolkit is open</Text>
                <Text style={styles.proActiveSub}>Stories, exports, voice notes, sharing, and unlimited memories.</Text>
              </View>
            </View>
            <Feather name="check-circle" size={22} color="rgba(255,255,255,0.9)" />
          </LinearGradient>
          <Text style={[styles.unlockedTitle, { color: colors.foreground }]}>Unlocked Pro Magic</Text>
          <View style={styles.unlockedGrid}>
            {PRO_FEATURES.map(f => (
              <View key={f.label} style={[styles.unlockedFeature, { backgroundColor: colors.muted }]}>
                <View style={[styles.unlockedIcon, { backgroundColor: colors.primary + '16' }]}>
                  <Feather name={f.icon} size={15} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.unlockedLabel, { color: colors.foreground }]}>{f.label}</Text>
                  <Text style={[styles.unlockedSub, { color: colors.mutedForeground }]}>{f.body}</Text>
                </View>
                <Feather name="check" size={15} color="#7DAF8C" />
              </View>
            ))}
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.upgradeCard, { backgroundColor: colors.primary }]}
          onPress={() => setShowPaywall(true)}
          activeOpacity={0.9}
        >
          <View style={styles.upgradeTop}>
            <View style={styles.upgradeStarWrap}>
              <Feather name="star" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.upgradeTitle}>Bean Pro</Text>
              <Text style={styles.upgradePrice}>$2.99 / month</Text>
            </View>
            <View style={styles.upgradeBtn}>
              <Text style={styles.upgradeBtnTxt}>Upgrade</Text>
            </View>
          </View>
          <View style={styles.featureList}>
            {PRO_FEATURES.map(f => (
              <View key={f.label} style={styles.featureRow}>
                <Feather name={f.icon} size={13} color="rgba(255,255,255,0.8)" />
                <Text style={styles.featureTxt}>{f.label}</Text>
              </View>
            ))}
          </View>
        </TouchableOpacity>
      )}

      {/* App branding */}
      <LinearGradient colors={['#11131D', '#26283D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.beanCard}>
        <Feather name="map-pin" size={24} color="rgba(255,255,255,0.9)" />
        <View style={{ flex: 1 }}>
          <Text style={styles.beanTitle}>Travel Bean feels better when it feels personal.</Text>
          <Text style={styles.beanSub}>Collect Places, write Memories, and keep the story of where you have been.</Text>
        </View>
      </LinearGradient>

      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  screenTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', marginBottom: 16 },
  hero: {
    minHeight: 330,
    borderRadius: 34,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#2500FF',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 26,
    elevation: 9,
  },
  heroArt: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  heroTopRow: { zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroLogo: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beanMarkCore: { width: 35, height: 35, borderRadius: 18, backgroundColor: '#EEF7FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', transform: [{ rotate: '-12deg' }] },
  beanMarkShape: { width: 28, height: 17, borderRadius: 15, backgroundColor: '#542CF4' },
  beanMarkCut: { position: 'absolute', width: 24, height: 5, borderRadius: 6, backgroundColor: '#EEF7FF', transform: [{ rotate: '-18deg' }] },
  heroKicker: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 4 },
  heroTitle: { color: '#fff', fontSize: 30, lineHeight: 34, fontFamily: 'Inter_700Bold', maxWidth: 620 },
  heroText: { zIndex: 2, color: 'rgba(255,255,255,0.82)', fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium', marginTop: 18, maxWidth: 660 },
  heroSignOut: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroStats: { zIndex: 2, flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 20 },
  heroStat: {
    minWidth: 104,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroStatValue: { color: '#fff', fontSize: 24, fontFamily: 'Inter_700Bold' },
  heroStatLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontFamily: 'Inter_700Bold', marginTop: 2 },
  heroActions: { zIndex: 2, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  heroPrimary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 13 },
  heroPrimaryText: { color: '#11131D', fontSize: 14, fontFamily: 'Inter_700Bold' },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, backgroundColor: 'rgba(17,19,29,0.28)', paddingHorizontal: 13, paddingVertical: 11 },
  heroPillText: { color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' },

  accountCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 22, borderWidth: 1, gap: 14, marginBottom: 14 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff' },
  accountEmail: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2, flexShrink: 1 },
  accountSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  signOutBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  proBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  proBadgeTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 0.5 },
  emailConsentCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 22, borderWidth: 1, gap: 13, marginBottom: 14 },
  emailConsentIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#CBEDE1', alignItems: 'center', justifyContent: 'center' },
  emailConsentCopy: { flex: 1, minWidth: 0 },
  emailConsentTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  emailConsentText: { fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', marginTop: 2 },
  emailConsentEmail: { fontSize: 12, fontFamily: 'Inter_700Bold', marginTop: 6 },

  upgradeCard: { borderRadius: 18, padding: 18, marginBottom: 24 },
  upgradeTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  upgradeStarWrap: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  upgradeTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff' },
  upgradePrice: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  upgradeBtn: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  upgradeBtnTxt: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#E8825A' },
  featureList: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureTxt: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.9)' },

  magicGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginBottom: 14 },
  magicTile: {
    flex: 1,
    minWidth: 210,
    minHeight: 158,
    borderRadius: 28,
    padding: 16,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    shadowColor: '#2500FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.13,
    shadowRadius: 20,
    elevation: 5,
  },
  magicIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  magicTitle: { color: '#fff', fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 5 },
  magicText: { color: 'rgba(255,255,255,0.82)', fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold' },

  proUnlockedCard: { borderWidth: 1, borderRadius: 28, padding: 12, marginBottom: 18 },
  proActiveCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderRadius: 22, marginBottom: 14 },
  proActiveLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  proActiveStar: { width: 38, height: 38, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  proActiveTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  proActiveSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  unlockedTitle: { fontSize: 15, fontFamily: 'Inter_700Bold', marginBottom: 10, paddingHorizontal: 4 },
  unlockedGrid: { gap: 8 },
  unlockedFeature: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 18, padding: 13 },
  unlockedIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  unlockedLabel: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  unlockedSub: { fontSize: 11, fontFamily: 'Inter_500Medium', marginTop: 1 },

  beanCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 24, gap: 14, marginBottom: 14 },
  beanTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff' },
  beanSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
});
