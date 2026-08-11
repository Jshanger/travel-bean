import React, { useMemo } from 'react';
import Svg, { G, Path } from 'react-native-svg';
import { COUNTRY_COORDS, countryToPath } from '@/constants/countryPaths';

interface Props {
  country?: string;
  color?: string;
  mutedColor?: string;
}

function toPoint([lon, lat]: [number, number]) {
  return [lon + 180, 90 - lat] as const;
}

export default function CountryMiniMap({ country, color = '#542CF4', mutedColor = 'rgba(255,255,255,0.28)' }: Props) {
  const data = country ? COUNTRY_COORDS[country] : undefined;

  const viewBox = useMemo(() => {
    if (!data) return '0 0 360 180';
    const points = data.flat().map(toPoint);
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const padX = Math.max((maxX - minX) * 0.22, 4);
    const padY = Math.max((maxY - minY) * 0.22, 4);
    return `${minX - padX} ${minY - padY} ${maxX - minX + padX * 2} ${maxY - minY + padY * 2}`;
  }, [data]);

  if (!data) {
    return (
      <Svg viewBox="0 0 360 180" width="100%" height="100%">
        <Path d="M55 72 C88 46 134 52 160 77 C188 102 232 78 279 96 C304 106 305 133 267 144 C220 158 198 130 158 139 C103 151 44 130 55 72 Z" fill={mutedColor} />
      </Svg>
    );
  }

  return (
    <Svg viewBox={viewBox} width="100%" height="100%">
      <G>
        <Path d={countryToPath(data)} fill={color} stroke="rgba(255,255,255,0.78)" strokeWidth="0.65" />
      </G>
    </Svg>
  );
}
