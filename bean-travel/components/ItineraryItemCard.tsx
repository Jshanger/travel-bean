import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import ProGate from '@/components/ProGate';
import VoiceDictation from '@/components/VoiceDictation';
import { useColors } from '@/hooks/useColors';
import { BookingStatus, ItineraryItem } from '@/types';
import { useApp } from '@/context/AppContext';

const BOOKING_COLORS: Record<BookingStatus, string> = {
  'Booked': '#7DAF8C',
  'Pending': '#C9963A',
  'Not Booked': '#8C857F',
};

interface Props {
  item: ItineraryItem;
  tripId: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function ItineraryItemCard({ item, tripId, onEdit, onDelete }: Props) {
  const colors = useColors();
  const { addComment, voteOnItem, isPro } = useApp();
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [author, setAuthor] = useState('');
  const bookingColor = BOOKING_COLORS[item.bookingStatus];

  function submitComment() {
    if (!newComment.trim()) return;
    addComment(tripId, item.id, { author: author.trim() || 'You', text: newComment.trim() });
    setNewComment('');
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.foreground }]}>{item.title}</Text>
        <View style={styles.actions}>
          <TouchableOpacity onPress={onEdit} style={styles.btn}>
            <Feather name="edit-2" size={13} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={styles.btn}>
            <Feather name="trash-2" size={13} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>

      {item.location ? (
        <View style={styles.locRow}>
          <Feather name="map-pin" size={12} color={colors.primary} />
          <Text style={[styles.loc, { color: colors.mutedForeground }]}>{item.location}</Text>
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <View style={[styles.bookingBadge, { backgroundColor: bookingColor + '20' }]}>
          <Text style={[styles.bookingTxt, { color: bookingColor }]}>{item.bookingStatus}</Text>
        </View>
        {item.travelTime ? (
          <View style={styles.metaItem}>
            <Feather name="clock" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaTxt, { color: colors.mutedForeground }]}>{item.travelTime}</Text>
          </View>
        ) : null}
        {item.budget ? (
          <View style={styles.metaItem}>
            <Feather name="dollar-sign" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaTxt, { color: colors.mutedForeground }]}>{item.budget}</Text>
          </View>
        ) : null}
      </View>

      {item.notes ? <Text style={[styles.notes, { color: colors.mutedForeground }]} numberOfLines={2}>{item.notes}</Text> : null}

      {/* ── Collaboration section — Bean Pro ── */}
      <ProGate feature={{ icon: 'users', label: 'Journey Bean collaboration & voting' }}>
        <View style={[styles.voteRow, { borderTopColor: colors.border }]}>
          <TouchableOpacity style={[styles.voteBtn, { backgroundColor: '#7DAF8C20' }]} onPress={() => voteOnItem(tripId, item.id, 'mustGo')}>
            <Feather name="thumbs-up" size={13} color="#7DAF8C" />
            <Text style={[styles.voteTxt, { color: '#7DAF8C' }]}>{item.votes.mustGo}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.voteBtn, { backgroundColor: '#C9963A20' }]} onPress={() => voteOnItem(tripId, item.id, 'maybe')}>
            <Feather name="help-circle" size={13} color="#C9963A" />
            <Text style={[styles.voteTxt, { color: '#C9963A' }]}>{item.votes.maybe}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.voteBtn, { backgroundColor: '#E05C5C20' }]} onPress={() => voteOnItem(tripId, item.id, 'skip')}>
            <Feather name="thumbs-down" size={13} color="#E05C5C" />
            <Text style={[styles.voteTxt, { color: '#E05C5C' }]}>{item.votes.skip}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.commentToggle} onPress={() => isPro && setShowComments(v => !v)}>
            <Feather name="message-circle" size={13} color={colors.mutedForeground} />
            <Text style={[styles.voteTxt, { color: colors.mutedForeground }]}>{item.comments.length}</Text>
          </TouchableOpacity>
        </View>

        {showComments && (
          <View style={[styles.commentsSection, { borderTopColor: colors.border }]}>
            {item.comments.map(c => (
              <View key={c.id} style={[styles.comment, { backgroundColor: colors.muted }]}>
                <Text style={[styles.commentAuthor, { color: colors.foreground }]}>{c.author}</Text>
                <Text style={[styles.commentText, { color: colors.mutedForeground }]}>{c.text}</Text>
              </View>
            ))}
            <View style={styles.commentInput}>
              <TextInput
                style={[styles.authorInput, { backgroundColor: colors.muted, color: colors.foreground }]}
                placeholder="Name"
                placeholderTextColor={colors.mutedForeground}
                value={author}
                onChangeText={setAuthor}
              />
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.muted, color: colors.foreground, flex: 1 }]}
                placeholder="Add Bean note..."
                placeholderTextColor={colors.mutedForeground}
                value={newComment}
                onChangeText={setNewComment}
                onSubmitEditing={submitComment}
                returnKeyType="send"
              />
              <VoiceDictation
                onResult={text => setNewComment(c => (c ? c.trimEnd() + ' ' : '') + text)}
                size={15}
              />
              <TouchableOpacity onPress={submitComment} style={[styles.sendBtn, { backgroundColor: colors.primary }]}>
                <Feather name="send" size={13} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ProGate>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  title: { fontSize: 14, fontFamily: 'Inter_600SemiBold', flex: 1, marginRight: 8 },
  actions: { flexDirection: 'row', gap: 6 },
  btn: { padding: 3 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  loc: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  bookingBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  bookingTxt: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaTxt: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  notes: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17, marginBottom: 10 },
  voteRow: { flexDirection: 'row', gap: 8, paddingTop: 10, borderTopWidth: 1 },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  voteTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  commentToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, marginLeft: 'auto' },
  commentsSection: { paddingTop: 12, borderTopWidth: 1, marginTop: 8, gap: 8 },
  comment: { padding: 10, borderRadius: 10 },
  commentAuthor: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginBottom: 2 },
  commentText: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  commentInput: { flexDirection: 'row', gap: 6, marginTop: 4 },
  authorInput: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, width: 70, fontFamily: 'Inter_400Regular' },
  textInput: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, fontFamily: 'Inter_400Regular' },
  sendBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
