import { Feather } from '@expo/vector-icons';
import { useSSO } from '@clerk/expo';
import { useSignUpLegacy } from '@/hooks/useClerkAuth';
import * as AuthSession from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthBrandHero from '@/components/AuthBrandHero';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUpLegacy();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    WebBrowser.warmUpAsync();
    return () => { WebBrowser.coolDownAsync(); };
  }, []);

  async function handleSignUp() {
    if (!isLoaded || !signUp) return;
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
    if (!isLoaded || !signUp) return;
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

  const handleGoogle = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const { createdSessionId, setActive: setSSOActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setSSOActive) {
        await setSSOActive({ session: createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      const msg = e?.errors?.[0]?.longMessage ?? e?.message ?? 'Google sign-in failed.';
      if (!msg.includes('Another web browser')) setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [startSSOFlow, router]);

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
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: (!code || loading) ? 0.6 : 1 }]}
            onPress={handleVerify}
            disabled={!code || loading}
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
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Start mapping your travels</Text>

        <TouchableOpacity style={[styles.googleBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={handleGoogle} activeOpacity={0.8} disabled={loading}>
          <Feather name="globe" size={18} color={colors.foreground} />
          <Text style={[styles.googleBtnTxt, { color: colors.foreground }]}>Continue with Google</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerTxt, { color: colors.mutedForeground }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

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
          style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: (!email || !password || loading) ? 0.6 : 1 }]}
          onPress={handleSignUp}
          disabled={!email || !password || loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnTxt}>Create account</Text>}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerTxt, { color: colors.mutedForeground }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-in' as any)}>
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
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: 16, borderRadius: 22, borderWidth: 1, marginBottom: 20,
    shadowColor: '#542CF4', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
  },
  googleBtnTxt: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerTxt: { fontSize: 12, fontFamily: 'Inter_400Regular' },
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
