import { useClerk } from '@clerk/expo';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useColors } from '@/hooks/useColors';

export default function SsoCallbackScreen() {
  const clerk = useClerk() as any;
  const router = useRouter();
  const colors = useColors();
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let mounted = true;

    async function completeOAuth() {
      try {
        await clerk.handleRedirectCallback(
          {
            signInUrl: '/sign-in',
            signUpUrl: '/sign-up',
            continueSignUpUrl: '/sign-up',
          },
          (to: string) => router.replace((to || '/(tabs)') as any),
        );
      } catch (err: any) {
        if (!mounted) return;
        const msg =
          err?.errors?.[0]?.longMessage ??
          err?.errors?.[0]?.message ??
          err?.message ??
          'Google sign-in could not be completed. Please try again.';
        setErrorMsg(msg);
      }
    }

    void completeOAuth();

    return () => {
      mounted = false;
    };
  }, [clerk, router]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {errorMsg ? (
        <>
          <Text style={[styles.title, { color: colors.foreground }]}>Sign in paused</Text>
          <Text style={[styles.message, { color: colors.mutedForeground }]}>{errorMsg}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.message, { color: colors.mutedForeground }]}>Finishing Google sign-in...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 14,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
});
