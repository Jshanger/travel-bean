import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import QRCode from 'react-native-qrcode-svg';
import {
  Alert, Image, Linking, Modal, Platform, ScrollView, Share, StyleSheet, Text,
  TextInput, TouchableOpacity, View
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import BeanMapPin from '@/components/BeanMapPin';
import { ItineraryItemCard } from '@/components/ItineraryItemCard';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { BookingStatus, ItineraryItem, TimeBlock, Trip } from '@/types';

const TIME_BLOCKS: TimeBlock[] = ['Morning', 'Afternoon', 'Evening'];
const BOOKING_STATUSES: BookingStatus[] = ['Not Booked', 'Booked', 'Pending'];

const BLOCK_ICONS: Record<TimeBlock, keyof typeof Feather.glyphMap> = {
  Morning: 'sunrise',
  Afternoon: 'sun',
  Evening: 'moon',
};

interface ItemForm {
  day: string;
  timeBlock: TimeBlock;
  title: string;
  location: string;
  travelTime: string;
  notes: string;
  bookingStatus: BookingStatus;
  budget: string;
}

const EMPTY_FORM: ItemForm = { day: '1', timeBlock: 'Morning', title: '', location: '', travelTime: '', notes: '', bookingStatus: 'Not Booked', budget: '' };

function generateTripHTML(trip: Trip): string {
  const numDays = getDays(trip.startDate, trip.endDate);
  const days = Array.from({ length: numDays }, (_, i) => i + 1);

  const dayHtml = days.map(day => {
    const dayItems = trip.itinerary.filter(i => i.day === day);
    if (dayItems.length === 0) return '';
    const dayDate = getDayDate(trip.startDate, day);
    const blockHtml = TIME_BLOCKS.map(block => {
      const items = dayItems.filter(i => i.timeBlock === block);
      if (items.length === 0) return '';
      const itemHtml = items.map(item => {
        const statusClass = item.bookingStatus === 'Booked' ? 'booked' : item.bookingStatus === 'Pending' ? 'pending' : 'not-booked';
        return `
          <div class="item">
            <div class="item-title">${item.title}</div>
            ${item.location ? `<div class="item-loc">📍 ${item.location}</div>` : ''}
            <div class="item-meta">
              <span class="${statusClass}">${item.bookingStatus}</span>
              ${item.travelTime ? ` · ⏱ ${item.travelTime}` : ''}
              ${item.budget ? ` · 💰 ${item.budget}` : ''}
            </div>
            ${item.notes ? `<div class="notes">${item.notes}</div>` : ''}
          </div>`;
      }).join('');
      return `<div class="block"><div class="block-name">${block}</div>${itemHtml}</div>`;
    }).join('');
    return `
      <div class="day">
        <div class="day-title">Day ${day}${dayDate ? ` · ${dayDate}` : ''}</div>
        ${blockHtml}
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Helvetica, sans-serif; color: #2D2926; background: #FFF9F4; padding: 40px 32px; }
    h1 { font-size: 26px; font-weight: 700; color: #E8825A; margin-bottom: 4px; }
    .meta { color: #8C857F; font-size: 13px; margin-bottom: 36px; }
    .day { margin-bottom: 32px; }
    .day-title { font-size: 15px; font-weight: 700; color: #E8825A; padding-bottom: 8px; border-bottom: 1.5px solid #E8D8CE; margin-bottom: 14px; }
    .block { margin-bottom: 16px; }
    .block-name { font-size: 11px; font-weight: 600; color: #8C857F; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .item { background: #fff; border-radius: 10px; padding: 12px 16px; margin-bottom: 8px; border-left: 3px solid #E8825A; }
    .item-title { font-size: 14px; font-weight: 700; margin-bottom: 3px; }
    .item-loc { font-size: 12px; color: #8C857F; margin-bottom: 5px; }
    .item-meta { font-size: 12px; color: #8C857F; margin-bottom: 4px; }
    .booked { color: #7DAF8C; font-weight: 600; }
    .pending { color: #C9963A; font-weight: 600; }
    .not-booked { color: #8C857F; }
    .notes { font-size: 12px; color: #5C5752; font-style: italic; margin-top: 4px; }
    .footer { margin-top: 40px; font-size: 11px; color: #C0B8B2; text-align: center; }
  </style>
</head>
<body>
  <h1>${trip.name}</h1>
  <div class="meta">${trip.destination} · ${formatDateRange(trip.startDate, trip.endDate)}${trip.travellers.length ? ' · ' + trip.travellers.join(', ') : ''}</div>
  ${dayHtml}
  <div class="footer">Created with Bean · Travel smarter</div>
</body>
</html>`;
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getTripById, addItineraryItem, editItineraryItem, deleteItineraryItem, isPro } = useApp();

  const trip = getTripById(id ?? '');
  const [activeDay, setActiveDay] = useState(1);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);

  function getShareUrl() {
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    return domain ? `https://${domain}/share/${trip?.shareId}` : `https://beantravel.app/share/${trip?.shareId}`;
  }

  async function handleShare() {
    if (!trip) return;
    setShareSheetVisible(true);
  }

  const topPt = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPb = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  if (!trip) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPt }]}>
        <EmptyState icon="briefcase" title="Trip not found" subtitle="This Trip may have been deleted" />
      </View>
    );
  }

  const numDays = getDays(trip.startDate, trip.endDate);
  const dayItems = trip.itinerary.filter(i => i.day === activeDay);

  function openAdd(dayOverride = activeDay) {
    setActiveDay(dayOverride);
    setForm({ ...EMPTY_FORM, day: String(dayOverride) });
    setEditingItemId(null);
    setModalVisible(true);
  }
  function openEdit(item: ItineraryItem) {
    setForm({ day: String(item.day), timeBlock: item.timeBlock, title: item.title, location: item.location, travelTime: item.travelTime, notes: item.notes, bookingStatus: item.bookingStatus, budget: item.budget });
    setEditingItemId(item.id);
    setModalVisible(true);
  }
  function handleDelete(itemId: string) {
    const tripId = trip?.id ?? '';
    Alert.alert('Delete Bean stop', 'Remove this Bean stop from the itinerary?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteItineraryItem(tripId, itemId); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } },
    ]);
  }
  function handleSave() {
    if (!form.title.trim() || !trip) return;
    const payload = { day: parseInt(form.day) || activeDay, timeBlock: form.timeBlock, title: form.title, location: form.location, travelTime: form.travelTime, notes: form.notes, bookingStatus: form.bookingStatus, budget: form.budget };
    if (editingItemId) {
      editItineraryItem(trip.id, editingItemId, payload);
    } else {
      addItineraryItem(trip.id, payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setModalVisible(false);
  }

  async function handleExportPdf() {
    if (!isPro) { router.push('/(tabs)/more'); return; }
    if (!trip) return;
    try {
      setExportingPdf(true);
      const html = generateTripHTML(trip);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${trip.name} Trip`,
        UTI: 'com.adobe.pdf',
      });
    } catch (e) {
      Alert.alert('Export failed', 'Could not generate the PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  }

  const routeDays = Array.from({ length: numDays }, (_, index) => {
    const day = index + 1;
    const items = trip.itinerary.filter(i => i.day === day);
    const primary = items[0];
    return {
      day,
      title: primary?.location || primary?.title || trip.destination,
      date: getRouteDayRange(trip.startDate, day),
      itemCount: items.length,
    };
  });
  const plannedNights = Math.max(0, numDays - 1);
  const filledDays = new Set(trip.itinerary.map(i => i.day)).size;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.routeMapHero}>
        <LinearGradient colors={['#5A8F78', '#BDEAD8', '#EAF8F1']} style={styles.routeMapBase}>
          <Svg width="100%" height="100%" viewBox="0 0 390 430" style={styles.routeMapSvg}>
            <Circle cx="270" cy="72" r="132" fill="#FFFFFF" opacity="0.13" />
            <Circle cx="270" cy="72" r="84" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.16" />
            <Path d="M-20 80 C65 10 115 90 190 42 C260 -4 300 48 430 20" stroke="rgba(255,255,255,0.74)" strokeWidth="4" fill="none" />
            <Path d="M-10 230 C84 198 130 246 214 210 C282 180 320 236 420 190" stroke="rgba(255,255,255,0.62)" strokeWidth="5" fill="none" />
            <Path d="M32 370 C120 284 192 350 278 280 C330 238 360 270 420 246" stroke="rgba(255,255,255,0.7)" strokeWidth="4" fill="none" />
            <Path d="M26 58 L105 112 L92 176 L166 248 L148 372" stroke="rgba(22,58,70,0.18)" strokeWidth="3" fill="none" />
            <Path d="M244 12 L220 96 L268 158 L232 236 L298 338" stroke="rgba(22,58,70,0.15)" strokeWidth="3" fill="none" />
            <Path d="M34 326 L92 280 L142 300 L210 250 L268 272 L354 218" stroke="rgba(84,44,244,0.68)" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 13" fill="none" />
            <Path d="M68 112 C98 82 125 85 156 106 C182 124 206 120 236 92" stroke="rgba(255,255,255,0.5)" strokeWidth="10" strokeLinecap="round" fill="none" />
            <Path d="M186 180 C222 146 266 152 309 184 C336 204 362 196 402 166" stroke="rgba(255,255,255,0.36)" strokeWidth="9" strokeLinecap="round" fill="none" />
            <Circle cx="222" cy="218" r="14" fill="#fff" opacity="0.96" />
            <Circle cx="222" cy="218" r="27" fill="#fff" opacity="0.38" />
            <Circle cx="222" cy="218" r="48" fill="#542CF4" opacity="0.09" />
            <Circle cx="92" cy="280" r="7" fill="#fff" opacity="0.8" />
            <Circle cx="268" cy="272" r="7" fill="#fff" opacity="0.74" />
          </Svg>
          <LinearGradient colors={['rgba(18,51,45,0.5)', 'rgba(18,51,45,0.08)', 'rgba(255,255,255,0)']} style={styles.routeMapShade} />
          <View style={[styles.routeHeader, { paddingTop: topPt + 18 }]}>
            <TouchableOpacity style={styles.roundHeaderBtn} onPress={() => router.back()}>
              <Feather name="chevron-left" size={30} color="#153A46" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeTripTitle} numberOfLines={1}>{trip.name}</Text>
              <Text style={styles.routeTripDates}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
            </View>
            <TouchableOpacity style={styles.pinCountBtn} onPress={isPro ? handleShare : () => router.push('/(tabs)/more')}>
              <Feather name="map-pin" size={20} color="#8B5CF6" />
              <Text style={styles.pinCountText}>{trip.itinerary.length}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.roundHeaderBtn} onPress={handleExportPdf} disabled={exportingPdf}>
              <Feather name="menu" size={26} color="#153A46" />
            </TouchableOpacity>
          </View>
          <View style={styles.routeMarker}>
            <BeanMapPin size={54} color="#5BCF9A" featured />
            <View style={styles.routeMarkerBadge}>
              <Text style={styles.routeMarkerText}>{Math.max(1, activeDay)}</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={[styles.routeSheet, { backgroundColor: colors.background, paddingBottom: bottomPb + 24 }]}>
        <View style={styles.routeHandle} />
        <View style={[styles.routeTabs, { borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.routeTabActive}><Text style={styles.routeTabActiveText}>Route</Text></TouchableOpacity>
          <TouchableOpacity style={styles.routeTab}><Text style={[styles.routeTabText, { color: colors.mutedForeground }]}>Days</Text></TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.routeSheetScroll}>
          <View style={styles.routeSummary}>
            <View style={styles.nightsRing}>
              <Text style={styles.nightsRingText}>{filledDays}/{numDays}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.nightsTitle, { color: colors.foreground }]}>Days planned</Text>
              <Text style={[styles.nightsSub, { color: colors.mutedForeground }]}>{plannedNights} night{plannedNights === 1 ? '' : 's'} · {trip.itinerary.length} Bean stops</Text>
            </View>
            <TouchableOpacity style={styles.optimizeBtn} onPress={() => openAdd(activeDay)}>
              <Feather name="plus" size={16} color="#8B5CF6" />
              <Text style={styles.optimizeText}>Add Place stop</Text>
            </TouchableOpacity>
          </View>

          {routeDays.map(route => (
            <View key={route.day}>
              <TouchableOpacity style={styles.routeDayRow} onPress={() => setActiveDay(route.day)} activeOpacity={0.76}>
                <View style={[styles.routeDayNum, activeDay === route.day && styles.routeDayNumActive]}>
                  <Text style={[styles.routeDayNumText, activeDay === route.day && styles.routeDayNumTextActive]}>{route.day}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.routeDayTitle, { color: colors.foreground }]} numberOfLines={1}>{route.title}</Text>
                  <Text style={[styles.routeDayDate, { color: colors.mutedForeground }]}>{route.date}</Text>
                  {route.itemCount > 0 ? <Text style={styles.routeDayStops}>{route.itemCount} Bean stop{route.itemCount === 1 ? '' : 's'}</Text> : null}
                </View>
                <TouchableOpacity style={styles.nightStepper}><Feather name="minus" size={25} color="#153A46" /></TouchableOpacity>
                <View style={styles.nightCount}>
                  <Text style={[styles.nightCountValue, { color: colors.foreground }]}>{route.day < numDays ? 1 : 0}</Text>
                  <Text style={[styles.nightCountLabel, { color: colors.mutedForeground }]}>night</Text>
                </View>
                <TouchableOpacity style={styles.nightStepper} onPress={() => openAdd(route.day)}><Feather name="plus" size={29} color="#153A46" /></TouchableOpacity>
              </TouchableOpacity>
              <DayActivityPreview
                items={trip.itinerary.filter(i => i.day === route.day)}
                colors={colors}
                onAdd={() => openAdd(route.day)}
                onEdit={openEdit}
                onDelete={handleDelete}
                tripId={trip.id}
              />
              {route.day < numDays && (
                <View style={[styles.routeDistanceLine, { backgroundColor: colors.border }]}>
                  <View style={styles.routeDistanceBadge}>
                    <Feather name="plus" size={14} color="#D95A84" />
                    <Text style={styles.routeDistanceText}>0 km</Text>
                  </View>
                </View>
              )}
            </View>
          ))}

          {dayItems.length > 0 && (
            <View style={styles.activeDayDetails}>
              <Text style={[styles.activeDayTitle, { color: colors.foreground }]}>Day {activeDay} Bean stops</Text>
              {TIME_BLOCKS.map(block => {
                const blockItems = dayItems.filter(i => i.timeBlock === block);
                if (blockItems.length === 0) return null;
                return (
                  <View key={block} style={{ marginBottom: 12 }}>
                    <View style={styles.blockHeader}>
                      <Feather name={BLOCK_ICONS[block]} size={16} color="#5BCF9A" />
                      <Text style={[styles.blockTitle, { color: colors.foreground }]}>{block}</Text>
                    </View>
                    {blockItems.map(item => (
                      <ItineraryItemCard key={item.id} item={item} tripId={trip.id} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item.id)} />
                    ))}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>

      <View style={[styles.fab, { bottom: bottomPb + 18 }]}>
        <TouchableOpacity style={[styles.fabBtn, { backgroundColor: '#5BCF9A' }]} onPress={() => openAdd(activeDay)}>
          <Feather name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={{ fontSize: 15, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editingItemId ? 'Edit Bean Stop' : 'Add Place Stop'}</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={{ fontSize: 15, color: colors.primary, fontFamily: 'Inter_600SemiBold' }}>Save</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
            <FieldLabel label="Bean Stop Title *" colors={colors}>
              <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]} placeholder="e.g. Shinjuku Gyoen" placeholderTextColor={colors.mutedForeground} value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} />
            </FieldLabel>
            <FieldLabel label="Location" colors={colors}>
              <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]} placeholder="e.g. Shinjuku, Tokyo" placeholderTextColor={colors.mutedForeground} value={form.location} onChangeText={v => setForm(f => ({ ...f, location: v }))} />
            </FieldLabel>
            <FieldLabel label="Day" colors={colors}>
              <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]} placeholder="1" placeholderTextColor={colors.mutedForeground} value={form.day} onChangeText={v => setForm(f => ({ ...f, day: v }))} keyboardType="number-pad" />
            </FieldLabel>
            <FieldLabel label="Time Block" colors={colors}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {TIME_BLOCKS.map(b => (
                  <TouchableOpacity key={b} style={[styles.blockChip, { backgroundColor: form.timeBlock === b ? colors.primary : colors.muted, flex: 1 }]} onPress={() => setForm(f => ({ ...f, timeBlock: b }))}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: form.timeBlock === b ? '#fff' : colors.mutedForeground, textAlign: 'center' }}>{b}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FieldLabel>
            <FieldLabel label="Booking Status" colors={colors}>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {BOOKING_STATUSES.map(s => (
                  <TouchableOpacity key={s} style={[styles.blockChip, { backgroundColor: form.bookingStatus === s ? colors.secondary : colors.muted }]} onPress={() => setForm(f => ({ ...f, bookingStatus: s }))}>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: form.bookingStatus === s ? '#fff' : colors.mutedForeground }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FieldLabel>
            <FieldLabel label="Travel Time" colors={colors}>
              <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]} placeholder="e.g. 30 min" placeholderTextColor={colors.mutedForeground} value={form.travelTime} onChangeText={v => setForm(f => ({ ...f, travelTime: v }))} />
            </FieldLabel>
            <FieldLabel label="Budget" colors={colors}>
              <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]} placeholder="e.g. ¥3,000" placeholderTextColor={colors.mutedForeground} value={form.budget} onChangeText={v => setForm(f => ({ ...f, budget: v }))} />
            </FieldLabel>
            <FieldLabel label="Bean Notes" colors={colors}>
              <TextInput style={[styles.input, styles.textarea, { backgroundColor: colors.muted, color: colors.foreground }]} placeholder="Tips, reminders, booking info..." placeholderTextColor={colors.mutedForeground} value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} multiline numberOfLines={3} textAlignVertical="top" />
            </FieldLabel>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Share sheet (all platforms) ── */}
      <Modal visible={shareSheetVisible} transparent animationType="slide" onRequestClose={() => setShareSheetVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setShareSheetVisible(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: insets.bottom + 24, gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 17, fontFamily: 'Inter_600SemiBold', color: colors.foreground }}>Share Trip</Text>
                <TouchableOpacity onPress={() => setShareSheetVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground }}>
                Show this QR code or share the link — recipients need Bean to collaborate.
              </Text>

              {/* QR code — native SVG renderer on device, image API on web */}
              <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                <View style={{ padding: 14, backgroundColor: '#fff', borderRadius: 16 }}>
                  {Platform.OS === 'web' ? (
                    <Image
                      source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=2&data=${encodeURIComponent(getShareUrl())}` }}
                      style={{ width: 180, height: 180 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <QRCode
                      value={getShareUrl()}
                      size={180}
                      color="#2D2926"
                      backgroundColor="#fff"
                    />
                  )}
                </View>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 10 }}>
                  Scan with your camera to open in Bean
                </Text>
              </View>

              {/* Selectable URL */}
              <View>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginBottom: 6 }}>
                  {Platform.OS === 'web' ? 'Tap the link to select it, then copy' : 'Trip link'}
                </Text>
                <TextInput
                  editable={false}
                  selectTextOnFocus
                  value={getShareUrl()}
                  multiline={false}
                  style={{
                    backgroundColor: colors.muted,
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 12,
                    fontFamily: 'Inter_400Regular',
                    color: colors.foreground,
                  }}
                />
              </View>

              {/* Primary action — native share sheet on device, open-in-browser on web */}
              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                onPress={async () => {
                  const url = getShareUrl();
                  if (Platform.OS === 'web') {
                    Linking.openURL(url);
                  } else {
                    try { await Share.share({ message: url, url }); } catch {}
                  }
                }}
              >
                <Feather name={Platform.OS === 'web' ? 'external-link' : 'share-2'} size={16} color="#fff" />
                <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>
                  {Platform.OS === 'web' ? 'Open Link' : 'Share'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

function FieldLabel({ label, children, colors }: { label: string; children: React.ReactNode; colors: any }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground }}>{label}</Text>
      {children}
    </View>
  );
}

