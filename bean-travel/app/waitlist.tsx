import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

const TRAVELLER_TYPES = [
  { icon: 'briefcase' as const, label: 'Business Traveller', desc: 'Frequent trips for work' },
  { icon: 'heart' as const, label: 'Couple Traveller', desc: 'Adventures with a partner' },
  { icon: 'users' as const, label: 'Group Explorer', desc: 'Friends or family travel' },
  { icon: 'user' as const, label: 'Solo Adventurer', desc: 'Independent exploration' },
  { icon: 'camera' as const, label: 'Travel Photographer', desc: 'Capturing every moment' },
  { icon: 'map' as const, label: 'Dream Bean Collector', desc: 'Collecting future places that call to you' },
];

export default function WaitlistScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const topPt = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPb = Platform.OS === 'web' ? 34 : insets.bottom + 20;

  function handleSubmit() {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!selectedType) {
      setError('Please choose your traveller type.');
      return;
    }
    setError('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitted(true);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPt + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Join Bean</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: bottomPb + 20 }} showsVerticalScrollIndicator={false}>
        {submitted ? (
          <View style={styles.successContainer}>
            <View style={[styles.successIcon, { backgroundColor: colors.secondary + '20' }]}>
              <Feather name="check-circle" size={48} color={colors.secondary} />
            </View>
            <Text style={[styles.successTitle, { color: colors.foreground }]}>You're on the list!</Text>
            <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
              We'll let you know as soon as Bean opens up. In the meantime, keep exploring with the app.
            </Text>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
              <Text style={styles.doneBtnTxt}>Back to Bean</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={[styles.heroPin, { backgroundColor: colors.primary }]}>
              <Feather name="map-pin" size={28} color="#fff" />
            </View>
            <Text style={[styles.headline, { color: colors.foreground }]}>Get Early Access</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>
              Bean is growing. Join the waitlist and be the first to know when new memory features and sharing updates go live.
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Email Address</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: error && !email.includes('@') ? colors.destructive : 'transparent' }]}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={v => { setEmail(v); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 20 }]}>I travel as a...</Text>
            <View style={styles.typeGrid}>
              {TRAVELLER_TYPES.map(t => (
                <TouchableOpacity
                  key={t.label}
                  style={[styles.typeCard, { backgroundColor: selectedType === t.label ? colors.primary : colors.card, borderColor: selectedType === t.label ? colors.primary : colors.border }]}
                  onPress={() => { setSelectedType(t.label); setError(''); }}
                  activeOpacity={0.8}
                >
                  <Feather name={t.icon} size={20} color={selectedType === t.label ? '#fff' : colors.primary} />
                  <Text style={[styles.typeLabel, { color: selectedType === t.label ? '#fff' : colors.foreground }]}>{t.label}</Text>
                  <Text style={[styles.typeDesc, { color: selectedType === t.label ? 'rgba(255,255,255,0.8)' : colors.mutedForeground }]}>{t.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

            <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }]} onPress={handleSubmit} activeOpacity={0.85}>
              <Feather name="send" size={18} color="#fff" />
              <Text style={styles.submitTxt}>Join the Waitlist</Text>
            </TouchableOpacity>

            <Text style={[styles.fine, { color: colors.mutedForeground }]}>No spam, ever. Unsubscribe any time.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  heroPin: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 20, alignSelf: 'center' },
  headline: { fontSize: 28, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 10 },
  sub: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  fieldLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  input: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, fontFamily: 'Inter_400Regular', borderWidth: 1.5 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  typeCard: { width: '47%', padding: 14, borderRadius: 14, borderWidth: 1.5, gap: 6 },
  typeLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  typeDesc: { fontSize: 11, fontFamily: 'Inter_400Regular', lineHeight: 15 },
  error: { fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 12, textAlign: 'center' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 14, gap: 10, marginBottom: 12 },
  submitTxt: { color: '#fff', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  fine: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  successContainer: { alignItems: 'center', paddingTop: 40 },
  successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  successSub: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  doneBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  doneBtnTxt: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
