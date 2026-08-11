import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import CreateBeanMascot from '@/components/CreateBeanMascot';
import { useApp } from '@/context/AppContext';
import { PREMIUM_STORAGE_MARKETING_BODY, PREMIUM_STORAGE_MARKETING_TITLE, type SubscriptionPlan } from '@/utils/premium';

const INK = '#2A1714';
const MUTED = '#7B6258';
const ORANGE = '#F26A2E';
const CARD = '#FFFDF8';
const PAPER = '#FFF8EF';
const BORDER = '#F1D7C5';

type PremiumMode = 'general' | 'templates' | 'limit' | 'export' | 'quotes';

interface Props {
  visible: boolean;
  mode?: PremiumMode;
  onClose: () => void;
  onActivated?: (plan: Exclude<SubscriptionPlan, 'free'>) => void;
}

const COPY: Record<PremiumMode, { title: string; subtitle: string }> = {
  general: {
    title: 'Publish Your Travel Bean Blog',
    subtitle: 'Upgrade to publish your public Travel Bean Blog, share reader links, HD exports, and room for thousands of memories.',
  },
  templates: {
    title: 'Unlock Blog Publishing',
    subtitle: 'Create Beans and draft blog posts for free. Premium unlocks public publishing.',
  },
  limit: {
    title: "You've used your 10 free Beans this month",
    subtitle: 'Upgrade for unlimited Beans, public blog posts, HD exports, and room for thousands of memories.',
  },
  export: {
    title: 'Want HD export?',
    subtitle: 'Upgrade to save sharper Beans and publish memories to your Travel Bean Blog when they are ready.',
  },
  quotes: {
    title: 'Unlock Blog Publishing',
    subtitle: 'Turn finished Beans into shareable travel stories on your public Travel Bean Blog.',
  },
};

const BENEFITS: Array<{ title: string; body: string; icon: keyof typeof Feather.glyphMap }> = [
  { title: 'Unlimited Beans', body: 'Create as many memories as you like.', icon: 'repeat' },
  { title: 'Unlimited Blog Publishing', body: 'Publish your Travel Bean Blog and individual posts for readers.', icon: 'globe' },
  { title: PREMIUM_STORAGE_MARKETING_TITLE, body: PREMIUM_STORAGE_MARKETING_BODY, icon: 'database' },
  { title: 'Public Share Links', body: 'Share your posts with anyone in a browser.', icon: 'link' },
  { title: 'HD Export', body: 'Save sharper, cleaner memory cards.', icon: 'download-cloud' },
];

