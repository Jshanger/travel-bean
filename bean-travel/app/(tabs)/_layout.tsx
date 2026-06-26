import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ORANGE = '#F26A2E';
const INK = '#2A1714';
const MUTED = '#9E7B6B';
const PAPER = '#FFF8EF';
const BORDER = '#F1D7C5';

export default function TabLayout() {
  const safeAreaInsets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const isIOS = Platform.OS === 'ios';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ORANGE,
        tabBarInactiveTintColor: MUTED,
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 2 },
        tabBarItemStyle: { alignItems: 'center', justifyContent: 'center' },
        tabBarStyle: {
          position: 'absolute',
          height: 76 + safeAreaInsets.bottom,
          paddingTop: 7,
          paddingBottom: Math.max(safeAreaInsets.bottom, 10),
          backgroundColor: isIOS ? 'transparent' : PAPER,
          borderTopWidth: 1,
          borderTopColor: BORDER,
          elevation: 0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={92} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: PAPER }]} />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="passport"
        options={{
          title: 'Passport',
          tabBarIcon: ({ color }) => <Feather name="map" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          tabBarLabelStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 11, marginTop: 8 },
          tabBarIcon: ({ focused }) => (
            <View style={[styles.createButton, { transform: [{ scale: focused ? 1.05 : 1 }] }]}>
              <Feather name="plus" size={25} color="#fff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          href: '/journal',
          tabBarIcon: ({ color }) => <Feather name="book-open" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="blog"
        options={{
          title: 'Blog',
          href: '/blog' as any,
          tabBarIcon: ({ color }) => <Feather name="globe" size={22} color={color} />,
        }}
      />
      {['places', 'trips', 'bucket', 'more'].map(name => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -15,
    backgroundColor: ORANGE,
    shadowColor: INK,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
});
