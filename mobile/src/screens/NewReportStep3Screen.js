import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import api from '../services/api';

const C = {
  primary: '#561C24', secondary: '#6D2932', accent: '#C7B7A3',
  background: '#E8D8C4', surface: '#FFFFFF',
};

export default function NewReportStep3Screen({ navigation, route }) {
  const { categoriaId, subcategoriaId, subcategoriaNombre } = route.params;

  const [descripcion, setDescripcion] = useState('');
  const [colonia,     setColonia]     = useState('');
  const [location,    setLocation]    = useState(null);   // { latitud, longitud, precision }
  const [locationText, setLocationText] = useState('Obteniendo ubicación…');
  const [fotos,       setFotos]       = useState([]);    // max 2
  const [loading,     setLoading]     = useState(false);
  const [locLoading,  setLocLoading]  = useState(true);

  // Obtener ubicación GPS y hacer reverse geocoding
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationText('Permiso de ubicación denegado');
        setLocLoading(false);
        return;
      }
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const { latitude, longitude, accuracy } = pos.coords;
        setLocation({ latitud: latitude, longitud: longitude, precision: accuracy });

        // Intentar reverse geocoding para dirección legible
        try {
          const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (place) {
            const parts = [
              place.street && place.streetNumber
                ? `${place.street} ${place.streetNumber}`
                : place.street,
              place.district || place.subregion,
              place.city || place.region,
            ].filter(Boolean);

            if (parts.length > 0) {
              setLocationText(parts.join(', '));
              // Pre-rellenar colonia si está vacía
              if (!colonia && (place.district || place.subregion)) {
                setColonia(place.district || place.subregion);
              }
              return;
            }
          }
        } catch (_) { /* reverse geocoding opcional */ }

        // Fallback a coordenadas
        setLocationText(`Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`);
      } catch {
        setLocationText('No se pudo obtener la ubicación');
      } finally {
        setLocLoading(false);
      }
    })();
  }, []);

  const pickFromGallery = async () => {
    if (fotos.length >= 2) { Alert.alert('Máximo 2 fotos'); return; }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      setFotos(f => [...f, result.assets[0]]);
    }
  };

  const takePhoto = async () => {
    if (fotos.length >= 2) { Alert.alert('Máximo 2 fotos'); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso denegado'); return; }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      setFotos(f => [...f, result.assets[0]]);
    }
  };

  const removePhoto = (index) => {
    setFotos(f => f.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!descripcion.trim()) {
      Alert.alert('Descripción requerida', 'Por favor describe el problema.');
      return;
    }
    setLoading(true);
    try {
      // 1. Crear el reporte
      const body = {
        categoria_id:    categoriaId,
        subcategoria_id: subcategoriaId,
        descripcion:     descripcion.trim(),
        latitud:         location?.latitud  ?? null,
        longitud:        location?.longitud ?? null,
        precision_gps:   location?.precision ?? null,
        colonia:         colonia.trim() || undefined,
      };
      const { data } = await api.post('/reports', body);
      const reporteId = data.reporte.id;

      // 2. Subir fotos si las hay
      if (fotos.length > 0) {
        const form = new FormData();
        fotos.forEach((foto, i) => {
          const ext  = foto.uri.split('.').pop() || 'jpg';
          const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
          form.append('fotos', { uri: foto.uri, name: `foto_${i}.${ext}`, type: mime });
        });
        await api.post(`/reports/${reporteId}/photos`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      navigation.replace('ReportSuccess', { reporteId });
    } catch (err) {
      if (err.message?.includes('duplicado')) {
        Alert.alert('Posible duplicado', 'Ya existe un reporte similar cerca. ¿Continuar de todas formas?', [
          { text: 'Cancelar' },
          {
            text: 'Continuar', onPress: async () => {
              try {
                const body = {
                  categoria_id: categoriaId, subcategoria_id: subcategoriaId,
                  descripcion: descripcion.trim(),
                  latitud: location?.latitud, longitud: location?.longitud,
                  precision_gps: location?.precision, colonia: colonia.trim() || undefined,
                  omitir_duplicado: true,
                };
                const { data } = await api.post('/reports', body);
                navigation.replace('ReportSuccess', { reporteId: data.reporte.id });
              } catch (e2) {
                Alert.alert('Error', e2.message);
              }
            }
          },
        ]);
      } else {
        Alert.alert('Error al enviar', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backText}>‹</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.step}>Paso 3 de 3</Text>
            <Text style={s.title} numberOfLines={1}>{subcategoriaNombre}</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.popToTop()} style={s.cancelBtn}>
            <Text style={s.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>

        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: '100%' }]} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Ubicación */}
          <Text style={s.sectionLabel}>📍 Ubicación GPS</Text>
          <View style={s.locationBox}>
            {locLoading
              ? <ActivityIndicator size="small" color={C.secondary} />
              : <Text style={s.locationText}>{locationText}</Text>
            }
          </View>

          <Text style={s.sectionLabel}>🏘️ Colonia (opcional)</Text>
          <TextInput
            style={s.input}
            value={colonia}
            onChangeText={setColonia}
            placeholder="Ej. Jardines del Sol"
            placeholderTextColor="#9CA3AF"
          />

          {/* Descripción */}
          <Text style={s.sectionLabel}>📝 Descripción del problema *</Text>
          <TextInput
            style={s.textarea}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Describe el problema con detalle…"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <Text style={s.charCount}>{descripcion.length} caracteres</Text>

          {/* Fotos */}
          <Text style={s.sectionLabel}>📷 Fotos ({fotos.length}/2)</Text>
          <View style={s.photoRow}>
            <TouchableOpacity style={s.photoBtn} onPress={takePhoto} activeOpacity={0.8}>
              <Text style={s.photoBtnIcon}>📸</Text>
              <Text style={s.photoBtnText}>Cámara</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.photoBtn} onPress={pickFromGallery} activeOpacity={0.8}>
              <Text style={s.photoBtnIcon}>🖼️</Text>
              <Text style={s.photoBtnText}>Galería</Text>
            </TouchableOpacity>
          </View>

          {fotos.length > 0 && (
            <View style={s.thumbRow}>
              {fotos.map((foto, i) => (
                <View key={i} style={s.thumbWrap}>
                  <Image source={{ uri: foto.uri }} style={s.thumb} />
                  <TouchableOpacity style={s.thumbRemove} onPress={() => removePhoto(i)}>
                    <Text style={s.thumbRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Botón enviar */}
          <TouchableOpacity
            style={[s.btnSubmit, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnSubmitText}>Enviar reporte</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.background },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  backText:     { fontSize: 22, color: C.primary, fontWeight: '300' },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  step:         { fontSize: 12, color: C.secondary, fontWeight: '600' },
  title:        { fontSize: 14, fontWeight: '700', color: C.primary },
  cancelBtn:    { paddingHorizontal: 4 },
  cancelText:   { fontSize: 14, color: C.accent },
  progressBar:  { height: 4, backgroundColor: '#E5E7EB', marginHorizontal: 16, marginBottom: 4, borderRadius: 2 },
  progressFill: { height: '100%', backgroundColor: C.secondary, borderRadius: 2 },
  scroll:       { padding: 16, paddingBottom: 40 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: C.primary, marginBottom: 6, marginTop: 16 },
  locationBox:  { backgroundColor: C.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', minHeight: 42, justifyContent: 'center' },
  locationText: { fontSize: 13, color: '#374151' },
  input:        { backgroundColor: C.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 14, color: '#111827' },
  textarea:     { backgroundColor: C.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 14, color: '#111827', minHeight: 110 },
  charCount:    { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },
  photoRow:     { flexDirection: 'row', gap: 12 },
  photoBtn:     { flex: 1, backgroundColor: C.surface, borderRadius: 10, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', gap: 6 },
  photoBtnIcon: { fontSize: 24 },
  photoBtnText: { fontSize: 13, color: C.primary, fontWeight: '600' },
  thumbRow:     { flexDirection: 'row', gap: 12, marginTop: 12 },
  thumbWrap:    { position: 'relative' },
  thumb:        { width: 90, height: 90, borderRadius: 10 },
  thumbRemove:  { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  thumbRemoveText:{ color: '#fff', fontSize: 11, fontWeight: '700' },
  btnSubmit:    { backgroundColor: C.accent, paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 24, elevation: 3, shadowColor: C.accent, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 3 }, shadowRadius: 6 },
  btnSubmitText:{ color: '#fff', fontSize: 16, fontWeight: '700' },
});
