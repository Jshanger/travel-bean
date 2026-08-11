import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { useSubscription } from '@/services/revenuecat';

const FEATURES: { icon: keyof typeof Feather.glyphMap; label: string; desc: string }[] = [
  { icon: 'users',      label: 'Trip collaboration', desc: 'Invite friends to vote and comment on your itinerary' },
  { icon: 'share-2',    label: 'Shareable Trip links', desc: 'Send anyone a live read-only view of your plan' },
  { icon: 'file-text',  label: 'PDF Trip export', desc: 'Download any Trip as a polished itinerary' },
  { icon: 'image',      label: 'Unlimited Memories', desc: 'Add as many photo memories as you like to any place' },
  { icon: 'mic',        label: 'Voice-to-text Bean notes', desc: 'Dictate notes hands-free while you explore' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function PaywallModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activatePro, refreshEntitlements } = useApp();
  const { offerings, purchase, restore, isPurchasing, isRestoring } = useSubscription();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
  const [devLoading, setDevLoading] = useState(false);

  const topPt = Platform.OS === 'web' ? 24 : insets.top + 16;
  const bottomPb = Platform.OS === 'web' ? 24 : insets.bottom + 16;

  const currentOffering = offerings?.current;
  const monthlyPkg = currentOffering?.availablePackages.find((p) => p.packageType === 'MONTHLY');
  const yearlyPkg  = currentOffering?.availablePackages.find((p) => p.packageType === 'ANNUAL');
  const selectedPkg = billing === 'monthly' ? monthlyPkg : yearlyPkg;

  const monthlyPrice = monthlyPkg?.product.priceString ?? '$2.99';
  const yearlyPrice  = yearlyPkg?.product.priceString  ?? '$17.99';

  async function handlePurchase() {
    if (!selectedPkg) {
      Alert.alert('Not available', 'Please try again in a moment.');
      return;
    }
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await purchase(selectedPkg);
      await refreshEntitlements();
      onClose();
    } catch (e: any) {
      if (e?.userCancelled) return;
      Alert.alert('Purchase failed', e?.message ?? 'Please try again.');
    }
  }

  async function handleRestore() {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await restore();
      await refreshEntitlements();
      Alert.alert('Restored!', 'Your purchases have been restored.');
      onClose();
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? 'Please try again.');
    }
  }

  async function handleDevActivate() {
    setDevLoading(true);
    try { await activatePro(); onClose(); } finally { setDevLoading(false); }
  }

  const isBusy = isPurchasing || isRestoring || devLoading;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: topPt }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPb + 20 }]} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.heroSection}>
            <View style={[styles.starBadge, { backgroundColor: colors.primary + '18' }]}>
              <Feather name="star" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>Bean Pro</Text>
            <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
              Unlock your full Bean life
            </Text>
          </View>

          {/* Feature list */}
          <View style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {FEATURES.map((f, i) => (
              <View key={f.label} style={[styles.featureRow, i < FEATURES.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <View style={[styles.featureIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Feather name={f.icon} size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.featureLabel, { color: colors.foreground }]}>{f.label}</Text>
                  <Text style={[styles.featureDesc, { color: colors.mutedForeground }]}>{f.desc}</Text>
                </View>
                <Feather name="check" size={16} color="#7DAF8C" />
              </View>
            ))}
          </View>

          {/* Pricing toggle */}
          <View style={[styles.pricingToggle, { backgroundColor: colors.muted }]}>
            <TouchableOpacity
              style={[styles.pricingOption, billing === 'monthly' && { backgroundColor: colors.background, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 }]}
              onPress={() => { setBilling('monthly'); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.pricingPrice, { color: colors.foreground }]}>{monthlyPrice}</Text>
              <Text style={[styles.pricingPer, { color: colors.mutedForeground }]}>/ month</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pricingOption, billing === 'yearly' && { backgroundColor: colors.background, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 }]}
              onPress={() => { setBilling('yearly'); Haptics.selectionAsync(); }}
            >
              <View style={styles.saveBadge}>
                <Text style={styles.saveTxt}>SAVE 50%</Text>
              </View>
              <Text style={[styles.pricingPrice, { color: colors.foreground }]}>{yearlyPrice}</Text>
              <Text style={[styles.pricingPer, { color: colors.mutedForeground }]}>/ year</Text>
            </TouchableOpacity>
          </View>

          {/* Subscribe button */}
          <TouchableOpacity
            style={[styles.subscribeBtn, { backgroundColor: isBusy ? colors.primary + '80' : colors.primary }]}
            onPress={handlePurchase}
            disabled={isBusy}
            activeOpacity={0.88}
          >
            {isPurchasing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.subscribeTxt}>
                  {billing === 'monthly'
                    ? `Subscribe for ${monthlyPrice} / month`
                    : `Subscribe for ${yearlyPrice} / year`}
                </Text>
            }
          </TouchableOpacity>

          <Text style={[styles.legalTxt, { color: colors.mutedForeground }]}>
            Cancel anytime. Billed through the App Store.
          </Text>

          <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={isBusy}>
            {isRestoring
              ? <ActivityIndicator size="small" color={colors.mutedForeground} />
              : <Text style={[styles.restoreTxt, { color: colors.mutedForeground }]}>Restore Purchase</Text>
            }
          </TouchableOpacity>

          {/* Dev-only test button */}
          {__DEV__ && (
            <TouchableOpacity
              style={[styles.devBtn, { borderColor: colors.border }]}
              onPress={handleDevActivate}
              disabled={isBusy}
            >
              {devLoading
                ? <ActivityIndicator size="small" color={colors.mutedForeground} />
                : <Text style={[styles.devTxt, { color: colors.mutedForeground }]}>⚙️ Activate Pro (Dev only)</Text>
              }
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingBottom: 8, alignItems: 'flex-end' },
  closeBtn: { padding: 4 },
  content: { paddingHorizontal: 24, gap: 16 },
  heroSection: { alignItems: 'center', paddingTop: 8, paddingBottom: 8, gap: 8 },
  starBadge: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -0.5 },
  heroSub: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  featureCard: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  featureIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  featureDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 16 },
  pricingToggle: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  pricingOption: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 11, gap: 2, position: 'relative' },
  pricingPrice: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  pricingPer: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  saveBadge: { position: 'absolute', top: -8, backgroundColor: '#7DAF8C', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  saveTxt: { fontSize: 9, fontFamily: 'Inter_700Bold', color: '#fff', letterSpacing: 0.5 },
  subscribeBtn: { borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  subscribeTxt: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  legalTxt: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  restoreBtn: { alignItems: 'center', paddingVertical: 4 },
  restoreTxt: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  devBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderStyle: 'dashed', marginTop: 8 },
  devTxt: { fontSize: 13, fontFamily: 'Inter_400Regular' },
});
