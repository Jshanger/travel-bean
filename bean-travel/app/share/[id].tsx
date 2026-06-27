import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTravelAuth } from '@/hooks/useTravelAuth';
import { ItineraryItem, TimeBlock, Trip } from '@/types';

const TIME_BLOCKS: TimeBlock[] = ['Morning', 'Afternoon', 'Evening'];

const BLOCK_ICONS: Record<TimeBlock, keyof typeof Feather.glyphMap> = {
  Morning: 'sunrise',
  Afternoon: 'sun',
  Evening: 'moon',
};

const VOTE_META = {
  mustGo: { icon: 'thumbs-up' as const, color: '#7DAF8C', label: 'Must Go' },
  maybe:  { icon: 'help-circle' as const, color: '#C9963A', label: 'Maybe' },
  skip:   { icon: 'thumbs-down' as const, color: '#E05C5C', label: 'Skip' },
};

function getApiBase(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}/api/bean`;
  return '/api/bean';
}

export default function ShareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getTripById } = useApp();
  const { isSignedIn, getToken } = useTravelAuth();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCollaborator, setIsCollaborator] = useState(false); // viewing someone else's trip
  const [localVotes, setLocalVotes] = useState<Record<string, Record<string, number>>>({});
  const [votedItems, setVotedItems] = useState<Record<string, string>>({});

  const topPt = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPb = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    if (!isSignedIn) { setLoading(false); return; }
    const local = getTripById(id);
    if (local) {
      setTrip(local);
      setIsCollaborator(false);
      setLoading(false);
    } else {
      // Fetch by shareId — requires auth token
      getToken().then(token => {
        fetch(`${getApiBase()}/share/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data) { setTrip(mapTrip(data)); setIsCollaborator(true); }
            setLoading(false);
          })
          .catch(() => setLoading(false));
      });
    }
  }, [id, isSignedIn]);

  function mapTrip(r: any): Trip {
    return {
      id: r.id, shareId: r.shareId, name: r.name, destination: r.destination,
      startDate: r.startDate, endDate: r.endDate, travellers: r.travellers ?? [],
      itinerary: r.itinerary ?? [], createdAt: r.createdAt ?? '',
    };
  }

  async function handleVote(itemId: string, vote: 'mustGo' | 'maybe' | 'skip') {
    if (!trip || !isCollaborator) return;
    if (votedItems[itemId]) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVotedItems(v => ({ ...v, [itemId]: vote }));
    setLocalVotes(lv => ({
      ...lv,
      [itemId]: { ...(lv[itemId] ?? {}), [vote]: ((lv[itemId]?.[vote] ?? 0) + 1) },
    }));
    try {
      const token = await getToken();
      await fetch(`${getApiBase()}/share/${trip.shareId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ itemId, vote }),
      });
    } catch (_) {}
  }

  function getVoteCount(item: ItineraryItem, voteKey: string): number {
    return (localVotes[item.id]?.[voteKey] ?? 0) + (item.votes[voteKey as keyof typeof item.votes] ?? 0);
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (!isSignedIn) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPt, justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#E8825A18', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Feather name="users" size={32} color="#E8825A" />
        </View>
        <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.foreground, textAlign: 'center', marginBottom: 10 }}>
          You need Bean to collaborate
        </Text>
        <Text style={{ fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
          Trip collaboration is for Bean users. Sign in to view this shared itinerary and vote on Bean stops.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: '#E8825A', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 }}
          onPress={() => router.replace('/sign-in')}
        >
          <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Sign in to Bean</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPt }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 16 }}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.notFound, { color: colors.mutedForeground }]}>Loading…</Text>
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPt }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 16 }}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.notFound, { color: colors.mutedForeground }]}>Trip not found</Text>
      </View>
    );
  }

  const numDays = getDays(trip.startDate, trip.endDate);
  const grouped: Record<number, ItineraryItem[]> = {};
  trip.itinerary.forEach(item => {
    if (!grouped[item.day]) grouped[item.day] = [];
    grouped[item.day].push(item);
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPt + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {isCollaborator ? trip.name : 'Shared Trip'}
        </Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: bottomPb + 20 }} showsVerticalScrollIndicator={false}>

        {/* Trip header card */}
        <View style={[styles.tripHeader, { backgroundColor: colors.primary }]}>
          <Feather name="map" size={22} color="rgba(255,255,255,0.9)" />
          <View style={{ flex: 1 }}>
            <Text style={styles.tripName}>{trip.name}</Text>
            <Text style={styles.tripMeta}>{formatDateRange(trip.startDate, trip.endDate)}</Text>
            {trip.travellers.length > 0 && (
              <Text style={styles.tripTravellers}>
                <Feather name="users" size={11} color="rgba(255,255,255,0.7)" /> {trip.travellers.join(', ')}
              </Text>
            )}
          </View>
        </View>

        {/* Collaborator banner */}
        {isCollaborator && (
          <View style={[styles.publicBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="users" size={14} color={colors.mutedForeground} />
            <Text style={[styles.publicBannerTxt, { color: colors.mutedForeground }]}>
              Tap the vote buttons to help plan the trip — your votes sync to the owner.
            </Text>
          </View>
        )}

        {/* Itinerary */}
        <Text style={[styles.itineraryTitle, { color: colors.foreground }]}>Trip Itinerary</Text>
        <Text style={[styles.itinerarySub, { color: colors.mutedForeground }]}>
          {trip.itinerary.length} Bean stop{trip.itinerary.length === 1 ? '' : 's'} · {numDays} day{numDays !== 1 ? 's' : ''}
        </Text>

        {Array.from({ length: numDays }, (_, i) => i + 1).map(day => {
          const items = grouped[day] ?? [];
          if (items.length === 0) return null;
          return (
            <View key={day} style={{ marginBottom: 24 }}>
              <View style={[styles.dayBadge, { backgroundColor: colors.muted }]}>
                <Text style={[styles.dayBadgeText, { color: colors.foreground }]}>
                  Day {day}{getDayDate(trip.startDate, day) ? ` · ${getDayDate(trip.startDate, day)}` : ''}
                </Text>
              </View>

              {TIME_BLOCKS.map(block => {
                const blockItems = items.filter(i => i.timeBlock === block);
                if (blockItems.length === 0) return null;
                return (
                  <View key={block}>
                    <View style={styles.blockHeader}>
                      <Feather name={BLOCK_ICONS[block]} size={12} color={colors.primary} />
                      <Text style={[styles.blockLabel, { color: colors.mutedForeground }]}>{block}</Text>
                    </View>
                    {blockItems.map(item => {
                      const myVote = votedItems[item.id];
                      return (
                        <View key={item.id} style={[styles.shareItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <Text style={[styles.shareItemTitle, { color: colors.foreground }]}>{item.title}</Text>
                          {item.location ? (
                            <View style={styles.locRow}>
                              <Feather name="map-pin" size={11} color={colors.primary} />
                              <Text style={[styles.shareItemMeta, { color: colors.mutedForeground }]}>{item.location}</Text>
                            </View>
                          ) : null}

                          <View style={styles.shareMeta}>
                            {item.bookingStatus !== 'Not Booked' && (
                              <View style={[styles.bookingTag, { backgroundColor: item.bookingStatus === 'Booked' ? '#7DAF8C20' : '#C9963A20' }]}>
                                <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: item.bookingStatus === 'Booked' ? '#7DAF8C' : '#C9963A' }}>{item.bookingStatus}</Text>
                              </View>
                            )}
                            {item.budget ? <Text style={[styles.budget, { color: colors.mutedForeground }]}>{item.budget}</Text> : null}
                            {item.travelTime ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Feather name="clock" size={11} color={colors.mutedForeground} />
                                <Text style={[styles.budget, { color: colors.mutedForeground }]}>{item.travelTime}</Text>
                              </View>
                            ) : null}
                          </View>

                          {item.notes ? <Text style={[styles.shareNotes, { color: colors.mutedForeground }]}>{item.notes}</Text> : null}

                          {/* Vote row */}
                          <View style={[styles.voteRow, { borderTopColor: colors.border }]}>
                            {(Object.keys(VOTE_META) as Array<keyof typeof VOTE_META>).map(vk => {
                              const meta = VOTE_META[vk];
                              const count = getVoteCount(item, vk);
                              const isMyVote = myVote === vk;
                              return (
                                <TouchableOpacity
                                  key={vk}
                                  style={[
                                    styles.voteBtn,
                                    { backgroundColor: isMyVote ? meta.color + '30' : meta.color + '15' },
                                    isMyVote && { borderWidth: 1, borderColor: meta.color + '60' },
                                  ]}
                                  onPress={() => handleVote(item.id, vk)}
                                  disabled={!isCollaborator || !!myVote}
                                  activeOpacity={isCollaborator ? 0.7 : 1}
                                >
                                  <Feather name={meta.icon} size={12} color={meta.color} />
                                  {count > 0 && <Text style={[styles.voteTxt, { color: meta.color }]}>{count}</Text>}
                                </TouchableOpacity>
                              );
                            })}
                            {myVote && (
                              <Text style={[styles.votedLabel, { color: colors.mutedForeground }]}>voted!</Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          );
        })}

      </ScrollView>
    </View>
  );
}

function getDays(s: string, e: string) {
  try { return Math.max(1, Math.ceil((new Date(e).getTime() - new Date(s).getTime()) / (1000 * 60 * 60 * 24)) + 1); }
  catch { return 1; }
}
function getDayDate(start: string, day: number) {
  try { const d = new Date(start); d.setDate(d.getDate() + day - 1); return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
  catch { return ''; }
}
function formatDateRange(s: string, e: string) {
  try { return `${new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(e).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`; }
  catch { return `${s} – ${e}`; }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold', flex: 1, marginLeft: 8 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  shareBtnTxt: { color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  tripHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 16, gap: 14, marginBottom: 14 },
  tripName: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#fff', marginBottom: 2 },
  tripMeta: { fontSize: 13, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.85)', marginBottom: 2 },
  tripTravellers: { fontSize: 12, fontFamily: 'Inter_400Regular', color: 'rgba(255,255,255,0.7)' },
  linkCard: { flexDirection: 'row', alignItems: 'center', padding: 13, borderRadius: 14, borderWidth: 1, gap: 10, marginBottom: 20 },
  linkText: { flex: 1, fontSize: 12, fontFamily: 'Inter_400Regular' },
  copyChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, gap: 4 },
  copyTxt: { color: '#fff', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  publicBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  publicBannerTxt: { flex: 1, fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  itineraryTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', marginBottom: 2 },
  itinerarySub: { fontSize: 13, fontFamily: 'Inter_400Regular', marginBottom: 18 },
  dayBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 12 },
  dayBadgeText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  blockHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  blockLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.6 },
  shareItem: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  shareItemTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  shareItemMeta: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  shareMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  bookingTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  budget: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  shareNotes: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, marginBottom: 10 },
  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10, borderTopWidth: 1, marginTop: 4 },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  voteTxt: { fontSize: 12, fontFamily: 'Inter_700Bold' },
  votedLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', marginLeft: 4 },
  beanBanner: { marginTop: 8, padding: 20, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  beanBannerTitle: { fontSize: 16, fontFamily: 'Inter_700Bold', marginBottom: 6, textAlign: 'center' },
  beanBannerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 18, textAlign: 'center' },
  notFound: { fontSize: 16, textAlign: 'center', fontFamily: 'Inter_400Regular', marginTop: 40 },
});