export default function PremiumModal({ visible, mode = 'general', onClose, onActivated }: Props) {
  const { isPremium, subscriptionPlan, activatePremiumPlan, deactivatePremiumMode } = useApp();
  const copy = COPY[mode];

  async function startPlan(plan: Exclude<SubscriptionPlan, 'free'>) {
    await activatePremiumPlan(plan);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onActivated?.(plan);
    Alert.alert('Premium Mode is on', 'Payments are not connected yet, so Premium is enabled locally for testing.');
    onClose();
  }

  async function togglePremium(nextValue: boolean) {
    if (nextValue) {
      await startPlan(subscriptionPlan === 'yearly' ? 'yearly' : 'monthly');
    } else {
      await deactivatePremiumMode();
      Haptics.selectionAsync();
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.84}>
            <Feather name="x" size={20} color={INK} />
          </TouchableOpacity>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.mascotRow}>
              <CreateBeanMascot size={78} frameless bubble="star" />
              <View style={styles.iconCircle}>
                <Feather name="star" size={18} color="#fff" />
              </View>
            </View>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>

            <View style={styles.benefits}>
              {BENEFITS.map(benefit => (
                <View key={benefit.title} style={styles.benefitRow}>
                  <View style={styles.checkCircle}><Feather name={benefit.icon} size={13} color="#fff" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.benefitText}>{benefit.title}</Text>
                    <Text style={styles.benefitBody}>{benefit.body}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.pricingGrid}>
              <PricingCard
                title="Monthly"
                price="£6.99"
                cadence="/ month"
                button="Start Monthly"
                onPress={() => startPlan('monthly')}
              />
              <PricingCard
                title="Yearly"
                price="£49.99"
                cadence="/ year"
                badge="Best value"
                subtext="Save over 40%"
                button="Start Yearly"
                featured
                onPress={() => startPlan('yearly')}
              />
            </View>

            <Text style={styles.footerText}>Cancel anytime.</Text>

            <View style={styles.devToggle}>
              <View style={{ flex: 1 }}>
                <Text style={styles.devTitle}>Premium Mode</Text>
                <Text style={styles.devSub}>{isPremium ? `On${subscriptionPlan !== 'free' ? ` · ${subscriptionPlan}` : ''}` : 'Off'} for local testing</Text>
              </View>
              <Switch
                value={isPremium}
                onValueChange={togglePremium}
                trackColor={{ false: '#E8CBB8', true: '#F8B18F' }}
                thumbColor={isPremium ? ORANGE : '#FFFDF8'}
              />
            </View>

            <TouchableOpacity style={styles.laterButton} onPress={onClose} activeOpacity={0.84}>
              <Text style={styles.laterText}>Maybe later</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PricingCard({
  title,
  price,
  cadence,
  badge,
  subtext,
  button,
  featured,
  onPress,
}: {
  title: string;
  price: string;
  cadence: string;
  badge?: string;
  subtext?: string;
  button: string;
  featured?: boolean;
  onPress: () => void;
}) {
  return (
    <View style={[styles.priceCard, featured && styles.priceCardFeatured]}>
      {badge ? <Text style={styles.bestBadge}>{badge}</Text> : null}
      <Text style={styles.planTitle}>{title}</Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{price}</Text>
        <Text style={styles.cadence}>{cadence}</Text>
      </View>
      {subtext ? <Text style={styles.planSubtext}>{subtext}</Text> : <Text style={styles.planSubtext}>Flexible plan</Text>}
      <TouchableOpacity style={[styles.planButton, featured && styles.planButtonFeatured]} onPress={onPress} activeOpacity={0.86}>
        <Text style={[styles.planButtonText, featured && styles.planButtonTextFeatured]}>{button}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(42,23,20,0.32)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: PAPER, borderWidth: 1, borderColor: BORDER, overflow: 'hidden' },
  closeButton: { position: 'absolute', right: 18, top: 16, zIndex: 3, width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 },
  mascotRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginLeft: -12, marginTop: -30, borderWidth: 3, borderColor: CARD },
  title: { color: INK, fontSize: 27, lineHeight: 32, fontFamily: 'Inter_700Bold', paddingRight: 40 },
  subtitle: { color: MUTED, fontSize: 15, lineHeight: 22, fontFamily: 'Inter_500Medium', marginTop: 8 },
  benefits: { marginTop: 18, borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 14, gap: 10 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkCircle: { width: 23, height: 23, borderRadius: 12, backgroundColor: '#55A878', alignItems: 'center', justifyContent: 'center' },
  benefitText: { color: INK, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  benefitBody: { color: MUTED, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_500Medium', marginTop: 2 },
  pricingGrid: { flexDirection: 'row', gap: 10, marginTop: 14 },
  priceCard: { flex: 1, minHeight: 186, borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 13 },
  priceCardFeatured: { borderColor: ORANGE, backgroundColor: '#FFF1E6' },
  bestBadge: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 10, backgroundColor: '#DBF1E4', color: '#287451', paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, fontFamily: 'Inter_700Bold', marginBottom: 7 },
  planTitle: { color: INK, fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 7 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 4 },
  price: { color: INK, fontSize: 23, fontFamily: 'Inter_700Bold' },
  cadence: { color: MUTED, fontSize: 12, fontFamily: 'Inter_600SemiBold', marginBottom: 3 },
  planSubtext: { color: MUTED, fontSize: 12, fontFamily: 'Inter_600SemiBold', marginTop: 7, minHeight: 18 },
  planButton: { marginTop: 'auto', minHeight: 42, borderRadius: 21, borderWidth: 1, borderColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  planButtonFeatured: { backgroundColor: ORANGE },
  planButtonText: { color: ORANGE, fontSize: 12, fontFamily: 'Inter_700Bold' },
  planButtonTextFeatured: { color: '#fff' },
  footerText: { color: MUTED, textAlign: 'center', fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 12 },
  devToggle: { marginTop: 16, borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  devTitle: { color: INK, fontSize: 15, fontFamily: 'Inter_700Bold' },
  devSub: { color: MUTED, fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 3, textTransform: 'capitalize' },
  laterButton: { minHeight: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  laterText: { color: MUTED, fontSize: 14, fontFamily: 'Inter_700Bold' },
});
