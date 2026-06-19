import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import {
  Alert, Dimensions, Modal, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { useColors } from '@/hooks/useColors';
import { PlacePhoto, VisitedPlace } from '@/types';

const { width: SW, height: SH } = Dimensions.get('window');
const G = 3; // gap between photos
const BEAN_DARK = '#2D2926';
const PLACEHOLDER_GRADIENT = ['#DCEAFF', '#EEF7FF', '#F8F3FF'] as const;

interface CollageTheme {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  bg: string;
  ink: string;
  muted: string;
  accent: string;
  frame: string;
  footer: string;
}

const COLLAGE_THEMES: CollageTheme[] = [
  { id: 'cinematic', label: 'Cinematic', icon: 'film', bg: '#11131D', ink: '#FFFFFF', muted: 'rgba(255,255,255,0.66)', accent: '#F6C85F', frame: '#FFFFFF', footer: 'Memory · cinematic travel journal' },
  { id: 'scrapbook', label: 'Scrapbook', icon: 'scissors', bg: '#FFF7E8', ink: '#2B2430', muted: 'rgba(43,36,48,0.6)', accent: '#FF7A59', frame: '#F7E2C6', footer: 'Memory · scrapbook keepsake' },
  { id: 'minimal', label: 'Minimal', icon: 'circle', bg: '#F7F8FC', ink: '#11131D', muted: '#7B8193', accent: '#542CF4', frame: '#FFFFFF', footer: 'Memory · made with Place' },
  { id: 'explorer', label: 'Explorer', icon: 'compass', bg: '#153A46', ink: '#FFFFFF', muted: 'rgba(255,255,255,0.68)', accent: '#5BCF9A', frame: '#E9F5EC', footer: 'Memory · little atlas entry' },
];

function apiBase() {
  const d = process.env.EXPO_PUBLIC_DOMAIN;
  return d ? `https://${d}/api/bean` : '/api/bean';
}

function imgSrc(photo: PlacePhoto, auth: Record<string, string>) {
  return { uri: `${apiBase()}/photos/img/${encodeURIComponent(photo.id)}`, headers: auth };
}

function canvasSize(ratio: number): { w: number; h: number } {
  const maxW = SW - 48;
  const maxH = SH * 0.48;
  let w = maxW, h = w / ratio;
  if (h > maxH) { h = maxH; w = h * ratio; }
  return { w: Math.round(w), h: Math.round(h) };
}

function waitForFrame(ms = 160) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Slot helper ──────────────────────────────────────────────────────────────

function PhotoOrPlaceholder({
  photo, auth, style,
}: { photo?: PlacePhoto; auth: Record<string, string>; style: any }) {
  if (photo) return <Image source={imgSrc(photo, auth)} style={style} contentFit="cover" />;
  return <MemoryPlaceholder style={style} />;
}

function MemoryPlaceholder({ style }: { style: any }) {
  return (
    <LinearGradient
      colors={PLACEHOLDER_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[style, placeholder.wrap]}
    >
      <View style={placeholder.bean}>
        <Feather name="image" size={14} color="#542CF4" />
      </View>
    </LinearGradient>
  );
}

// ─── Bean header / footer ─────────────────────────────────────────────────────

function BeanHeader({ place, theme }: { place: VisitedPlace; theme: CollageTheme }) {
  return (
    <View style={[hdr.wrap, { backgroundColor: theme.bg }]}>
      <View style={{ flex: 1 }}>
        <Text style={[hdr.title, { color: theme.ink }]} numberOfLines={1}>{place.name}</Text>
        {place.country ? <Text style={[hdr.sub, { color: theme.muted }]}>{place.country}</Text> : null}
      </View>
      <View style={[hdr.beanMark, { backgroundColor: theme.accent }]}>
        <Feather name="coffee" size={10} color={theme.bg === '#FFF7E8' || theme.bg === '#F7F8FC' ? '#fff' : theme.bg} />
      </View>
      {place.dateVisited ? <Text style={[hdr.date, { color: theme.muted }]}>{place.dateVisited}</Text> : null}
    </View>
  );
}

function BeanFooter({ theme }: { theme: CollageTheme }) {
  return (
    <View style={[hdr.foot, { backgroundColor: theme.bg }]}>
      <Feather name="map-pin" size={10} color={theme.muted} />
      <Text style={[hdr.footTxt, { color: theme.muted }]}>{theme.footer}</Text>
    </View>
  );
}

const hdr = StyleSheet.create({
  wrap: { backgroundColor: BEAN_DARK, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center' },
  title: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
  sub: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontFamily: 'Inter_400Regular', marginTop: 1 },
  date: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontFamily: 'Inter_400Regular' },
  beanMark: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  foot: { backgroundColor: BEAN_DARK, paddingHorizontal: 12, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  footTxt: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontFamily: 'Inter_400Regular' },
});

const placeholder = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bean: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#542CF4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 4,
  },
});

// ─── Layout renderers ─────────────────────────────────────────────────────────

type RenderFn = (photos: PlacePhoto[], w: number, h: number, auth: Record<string, string>) => React.ReactNode;
type ThumbFn = (w: number, h: number) => React.ReactNode;

