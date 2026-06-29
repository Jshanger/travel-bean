import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CreateBeanMascot from '@/components/CreateBeanMascot';
import PremiumModal from '@/components/PremiumModal';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTravelAuth, useTravelUser } from '@/hooks/useTravelAuth';
import { PREMIUM_STORAGE_MARKETING_BODY, PREMIUM_STORAGE_MARKETING_TITLE } from '@/utils/premium';

const PRO_FEATURES = [
  { icon: 'globe' as const, label: 'Unlimited blog publishing', body: 'Publish your blog and individual posts for readers.' },
  { icon: 'edit-3' as const, label: 'Fully editable blog', body: 'Edit posts, drafts, photos, and settings on web.' },
  { icon: 'link' as const, label: 'Public blog links', body: 'Share your blog and individual posts with readers.' },
  { icon: 'database' as const, label: PREMIUM_STORAGE_MARKETING_TITLE, body: PREMIUM_STORAGE_MARKETING_BODY },
  { icon: 'repeat' as const, label: 'Unlimited Beans', body: 'Keep creating beyond the free monthly limit.' },
  { icon: 'download-cloud' as const, label: 'HD export', body: 'Save sharper, cleaner memory cards.' },
];

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isPro, userProfile, updateMarketingConsent } = useApp();
  const { signOut } = useTravelAuth();
  const { user } = useTravelUser();
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
        colors={['#FFF8EF', '#FFE7D6', '#EFFAF5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroLogo}>
            <CreateBeanMascot size={64} frameless bubble="star" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroKicker}>{isPro ? 'Premium is active' : 'Settings'}</Text>
            <Text style={styles.heroTitle}>Travel Bean</Text>
          </View>
          {user ? (
            <TouchableOpacity onPress={handleSignOut} style={styles.heroSignOut}>
              <Feather name="log-out" size={16} color="#153A46" />
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.heroText}>Create Beans while you travel, then turn your best memories into a public Travel Bean Blog.</Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{isPro ? '∞' : '10'}</Text>
            <Text style={styles.heroStatLabel}>{isPro ? 'Beans' : 'Free Beans/mo'}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{isPro ? '∞' : 'Drafts'}</Text>
            <Text style={styles.heroStatLabel}>{isPro ? 'Public posts' : 'Preview only'}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>1000+</Text>
            <Text style={styles.heroStatLabel}>Memories</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>Web</Text>
            <Text style={styles.heroStatLabel}>Blog dashboard</Text>
          </View>
        </View>

        <View style={styles.heroActions}>
          <TouchableOpacity
            style={styles.heroPrimary}
            onPress={() => !isPro && setShowPaywall(true)}
            activeOpacity={0.9}
          >
            <Text style={styles.heroPrimaryText}>{isPro ? 'Premium publishing unlocked' : 'Unlock publishing'}</Text>
            <Feather name={isPro ? 'check-circle' : 'arrow-right'} size={17} color="#fff" />
          </TouchableOpacity>
          <View style={styles.heroPill}>
            <Feather name="star" size={14} color="#F26A2E" />
            <Text style={styles.heroPillText}>Made for travel stories</Text>
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
                {isPro ? 'Travel Bean Premium · Active' : 'Signed in to Travel Bean'}
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

      {/* Bean Pro card */}
      {isPro ? (
        <View style={[styles.proUnlockedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <LinearGradient colors={['#153A46', '#2D8F88']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.proActiveCard}>
            <View style={styles.proActiveLeft}>
              <View style={styles.proActiveStar}>
                <Feather name="star" size={18} color="#fff" />
              </View>
              <View>
                <Text style={styles.proActiveTitle}>Travel Bean Premium is open</Text>
                <Text style={styles.proActiveSub}>Unlimited Beans, public blog publishing, editable posts, and HD exports.</Text>
              </View>
            </View>
            <Feather name="check-circle" size={22} color="rgba(255,255,255,0.9)" />
          </LinearGradient>
          <Text style={[styles.unlockedTitle, { color: colors.foreground }]}>Premium publishing tools</Text>
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
              <Text style={styles.upgradeTitle}>Travel Bean Premium</Text>
              <Text style={styles.upgradePrice}>£6.99 / month · £49.99 / year</Text>
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
      <LinearGradient colors={['#153A46', '#2D8F88']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.beanCard}>
        <Feather name="map-pin" size={24} color="#FFE7D6" />
        <View style={{ flex: 1 }}>
          <Text style={styles.beanTitle}>Your travel stories belong to you.</Text>
          <Text style={styles.beanSub}>Create Beans on the go, publish only what you choose, and keep editing from the web dashboard.</Text>
        </View>
      </LinearGradient>

      <PremiumModal visible={showPaywall} mode="general" onClose={() => setShowPaywall(false)} />
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
    borderWidth: 1,
    borderColor: '#F1D7C5',
    shadowColor: '#925C34',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 26,
    elevation: 9,
  },
  heroTopRow: { zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroLogo: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroKicker: { color: '#F26A2E', fontSize: 11, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 4 },
  heroTitle: { color: '#2A1714', fontSize: 32, lineHeight: 36, fontFamily: 'Inter_700Bold', maxWidth: 620 },
  heroText: { zIndex: 2, color: '#7B6258', fontSize: 16, lineHeight: 23, fontFamily: 'Inter_600SemiBold', marginTop: 18, maxWidth: 660 },
  heroSignOut: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(21,58,70,0.1)', alignItems: 'center', justifyContent: 'center' },
  heroStats: { zIndex: 2, flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 20 },
  heroStat: {
    minWidth: 104,
    borderRadius: 20,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: '#F1D7C5',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroStatValue: { color: '#153A46', fontSize: 24, fontFamily: 'Inter_700Bold' },
  heroStatLabel: { color: '#7B6258', fontSize: 11, fontFamily: 'Inter_700Bold', marginTop: 2 },
  heroActions: { zIndex: 2, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 22 },
  heroPrimary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F26A2E', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 13 },
  heroPrimaryText: { color: '#fff', fontSize: 14, fontFamily: 'Inter_700Bold' },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 999, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#F1D7C5', paddingHorizontal: 13, paddingVertical: 11 },
  heroPillText: { color: '#153A46', fontSize: 12, fontFamily: 'Inter_700Bold' },

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
    shadowColor: '#925C34',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
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
