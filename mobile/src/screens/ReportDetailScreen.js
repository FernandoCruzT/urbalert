import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';

const C = {
  primary: '#561C24', secondary: '#6D2932', accent: '#C7B7A3',
  background: '#E8D8C4', surface: '#FFFFFF',
};

const ESTADOS_ORDEN = [
  'enviado', 'en_validacion', 'en_revision', 'pendiente',
  'asignado', 'en_proceso', 'resuelto', 'cerrado',
];

const ESTADO_LABEL = {
  enviado:       'Enviado',
  en_validacion: 'En validación',
  en_revision:   'En revisión',
  pendiente:     'Pendiente',
  asignado:      'Asignado',
  en_proceso:    'En proceso',
  resuelto:      'Resuelto',
  cerrado:       'Cerrado',
};

const URGENCIA_COLOR = { alto: '#C7B7A3', medio: '#F59E0B', bajo: '#10B981' };
const URGENCIA_BG    = { alto: '#FEE2E2', medio: '#FEF3C7', bajo: '#D1FAE5' };

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function fmtHistDate(d) {
  const dia  = String(d.getDate()).padStart(2, '0');
  const mes  = MESES[d.getMonth()];
  const h24  = d.getHours();
  const min  = String(d.getMinutes()).padStart(2, '0');
  const ampm = h24 >= 12 ? 'p.m.' : 'a.m.';
  const h12  = h24 % 12 || 12;
  return `${dia} ${mes} · ${h12}:${min} ${ampm}`;
}