function DayActivityPreview({
  items,
  colors,
  onAdd,
}: {
  items: ItineraryItem[];
  colors: any;
  onAdd: () => void;
  onEdit: (item: ItineraryItem) => void;
  onDelete: (id: string) => void;
  tripId: string;
}) {
  if (items.length === 0) {
    return (
      <TouchableOpacity style={[styles.dayEmptyPlan, { borderColor: colors.border }]} onPress={onAdd} activeOpacity={0.78}>
        <Feather name="plus-circle" size={16} color="#5BCF9A" />
        <Text style={[styles.dayEmptyText, { color: colors.mutedForeground }]}>Add sites, cafes, activities or transport for this day</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.dayActivityList}>
      {items.map(item => (
        <View key={item.id} style={[styles.dayActivityRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dayActivityIcon}>
            <Feather name={BLOCK_ICONS[item.timeBlock]} size={14} color="#48B985" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dayActivityTitle, { color: colors.foreground }]} numberOfLines={1}>{item.title}</Text>
            <Text style={[styles.dayActivityMeta, { color: colors.mutedForeground }]} numberOfLines={2}>
              {item.timeBlock}{item.location ? ` · ${item.location}` : ''}{item.travelTime ? ` · ${item.travelTime}` : ''}
            </Text>
          </View>
          <Text style={[styles.dayActivityBadge, { color: colors.primary }]}>{item.bookingStatus}</Text>
        </View>
      ))}
    </View>
  );
}