function pStyle(w: number, h: number) { return { width: w, height: h } as const; }
function slot(p: PlacePhoto[], index: number) { return p.length > 0 ? p[index % p.length] : undefined; }

const renders: Record<string, RenderFn> = {
  // ── Memory Collage Classics ────────────────────────────────────────────────
  mem_ribbons: (p, w, h, a) => {
    const aH = Math.round(h * 0.33);
    const bH = Math.round(h * 0.28);
    const cH = h - aH - bH - G * 2;
    return (
      <View style={{ gap: G }}>
        <PhotoOrPlaceholder photo={slot(p, 0)} auth={a} style={pStyle(w, aH)} />
        <PhotoOrPlaceholder photo={slot(p, 1)} auth={a} style={pStyle(w, bH)} />
        <PhotoOrPlaceholder photo={slot(p, 2)} auth={a} style={pStyle(w, cH)} />
      </View>
    );
  },

  mem_columns: (p, w, h, a) => {
    const cw = (w - G * 2) / 3;
    return (
      <View style={{ flexDirection: 'row', gap: G }}>
        {[0, 1, 2].map(i => <PhotoOrPlaceholder key={i} photo={slot(p, i)} auth={a} style={pStyle(cw, h)} />)}
      </View>
    );
  },

  mem_window: (p, w, h, a) => {
    const topH = Math.round(h * 0.43);
    const cellH = (h - topH - G * 2) / 2;
    const cellW = (w - G * 2) / 3;
    return (
      <View style={{ gap: G }}>
        <PhotoOrPlaceholder photo={slot(p, 0)} auth={a} style={pStyle(w, topH)} />
        {[0, 1].map(row => (
          <View key={row} style={{ flexDirection: 'row', gap: G }}>
            {[0, 1, 2].map(col => {
              const i = 1 + row * 3 + col;
              return <PhotoOrPlaceholder key={i} photo={slot(p, i)} auth={a} style={pStyle(cellW, cellH)} />;
            })}
          </View>
        ))}
      </View>
    );
  },

  mem_fieldnotes: (p, w, h, a) => {
    const topH = Math.round(h * 0.46);
    const botH = h - topH - G;
    const topW = (w - G * 2) / 3;
    const botW = (w - G) / 2;
    return (
      <View style={{ gap: G }}>
        <View style={{ flexDirection: 'row', gap: G }}>
          {[0, 1, 2].map(i => <PhotoOrPlaceholder key={i} photo={slot(p, i)} auth={a} style={pStyle(topW, topH)} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: G }}>
          {[3, 4].map(i => <PhotoOrPlaceholder key={i} photo={slot(p, i)} auth={a} style={pStyle(botW, botH)} />)}
        </View>
      </View>
    );
  },

  mem_atlas: (p, w, h, a) => {
    const leftW = Math.round(w * 0.56);
    const rightW = w - leftW - G;
    const rightH = (h - G * 2) / 3;
    return (
      <View style={{ flexDirection: 'row', gap: G }}>
        <PhotoOrPlaceholder photo={slot(p, 0)} auth={a} style={pStyle(leftW, h)} />
        <View style={{ gap: G }}>
          {[1, 2, 3].map(i => <PhotoOrPlaceholder key={i} photo={slot(p, i)} auth={a} style={pStyle(rightW, rightH)} />)}
        </View>
      </View>
    );
  },

  mem_circle: (p, w, h, a) => {
    const size = Math.min(w, h) * 0.82;
    return (
      <LinearGradient colors={['#EAF1FF', '#FFF7E8']} style={{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }}>
        <PhotoOrPlaceholder photo={slot(p, 0)} auth={a} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 8, borderColor: '#FFFFFF' }} />
      </LinearGradient>
    );
  },

  mem_bean: (p, w, h, a) => {
    const beanW = Math.round(w * 0.82);
    const beanH = Math.round(h * 0.62);
    return (
      <LinearGradient colors={['#F7F8FC', '#E9F8F5']} style={{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }}>
        <PhotoOrPlaceholder
          photo={slot(p, 0)}
          auth={a}
          style={{
            width: beanW,
            height: beanH,
            borderRadius: beanH / 2,
            borderWidth: 8,
            borderColor: '#FFFFFF',
            transform: [{ rotate: '-6deg' }],
          }}
        />
      </LinearGradient>
    );
  },

  mem_postcard: (p, w, h, a) => {
    const mainH = Math.round(h * 0.7);
    const thumbW = (w - G * 2) / 3;
    return (
      <View style={{ gap: G }}>
        <PhotoOrPlaceholder photo={slot(p, 0)} auth={a} style={pStyle(w, mainH)} />
        <View style={{ flexDirection: 'row', gap: G }}>
          {[1, 2, 3].map(i => <PhotoOrPlaceholder key={i} photo={slot(p, i)} auth={a} style={pStyle(thumbW, h - mainH - G)} />)}
        </View>
      </View>
    );
  },

  // ── Instagram Post ──────────────────────────────────────────────────────────
  ip_single: (p, w, h, a) => <PhotoOrPlaceholder photo={p[0]} auth={a} style={pStyle(w, h)} />,

  ip_duo: (p, w, h, a) => {
    const fw = (w - G) / 2;
    return (
      <View style={{ flexDirection: 'row', gap: G }}>
        {[0, 1].map(i => <PhotoOrPlaceholder key={i} photo={p[i]} auth={a} style={pStyle(fw, h)} />)}
      </View>
    );
  },

  ip_featured: (p, w, h, a) => {
    const topH = Math.round(h * 0.6), botH = h - topH - G;
    const n = Math.min(p.length > 1 ? p.length - 1 : 1, 3);
    const bw = (w - G * (n - 1)) / n;
    return (
      <View style={{ gap: G }}>
        <PhotoOrPlaceholder photo={p[0]} auth={a} style={pStyle(w, topH)} />
        <View style={{ flexDirection: 'row', gap: G }}>
          {Array.from({ length: n }, (_, i) => (
            <PhotoOrPlaceholder key={i} photo={p[i + 1]} auth={a} style={pStyle(bw, botH)} />
          ))}
        </View>
      </View>
    );
  },

  ip_grid: (p, w, h, a) => {
    const cell = (w - G) / 2, cellH = (h - G) / 2;
    return (
      <View style={{ gap: G }}>
        {[0, 2].map(row => (
          <View key={row} style={{ flexDirection: 'row', gap: G }}>
            {[row, row + 1].map(i => <PhotoOrPlaceholder key={i} photo={p[i]} auth={a} style={pStyle(cell, cellH)} />)}
          </View>
        ))}
      </View>
    );
  },

  ip_mosaic: (p, w, h, a) => {
    const lw = Math.round(w * 0.6), rw = w - lw - G, cellH = (h - G) / 2;
    return (
      <View style={{ flexDirection: 'row', gap: G }}>
        <PhotoOrPlaceholder photo={p[0]} auth={a} style={pStyle(lw, h)} />
        <View style={{ gap: G }}>
          {[1, 2].map(i => <PhotoOrPlaceholder key={i} photo={p[i]} auth={a} style={pStyle(rw, cellH)} />)}
        </View>
      </View>
    );
  },

  // ── Stories ─────────────────────────────────────────────────────────────────
  st_single: (p, w, h, a) => <PhotoOrPlaceholder photo={p[0]} auth={a} style={pStyle(w, h)} />,

  st_duo: (p, w, h, a) => {
    const bh = (h - G) / 2;
    return (
      <View style={{ gap: G }}>
        {[0, 1].map(i => <PhotoOrPlaceholder key={i} photo={p[i]} auth={a} style={pStyle(w, bh)} />)}
      </View>
    );
  },

  st_feature: (p, w, h, a) => {
    const topH = Math.round(h * 0.65), botH = h - topH - G, hw = (w - G) / 2;
    return (
      <View style={{ gap: G }}>
        <PhotoOrPlaceholder photo={p[0]} auth={a} style={pStyle(w, topH)} />
        <View style={{ flexDirection: 'row', gap: G }}>
          {[1, 2].map(i => <PhotoOrPlaceholder key={i} photo={p[i]} auth={a} style={pStyle(hw, botH)} />)}
        </View>
      </View>
    );
  },

  st_strip: (p, w, h, a) => {
    const bh = (h - G * 2) / 3;
    return (
      <View style={{ gap: G }}>
        {[0, 1, 2].map(i => <PhotoOrPlaceholder key={i} photo={p[i]} auth={a} style={pStyle(w, bh)} />)}
      </View>
    );
  },

  st_quad: (p, w, h, a) => {
    const cell = (w - G) / 2, cellH = (h - G) / 2;
    return (
      <View style={{ gap: G }}>
        {[0, 2].map(row => (
          <View key={row} style={{ flexDirection: 'row', gap: G }}>
            {[row, row + 1].map(i => <PhotoOrPlaceholder key={i} photo={p[i]} auth={a} style={pStyle(cell, cellH)} />)}
          </View>
        ))}
      </View>
    );
  },

  // ── Facebook Post ────────────────────────────────────────────────────────────
  fb_single: (p, w, h, a) => <PhotoOrPlaceholder photo={p[0]} auth={a} style={pStyle(w, h)} />,

  fb_split: (p, w, h, a) => {
    const fw = (w - G) / 2;
    return (
      <View style={{ flexDirection: 'row', gap: G }}>
        {[0, 1].map(i => <PhotoOrPlaceholder key={i} photo={p[i]} auth={a} style={pStyle(fw, h)} />)}
      </View>
    );
  },

  fb_featured: (p, w, h, a) => {
    const lw = Math.round(w * 0.62), rw = w - lw - G, cellH = (h - G) / 2;
    return (
      <View style={{ flexDirection: 'row', gap: G }}>
        <PhotoOrPlaceholder photo={p[0]} auth={a} style={pStyle(lw, h)} />
        <View style={{ gap: G }}>
          {[1, 2].map(i => <PhotoOrPlaceholder key={i} photo={p[i]} auth={a} style={pStyle(rw, cellH)} />)}
        </View>
      </View>
    );
  },

  fb_trio: (p, w, h, a) => {
    const cw = (w - G * 2) / 3;
    return (
      <View style={{ flexDirection: 'row', gap: G }}>
        {[0, 1, 2].map(i => <PhotoOrPlaceholder key={i} photo={p[i]} auth={a} style={pStyle(cw, h)} />)}
      </View>
    );
  },

  // ── YouTube Thumbnail ────────────────────────────────────────────────────────
  yt_hero: (p, w, h, a) => <PhotoOrPlaceholder photo={p[0]} auth={a} style={pStyle(w, h)} />,

  yt_split: (p, w, h, a) => {
    const lw = Math.round(w * 0.65), rw = w - lw - G;
    return (
      <View style={{ flexDirection: 'row', gap: G }}>
        <PhotoOrPlaceholder photo={p[0]} auth={a} style={pStyle(lw, h)} />
        <PhotoOrPlaceholder photo={p[1]} auth={a} style={pStyle(rw, h)} />
      </View>
    );
  },

  yt_trio: (p, w, h, a) => {
    const cw = (w - G * 2) / 3;
    return (
      <View style={{ flexDirection: 'row', gap: G }}>
        {[0, 1, 2].map(i => <PhotoOrPlaceholder key={i} photo={p[i]} auth={a} style={pStyle(cw, h)} />)}
      </View>
    );
  },

  yt_bold: (p, w, h, a) => {
    const lw = Math.round(w * 0.58), rw = w - lw - G, cellH = (h - G) / 2;
    return (
      <View style={{ flexDirection: 'row', gap: G }}>
        <PhotoOrPlaceholder photo={p[0]} auth={a} style={pStyle(lw, h)} />
        <View style={{ gap: G }}>
          {[1, 2].map(i => <PhotoOrPlaceholder key={i} photo={p[i]} auth={a} style={pStyle(rw, cellH)} />)}
        </View>
      </View>
    );
  },
};

