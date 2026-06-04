import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';

const C = {
  primary: '#561C24', secondary: '#6D2932', accent: '#C7B7A3',
  background: '#E8D8C4', surface: '#FFFFFF',
};

const STATUS_CONFIG = {
  enviado:       { label: 'Enviado',       bg: '#F3F4F6', text: '#374151' },
  en_validacion: { label: 'En validación', bg: '#FEF3C7', text: '#92400E' },
  en_revision:   { label: 'En revisión',   bg: '#DBEAFE', text: '#1E40AF' },
  pendiente:     { label: 'Pendiente',     bg: '#EDE9FE', text: '#5B21B6' },
  asignado:      { label: 'Asignado',      bg: '#CFFAFE', text: '#155E75' },
  en_proceso:    { label: 'En proceso',    bg: '#FFEDD5', text: '#9A3412' },
  resuelto:      { label: 'Resuelto',      bg: '#D1FAE5', text: '#065F46' },
  cerrado:       { label: 'Cerrado',       bg: '#E5E7EB', text: '#374151' },
};

function StatusBadge({ estado }) {
  const cfg = STATUS_CONFIG[estado] ?? { label: estado, bg: '#E5E7EB', text: '#374151' };
  return (
    <View style={[badge.wrap, { backgroundColor: cfg.bg }]}>
      <Text style={[badge.text, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

function ReportCard({ item, onPress }) {
  const date = new Date(item.created_at).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  return (
    <TouchableOpacity style={card.wrap} onPress={onPress} activeOpacity={0.8}>
      <View style={card.top}>
        <Text style={card.subcat} numberOfLines={1}>{item.subcategoria_nombre}</Text>
        <StatusBadge estado={item.estado} />
      </View>
      <Text style={card.cat}>{item.categoria_nombre}</Text>
      {item.colonia ? <Text style={card.loc}>📍 {item.colonia}</Text> : null}
      <Text style={card.date}>{date}</Text>
    </TouchableOpacity>
  );
}

export default function MyReportsScreen({ navigation }) {
  const [reportes, setReportes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refresh, setRefresh]   = useState(false);

  const fetchReports = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const { data } = await api.get('/reports/mine');
      setReportes(data.reportes || []);
    } catch (_) {}
    setLoading(false);
    setRefresh(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchReports(); }, [fetchReports]));

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator size="large" color={C.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Mis reportes</Text>
        <View style={{ width: 36 }} />
      </View>

      {reportes.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📋</Text>
          <Text style={s.emptyTitle}>Sin reportes aún</Text>
          <Text style={s.emptyText}>Tus reportes enviados aparecerán aquí.</Text>
        </View>
      ) : (
        <FlatList
          data={reportes}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <ReportCard
              item={item}
              onPress={() => navigation.navigate('ReportDetail', { reporteId: item.id })}
            />
          )}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refresh} onRefresh={() => fetchReports(true)} colors={[C.primary]} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.background },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: C.surface },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center' },
  backText:   { fontSize: 24, color: C.primary },
  title:      { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.primary },
  list:       { padding: 16, paddingBottom: 32 },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.primary, marginBottom: 6 },
  emptyText:  { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});

const badge = StyleSheet.create({
  wrap:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  text:  { fontSize: 11, fontWeight: '700' },
});

const card = StyleSheet.create({
  wrap: {
    backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3,
  },
  top:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  subcat: { fontSize: 15, fontWeight: '700', color: C.primary, flex: 1, marginRight: 8 },
  cat:    { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  loc:    { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  date:   { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
});
