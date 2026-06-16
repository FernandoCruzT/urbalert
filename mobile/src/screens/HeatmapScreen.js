import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView, Alert, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polygon } from 'react-native-maps';
import * as Location from 'expo-location';

import coloniasGeoJSON from '../../assets/colonias-zmg.json';
import api from '../services/api';

const C = {
  primary: '#561C24', secondary: '#6D2932', accent: '#C7B7A3',
  background: '#E8D8C4', surface: '#FFFFFF',
};

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.round(SCREEN_W * 0.75);

const GDL = { latitude: 20.6597, longitude: -103.3496, latitudeDelta: 0.15, longitudeDelta: 0.15 };

// ── Constantes de fecha ───────────────────────────────────────────────────────

const CURRENT_YEAR  = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const MES_LABEL = `${MESES_FULL[CURRENT_MONTH - 1]} ${CURRENT_YEAR}`;

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

const MONTH_WEEK_MIN = getISOWeek(new Date(CURRENT_YEAR, CURRENT_MONTH - 1, 1));
const MONTH_WEEK_MAX = getISOWeek(new Date(CURRENT_YEAR, CURRENT_MONTH, 0));
const CURRENT_WEEK   = Math.min(Math.max(getISOWeek(new Date()), MONTH_WEEK_MIN), MONTH_WEEK_MAX);

const TEMP_OPTS   = ['mes', 'semana'];
const VISTA_OPTS  = ['periodo', 'acumulado'];
const ESTADO_OPTS = ['todos', 'abiertos', 'cerrados'];

// ── Helpers de mapa ───────────────────────────────────────────────────────────

function polyColor(total) {
  if (total >= 7) return '#D32F2F';
  if (total >= 4) return '#F57C00';
  if (total >= 2) return '#FFB300';
  return '#FFF176';
}