function LifecycleTracker({ estadoActual, historial }) {
  const currentIdx = ESTADOS_ORDEN.indexOf(estadoActual);

  return (
    <View style={lc.container}>
      <Text style={lc.sectionTitle}>Ciclo de vida</Text>
      {ESTADOS_ORDEN.map((estado, idx) => {
        const done    = idx < currentIdx;
        const current = idx === currentIdx;
        const pending = idx > currentIdx;

        // Para en_proceso recolectar TODAS las entradas (transición + notas de actualización)
        const todasEnProceso = estado === 'en_proceso'
          ? (historial?.filter(h => h.estado_nuevo === 'en_proceso') ?? [])
          : [];
        const histEntry = estado === 'en_proceso'
          ? (todasEnProceso[0] ?? null)
          : (historial?.find(h => h.estado_nuevo === estado) ?? null);
        const notasExtra = todasEnProceso.slice(1);

        const date = histEntry ? fmtHistDate(new Date(histEntry.created_at)) : null;

        return (
          <View key={estado} style={lc.row}>
            {/* Línea vertical */}
            <View style={lc.lineCol}>
              <View style={[lc.dot,
                done    && lc.dotDone,
                current && lc.dotCurrent,
                pending && lc.dotPending,
              ]} />
              {idx < ESTADOS_ORDEN.length - 1 && (
                <View style={[lc.line, done && lc.lineDone]} />
              )}
            </View>
            {/* Contenido */}
            <View style={lc.content}>
              <Text style={[lc.label, current && lc.labelCurrent, done && lc.labelDone]}>
                {ESTADO_LABEL[estado]}
              </Text>
              {date && <Text style={lc.date}>{date}</Text>}
              {histEntry?.observacion && (
                <Text style={lc.obs}>{histEntry.observacion}</Text>
              )}
              {/* Sub-items: notas de actualización (en_proceso → en_proceso) */}
              {notasExtra.map((nota, i) => (
                <View key={i} style={lc.notaWrap}>
                  <Text style={lc.notaDate}>{fmtHistDate(new Date(nota.created_at))}</Text>
                  <Text style={lc.notaObs}>{nota.observacion || 'Actualización sin nota'}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function ReportDetailScreen({ navigation, route }) {
  const { reporteId } = route.params;
  const [reporte, setReporte] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/reports/${reporteId}`)
      .then(({ data }) => setReporte(data.reporte))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [reporteId]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator size="large" color={C.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!reporte) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.errorWrap}>
          <Text style={s.errorText}>No se pudo cargar el reporte.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.errorBack}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const dateCreated = new Date(reporte.created_at).toLocaleDateString('es-MX', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>Detalle del reporte</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Categoría y urgencia */}
        <View style={s.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.category}>{reporte.categoria_nombre}</Text>
            <Text style={s.subcat}>{reporte.subcategoria_nombre}</Text>
          </View>
          <View style={[s.urgBadge, { backgroundColor: URGENCIA_BG[reporte.urgencia] }]}>
            <Text style={[s.urgText, { color: URGENCIA_COLOR[reporte.urgencia] }]}>
              {reporte.urgencia}
            </Text>
          </View>
        </View>

        {/* Descripción */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>📝 Descripción</Text>
          <Text style={s.description}>{reporte.descripcion}</Text>
        </View>

        {/* Ubicación */}
        {(reporte.colonia || reporte.calle) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>📍 Ubicación</Text>
            {reporte.calle   && <Text style={s.detail}>{reporte.calle} {reporte.numero ?? ''}</Text>}
            {reporte.colonia && <Text style={s.detail}>{reporte.colonia}</Text>}
            {reporte.latitud && (
              <Text style={s.coords}>
                {Number(reporte.latitud).toFixed(6)}, {Number(reporte.longitud).toFixed(6)}
              </Text>
            )}
          </View>
        )}

        {/* Fotos */}
        {reporte.fotos?.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>📷 Fotos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.photoScroll}>
              {reporte.fotos.map(f => (
                <Image key={f.id} source={{ uri: f.url_cloudinary }} style={s.photo} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Autoridad asignada */}
        {reporte.autoridad && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>👤 Autoridad asignada</Text>
            <Text style={s.detail}>{reporte.autoridad.nombre} {reporte.autoridad.apellido}</Text>
            <Text style={s.detail}>{reporte.autoridad.departamento}</Text>
          </View>
        )}

        <Text style={s.dateCreated}>Creado el {dateCreated}</Text>

        {/* Ciclo de vida */}
        <LifecycleTracker estadoActual={reporte.estado} historial={reporte.historial} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.background },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center' },
  backText:    { fontSize: 24, color: C.primary },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.primary },
  scroll:      { padding: 16, paddingBottom: 40 },
  topRow:      { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  category:    { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  subcat:      { fontSize: 18, fontWeight: '700', color: C.primary },
  urgBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  urgText:     { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  section:     { backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  sectionTitle:{ fontSize: 13, fontWeight: '700', color: C.primary, marginBottom: 8 },
  description: { fontSize: 14, color: '#374151', lineHeight: 20 },
  detail:      { fontSize: 14, color: '#374151', marginBottom: 2 },
  coords:      { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  photoScroll: { marginTop: 4 },
  photo:       { width: 140, height: 100, borderRadius: 8, marginRight: 8 },
  dateCreated: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginVertical: 8 },
  errorWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText:   { fontSize: 16, color: '#6B7280', marginBottom: 12 },
  errorBack:   { color: C.secondary, fontSize: 15, fontWeight: '600' },
});

const lc = StyleSheet.create({
  container:    { backgroundColor: C.surface, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.primary, marginBottom: 16 },
  row:          { flexDirection: 'row', minHeight: 40 },
  lineCol:      { width: 24, alignItems: 'center' },
  dot: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: '#fff',
    zIndex: 1,
  },
  dotDone:      { backgroundColor: C.secondary, borderColor: C.secondary },
  dotCurrent:   { backgroundColor: C.accent, borderColor: C.accent, width: 16, height: 16, borderRadius: 8 },
  dotPending:   { backgroundColor: '#fff', borderColor: '#D1D5DB' },
  line:         { flex: 1, width: 2, backgroundColor: '#E5E7EB', marginVertical: 2 },
  lineDone:     { backgroundColor: C.secondary },
  content:      { flex: 1, paddingLeft: 12, paddingBottom: 20 },
  label:        { fontSize: 13, color: '#9CA3AF' },
  labelDone:    { color: C.secondary, fontWeight: '600' },
  labelCurrent: { color: C.accent, fontWeight: '700', fontSize: 14 },
  date:         { fontSize: 11, color: '#6B7280', marginTop: 2 },
  obs:          { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontStyle: 'italic' },
  notaWrap:     { marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  notaDate:     { fontSize: 10, color: '#9CA3AF', marginBottom: 2 },
  notaObs:      { fontSize: 11, color: '#6B7280', fontStyle: 'italic' },
});
