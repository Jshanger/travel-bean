import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TravelClerkProvider } from "@/components/TravelClerkProvider";
import { AppProvider } from "@/context/AppContext";
import { SubscriptionProvider } from "@/services/revenuecat";
import { getClerkProxyUrl, getClerkPublishableKey } from "@/utils/clerkConfig";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient();

const publishableKey = getClerkPublishableKey();
const configuredProxyUrl = getClerkProxyUrl();
const proxyUrl = Platform.OS === "web" ? undefined : configuredProxyUrl;

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="sign-up" options={{ headerShown: false }} />
      <Stack.Screen name="sso-callback" options={{ headerShown: false }} />
      <Stack.Screen name="dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="blog/index" options={{ headerShown: false }} />
      <Stack.Screen name="blog/settings" options={{ headerShown: false }} />
      <Stack.Screen name="blog/editor/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="share/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="[username]" options={{ headerShown: false }} />
      <Stack.Screen name="[username]/[slug]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Feather.font,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <TravelClerkProvider
            publishableKey={publishableKey}
            proxyUrl={proxyUrl}
          >
            <QueryClientProvider client={queryClient}>
              <SubscriptionProvider>
                <AppProvider>
                  <RootLayoutNav />
                </AppProvider>
              </SubscriptionProvider>
            </QueryClientProvider>
          </TravelClerkProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