function ringToCoords(ring) {
  return ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

function extractRings(polygonCoords) {
  return {
    outer: ringToCoords(polygonCoords[0]),
    holes: polygonCoords.slice(1).map(ringToCoords),
  };
}

// ── Pill reutilizable ─────────────────────────────────────────────────────────

function Pill({ label, active, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[d.pill, active && d.pillActive, disabled && d.pillDisabled]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.75}
    >
      <Text style={[d.pillText, active && d.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function HeatmapScreen({ navigation }) {

  // Refs
  const mapRef    = useRef(null);
  const drawerAnim = useRef(new Animated.Value(0)).current;

  // Filtros
  const [temporalidad, setTemporalidad] = useState('mes');
  const [semana,       setSemana]       = useState(CURRENT_WEEK);
  const [vista,        setVista]        = useState('periodo');
  const [estado,       setEstado]       = useState('todos');

  const [categorias,    setCategorias]    = useState([]);
  const [catId,         setCatId]         = useState(null);
  const [subcategorias, setSubcategorias] = useState([]);
  const [subcatNombre,  setSubcatNombre]  = useState(null);

  // UI state
  const [drawerOpen,      setDrawerOpen]      = useState(false);
  const [locLoading,      setLocLoading]      = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);

  // Datos del mapa
  const [colonias, setColonias] = useState([]);
  const [loading,  setLoading]  = useState(true);

  // Animación del drawer
  const overlayOpacity = drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });
  const drawerTranslateX = drawerAnim.interpolate({ inputRange: [0, 1], outputRange: [DRAWER_W, 0] });

  // GeoJSON lookup
  const coloniaGeomMap = useMemo(() => {
    const map = new Map();
    for (const feature of coloniasGeoJSON.features) {
      const key  = feature.properties.nombre?.toLowerCase();
      if (!key) continue;
      const geom  = feature.geometry;
      const rings = [];
      if (geom.type === 'Polygon') {
        rings.push(extractRings(geom.coordinates));
      } else if (geom.type === 'MultiPolygon') {
        for (const pc of geom.coordinates) rings.push(extractRings(pc));
      }
      map.set(key, rings);
    }
    return map;
  }, []);

  // Cargar categorías al montar
  useEffect(() => {
    api.get('/categories')
      .then(res => {
        const cats = res.data.categorias ?? [];
        console.log('[Heatmap] /categories OK — cats:', cats.length,
          '| primera:', cats[0]?.nombre, '| subcats[0]:', cats[0]?.subcategorias?.length);
        setCategorias(cats);
      })
      .catch(err => console.error('[Heatmap] /categories ERROR:', err.message));
  }, []);

  // Subcategorías al cambiar categoría
  useEffect(() => {
    const cat = categorias.find(c => c.id === catId);
    const subs = cat?.subcategorias ?? [];
    console.log('[Heatmap] catId cambió →', catId, '| subcats disponibles:', subs.length);
    setSubcategorias(subs);
    setSubcatNombre(null);
  }, [catId, categorias]);

  // Fetch del heatmap
  const load = useCallback(async () => {
    setLoading(true);
    const params = { estado, vista, temporalidad, anio: CURRENT_YEAR };
    if (temporalidad === 'mes')    params.mes    = CURRENT_MONTH;
    if (temporalidad === 'semana') params.semana = semana;
    if (catId)        params.categoria_id = catId;
    if (subcatNombre) params.subcategoria  = subcatNombre;
    // Acumulado en mobile = desde el 1 del mes actual (no desde el 1 de enero)
    if (vista === 'acumulado') {
      params.fecha_inicio_override = new Date(CURRENT_YEAR, CURRENT_MONTH - 1, 1).toISOString();
    }

    console.log('[Heatmap] load params:', JSON.stringify(params));
    try {
      const { data } = await api.get('/heatmap', { params });
      console.log('[Heatmap] /heatmap OK — colonias:', data.colonias?.length ?? 0,
        '| primera:', data.colonias?.[0]?.colonia);
      setColonias(data.colonias ?? []);
    } catch (err) {
      console.error('[Heatmap] /heatmap ERROR:', err.message);
      setColonias([]);
    }
    setLoading(false);
  }, [temporalidad, semana, vista, estado, catId, subcatNombre]);

  useEffect(() => { load(); }, [load]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function stepSemana(delta) {
    setSemana(s => Math.min(MONTH_WEEK_MAX, Math.max(MONTH_WEEK_MIN, s + delta)));
  }

  function openDrawer() {
    setDrawerOpen(true);
    Animated.timing(drawerAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }

  function closeDrawer() {
    Animated.timing(drawerAnim, { toValue: 0, duration: 250, useNativeDriver: true })
      .start(({ finished }) => { if (finished) setDrawerOpen(false); });
  }

  async function goToLocation() {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el acceso a tu ubicación para usar esta función.');
        return;
      }
      setLocationGranted(true); // activa el punto azul nativo en el MapView
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      mapRef.current?.animateToRegion({
        latitude:      pos.coords.latitude,
        longitude:     pos.coords.longitude,
        latitudeDelta:  0.01,
        longitudeDelta: 0.01,
      }, 800);
    } catch (err) {
      console.error('[Heatmap] location error:', err.message);
      Alert.alert('Error', 'No se pudo obtener la ubicación.');
    } finally {
      setLocLoading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Mapa de calor</Text>
        <TouchableOpacity onPress={openDrawer} style={s.iconBtn} activeOpacity={0.8}>
          <Text style={s.filterIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* ── Mapa ── */}
      <View style={s.mapContainer}>
        <MapView
          ref={mapRef}
          style={s.map}
          initialRegion={GDL}
          mapType="standard"
          showsUserLocation={locationGranted}
          showsMyLocationButton={false}
        >
          {colonias.flatMap((col) => {
            const rings = coloniaGeomMap.get(col.colonia?.toLowerCase());
            if (!rings || rings.length === 0) return [];
            const color     = polyColor(col.total);
            const fillColor = color + 'BB';
            return rings.map((ring, ri) => (
              <Polygon
                key={`${col.colonia}-${ri}`}
                coordinates={ring.outer}
                holes={ring.holes.length > 0 ? ring.holes : undefined}
                strokeColor={color}
                strokeWidth={1}
                fillColor={fillColor}
              />
            ));
          })}
        </MapView>

        {loading && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color={C.primary} />
          </View>
        )}

        {/* Leyenda de colores */}
        <View style={s.legend}>
          {[
            { color: '#FFF176', label: '1'   },
            { color: '#FFB300', label: '2–3' },
            { color: '#F57C00', label: '4–6' },
            { color: '#D32F2F', label: '7+'  },
          ].map(item => (
            <View key={item.label} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: item.color }]} />
              <Text style={s.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* FAB — ubicación actual */}
        <TouchableOpacity style={s.locFab} onPress={goToLocation} activeOpacity={0.85}>
          {locLoading
            ? <ActivityIndicator size="small" color={C.primary} />
            : <Text style={s.locFabIcon}>📍</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ── Overlay del drawer ── */}
      <Animated.View
        pointerEvents={drawerOpen ? 'box-none' : 'none'}
        style={[s.drawerOverlay, { opacity: overlayOpacity }]}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeDrawer} activeOpacity={1} />
      </Animated.View>

      {/* ── Drawer lateral ── */}
      <Animated.View style={[s.drawer, { transform: [{ translateX: drawerTranslateX }] }]}>

        {/* Cabecera del drawer */}
        <View style={d.header}>
          <Text style={d.headerTitle}>Filtros</Text>
          <TouchableOpacity onPress={closeDrawer} style={d.closeBtn} activeOpacity={0.8}>
            <Text style={d.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Contenido con scroll */}
        <ScrollView
          style={d.scroll}
          contentContainerStyle={d.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Periodo */}
          <View style={d.section}>
            <Text style={d.sectionTitle}>Periodo</Text>
            <View style={d.pillWrap}>
              {TEMP_OPTS.map(opt => (
                <Pill key={opt} label={opt} active={temporalidad === opt}
                  onPress={() => setTemporalidad(opt)} />
              ))}
            </View>
          </View>

          {/* Vista */}
          <View style={d.section}>
            <Text style={d.sectionTitle}>Vista</Text>
            <View style={d.pillWrap}>
              {VISTA_OPTS.map(opt => (
                <Pill key={opt} label={opt === 'acumulado' ? 'acum.' : opt}
                  active={vista === opt} onPress={() => setVista(opt)} />
              ))}
            </View>
          </View>

          {/* Control de tiempo */}
          <View style={d.section}>
            <Text style={d.sectionTitle}>
              {temporalidad === 'mes' ? 'Mes' : 'Semana'}
            </Text>
            {temporalidad === 'mes' ? (
              <View style={d.pillWrap}>
                <View style={d.chipFixed}>
                  <Text style={d.chipFixedText}>{MES_LABEL}</Text>
                </View>
              </View>
            ) : (
              <View style={d.stepperRow}>
                <TouchableOpacity
                  style={[d.stepBtn, semana <= MONTH_WEEK_MIN && d.stepBtnDis]}
                  onPress={() => stepSemana(-1)} activeOpacity={0.7}
                >
                  <Text style={d.stepBtnText}>−</Text>
                </TouchableOpacity>
                <View style={d.stepVal}>
                  <Text style={d.stepValText}>{semana}</Text>
                </View>
                <TouchableOpacity
                  style={[d.stepBtn, semana >= MONTH_WEEK_MAX && d.stepBtnDis]}
                  onPress={() => stepSemana(1)} activeOpacity={0.7}
                >
                  <Text style={d.stepBtnText}>+</Text>
                </TouchableOpacity>
                <Text style={d.stepRange}>Sem {MONTH_WEEK_MIN}–{MONTH_WEEK_MAX}</Text>
              </View>
            )}
          </View>

          {/* Estado */}
          <View style={d.section}>
            <Text style={d.sectionTitle}>Estado</Text>
            <View style={d.pillWrap}>
              {ESTADO_OPTS.map(opt => (
                <Pill key={opt} label={opt} active={estado === opt}
                  onPress={() => setEstado(opt)} />
              ))}
            </View>
          </View>

          {/* Categoría */}
          <View style={d.section}>
            <Text style={d.sectionTitle}>Categoría</Text>
            <View style={d.pillWrap}>
              <Pill label="Todas" active={catId === null} onPress={() => setCatId(null)} />
              {categorias.map(cat => (
                <Pill key={cat.id} label={cat.nombre} active={catId === cat.id}
                  onPress={() => setCatId(cat.id)} />
              ))}
            </View>
          </View>

          {/* Subcategoría (condicional) */}
          {catId !== null && subcategorias.length > 0 && (
            <View style={d.section}>
              <Text style={d.sectionTitle}>Subcategoría</Text>
              <View style={d.pillWrap}>
                <Pill label="Todas" active={subcatNombre === null}
                  onPress={() => setSubcatNombre(null)} />
                {subcategorias.map(sub => (
                  <Pill key={sub.id} label={sub.nombre}
                    active={subcatNombre === sub.nombre}
                    onPress={() => setSubcatNombre(sub.nombre)} />
                ))}
              </View>
            </View>
          )}

        </ScrollView>
      </Animated.View>

    </SafeAreaView>
  );
}

