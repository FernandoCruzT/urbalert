import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';

const C = {
  primary: '#561C24', secondary: '#6D2932', accent: '#C7B7A3',
  background: '#E8D8C4', surface: '#FFFFFF',
};

const CAT_ICONS = {
  'Baches y daños en vialidades': '🚧',
  'Alumbrado público':            '💡',
  'Basura y limpieza urbana':     '🗑️',
  'Seguridad pública':            '🚔',
  'Agua y drenaje':               '💧',
  'Espacios públicos':            '🌳',
  'Infraestructura urbana':       '🏗️',
  'Protección civil':             '🚒',
  'Transporte y movilidad':       '🚌',
};

export default function NewReportStep1Screen({ navigation }) {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/categories')
      .then(({ data }) => setCategorias(data.categorias || []))
      .catch(() => Alert.alert('Error', 'No se pudieron cargar las categorías.'))
      .finally(() => setLoading(false));
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.8}
      onPress={() => navigation.navigate('NewReportStep2', {
        categoriaId:    item.id,
        categoriaNombre: item.nombre,
        subcategorias:  item.subcategorias || [],
      })}
    >
      <Text style={s.cardIcon}>{CAT_ICONS[item.nombre] ?? '📌'}</Text>
      <View style={s.cardBody}>
        <Text style={s.cardTitle}>{item.nombre}</Text>
        <Text style={s.cardSub}>{(item.subcategorias || []).length} subcategorías</Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>✕</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.step}>Paso 1 de 3</Text>
          <Text style={s.title}>¿Qué tipo de problema?</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Barra de progreso */}
      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: '33%' }]} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={categorias}
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
  backText:    { fontSize: 16, color: '#6B7280' },
  headerCenter:{ flex: 1, alignItems: 'center' },
  step:        { fontSize: 12, color: C.secondary, fontWeight: '600' },
  title:       { fontSize: 17, fontWeight: '700', color: C.primary },
  progressBar: { height: 4, backgroundColor: '#E5E7EB', marginHorizontal: 16, marginBottom: 16, borderRadius: 2 },
  progressFill:{ height: '100%', backgroundColor: C.secondary, borderRadius: 2 },
  list:        { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface,
    borderRadius: 12, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 1 }, shadowRadius: 3,
  },
  cardIcon:    { fontSize: 28, marginRight: 14 },
  cardBody:    { flex: 1 },
  cardTitle:   { fontSize: 15, fontWeight: '600', color: C.primary },
  cardSub:     { fontSize: 12, color: '#6B7280', marginTop: 2 },
  chevron:     { fontSize: 22, color: '#9CA3AF', fontWeight: '300' },
});
