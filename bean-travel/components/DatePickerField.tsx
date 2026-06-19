import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { createElement, useState } from 'react';
import { Modal, Platform, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  value: string;
  onChange: (val: string) => void;
  colors: any;
  placeholder?: string;
}

function toDate(val: string): Date {
  if (!val) return new Date();
  const d = new Date(val + 'T12:00:00');
  return isNaN(d.getTime()) ? new Date() : d;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function format(val: string): string {
  const d = new Date(val + 'T12:00:00');
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TODAY = toYMD(new Date());

export function DatePickerField({ value, onChange, colors, placeholder = 'Set visit date' }: Props) {
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState<Date | null>(null);
  const current = value ? toDate(value) : new Date();

  const buttonContent = (
    <>
      <Feather name="calendar" size={16} color={value ? colors.primary : colors.mutedForeground} />
      <Text style={{ flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', color: value ? colors.foreground : colors.mutedForeground }}>
        {value ? format(value) : placeholder}
      </Text>
      {value ? (
        <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      ) : (
        <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
      )}
    </>
  );

  const buttonStyle = {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
    backgroundColor: colors.muted, paddingHorizontal: 14,
    paddingVertical: 13, borderRadius: 12,
  };

  if (Platform.OS === 'web') {
    return (
      <View style={{ position: 'relative' }}>
        <View style={buttonStyle} pointerEvents="none">
          {buttonContent}
        </View>
        {createElement('input', {
          type: 'date',
          value: value || '',
          max: TODAY,
          onChange: (e: any) => onChange(e.target.value),
          style: {
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer', border: 'none',
          },
        })}
      </View>
    );
  }

  function handleChange(_: unknown, selected?: Date) {
    if (Platform.OS === 'android') {
      setShow(false);
      if (selected) onChange(toYMD(selected));
    } else {
      if (selected) setPending(selected);
    }
  }

  function confirmIOS() {
    if (pending) onChange(toYMD(pending));
    setShow(false);
    setPending(null);
  }

  function cancelIOS() {
    setShow(false);
    setPending(null);
  }

  return (
    <>
      <TouchableOpacity onPress={() => setShow(true)} style={buttonStyle} activeOpacity={0.7}>
        {buttonContent}
      </TouchableOpacity>

      {Platform.OS === 'ios' ? (
        <Modal visible={show} transparent animationType="slide" onRequestClose={cancelIOS}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={cancelIOS} />
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 34 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <TouchableOpacity onPress={cancelIOS}>
                <Text style={{ fontSize: 16, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>Visit Date</Text>
              <TouchableOpacity onPress={confirmIOS}>
                <Text style={{ fontSize: 16, color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Done</Text>
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={pending ?? current}
              mode="date"
              display="spinner"
              onChange={handleChange}
              maximumDate={new Date()}
              style={{ height: 200 }}
            />
          </View>
        </Modal>
      ) : (
        show && (
          <DateTimePicker
            value={current}
            mode="date"
            display="default"
            onChange={handleChange}
            maximumDate={new Date()}
          />
        )
      )}
    </>
  );
}
