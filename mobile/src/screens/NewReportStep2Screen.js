import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  primary: '#561C24', secondary: '#6D2932', accent: '#C7B7A3',
  background: '#E8D8C4', surface: '#FFFFFF',
};

const URGENCIA_COLOR = { alto: '#C7B7A3', medio: '#F59E0B', bajo: '#10B981' };
const URGENCIA_BG    = { alto: '#FEE2E2', medio: '#FEF3C7', bajo: '#D1FAE5' };

export default function NewReportStep2Screen({ navigation, route }) {
  const { categoriaId, categoriaNombre, subcategorias } = route.params;

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('NewReportStep3', {
        categoriaId,
        categoriaNombre,
        subcategoriaId:    item.id,
        subcategoriaNombre: item.nombre,
      })}
    >
      <View style={s.cardBody}>
        <Text style={s.cardTitle}>{item.nombre}</Text>
        {item.razon_urgencia && (
          <Text style={s.cardDesc}>{item.razon_urgencia}</Text>
        )}
      </View>
      <View style={[s.urgBadge, { backgroundColor: URGENCIA_BG[item.urgencia] }]}>
        <Text style={[s.urgText, { color: URGENCIA_COLOR[item.urgencia] }]}>
          {item.urgencia}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.step}>Paso 2 de 3</Text>
          <Text style={s.title} numberOfLines={1}>{categoriaNombre}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.popToTop()} style={s.cancelBtn}>
          <Text style={s.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </View>

      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: '66%' }]} />
      </View>

      <Text style={s.subtitle}>Selecciona el problema específico</Text>

      {subcategorias.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>No hay subcategorías disponibles.</Text>
        </View>
      ) : (
        <FlatList
          data={subcategorias}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.list}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.background },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  backText:    { fontSize: 22, color: C.primary, fontWeight: '300' },
  headerCenter:{ flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  step:        { fontSize: 12, color: C.secondary, fontWeight: '600' },
  title:       { fontSize: 15, fontWeight: '700', color: C.primary },
  cancelBtn:   { paddingHorizontal: 4 },
  cancelText:  { fontSize: 14, color: C.accent },
  progressBar: { height: 4, backgroundColor: '#E5E7EB', marginHorizontal: 16, marginBottom: 8, borderRadius: 2 },
  progressFill:{ height: '100%', backgroundColor: C.secondary, borderRadius: 2 },
  subtitle:    { fontSize: 13, color: '#6B7280', paddingHorizontal: 16, marginBottom: 12, marginTop: 4 },
  list:        { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3,
  },
  cardBody:    { flex: 1, marginRight: 10 },
  cardTitle:   { fontSize: 14, fontWeight: '600', color: C.primary },
  cardDesc:    { fontSize: 12, color: '#6B7280', marginTop: 3, lineHeight: 16 },
  urgBadge:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  urgText:     { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  empty:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText:   { color: '#9CA3AF', fontSize: 15 },
});
