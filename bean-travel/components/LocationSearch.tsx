import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { hasPredictivePlaceProvider, ProviderPlaceSuggestion, searchPredictivePlaces } from '@/services/placeSearch';

interface Props {
  value: string;
  country: string;
  onChange: (name: string, country: string, coords?: { latitude: number; longitude: number }) => void;
  placeholder?: string;
}

export function LocationSearch({ value, country, onChange, placeholder = 'Search city, place or landmark…' }: Props) {
  const colors = useColors();
  const [query, setQuery] = useState(value && country ? `${value}, ${country}` : value);
  const [suggestions, setSuggestions] = useState<ProviderPlaceSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState(false);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const requestId = useRef(0);

  // Sync external value changes (edit mode)
  useEffect(() => {
    if (value && country) {
      setQuery(`${value}, ${country}`);
      setSelected(true);
    } else if (value) {
      setQuery(value);
    }
  }, []);

  async function handleChangeText(text: string) {
    setQuery(text);
    setSelected(false);
    const currentRequest = ++requestId.current;
    if (text.length >= 2) {
      setSearching(true);
      const results = await searchPredictivePlaces(text, country);
      if (currentRequest !== requestId.current) return;
      setSearching(false);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
      setSearching(false);
    }
    // Pass raw text as name, empty country so caller knows it's unresolved
    onChange(text, '');
  }

  function handleSelect(suggestion: ProviderPlaceSuggestion) {
    const label = suggestion.region
      ? `${suggestion.name}, ${suggestion.region}, ${suggestion.country}`
      : `${suggestion.name}, ${suggestion.country}`;
    setQuery(label);
    setSuggestions([]);
    setShowDropdown(false);
    setSelected(true);
    onChange(
      suggestion.name,
      suggestion.country,
      suggestion.latitude != null && suggestion.longitude != null
        ? { latitude: suggestion.latitude, longitude: suggestion.longitude }
        : undefined,
    );
  }

  function handleBlur() {
    // Short delay so tap on suggestion registers first
    setTimeout(() => {
      setShowDropdown(false);
      // If user typed but didn't select, parse "City, Country" manually
      if (!selected && query.includes(',')) {
        const parts = query.split(',');
        const name = parts[0].trim();
        const parsedCountry = parts[parts.length - 1].trim();
        onChange(name, parsedCountry);
      } else if (!selected) {
        onChange(query.trim(), '');
      }
    }, 150);
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.inputRow, { backgroundColor: colors.muted }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginLeft: 12 }} />
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.foreground }]}
          value={query}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          onFocus={() => {
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="done"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              setSuggestions([]);
              setShowDropdown(false);
              setSelected(false);
              onChange('', '');
              inputRef.current?.focus();
            }}
            style={{ padding: 10 }}
          >
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
        {searching && (
          <Text style={[styles.providerHint, { color: colors.mutedForeground }]}>Searching</Text>
        )}
      </View>

      {showDropdown && suggestions.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <FlatList
            data={suggestions}
            keyExtractor={(_, i) => String(i)}
            scrollEnabled={false}
            keyboardShouldPersistTaps="always"
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.suggestion,
                  index < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.pinDot, { backgroundColor: colors.primary + '20' }]}>
                  <Feather name="map-pin" size={13} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.suggName, { color: colors.foreground }]}>
                    {item.name}
                    {item.region ? <Text style={{ color: colors.mutedForeground }}>, {item.region}</Text> : null}
                  </Text>
                  <Text style={[styles.suggCountry, { color: colors.mutedForeground }]}>
                    {item.address ?? item.country}
                  </Text>
                </View>
                <Text style={[styles.providerPill, { color: colors.primary, backgroundColor: colors.primary + '12' }]}>
                  {item.provider === 'local' && hasPredictivePlaceProvider() ? 'local' : item.provider}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 100 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    gap: 6,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 4,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  providerHint: { paddingRight: 10, fontSize: 11, fontFamily: 'Inter_700Bold' },
  providerPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontFamily: 'Inter_700Bold', textTransform: 'uppercase' },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 999,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  pinDot: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggName: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 1 },
  suggCountry: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