// ── Estilos estructurales ─────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#F3F4F6' },
  header:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
                   paddingVertical: 10, backgroundColor: '#FFFFFF',
                   borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  iconBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6',
                   alignItems: 'center', justifyContent: 'center' },
  backText:      { fontSize: 22, color: C.primary, fontWeight: '300' },
  filterIcon:    { fontSize: 18, color: C.primary },
  title:         { flex: 1, fontSize: 16, fontWeight: '700', color: C.primary, textAlign: 'center' },
  mapContainer:  { flex: 1, position: 'relative' },
  map:           { flex: 1 },
  loadingOverlay:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.55)',
                   alignItems: 'center', justifyContent: 'center' },
  // Leyenda
  legend:        { position: 'absolute', bottom: 28, left: 12,
                   backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: 10,
                   gap: 6, elevation: 4, shadowColor: '#000', shadowOpacity: 0.12,
                   shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:     { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: '#00000022' },
  legendText:    { fontSize: 11, color: '#374151', fontWeight: '600' },
  // FAB ubicación
  locFab:        { position: 'absolute', bottom: 28, right: 16, width: 46, height: 46,
                   borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center',
                   justifyContent: 'center', elevation: 5, shadowColor: '#000',
                   shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5 },
  locFabIcon:    { fontSize: 22 },
  // Drawer overlay
  drawerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000' },
  // Drawer panel
  drawer:        { position: 'absolute', top: 0, right: 0, bottom: 0, width: DRAWER_W,
                   backgroundColor: '#FFFFFF',
                   shadowColor: '#000', shadowOpacity: 0.25, shadowOffset: { width: -3, height: 0 },
                   shadowRadius: 8, elevation: 16 },
});

// ── Estilos del drawer ────────────────────────────────────────────────────────

const d = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
                  borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle:  { fontSize: 16, fontWeight: '800', color: C.primary },
  closeBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6',
                  alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  // Secciones
  section:      { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9CA3AF',
                  textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  // Pills en wrap
  pillWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14,
                  borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  pillActive:   { backgroundColor: C.primary, borderColor: C.primary },
  pillDisabled: { opacity: 0.35 },
  pillText:     { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  pillTextActive:{ color: '#fff' },
  // Chip de mes fijo
  chipFixed:    { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14,
                  backgroundColor: C.primary },
  chipFixedText:{ fontSize: 13, fontWeight: '700', color: '#fff' },
  // Stepper de semana
  stepperRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: '#E5E7EB' },
  stepBtnDis:   { opacity: 0.3 },
  stepBtnText:  { fontSize: 18, color: C.primary, fontWeight: '500', lineHeight: 22 },
  stepVal:      { minWidth: 44, height: 32, borderRadius: 8, backgroundColor: C.primary,
                  alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  stepValText:  { fontSize: 14, fontWeight: '700', color: '#fff' },
  stepRange:    { fontSize: 11, color: '#9CA3AF', flexShrink: 1 },
});
