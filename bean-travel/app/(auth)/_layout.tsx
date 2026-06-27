import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export default function AuthLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#F26A2E" size="large" />
        <Text style={styles.loadingText}>Loading Travel Bean sign in...</Text>
      </View>
    );
  }

  // If already signed in, redirect to the app
  if (isSignedIn) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: '#FFF8EF',
    padding: 24,
  },
  loadingText: {
    color: '#7A625A',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    textAlign: 'center',
  },
});
