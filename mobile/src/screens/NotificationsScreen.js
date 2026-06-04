import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';

const C = {
  primary: '#561C24', secondary: '#6D2932', accent: '#C7B7A3',
  background: '#E8D8C4', surface: '#FFFFFF',
};

function fmtDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)   return `Hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7)    return `Hace ${diffD} día${diffD > 1 ? 's' : ''}`;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function NotifItem({ item, onPress }) {
  const unread = !item.leida;
  return (
    <TouchableOpacity
      style={[s.item, unread && s.itemUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
    >
      <View style={s.itemRow}>
        <View style={s.itemContent}>
          <Text style={[s.itemTitle, unread && s.itemTitleUnread]} numberOfLines={1}>
            {item.titulo}
          </Text>
          <Text style={s.itemMsg} numberOfLines={2}>
            {item.mensaje.length > 80 ? item.mensaje.slice(0, 80) + '…' : item.mensaje}
          </Text>
          <Text style={s.itemDate}>{fmtDate(item.created_at)}</Text>
        </View>
        {unread && <View style={s.dot} />}
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen({ navigation }) {
  const [notifs,    setNotifs]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifs(data.notificaciones ?? data ?? []);
    } catch (_) {}
    if (isRefresh) setRefreshing(false); else setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleTap = async (item) => {
    // Optimistic update
    if (!item.leida) {
      setNotifs(prev => prev.map(n => n.id === item.id ? { ...n, leida: true } : n));
      try { await api.patch(`/notifications/${item.id}/read`); } catch (_) {}
    }
    if (item.reporte_id) {
      navigation.navigate('ReportDetail', { reporteId: item.reporte_id });
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await api.patch('/notifications/read-all');
      setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
    } catch (_) {}
    setMarkingAll(false);
  };

  const unreadCount = notifs.filter(n => !n.leida).length;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Notificaciones</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={handleMarkAll}
            disabled={markingAll}
            style={s.markAllBtn}
            activeOpacity={0.7}
          >
            {markingAll
              ? <ActivityIndicator size="small" color={C.secondary} />
              : <Text style={s.markAllText}>Leer todas</Text>
            }
          </TouchableOpacity>
        ) : (
          <View style={s.headerRight} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <NotifItem item={item} onPress={handleTap} />}
          contentContainerStyle={notifs.length === 0 ? s.emptyContainer : s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              colors={[C.secondary]}
              tintColor={C.secondary}
            />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🔔</Text>
              <Text style={s.emptyTitle}>Sin notificaciones</Text>
              <Text style={s.emptyMsg}>Aquí aparecerán las actualizaciones de tus reportes</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: C.background },
  header:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  backText:       { fontSize: 22, color: C.primary, fontWeight: '300' },
  title:          { flex: 1, fontSize: 17, fontWeight: '700', color: C.primary, textAlign: 'center' },
  headerRight:    { width: 72 },
  markAllBtn:     { width: 72, alignItems: 'flex-end' },
  markAllText:    { fontSize: 13, color: C.secondary, fontWeight: '600' },
  list:           { paddingVertical: 8 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  item:           { backgroundColor: C.surface, paddingHorizontal: 16, paddingVertical: 14 },
  itemUnread:     { backgroundColor: '#EFF6FF' },
  itemRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemContent:    { flex: 1, gap: 3 },
  itemTitle:      { fontSize: 14, fontWeight: '600', color: '#374151' },
  itemTitleUnread:{ color: C.primary, fontWeight: '700' },
  itemMsg:        { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  itemDate:       { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  dot:            { width: 9, height: 9, borderRadius: 5, backgroundColor: C.secondary, flexShrink: 0 },
  separator:      { height: 1, backgroundColor: '#F3F4F6', marginLeft: 16 },
  empty:          { alignItems: 'center', gap: 10 },
  emptyIcon:      { fontSize: 48 },
  emptyTitle:     { fontSize: 17, fontWeight: '700', color: C.primary },
  emptyMsg:       { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});
