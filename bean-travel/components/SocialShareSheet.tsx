import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { sharePublicLink } from '@/utils/shareLinks';

const INK = '#2A1714';
const MUTED = '#7B6258';
const ORANGE = '#F26A2E';
const PAPER = '#FFF8EF';
const CARD = '#FFFDF8';
const BORDER = '#F1D7C5';
const TEAL = '#153A46';

export type SocialSharePayload = {
  url: string;
  title: string;
  text?: string;
  mediaUrl?: string;
  kind?: 'blog' | 'post';
};

type Props = {
  visible: boolean;
  payload: SocialSharePayload | null;
  onClose: () => void;
};

type SocialTarget = 'instagram' | 'facebook' | 'whatsapp' | 'pinterest';

const SOCIALS: Array<{
  id: SocialTarget;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  bg: string;
}> = [
  { id: 'instagram', label: 'Instagram', icon: 'instagram', color: '#B62A72', bg: '#FFF0F7' },
  { id: 'facebook', label: 'Facebook', icon: 'facebook', color: '#1877F2', bg: '#EDF5FF' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'message-circle', color: '#128C7E', bg: '#EAF8F3' },
  { id: 'pinterest', label: 'Pinterest', icon: 'image', color: '#BD081C', bg: '#FFF1F2' },
];

function shareText(payload: SocialSharePayload) {
  return [payload.title, payload.text, payload.url].filter(Boolean).join('\n');
}

function socialUrl(target: SocialTarget, payload: SocialSharePayload) {
  const url = encodeURIComponent(payload.url);
  const description = encodeURIComponent(payload.text || payload.title);
  const message = encodeURIComponent(shareText(payload));
  switch (target) {
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    case 'whatsapp':
      return `https://wa.me/?text=${message}`;
    case 'pinterest':
      return `https://www.pinterest.com/pin/create/button/?url=${url}&description=${description}${payload.mediaUrl ? `&media=${encodeURIComponent(payload.mediaUrl)}` : ''}`;
    case 'instagram':
      return Platform.OS === 'web' ? 'https://www.instagram.com/' : 'instagram://app';
  }
}

async function writeClipboard(value: string) {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(value);
      return true;
    }
  }
  return false;
}

export default function SocialShareSheet({ visible, payload, onClose }: Props) {
  const [busyTarget, setBusyTarget] = useState<SocialTarget | 'copy' | 'more' | null>(null);
  const title = payload?.kind === 'blog' ? 'Share Travel Blog' : 'Share Blog Post';

  async function copyLink(showAlert = true, fallbackToSystemShare = true) {
    if (!payload) return false;
    setBusyTarget('copy');
    try {
      const copied = await writeClipboard(payload.url);
      if (copied) {
        if (showAlert) Alert.alert('Link copied', 'The link is ready to paste.');
        return true;
      }
      if (!fallbackToSystemShare) return false;
      await Share.share({ title: payload.title, message: payload.url, url: payload.url });
      return true;
    } finally {
      setBusyTarget(null);
    }
  }

  async function shareTo(target: SocialTarget) {
    if (!payload) return;
    setBusyTarget(target);
    try {
      if (target === 'instagram') {
        const copied = await copyLink(false, false);
        try {
          await Linking.openURL(socialUrl(target, payload));
        } catch {
          await Linking.openURL('https://www.instagram.com/');
        }
        Alert.alert(
          copied ? 'Instagram opened' : 'Open Instagram',
          copied
            ? 'Instagram does not support pre-filled public links. Paste the copied link into your caption, story, or bio.'
            : 'Instagram does not support pre-filled public links from web. Use Copy Link, then paste it into Instagram.'
        );
        return;
      }
      await Linking.openURL(socialUrl(target, payload));
    } catch {
      Alert.alert('Could not open share option', 'Please try another sharing option.');
    } finally {
      setBusyTarget(null);
    }
  }

  async function moreShare() {
    if (!payload) return;
    setBusyTarget('more');
    try {
      const result = await sharePublicLink(payload);
      if (result === 'copied') Alert.alert('Link copied', 'The link is ready to paste.');
    } catch {
      Alert.alert('Could not share', 'Please try again.');
    } finally {
      setBusyTarget(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Feather name="share-2" size={19} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{payload?.title}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.84}>
              <Feather name="x" size={19} color={INK} />
            </TouchableOpacity>
          </View>

          <View style={styles.socialGrid}>
            {SOCIALS.map(item => (
              <TouchableOpacity key={item.id} style={styles.socialButton} onPress={() => shareTo(item.id)} activeOpacity={0.86}>
                <View style={[styles.socialIcon, { backgroundColor: item.bg }]}>
                  {busyTarget === item.id ? <ActivityIndicator color={item.color} /> : <Feather name={item.icon} size={21} color={item.color} />}
                </View>
                <Text style={styles.socialLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.utilityRow}>
            <TouchableOpacity style={styles.utilityButton} onPress={() => copyLink(true)} activeOpacity={0.86}>
              {busyTarget === 'copy' ? <ActivityIndicator color={TEAL} /> : <Feather name="link" size={17} color={TEAL} />}
              <Text style={styles.utilityText}>Copy Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.utilityButton, styles.moreButton]} onPress={moreShare} activeOpacity={0.86}>
              {busyTarget === 'more' ? <ActivityIndicator color="#fff" /> : <Feather name="more-horizontal" size={17} color="#fff" />}
              <Text style={styles.moreText}>More</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(42,23,20,0.42)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: PAPER,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 22,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: '#E7CBB7', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  headerIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFF1E6', alignItems: 'center', justifyContent: 'center' },
  title: { color: INK, fontSize: 21, lineHeight: 27, fontFamily: 'Inter_700Bold' },
  subtitle: { color: MUTED, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  socialGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  socialButton: {
    width: '48%',
    minHeight: 94,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  socialLabel: { color: INK, fontSize: 13, fontFamily: 'Inter_700Bold' },
  utilityRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  utilityButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#B7D9CF',
    backgroundColor: '#EAF8F3',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  utilityText: { color: TEAL, fontSize: 13, fontFamily: 'Inter_700Bold' },
  moreButton: { borderColor: TEAL, backgroundColor: TEAL },
  moreText: { color: '#fff', fontSize: 13, fontFamily: 'Inter_700Bold' },
});
