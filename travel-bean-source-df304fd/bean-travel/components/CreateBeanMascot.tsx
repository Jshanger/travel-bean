import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

interface Props {
  size?: number;
  frameless?: boolean;
  bubble?: 'star' | 'heart' | 'none';
}

export default function CreateBeanMascot({ size = 132, frameless = false, bubble = 'star' }: Props) {
  return (
    <View style={[styles.card, frameless && styles.frameless, { width: size, height: size, borderRadius: size * 0.16 }]}>
      <Svg width={size * 0.9} height={size * 0.9} viewBox="0 0 150 150">
        <Ellipse cx="75" cy="136" rx="38" ry="7" fill="#EAD6BE" opacity={0.62} />

        {bubble !== 'none' && (
          <>
            <Circle cx="119" cy="41" r="23" fill="#FFFDF8" stroke="#F1D7C5" strokeWidth="2.4" />
            {bubble === 'heart' ? (
              <Path d="M119 52C109 45 106 39 108 34C110 29 116 29 119 34C123 29 129 29 131 34C134 40 129 46 119 52Z" fill="#F26A2E" />
            ) : (
              <Path d="M119 27L123 35L132 36.3L125.5 42.5L127 51.3L119 47.1L111 51.3L112.5 42.5L106 36.3L115 35Z" fill="#F26A2E" />
            )}
          </>
        )}

        <Path d="M33 77C20 80 17 97 26 108C36 120 50 112 48 95C47 83 42 75 33 77Z" fill="#2D8F88" />
        <Path d="M37 83C29 87 27 99 33 106" stroke="#236A66" strokeWidth="3" strokeLinecap="round" opacity={0.45} fill="none" />
        <Path d="M107 82C119 84 124 98 117 108C110 119 97 111 98 96C99 86 102 81 107 82Z" fill="#2D8F88" />

        <Path d="M42 32C39 21 50 12 73 12C96 12 104 21 101 31C83 27 61 27 42 32Z" fill="#2B7D78" />
        <Path d="M40 33C57 28 84 28 103 33C102 40 94 42 84 39C76 37 62 37 52 40C44 42 40 39 40 33Z" fill="#49A79C" />
        <Path d="M52 22C59 17 79 15 91 20" stroke="#77C8BC" strokeWidth="3" strokeLinecap="round" />

        <Path d="M33 73C33 45 50 31 73 31C98 31 113 48 112 78C111 112 94 130 73 130C49 130 33 107 33 73Z" fill="#C87625" />
        <Path d="M41 68C41 46 55 36 74 36C94 36 105 50 104 76C103 104 90 120 74 121C54 121 41 99 41 68Z" fill="#DF8B34" opacity={0.96} />
        <Path d="M94 42C104 51 108 66 105 86C102 108 91 121 75 123" stroke="#BD6D25" strokeWidth="5" strokeLinecap="round" opacity={0.18} fill="none" />

        <Ellipse cx="58" cy="68" rx="4.6" ry="6" fill="#20120F" />
        <Ellipse cx="88" cy="68" rx="4.6" ry="6" fill="#20120F" />
        <Path d="M63 82C69 88 79 88 84 81" stroke="#20120F" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <Circle cx="49" cy="83" r="6.8" fill="#F18A7B" opacity={0.86} />
        <Circle cx="98" cy="83" r="6.8" fill="#F18A7B" opacity={0.86} />

        <G stroke="#5A321D" strokeWidth="5.6" strokeLinecap="round" fill="none">
          <Path d="M44 94C38 102 35 111 36 118" />
          <Path d="M105 76C114 72 119 65 122 58" />
          <Path d="M119 61C123 58 128 61 126 66" />
          <Path d="M119 61C117 56 121 53 125 57" />
          <Path d="M47 125C42 130 36 130 32 126" />
          <Path d="M86 126C92 131 99 130 103 124" />
        </G>

        <G fill="none" stroke="#4A3A31" strokeWidth="3.6" strokeLinecap="round">
          <Path d="M49 86C59 96 64 103 67 111" />
          <Path d="M101 88C91 97 86 104 82 111" />
        </G>
        <Rect x="55" y="96" width="40" height="29" rx="6" fill="#5E4639" stroke="#2B1D18" strokeWidth="3" />
        <Rect x="62" y="91" width="14" height="8" rx="3" fill="#3F2C26" />
        <Circle cx="75" cy="110" r="10" fill="#2B201C" stroke="#9A7A66" strokeWidth="3" />
        <Circle cx="75" cy="110" r="4.5" fill="#17100E" />
        <Circle cx="88" cy="103" r="3" fill="#D8B090" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: '#F1D7C5',
    shadowColor: '#925C34',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  frameless: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
});