// ─── Thumb renderers (tiny schematic previews) ────────────────────────────────

const B = '#C5B8B0'; // block colour in thumb
const thumbs: Record<string, ThumbFn> = {
  mem_ribbons: (w, h) => (
    <View style={{ flex: 1, gap: 1 }}>
      <View style={{ flex: 1.1, backgroundColor: B, borderRadius: 1, transform: [{ rotate: '-1deg' }] }} />
      <View style={{ flex: 0.9, backgroundColor: B, borderRadius: 1, transform: [{ rotate: '1deg' }] }} />
      <View style={{ flex: 1.2, backgroundColor: B, borderRadius: 1 }} />
    </View>
  ),
  mem_columns: (w, h) => <View style={{ flex: 1, flexDirection: 'row', gap: 1 }}>{[0,1,2].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}</View>,
  mem_window: (w, h) => (
    <View style={{ flex: 1, gap: 1 }}>
      <View style={{ flex: 1.25, backgroundColor: B, borderRadius: 1 }} />
      {[0,1].map(r=><View key={r} style={{flex:1,flexDirection:'row',gap:1}}>{[0,1,2].map(c=><View key={c} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}</View>)}
    </View>
  ),
  mem_fieldnotes: (w, h) => (
    <View style={{ flex: 1, gap: 1 }}>
      <View style={{ flex: 1, flexDirection: 'row', gap: 1 }}>{[0,1,2].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}</View>
      <View style={{ flex: 1, flexDirection: 'row', gap: 1 }}>{[0,1].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}</View>
    </View>
  ),
  mem_atlas: (w, h) => (
    <View style={{ flex: 1, flexDirection: 'row', gap: 1 }}>
      <View style={{ flex: 3, backgroundColor: B, borderRadius: 1 }} />
      <View style={{ flex: 2, gap: 1 }}>{[0,1,2].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}</View>
    </View>
  ),
  mem_circle: (w, h) => <View style={{ width: '88%', height: '88%', borderRadius: 999, backgroundColor: B, alignSelf: 'center', marginTop: '6%' }} />,
  mem_bean: (w, h) => <View style={{ width: '88%', height: '60%', borderRadius: 999, backgroundColor: B, alignSelf: 'center', marginTop: '20%', transform: [{ rotate: '-7deg' }] }} />,
  mem_postcard: (w, h) => (
    <View style={{ flex: 1, gap: 1 }}>
      <View style={{ flex: 2.4, backgroundColor: B, borderRadius: 1 }} />
      <View style={{ flex: 1, flexDirection: 'row', gap: 1 }}>{[0,1,2].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}</View>
    </View>
  ),
  ip_single: (w, h) => <View style={{ flex: 1, backgroundColor: B, borderRadius: 2 }} />,
  ip_duo: (w, h) => <View style={{ flex: 1, flexDirection: 'row', gap: 1 }}>{[0,1].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}</View>,
  ip_featured: (w, h) => (
    <View style={{ flex: 1, gap: 1 }}>
      <View style={{ flex: 3, backgroundColor: B, borderRadius: 1 }} />
      <View style={{ flex: 1.5, flexDirection: 'row', gap: 1 }}>
        {[0,1].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}
      </View>
    </View>
  ),
  ip_grid: (w, h) => (
    <View style={{ flex: 1, gap: 1 }}>
      {[0,1].map(r=><View key={r} style={{flex:1,flexDirection:'row',gap:1}}>{[0,1].map(c=><View key={c} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}</View>)}
    </View>
  ),
  ip_mosaic: (w, h) => (
    <View style={{ flex: 1, flexDirection: 'row', gap: 1 }}>
      <View style={{ flex: 3, backgroundColor: B, borderRadius: 1 }} />
      <View style={{ flex: 2, gap: 1 }}>
        {[0,1].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}
      </View>
    </View>
  ),
  st_single: (w, h) => <View style={{ flex: 1, backgroundColor: B, borderRadius: 2 }} />,
  st_duo: (w, h) => <View style={{ flex: 1, gap: 1 }}>{[0,1].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}</View>,
  st_feature: (w, h) => (
    <View style={{ flex: 1, gap: 1 }}>
      <View style={{ flex: 4, backgroundColor: B, borderRadius: 1 }} />
      <View style={{ flex: 2, flexDirection: 'row', gap: 1 }}>
        {[0,1].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}
      </View>
    </View>
  ),
  st_strip: (w, h) => <View style={{ flex: 1, gap: 1 }}>{[0,1,2].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}</View>,
  st_quad: (w, h) => (
    <View style={{ flex: 1, gap: 1 }}>
      {[0,1].map(r=><View key={r} style={{flex:1,flexDirection:'row',gap:1}}>{[0,1].map(c=><View key={c} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}</View>)}
    </View>
  ),
  fb_single: (w, h) => <View style={{ flex: 1, backgroundColor: B, borderRadius: 2 }} />,
  fb_split: (w, h) => <View style={{ flex: 1, flexDirection: 'row', gap: 1 }}>{[0,1].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}</View>,
  fb_featured: (w, h) => (
    <View style={{ flex: 1, flexDirection: 'row', gap: 1 }}>
      <View style={{ flex: 3, backgroundColor: B, borderRadius: 1 }} />
      <View style={{ flex: 2, gap: 1 }}>
        {[0,1].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}
      </View>
    </View>
  ),
  fb_trio: (w, h) => <View style={{ flex: 1, flexDirection: 'row', gap: 1 }}>{[0,1,2].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}</View>,
  yt_hero: (w, h) => <View style={{ flex: 1, backgroundColor: B, borderRadius: 2 }} />,
  yt_split: (w, h) => (
    <View style={{ flex: 1, flexDirection: 'row', gap: 1 }}>
      <View style={{ flex: 4, backgroundColor: B, borderRadius: 1 }} />
      <View style={{ flex: 2, backgroundColor: B, borderRadius: 1 }} />
    </View>
  ),
  yt_trio: (w, h) => <View style={{ flex: 1, flexDirection: 'row', gap: 1 }}>{[0,1,2].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}</View>,
  yt_bold: (w, h) => (
    <View style={{ flex: 1, flexDirection: 'row', gap: 1 }}>
      <View style={{ flex: 3, backgroundColor: B, borderRadius: 1 }} />
      <View style={{ flex: 2, gap: 1 }}>
        {[0,1].map(i=><View key={i} style={{flex:1,backgroundColor:B,borderRadius:1}}/>)}
      </View>
    </View>
  ),
};

// ─── Template definitions ─────────────────────────────────────────────────────

interface LayoutDef { id: string; label: string; maxPhotos: number; icon: keyof typeof Feather.glyphMap }
interface TemplateDef { id: string; label: string; icon: keyof typeof Feather.glyphMap; ratio: number; layouts: LayoutDef[] }

const TEMPLATES: TemplateDef[] = [
  {
    id: 'memory_classic', label: 'Memory', icon: 'heart', ratio: 1,
    layouts: [
      { id: 'mem_ribbons',    label: 'Journey ribbons', maxPhotos: 3, icon: 'wind' },
      { id: 'mem_columns',    label: 'Three days',      maxPhotos: 3, icon: 'columns' },
      { id: 'mem_window',     label: 'City windows',    maxPhotos: 7, icon: 'grid' },
      { id: 'mem_fieldnotes', label: 'Field notes',     maxPhotos: 5, icon: 'layout' },
      { id: 'mem_atlas',      label: 'Atlas split',     maxPhotos: 4, icon: 'sidebar' },
      { id: 'mem_circle',     label: 'Memory stamp',    maxPhotos: 1, icon: 'circle' },
      { id: 'mem_bean',       label: 'Memory keepsake', maxPhotos: 1, icon: 'coffee' },
      { id: 'mem_postcard',   label: 'Postcard set',    maxPhotos: 4, icon: 'send' },
    ],
  },
  {
    id: 'diary_page', label: 'Diary', icon: 'book-open', ratio: 3 / 4,
    layouts: [
      { id: 'ip_featured', label: 'Diary page', maxPhotos: 4, icon: 'layout' },
      { id: 'ip_mosaic',   label: 'Memory page', maxPhotos: 3, icon: 'sidebar' },
      { id: 'ip_grid',     label: 'Field notes', maxPhotos: 4, icon: 'grid' },
    ],
  },
  {
    id: 'postcard', label: 'Postcard', icon: 'send', ratio: 1.45,
    layouts: [
      { id: 'fb_single',   label: 'Classic', maxPhotos: 1, icon: 'square' },
      { id: 'fb_split',    label: 'Front/back', maxPhotos: 2, icon: 'columns' },
      { id: 'fb_featured', label: 'Stamped', maxPhotos: 3, icon: 'sidebar' },
    ],
  },
  {
    id: 'insta_post', label: 'Post', icon: 'square', ratio: 1,
    layouts: [
      { id: 'ip_single',   label: 'Single',   maxPhotos: 1, icon: 'square' },
      { id: 'ip_duo',      label: 'Duo',       maxPhotos: 2, icon: 'columns' },
      { id: 'ip_featured', label: 'Featured',  maxPhotos: 4, icon: 'layout' },
      { id: 'ip_grid',     label: 'Grid',      maxPhotos: 4, icon: 'grid' },
      { id: 'ip_mosaic',   label: 'Mosaic',    maxPhotos: 3, icon: 'sidebar' },
    ],
  },
  {
    id: 'story', label: 'Story', icon: 'smartphone', ratio: 9 / 16,
    layouts: [
      { id: 'st_single',  label: 'Single',  maxPhotos: 1, icon: 'square' },
      { id: 'st_duo',     label: 'Duo',     maxPhotos: 2, icon: 'minus' },
      { id: 'st_feature', label: 'Feature', maxPhotos: 3, icon: 'layout' },
      { id: 'st_strip',   label: 'Strip',   maxPhotos: 3, icon: 'align-justify' },
      { id: 'st_quad',    label: 'Quad',    maxPhotos: 4, icon: 'grid' },
    ],
  },
  {
    id: 'facebook', label: 'Facebook', icon: 'thumbs-up', ratio: 1.91,
    layouts: [
      { id: 'fb_single',   label: 'Single',   maxPhotos: 1, icon: 'square' },
      { id: 'fb_split',    label: 'Split',    maxPhotos: 2, icon: 'columns' },
      { id: 'fb_featured', label: 'Featured', maxPhotos: 3, icon: 'sidebar' },
      { id: 'fb_trio',     label: 'Trio',     maxPhotos: 3, icon: 'align-justify' },
    ],
  },
  {
    id: 'youtube', label: 'YouTube', icon: 'play-circle', ratio: 16 / 9,
    layouts: [
      { id: 'yt_hero',  label: 'Hero',  maxPhotos: 1, icon: 'square' },
      { id: 'yt_split', label: 'Split', maxPhotos: 2, icon: 'columns' },
      { id: 'yt_trio',  label: 'Trio',  maxPhotos: 3, icon: 'align-justify' },
      { id: 'yt_bold',  label: 'Bold',  maxPhotos: 3, icon: 'sidebar' },
    ],
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  place: VisitedPlace;
  photos: PlacePhoto[];
  visible: boolean;
  onClose: () => void;
  authHeaders: Record<string, string>;
  initialSelectedIds?: string[];
}

export default function CollageBuilderModal({ place, photos, visible, onClose, authHeaders, initialSelectedIds = [] }: Props) {
  const colors = useColors();
  const shotRef = useRef<any>(null);
  const [templateIdx, setTemplateIdx] = useState(0);
  const [layoutIdx, setLayoutIdx] = useState(0);
  const [themeIdx, setThemeIdx] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  const template = TEMPLATES[templateIdx];
  const layout = template.layouts[layoutIdx];
  const theme = COLLAGE_THEMES[themeIdx];
  const { w: cW, h: cH } = canvasSize(template.ratio);

  // Ordered selected photos, capped to layout max
  const selectedPhotos: PlacePhoto[] = selectedIds
    .map(id => photos.find(p => p.id === id))
    .filter(Boolean) as PlacePhoto[];
  const collagePhotos = selectedPhotos.length > 0
    ? Array.from({ length: layout.maxPhotos }, (_, index) => selectedPhotos[index % selectedPhotos.length])
    : [];
  const uniqueSelectedCount = selectedPhotos.length;

  // Auto-select top photos when switching templates/layouts
  function autoSelect(max: number) {
    const preferred = initialSelectedIds
      .map(id => photos.find(p => p.id === id))
      .filter(Boolean) as PlacePhoto[];
    const fill = photos.filter(p => !preferred.some(s => s.id === p.id));
    setSelectedIds([...preferred, ...fill].slice(0, max).map(p => p.id));
  }

  function handleTemplateChange(idx: number) {
    Haptics.selectionAsync();
    setTemplateIdx(idx);
    setLayoutIdx(0);
    autoSelect(TEMPLATES[idx].layouts[0].maxPhotos);
  }

  function handleLayoutChange(idx: number) {
    Haptics.selectionAsync();
    setLayoutIdx(idx);
    autoSelect(template.layouts[idx].maxPhotos);
  }

  function togglePhoto(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= layout.maxPhotos) return [...prev.slice(1), id]; // replace oldest
      return [...prev, id];
    });
  }

  // Auto-select when first opened
  React.useEffect(() => {
    if (visible && photos.length > 0) autoSelect(layout.maxPhotos);
  }, [visible]);

  async function share() {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await shotRef.current?.capture();
      if (!uri) throw new Error('Capture failed');
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share collage' });
      } else {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.saveToLibraryAsync(uri);
          Alert.alert('Saved!', 'Collage saved to your photo library.');
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Could not share', 'Please try again.');
    } finally {
      setSharing(false);
    }
  }

  async function saveCurrentCollage() {
    if (sharing || collagePhotos.length === 0) return;
    setSharing(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to save this memory collage.');
        return;
      }
      const uri = await shotRef.current?.capture();
      if (!uri) throw new Error('Capture failed');
      await MediaLibrary.saveToLibraryAsync(uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Memory collage saved to your photo library.');
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setSharing(false);
    }
  }

  async function saveLayoutPack() {
    if (sharing || photos.length === 0) return;
    setSharing(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to save the collage pack.');
        return;
      }
      let saved = 0;
      for (let index = 0; index < template.layouts.length; index += 1) {
        setLayoutIdx(index);
        autoSelect(template.layouts[index].maxPhotos);
        await waitForFrame();
        const uri = await shotRef.current?.capture();
        if (uri) {
          await MediaLibrary.saveToLibraryAsync(uri);
          saved += 1;
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Collage pack saved', `${saved} memory collage layout${saved === 1 ? '' : 's'} saved to your photo library.`);
    } catch {
      Alert.alert('Could not save pack', 'Please try again.');
    } finally {
      setSharing(false);
    }
  }

  // Thumb sizing
  const THUMB_H = 48;
  const thumbW = Math.round(template.ratio >= 1
    ? THUMB_H * template.ratio  // landscape/square: height fixed, width grows
    : THUMB_H * template.ratio  // portrait: use ratio, will be narrow
  );
  const thumbActualW = Math.max(thumbW, 28);
  const thumbActualH = Math.round(thumbActualW / template.ratio);
  const thumbDisplayH = Math.min(thumbActualH, 70);
  const thumbDisplayW = Math.round(thumbDisplayH * template.ratio);

  const renderFn = renders[layout.id];
  const thumbFn = thumbs[layout.id];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[s.root, { backgroundColor: colors.background }]}>

        {/* ── Header ── */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={s.headerBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[s.headerTitle, { color: colors.foreground }]}>Make Memory Collage</Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground }]}>{place.name}</Text>
          </View>
          <TouchableOpacity
            onPress={share}
            disabled={sharing || collagePhotos.length === 0}
            style={[s.shareBtn, { backgroundColor: collagePhotos.length > 0 ? colors.primary : colors.muted }]}
          >
            <Feather name="share-2" size={15} color="#fff" />
            <Text style={s.shareBtnTxt}>{sharing ? 'Saving…' : 'Share'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Template tabs ── */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.tabRow}
          style={[s.tabBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}
        >
          {TEMPLATES.map((t, i) => {
            const active = i === templateIdx;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => handleTemplateChange(i)}
                style={[s.tab, active && { borderBottomColor: colors.primary }]}
                activeOpacity={0.7}
              >
                <Feather name={t.icon} size={16} color={active ? colors.primary : colors.mutedForeground} />
                <Text style={[s.tabLabel, { color: active ? colors.primary : colors.mutedForeground }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.themeRow}>
            {COLLAGE_THEMES.map((t, i) => {
              const active = i === themeIdx;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => { Haptics.selectionAsync(); setThemeIdx(i); }}
                  style={[s.themeChip, { backgroundColor: active ? t.bg : colors.card, borderColor: active ? t.accent : colors.border }]}
                  activeOpacity={0.76}
                >
                  <View style={[s.themeDot, { backgroundColor: t.accent }]}>
                    <Feather name={t.icon} size={11} color="#fff" />
                  </View>
                  <Text style={[s.themeText, { color: active ? t.ink : colors.foreground }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Layout picker ── */}
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.layoutRow}
            style={{ marginBottom: 16 }}
          >
            {template.layouts.map((l, i) => {
              const active = i === layoutIdx;
              const tf = thumbs[l.id];
              return (
                <TouchableOpacity
                  key={l.id}
                  onPress={() => handleLayoutChange(i)}
                  style={s.layoutItem}
                  activeOpacity={0.75}
                >
                  <View style={[
                    s.thumbWrap,
                    {
                      width: thumbDisplayW,
                      height: thumbDisplayH,
                      borderColor: active ? colors.primary : colors.border,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}>
                    {tf ? tf(thumbDisplayW, thumbDisplayH) : null}
                  </View>
                  <Text style={[s.layoutLabel, { color: active ? colors.primary : colors.mutedForeground }]}>
                    {l.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ── Canvas preview ── */}
          <View style={s.canvasOuter}>
            <ViewShot ref={shotRef} options={{ format: 'png', quality: 1.0 }}>
              <View style={[s.canvasInner, { width: cW, backgroundColor: theme.bg }]}>
                <BeanHeader place={place} theme={theme} />
                <View style={[s.photoFrame, { width: cW, height: cH, backgroundColor: theme.frame }]}>
                  {renderFn
                    ? renderFn(collagePhotos, cW, cH, authHeaders)
                    : <MemoryPlaceholder style={{ flex: 1 }} />
                  }
                  {place.notes ? (
                    <View style={[s.captionRibbon, { backgroundColor: theme.bg === '#FFF7E8' || theme.bg === '#F7F8FC' ? 'rgba(255,255,255,0.86)' : 'rgba(0,0,0,0.38)' }]}>
                      <Text style={[s.captionText, { color: theme.bg === '#FFF7E8' || theme.bg === '#F7F8FC' ? theme.ink : '#fff' }]} numberOfLines={2}>
                        {place.notes.replace(/\nMood: .+$/, '')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <BeanFooter theme={theme} />
              </View>
            </ViewShot>
          </View>

          {/* ── Usage hint ── */}
          <View style={s.hint}>
            <Feather name="info" size={12} color={colors.mutedForeground} />
            <Text style={[s.hintTxt, { color: colors.mutedForeground }]}>
              {uniqueSelectedCount}/{layout.maxPhotos} Memories · Download one collage or a layout pack
            </Text>
          </View>

          {/* ── Photo selection strip ── */}
          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.photoStrip}>
              {photos.map(photo => {
                const pos = selectedIds.indexOf(photo.id);
                const isSelected = pos !== -1;
                return (
                  <TouchableOpacity
                    key={photo.id}
                    onPress={() => togglePhoto(photo.id)}
                    activeOpacity={0.8}
                    style={[
                      s.stripPhoto,
                      { borderColor: isSelected ? colors.primary : 'transparent', opacity: isSelected ? 1 : 0.45 },
                    ]}
                  >
                    <Image source={imgSrc(photo, authHeaders)} style={s.stripImg} contentFit="cover" />
                    {isSelected && (
                      <View style={[s.posBadge, { backgroundColor: colors.primary }]}>
                        <Text style={s.posTxt}>{pos + 1}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {photos.length === 0 && (
            <View style={s.noPhotos}>
              <Feather name="camera" size={28} color={colors.mutedForeground} />
              <Text style={[s.noPhotosTxt, { color: colors.mutedForeground }]}>
                Add Memories to your place first
              </Text>
            </View>
          )}

          {/* ── Big share button ── */}
          <View style={s.downloadRow}>
            <TouchableOpacity
              onPress={saveCurrentCollage}
              disabled={sharing || collagePhotos.length === 0}
              activeOpacity={0.85}
              style={[s.downloadBtn, { backgroundColor: collagePhotos.length > 0 ? colors.foreground : colors.muted }]}
            >
              <Feather name="download" size={16} color={collagePhotos.length > 0 ? '#fff' : colors.mutedForeground} />
              <Text style={[s.downloadBtnText, { color: collagePhotos.length > 0 ? '#fff' : colors.mutedForeground }]}>Save collage</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={saveLayoutPack}
              disabled={sharing || photos.length === 0}
              activeOpacity={0.85}
              style={[s.downloadBtn, { backgroundColor: photos.length > 0 ? colors.card : colors.muted, borderColor: colors.border, borderWidth: 1 }]}
            >
              <Feather name="layers" size={16} color={photos.length > 0 ? colors.primary : colors.mutedForeground} />
              <Text style={[s.downloadBtnText, { color: photos.length > 0 ? colors.foreground : colors.mutedForeground }]}>Save layout pack</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={share}
            disabled={sharing || collagePhotos.length === 0}
            activeOpacity={0.85}
            style={[s.bigShare, { backgroundColor: collagePhotos.length > 0 ? colors.primary : colors.muted }]}
          >
            <Feather name="share-2" size={18} color="#fff" />
            <Text style={s.bigShareTxt}>{sharing ? 'Saving…' : 'Save Memory Collage'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  shareBtnTxt: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  tabBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  tabRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 4 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  body: { padding: 20, alignItems: 'center' },

  themeRow: { flexDirection: 'row', gap: 9, paddingHorizontal: 4, paddingBottom: 14 },
  themeChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  themeDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  themeText: { fontSize: 12, fontFamily: 'Inter_700Bold' },

  layoutRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 4, paddingVertical: 4 },
  layoutItem: { alignItems: 'center', gap: 6 },
  thumbWrap: { borderRadius: 8, overflow: 'hidden', padding: 4 },
  layoutLabel: { fontSize: 10, fontFamily: 'Inter_500Medium' },

  canvasOuter: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 6,
    borderRadius: 10, overflow: 'hidden', marginBottom: 8,
  },
  canvasInner: { overflow: 'hidden', borderRadius: 10 },
  photoFrame: { overflow: 'hidden', position: 'relative' },
  captionRibbon: { position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9 },
  captionText: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_700Bold' },

  hint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 },
  hintTxt: { fontSize: 11, fontFamily: 'Inter_400Regular' },

  photoStrip: { flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingBottom: 4 },
  stripPhoto: {
    width: 68, height: 68, borderRadius: 10,
    overflow: 'hidden', borderWidth: 2,
  },
  stripImg: { width: '100%', height: '100%' },
  posBadge: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  posTxt: { color: '#fff', fontSize: 10, fontFamily: 'Inter_700Bold' },

  noPhotos: { alignItems: 'center', gap: 8, padding: 24 },
  noPhotosTxt: { fontSize: 13, fontFamily: 'Inter_400Regular' },

  downloadRow: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 16 },
  downloadBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  downloadBtnText: { fontSize: 13, fontFamily: 'Inter_700Bold' },

  bigShare: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 32,
    borderRadius: 24, marginTop: 12,
  },
  bigShareTxt: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
