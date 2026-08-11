import { Feather } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
  FlatList, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { PLACES_DB } from '@/constants/placesDb';
import { useColors } from '@/hooks/useColors';

// Unique sorted country list from the places DB
const ALL_COUNTRIES = [...new Set(PLACES_DB.map(p => p.country))].sort();

interface Props {
  value: string;
  onChange: (country: string) => void;
  placeholder?: string;
}

export function CountrySearch({ value, onChange, placeholder = 'e.g. Japan, China, France…' }: Props) {
  const colors = useColors();
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<TextInput>(null);

  function handleChange(text: string) {
    setQuery(text);
    onChange(text);
    if (text.length >= 1) {
      const results = ALL_COUNTRIES.filter(c =>
        c.toLowerCase().startsWith(text.toLowerCase())
      ).slice(0, 6);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
    } else {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }

  function handleSelect(country: string) {
    setQuery(country);
    onChange(country);
    setSuggestions([]);
    setShowDropdown(false);
  }

  function handleBlur() {
    setTimeout(() => setShowDropdown(false), 150);
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.row, { backgroundColor: colors.muted }]}>
        <Feather name="globe" size={15} color={colors.mutedForeground} style={{ marginLeft: 12 }} />
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.foreground }]}
          value={query}
          onChangeText={handleChange}
          onBlur={handleBlur}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="done"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); onChange(''); setSuggestions([]); setShowDropdown(false); inputRef.current?.focus(); }} style={{ padding: 10 }}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {showDropdown && suggestions.length > 0 && (
        <View style={[styles.dropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <FlatList
            data={suggestions}
            keyExtractor={item => item}
            scrollEnabled={false}
            keyboardShouldPersistTaps="always"
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[styles.item, index < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <Text style={[styles.itemTxt, { color: colors.foreground }]}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 50 },
  row: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, gap: 6 },
  input: { flex: 1, paddingVertical: 12, paddingRight: 4, fontSize: 15, fontFamily: 'Inter_400Regular' },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
    borderRadius: 12, borderWidth: 1, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 8, zIndex: 999,
  },
  item: { paddingHorizontal: 14, paddingVertical: 12 },
  itemTxt: { fontSize: 14, fontFamily: 'Inter_500Medium' },
});
