import { useSignInLegacy } from '@/hooks/useClerkAuth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AuthBrandHero from '@/components/AuthBrandHero';
import { useColors } from '@/hooks/useColors';

type Screen = 'form' | 'otp';

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ redirect?: string | string[] }>();
  const { signIn, setActive, isLoaded } = useSignInLegacy();

  const [screen, setScreen] = useState<Screen>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const redirectTo = normalizeRedirect(params.redirect);

  async function handleSignIn() {
    if (!email.trim()) {
      setErrorMsg('Enter your email address to sign in.');
      return;
    }
    if (!password) {
      setErrorMsg('Enter your password to sign in.');
      return;
    }
    if (!isLoaded || !signIn) {
      setErrorMsg('Sign in is still loading. Please try again in a moment.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      // Step 1: identify the account — this reveals supported strategies
      const attempt = await signIn.create({ identifier: email });

      if (attempt.status === 'complete' && attempt.createdSessionId) {
        await setActive({ session: attempt.createdSessionId });
        router.replace(redirectTo as any);
        return;
      }

      const factors: any[] = attempt.supportedFirstFactors ?? [];
      const hasPassword = factors.some((f) => f.strategy === 'password');
      const hasEmailCode = factors.some((f) => f.strategy === 'email_code');
      const hasGoogleOnly =
        !hasPassword &&
        !hasEmailCode &&
        factors.some((f) => f.strategy?.startsWith('oauth_'));

      if (hasPassword) {
        // Step 2a: attempt password directly
        const result = await attempt.attemptFirstFactor({
          strategy: 'password',
          password,
        });
        if (result.status === 'complete' && result.createdSessionId) {
          await setActive({ session: result.createdSessionId });
          router.replace(redirectTo as any);
        }
      } else if (hasEmailCode) {
        // Step 2b: send email OTP then show code screen
        const emailFactor = factors.find((f) => f.strategy === 'email_code');
        await attempt.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: emailFactor?.emailAddressId,
        });
        setScreen('otp');
      } else if (hasGoogleOnly) {
        setErrorMsg('Google sign-in is temporarily unavailable. Please use an email and password account for now.');
      } else {
        setErrorMsg('Unable to sign in. Please check your credentials or sign up.');
      }
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ??
        err?.errors?.[0]?.message ??
        err?.message ??
        'Sign in failed. Please try again.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!verifyCode) {
      setErrorMsg('Enter the verification code from your email.');
      return;
    }
    if (!isLoaded || !signIn) {
      setErrorMsg('Verification is still loading. Please try again in a moment.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'email_code',
        code: verifyCode,
      });
      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace(redirectTo as any);
      }
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ??
        err?.errors?.[0]?.message ??
        'Verification failed. Try again.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  const topPt = Platform.OS === 'web' ? 67 : insets.top;

  if (screen === 'otp') {
    return (
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={{ paddingTop: topPt }}>
            <AuthBrandHero variant="verify" />
          </View>
          <View style={styles.inner}>
          <Text style={[styles.title, { color: colors.foreground }]}>Check your email</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            We sent a code to {email}
          </Text>
          <Text style={[styles.label, { color: colors.foreground }]}>Verification code</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            value={verifyCode}
            onChangeText={v => { setVerifyCode(v); setErrorMsg(''); }}
            placeholder="6-digit code"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            autoFocus
          />
          {errorMsg ? <Text style={styles.err}>{errorMsg}</Text> : null}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnTxt}>Verify</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setScreen('form'); setErrorMsg(''); setVerifyCode(''); }}>
            <Text style={[styles.link, { color: colors.primary, textAlign: 'center' }]}>Back to sign in</Text>
          </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingTop: topPt }}>
          <AuthBrandHero variant="signin" />
        </View>
        <View style={styles.inner}>
        <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Sign in with your email to manage your Beans and blog.</Text>

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
          autoComplete="password"
        />

        {errorMsg ? <Text style={styles.err}>{errorMsg}</Text> : null}

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }]}
          onPress={handleSignIn}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnTxt}>Sign in</Text>}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerTxt, { color: colors.mutedForeground }]}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/sign-up' as any)}>
            <Text style={[styles.link, { color: colors.primary }]}>Sign up</Text>
          </TouchableOpacity>
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function normalizeRedirect(value?: string | string[]) {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/(tabs)';
  if (next.includes('://')) return '/(tabs)';
  return next;
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
