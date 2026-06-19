import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

interface Props {
  compact?: boolean;
  size?: number;
}

export default function BrandMark({ compact = false, size = 54 }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.logoShadow, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox="0 0 128 128">
          <Path
            d="M63.9 24.6C56 16.1 47.8 15.6 40.4 21.4C46.3 28.3 54.3 31.1 63.9 27.1C64.7 26.8 64.7 25.4 63.9 24.6Z"
            fill="#75B84D"
          />
          <Path
            d="M63.4 24.6C71.8 15.9 82.3 15.1 91.9 22.1C83.8 31 74.4 33 63.4 27.3C62.5 26.8 62.6 25.4 63.4 24.6Z"
            fill="#86C85C"
          />
          <Circle cx="64" cy="71.4" r="39" fill="#F2B06F" stroke="#925C34" strokeWidth="3.6" />
          <Ellipse cx="48.9" cy="67.3" rx="3.4" ry="4.8" fill="#27120F" />
          <Ellipse cx="79.3" cy="67.3" rx="3.4" ry="4.8" fill="#27120F" />
          <Rect x="34.1" y="76.3" width="14.3" height="8.3" rx="4.15" fill="#F48678" />
          <Rect x="79.8" y="76.3" width="14.3" height="8.3" rx="4.15" fill="#F48678" />
          <Path d="M58 78.3C59.6 81.1 68.4 81.1 70 78.3" stroke="#27120F" strokeWidth="2.1" strokeLinecap="round" />
        </Svg>
      </View>
      {!compact && (
        <View>
          <Text style={styles.name}>Travel</Text>
          <Text style={styles.nameAccent}>Bean</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoShadow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 13, lineHeight: 13, fontFamily: 'Inter_700Bold', color: '#2A1714' },
  nameAccent: { fontSize: 13, lineHeight: 13, fontFamily: 'Inter_700Bold', color: '#F26A2E' },
});
