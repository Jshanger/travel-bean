import { Feather } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, StyleProp, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/AppContext';
import { useTravelAuth } from '@/hooks/useTravelAuth';

const BASE_URL = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : '/api';

const TRANSCRIBE_TIMEOUT_MS = 30_000;

interface Props {
  onResult: (text: string) => void;
  style?: StyleProp<ViewStyle>;
  size?: number;
  showLabel?: boolean;
}

async function resetAudioMode() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
    });
  } catch { /* ignore */ }
}

export default function VoiceDictation({ onResult, style, size = 18, showLabel = false }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { isPro } = useApp();
  const { getToken } = useTravelAuth();
  const [isListening, setIsListening] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const recordingRef = useRef<Audio.Recording | null>(null);

  const onResultRef = useRef(onResult);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  // Always reset audio mode when component unmounts
  useEffect(() => () => { resetAudioMode(); }, []);

  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.35, duration: 600, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, easing: Easing.ease, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  const stopAndTranscribe = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    setIsListening(false);

    try {
      await recording.stopAndUnloadAsync();
    } catch { /* already stopped */ }

    // Always reset audio mode so iOS returns to normal
    await resetAudioMode();

    const uri = recording.getURI();
    if (!uri) {
      Alert.alert('Recording error', 'No audio was captured. Please try again.');
      return;
    }

    try {
      const token = await getToken();

      // Use XHR instead of fetch() for reliable local file reading on iOS
      const audioData = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', uri, true);
        xhr.responseType = 'blob';
        xhr.onload = () => resolve(xhr.response as Blob);
        xhr.onerror = () => reject(new Error('Failed to read audio file'));
        xhr.send();
      });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);

      let uploadRes: Response;
      try {
        uploadRes = await fetch(`${BASE_URL}/bean/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'audio/m4a',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: audioData,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error((err as any)?.error ?? `HTTP ${uploadRes.status}`);
      }

      const { transcript } = await uploadRes.json() as { transcript: string };
      if (transcript?.trim()) {
        onResultRef.current(transcript.trim());
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Nothing heard', 'No speech was detected. Please try again.');
      }
    } catch (err: any) {
      const msg = err?.name === 'AbortError'
        ? 'Transcription timed out. Please try a shorter recording.'
        : (err?.message ?? 'Please try again.');
      Alert.alert('Transcription failed', msg);
    }
  }, [getToken]);

  async function toggle() {
    if (!isPro) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push('/(tabs)/more');
      return;
    }

    if (isListening) {
      await stopAndTranscribe();
      return;
    }

    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Microphone access needed', 'Please allow microphone access in Settings to use voice dictation.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsListening(true);

      // Auto-stop after 30 seconds
      setTimeout(() => {
        if (recordingRef.current === recording) {
          stopAndTranscribe();
        }
      }, 30000);
    } catch (err: any) {
      await resetAudioMode();
      Alert.alert('Could not start recording', err?.message ?? 'Please try again.');
      setIsListening(false);
    }
  }

  const isLocked = !isPro;
  const iconColor = isListening ? '#E8454A' : isLocked ? '#E8825A' : colors.mutedForeground;

  if (showLabel) {
    return (
      <TouchableOpacity
        onPress={toggle}
        style={[{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 9,
          paddingHorizontal: 14,
          borderRadius: 10,
          backgroundColor: isListening ? '#E8454A18' : isLocked ? '#E8825A14' : colors.muted,
          alignSelf: 'flex-start',
        }, style as any]}
        activeOpacity={0.7}
      >
        <Animated.View style={isListening ? { transform: [{ scale: pulseAnim }] } : undefined}>
          <Feather name="mic" size={15} color={iconColor} />
        </Animated.View>
        <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: iconColor }}>
          {isListening ? 'Tap to finish…' : isLocked ? 'Dictate note (Pro)' : 'Dictate note'}
        </Text>
        {isLocked && (
          <View style={{
            width: 16, height: 16, borderRadius: 8,
            backgroundColor: '#E8825A',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Feather name="lock" size={8} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View style={isListening ? { transform: [{ scale: pulseAnim }] } : undefined}>
        <TouchableOpacity
          onPress={toggle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            width: size + 12,
            height: size + 12,
            borderRadius: (size + 12) / 2,
            backgroundColor: isListening
              ? '#E8454A18'
              : isLocked
              ? colors.muted
              : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="mic" size={size} color={iconColor} />
          {isLocked && (
            <View style={{
              position: 'absolute',
              top: 0, right: 0,
              width: 10, height: 10, borderRadius: 5,
              backgroundColor: '#E8825A',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Feather name="lock" size={5} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