function getDays(start: string, end: string) {
  try {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  } catch { return 1; }
}
function getDayDate(start: string, day: number) {
  try {
    const d = new Date(start);
    d.setDate(d.getDate() + day - 1);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch { return null; }
}
function getRouteDayRange(start: string, day: number) {
  try {
    const from = new Date(start);
    const to = new Date(start);
    from.setDate(from.getDate() + day - 1);
    to.setDate(to.getDate() + day);
    const format = (date: Date) => date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return `${format(from)} - ${format(to)}`;
  } catch { return `Day ${day}`; }
}
function formatDateRange(s: string, e: string) {
  try {
    const sd = new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const ed = new Date(e).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${sd} – ${ed}`;
  } catch { return `${s} – ${e}`; }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  tripName: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  tripMeta: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  headerBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayPicker: { borderBottomWidth: 1, paddingVertical: 12 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  dayNum: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  dayDate: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  addDayBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed' },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  blockTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  diaryCard: { marginBottom: 22, borderRadius: 26, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 22, elevation: 8 },
  diaryGradient: { minHeight: 190, padding: 20, justifyContent: 'space-between' },
  diaryGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.15)', right: -58, top: -74 },
  diaryHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  diaryIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  diaryKicker: { color: 'rgba(255,255,255,0.72)', fontSize: 12, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  diaryTitle: { color: '#fff', fontSize: 27, lineHeight: 31, fontFamily: 'Inter_700Bold', marginTop: 18, maxWidth: 310 },
  diaryText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 20, fontFamily: 'Inter_500Medium', marginTop: 8, maxWidth: 330 },
  diaryFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  diaryPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  diaryPillText: { color: '#11131D', fontSize: 12, fontFamily: 'Inter_700Bold' },
  routeMapHero: { height: 520, backgroundColor: '#DFF3E8' },
  routeMapBase: { flex: 1, overflow: 'hidden' },
  routeMapSvg: { ...StyleSheet.absoluteFillObject },
  routeMapShade: { ...StyleSheet.absoluteFillObject },
  routeHeader: { position: 'absolute', left: 24, right: 24, top: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  roundHeaderBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D2D36',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
  routeTripTitle: { color: '#fff', fontSize: 22, fontFamily: 'Inter_700Bold' },
  routeTripDates: { color: 'rgba(255,255,255,0.84)', fontSize: 14, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  pinCountBtn: {
    height: 58,
    borderRadius: 29,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#0D2D36',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
  pinCountText: { color: '#153A46', fontSize: 16, fontFamily: 'Inter_700Bold' },
  routeMarker: {
    position: 'absolute',
    left: '55%',
    top: '42%',
    width: 54,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeMarkerBadge: {
    position: 'absolute',
    top: 10,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeMarkerText: { color: '#153A46', fontSize: 14, fontFamily: 'Inter_700Bold' },
  routeSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '66%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    shadowColor: '#0D2D36',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 10,
  },
  routeHandle: { width: 58, height: 7, borderRadius: 4, backgroundColor: '#DCE7EA', alignSelf: 'center', marginBottom: 18 },
  routeTabs: { flexDirection: 'row', borderBottomWidth: 1 },
  routeTabActive: { flex: 1, alignItems: 'center', paddingBottom: 16, borderBottomWidth: 3, borderBottomColor: '#5BCF9A' },
  routeTab: { flex: 1, alignItems: 'center', paddingBottom: 16 },
  routeTabActiveText: { color: '#5BCF9A', fontSize: 17, fontFamily: 'Inter_700Bold' },
  routeTabText: { fontSize: 17, fontFamily: 'Inter_700Bold' },
  routeSheetScroll: { padding: 20, paddingBottom: 30 },
  routeSummary: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 },
  nightsRing: { width: 74, height: 74, borderRadius: 37, borderWidth: 5, borderColor: '#E05C5C', alignItems: 'center', justifyContent: 'center' },
  nightsRingText: { color: '#E05C5C', fontSize: 16, fontFamily: 'Inter_700Bold' },
  nightsTitle: { fontSize: 22, lineHeight: 27, fontFamily: 'Inter_700Bold' },
  nightsSub: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 2 },
  optimizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E8EEF2',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  optimizeText: { color: '#8B5CF6', fontSize: 15, fontFamily: 'Inter_700Bold' },
  routeDayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  routeDayNum: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#5BCF9A', alignItems: 'center', justifyContent: 'center' },
  routeDayNumActive: { backgroundColor: '#5BCF9A' },
  routeDayNumText: { color: '#5BCF9A', fontSize: 15, fontFamily: 'Inter_700Bold' },
  routeDayNumTextActive: { color: '#fff' },
  routeDayTitle: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  routeDayDate: { fontSize: 15, fontFamily: 'Inter_600SemiBold', marginTop: 3 },
  routeDayStops: { color: '#5BCF9A', fontSize: 12, fontFamily: 'Inter_700Bold', marginTop: 4 },
  dayActivityList: { marginLeft: 40, gap: 8, paddingBottom: 10 },
  dayActivityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, padding: 10 },
  dayActivityIcon: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5BCF9A1F' },
  dayActivityTitle: { fontSize: 14, fontFamily: 'Inter_700Bold' },
  dayActivityMeta: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_500Medium', marginTop: 2 },
  dayActivityBadge: { fontSize: 11, fontFamily: 'Inter_700Bold' },
  dayEmptyPlan: { marginLeft: 40, marginBottom: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayEmptyText: { flex: 1, fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  nightStepper: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  nightCount: { alignItems: 'center', minWidth: 42 },
  nightCountValue: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  nightCountLabel: { fontSize: 12, fontFamily: 'Inter_700Bold', marginTop: -2 },
  routeDistanceLine: { height: 1, marginLeft: 48, marginRight: 4, alignItems: 'center', justifyContent: 'center' },
  routeDistanceBadge: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF1F6', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  routeDistanceText: { color: '#D95A84', fontSize: 13, fontFamily: 'Inter_700Bold' },
  activeDayDetails: { marginTop: 24, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#E8EEF2' },
  activeDayTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  fab: { position: 'absolute', right: 20 },
  fabBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  textarea: { minHeight: 80 },
  blockChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
});
