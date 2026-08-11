import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface Props {
  color?: string;
  size?: number;
  featured?: boolean;
}

export default function BeanMapPin({ color = '#542CF4', size = 42, featured = false }: Props) {
  const tip = size * 0.28;
  const beanSize = size * 0.56;

  return (
    <View style={[styles.wrap, { width: size, height: size + tip }]}>
      <LinearGradient
        colors={featured ? ['#6E35FF', '#24D6B7'] : [color, shadeColor(color, -18)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.body, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <View style={[styles.beanPlate, { width: beanSize, height: beanSize, borderRadius: beanSize / 2 }]}>
          <BeanGlyph size={beanSize * 0.82} color={color} />
        </View>
      </LinearGradient>
      <View
        style={[
          styles.tip,
          {
            width: tip,
            height: tip,
            bottom: tip * 0.52,
            borderRadius: tip * 0.22,
            backgroundColor: featured ? '#24D6B7' : shadeColor(color, -14),
          },
        ]}
      />
    </View>
  );
}

export function BeanGlyph({ size = 28, color = '#542CF4' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path
        d="M46.9 8.4c9.9 7.1 10.8 25.3 1.6 36.9-8.9 11.3-27.8 14.4-38.2 4.9C.1 40.9 4.1 22.1 17.1 13.4c8.2-5.5 19-12 29.8-5Z"
        fill={color}
        opacity="0.16"
      />
      <Path
        d="M49.4 11.1c6.6 6.9 5.7 19.9-1.8 29.1-8.4 10.4-22.4 13.6-31.4 7.5-8.7-5.9-9.1-18.1-2.6-27.4 3.9-5.6 8.7-7.8 14.1-7.1 4.8.7 7.1 4.4 12.1 4.2 3.5-.1 5.7-2.9 9.6-6.3Z"
        fill={color}
      />
      <Path
        d="M19.4 42.4c8.5 4.2 20.3-.4 25.9-9.9"
        fill="none"
        stroke="#fff"
        strokeLinecap="round"
        strokeWidth="5"
        opacity="0.72"
      />
    </Svg>
  );
}

function shadeColor(hex: string, amount: number) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const channels = [0, 2, 4].map(index => {
    const value = parseInt(clean.slice(index, index + 2), 16);
    return Math.max(0, Math.min(255, value + amount)).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  body: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#11131D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 2,
  },
  beanPlate: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  tip: {
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    borderRightWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#fff',
    shadowColor: '#11131D',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 7,
    elevation: 5,
    zIndex: 1,
  },
});
