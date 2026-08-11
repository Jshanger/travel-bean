import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { sanitizeBlogUsername } from '@/utils/travelBlog';

const INK = '#2A1714';
const MUTED = '#7B6258';
const ORANGE = '#F26A2E';
const PAPER = '#FFF8EF';
const CARD = '#FFFDF8';
const BORDER = '#F1D7C5';

export default function BlogSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ sourcePlaceId?: string }>();
  const { blogSettings, saveBlogSettings, createBlogDraftFromPlace } = useApp();
  const [username, setUsername] = useState(blogSettings.username);
  const [title, setTitle] = useState(blogSettings.title);
  const [intro, setIntro] = useState(blogSettings.intro);
  const [saving, setSaving] = useState(false);

  async function save() {
    const cleanUsername = sanitizeBlogUsername(username);
    if (!cleanUsername) {
      Alert.alert('Choose a username', 'Your public blog needs a simple username first.');
      return;
    }
    setSaving(true);
    try {
      await saveBlogSettings({ username: cleanUsername, title: title.trim() || 'My Travel Bean Blog', intro: intro.trim() });
      if (params.sourcePlaceId) {
        const draft = await createBlogDraftFromPlace(String(params.sourcePlaceId));
        router.replace({ pathname: '/blog/editor/[id]', params: { id: draft.id } } as any);
      } else {
        router.back();
      }
    } catch (error: any) {
      Alert.alert('Could not save blog', error?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: (Platform.OS === 'web' ? 42 : insets.top + 18), paddingBottom: 48 }}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.86}>
          <Feather name="chevron-left" size={23} color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Travel Blog</Text>
          <Text style={styles.subtitle}>Set up your public blog identity.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.heroIcon}>
          <Feather name="globe" size={26} color="#fff" />
        </View>
        <Text style={styles.cardTitle}>Your blog starts private</Text>
        <Text style={styles.cardText}>Journal entries become private drafts first. You choose exactly when a story becomes public.</Text>

        <Text style={styles.label}>Username</Text>
        <View style={styles.usernameRow}>
          <Text style={styles.atSign}>@</Text>
          <TextInput
            value={username}
            onChangeText={value => setUsername(sanitizeBlogUsername(value))}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="yourname"
            placeholderTextColor="#A98B7A"
            style={styles.usernameInput}
          />
        </View>

        <Text style={styles.label}>Blog title</Text>
        <TextInput value={title} onChangeText={setTitle} placeholder="My Travel Bean Blog" placeholderTextColor="#A98B7A" style={styles.input} />

        <Text style={styles.label}>Short intro</Text>
        <TextInput
          value={intro}
          onChangeText={setIntro}
          multiline
          scrollEnabled={false}
          placeholder="A growing collection of places, photos, and memories from my travels."
          placeholderTextColor="#A98B7A"
          style={[styles.input, styles.introInput]}
        />

        <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving} activeOpacity={0.88}>
          <Feather name="save" size={17} color="#fff" />
          <Text style={styles.saveText}>{saving ? 'Saving...' : params.sourcePlaceId ? 'Save and Create Draft' : 'Save Blog Settings'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PAPER },
  header: { maxWidth: 760, width: '100%', alignSelf: 'center', paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1E6' },
  title: { color: INK, fontSize: 28, fontFamily: 'Inter_700Bold' },
  subtitle: { color: MUTED, fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: 3 },
  card: { maxWidth: 760, width: '100%', alignSelf: 'center', marginHorizontal: 20, borderRadius: 24, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, padding: 18 },
  heroIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  cardTitle: { color: INK, fontSize: 24, lineHeight: 30, fontFamily: 'Inter_700Bold' },
  cardText: { color: MUTED, fontSize: 14, lineHeight: 21, fontFamily: 'Inter_500Medium', marginTop: 6, marginBottom: 8 },
  label: { color: MUTED, fontSize: 12, fontFamily: 'Inter_700Bold', marginBottom: 7, marginTop: 14 },
  input: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: PAPER, paddingHorizontal: 13, paddingVertical: 11, color: INK, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  introInput: { minHeight: 104, textAlignVertical: 'top', lineHeight: 21 },
  usernameRow: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: BORDER, backgroundColor: PAPER, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center' },
  atSign: { color: ORANGE, fontSize: 18, fontFamily: 'Inter_700Bold', marginRight: 2 },
  usernameInput: { flex: 1, color: INK, fontSize: 16, fontFamily: 'Inter_700Bold', paddingVertical: 12 },
  saveButton: { marginTop: 18, minHeight: 52, borderRadius: 26, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  saveText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_700Bold' },
});
