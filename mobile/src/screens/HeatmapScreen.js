import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polygon, Marker, Callout } from 'react-native-maps';
import coloniasGeoJSON from '../../assets/colonias-zmg.json';
import api from '../services/api';

const C = {
  primary: '#561C24', secondary: '#6D2932', accent: '#C7B7A3',
  background: '#E8D8C4', surface: '#FFFFFF',
};

const GDL = { latitude: 20.6597, longitude: -103.3496, latitudeDelta: 0.15, longitudeDelta: 0.15 };
const MARKER_SIZE = 8;

// ── Semana actual → ISO week params ─────────────────────────────────────────

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function weekParams() {
  const now = new Date();
  return { temporalidad: 'semana', anio: now.getFullYear(), semana: getISOWeek(now) };
}

// ── Color de polígono según total de reportes ─────────────────────────────

function polyColor(total) {
  if (total >= 7) return '#D32F2F';
  if (total >= 4) return '#F57C00';
  if (total >= 2) return '#FFB300';
  return '#FFF176';
}

// ── Convierte un anillo GeoJSON [lng,lat][] → [{latitude,longitude}] ────────

function ringToCoords(ring) {
  return ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

// ── Extrae los anillos (outer + holes) de una geometría Polygon ─────────────
// Devuelve { outer, holes } donde outer y cada hole son [{latitude,longitude}]

function extractRings(polygonCoords) {
  return {
    outer: ringToCoords(polygonCoords[0]),
    holes: polygonCoords.slice(1).map(ringToCoords),
  };
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function HeatmapScreen({ navigation }) {
  const [categorias,  setCategorias]  = useState([]);
  const [catId,       setCatId]       = useState(null);
  const [colonias,    setColonias]    = useState([]);   // datos del API
  const [loading,     setLoading]     = useState(true);

  // ── Lookup: nombre.toLowerCase() → array de { outer, holes } ──────────────
  // Calculado una sola vez al montar; incluye soporte para MultiPolygon.
  const coloniaGeomMap = useMemo(() => {
    const map = new Map();
    for (const feature of coloniasGeoJSON.features) {
      const key  = feature.properties.nombre?.toLowerCase();
      if (!key) continue;
      const geom = feature.geometry;
      const rings = [];

      if (geom.type === 'Polygon') {
        rings.push(extractRings(geom.coordinates));
      } else if (geom.type === 'MultiPolygon') {
        for (const polygonCoords of geom.coordinates) {
          rings.push(extractRings(polygonCoords));
        }
      }

      map.set(key, rings);
    }
    return map;
  }, []);

  // Cargar categorías al montar
  useEffect(() => {
    api.get('/categories')
      .then(res => setCategorias(res.data.categorias ?? []))
      .catch(() => {});
  }, []);

  // Cargar datos del API cuando cambia la categoría
  const load = useCallback(async (selectedCatId) => {
    setLoading(true);
    try {
      const params = {
        ...weekParams(),
        estado: 'todos',
        ...(selectedCatId ? { categoria_id: selectedCatId } : {}),
      };
      const { data } = await api.get('/heatmap', { params });
      setColonias(data.colonias ?? []);
    } catch (_) {
      setColonias([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(catId); }, [catId, load]);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>Mapa de calor</Text>
        <View style={s.headerRight} />
      </View>

      {/* Filtro de categoría */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.catBar}
        contentContainerStyle={s.catBarContent}
      >
        <TouchableOpacity
          style={[s.catChip, catId === null && s.catChipActive]}
          onPress={() => setCatId(null)}
          activeOpacity={0.8}
        >
          <Text style={[s.catChipText, catId === null && s.catChipTextActive]}>Todas</Text>
        </TouchableOpacity>
        {categorias.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[s.catChip, catId === cat.id && s.catChipActive]}
            onPress={() => setCatId(cat.id)}
            activeOpacity={0.8}
          >
            <Text style={[s.catChipText, catId === cat.id && s.catChipTextActive]}>
              {cat.nombre}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Mapa */}
      <View style={s.mapContainer}>
        <MapView style={s.map} initialRegion={GDL} mapType="standard">
          {colonias.map((col) => {
            const rings = coloniaGeomMap.get(col.colonia?.toLowerCase());
            if (!rings || rings.length === 0) return null;

            const color    = polyColor(col.total);
            const fillColor = color + 'BB'; // ~73% opacidad
            const hasCenter = col.lat_centroid != null && col.lng_centroid != null;

            return (
              <React.Fragment key={col.colonia}>
                {/* Un Polygon por cada anillo (Polygon o cada parte de MultiPolygon) */}
                {rings.map((ring, ri) => (
                  <Polygon
                    key={`${col.colonia}-${ri}`}
                    coordinates={ring.outer}
                    holes={ring.holes.length > 0 ? ring.holes : undefined}
                    strokeColor={color}
                    strokeWidth={1}
                    fillColor={fillColor}
                  />
                ))}

                {/* Marker transparente en el centroide para el Callout */}
                {hasCenter && (
                  <Marker
                    coordinate={{ latitude: col.lat_centroid, longitude: col.lng_centroid }}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={false}
                  >
                    <View style={s.markerTransparent} />
                    <Callout tooltip={false}>
                      <View style={s.callout}>
                        <Text style={s.calloutTitle} numberOfLines={2}>{col.colonia}</Text>
                        <Text style={s.calloutCount}>
                          {col.total} {col.total === 1 ? 'reporte' : 'reportes'}
                        </Text>
                      </View>
                    </Callout>
                  </Marker>
                )}
              </React.Fragment>
            );
          })}
        </MapView>

        {loading && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color={C.primary} />
          </View>
        )}

        {/* Leyenda */}
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
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: C.background },
  header:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  backText:         { fontSize: 22, color: C.primary, fontWeight: '300' },
  title:            { flex: 1, fontSize: 17, fontWeight: '700', color: C.primary, textAlign: 'center' },
  headerRight:      { width: 36 },
  catBar:           { flexGrow: 0, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  catBarContent:    { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  catChip:          { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  catChipActive:    { backgroundColor: C.primary, borderColor: C.primary },
  catChipText:      { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  catChipTextActive:{ color: '#fff' },
  mapContainer:     { flex: 1, position: 'relative' },
  map:              { flex: 1 },
  loadingOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  markerTransparent:{ width: MARKER_SIZE, height: MARKER_SIZE, borderRadius: MARKER_SIZE / 2, backgroundColor: 'transparent' },
  callout:          { minWidth: 140, maxWidth: 200, padding: 10, gap: 4 },
  calloutTitle:     { fontSize: 13, fontWeight: '700', color: C.primary },
  calloutCount:     { fontSize: 12, color: '#6B7280' },
  legend:           { position: 'absolute', bottom: 20, left: 12, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: 10, gap: 6, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  legendItem:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:        { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: '#00000022' },
  legendText:       { fontSize: 11, color: '#374151', fontWeight: '600' },
});
