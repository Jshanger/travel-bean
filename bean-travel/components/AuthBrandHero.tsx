import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BrandMark from '@/components/BrandMark';
import CreateBeanMascot from '@/components/CreateBeanMascot';

interface Props {
  variant: 'signin' | 'signup' | 'verify';
}

const copy = {
  signin: {
    label: 'Welcome back',
    title: 'Your travel memories are waiting.',
  },
  signup: {
    label: 'Start your journal',
    title: 'Turn the places you love into Beans.',
  },
  verify: {
    label: 'Almost there',
    title: 'One small step to your travel journal.',
  },
};

export default function AuthBrandHero({ variant }: Props) {
  const item = copy[variant];

  return (
    <LinearGradient
      colors={['#FFF8EF', '#FFF1E3', '#FFFDF8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <BrandMark size={46} />
      <View style={styles.scene}>
        <View style={styles.sun} />
        <View style={[styles.sparkle, styles.sparkleLeft]} />
        <View style={[styles.sparkle, styles.sparkleRight]} />
        <CreateBeanMascot size={184} frameless bubble="heart" />
      </View>
      <Text style={styles.eyebrow}>{item.label}</Text>
      <Text style={styles.heroTitle}>{item.title}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  scene: {
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sun: {
    position: 'absolute',
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: '#FFE4C7',
    opacity: 0.42,
  },
  sparkle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: '#F5A24B',
    transform: [{ rotate: '45deg' }],
  },
  sparkleLeft: { left: 36, top: 74 },
  sparkleRight: { right: 44, bottom: 48 },
  eyebrow: {
    marginBottom: 7,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: '#F26A2E',
    textTransform: 'uppercase',
  },
  heroTitle: {
    maxWidth: 340,
    fontSize: 29,
    lineHeight: 35,
    fontFamily: 'Inter_700Bold',
    color: '#2A1714',
  },
});
