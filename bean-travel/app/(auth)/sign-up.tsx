import { useSignUpLegacy } from '@/hooks/useClerkAuth';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthBrandHero from '@/components/AuthBrandHero';
import { useColors } from '@/hooks/useColors';

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUpLegacy();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSignUp() {
    if (!email.trim()) {
      setErrorMsg('Enter your email address to create an account.');
      return;
    }
    if (!password) {
      setErrorMsg('Enter a password to create an account.');
      return;
    }
    if (!isLoaded || !signUp) {
      setErrorMsg('Sign up is still loading. Please try again in a moment.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? err?.message ?? 'Sign up failed. Please try again.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!code) {
      setErrorMsg('Enter the verification code from your email.');
      return;
    }
    if (!isLoaded || !signUp) {
      setErrorMsg('Verification is still loading. Please try again in a moment.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message ?? 'Verification failed.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  const topPt = Platform.OS === 'web' ? 67 : insets.top;

  if (
    signUp?.status === 'missing_requirements' &&
    signUp?.unverifiedFields?.includes('email_address') &&
    signUp?.missingFields?.length === 0
  ) {
    return (
      <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={{ paddingTop: topPt }}>
          <AuthBrandHero variant="verify" />
        </View>
        <View style={styles.inner}>
          <Text style={[styles.title, { color: colors.foreground }]}>Check your email</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>We sent a code to {email}</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>Verification code</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={code}
            onChangeText={v => { setCode(v); setErrorMsg(''); }}
            placeholder="6-digit code"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
          />
          {errorMsg ? <Text style={styles.err}>{errorMsg}</Text> : null}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnTxt}>Verify email</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => signUp.prepareEmailAddressVerification({ strategy: 'email_code' })}>
            <Text style={[styles.link, { color: colors.primary, textAlign: 'center' }]}>Resend code</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={{ paddingTop: topPt }}>
          <AuthBrandHero variant="signup" />
        </View>
        <View style={styles.inner}>
        <Text style={[styles.title, { color: colors.foreground }]}>Create account</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Use your email to save Beans and publish your Travel Bean Blog.</Text>

        <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          value={email}
          onChangeText={v => { setEmail(v); setErrorMsg(''); }}
          placeholder="you@example.com"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          value={password}
          onChangeText={v => { setPassword(v); setErrorMsg(''); }}
          placeholder="••••••••"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          autoComplete="new-password"
        />

        {errorMsg ? <Text style={styles.err}>{errorMsg}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }]}
          onPress={handleSignUp}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnTxt}>Create account</Text>}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerTxt, { color: colors.mutedForeground }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/sign-in' as any)}>
            <Text style={[styles.link, { color: colors.primary }]}>Sign in</Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingBottom: 42 },
  inner: { paddingHorizontal: 28, paddingTop: 26, paddingBottom: 40 },
  title: { fontSize: 30, fontFamily: 'Inter_700Bold', textAlign: 'left', marginBottom: 6 },
  subtitle: { fontSize: 16, lineHeight: 23, fontFamily: 'Inter_500Medium', textAlign: 'left', marginBottom: 24 },
  label: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginBottom: 7 },
  input: { borderWidth: 1, borderRadius: 18, padding: 16, fontSize: 15, fontFamily: 'Inter_500Medium', marginBottom: 15 },
  err: { fontSize: 12, color: '#E05252', marginBottom: 10, fontFamily: 'Inter_400Regular' },
  primaryBtn: {
    padding: 18, borderRadius: 24, alignItems: 'center', marginTop: 4, marginBottom: 20,
    shadowColor: '#542CF4', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 22, elevation: 6,
  },
  primaryBtnTxt: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#fff' },
  footer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  footerTxt: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  link: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
