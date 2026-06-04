import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const C = {
  primary: '#561C24', secondary: '#6D2932', accent: '#C7B7A3',
  background: '#E8D8C4', surface: '#FFFFFF',
};

export default function ReportSuccessScreen({ navigation, route }) {
  const { reporteId } = route.params ?? {};

  const scale   = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1, tension: 80, friction: 5, useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1, duration: 300, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        {/* Icono animado */}
        <Animated.View style={[s.iconCircle, { transform: [{ scale }] }]}>
          <Text style={s.icon}>✓</Text>
        </Animated.View>

        <Animated.View style={{ opacity }}>
          <Text style={s.title}>¡Reporte enviado!</Text>
          <Text style={s.subtitle}>
            Tu reporte fue creado correctamente.{'\n'}
            Las autoridades serán notificadas.
          </Text>

          <View style={s.actions}>
            <TouchableOpacity
              style={s.btnPrimary}
              onPress={() => navigation.navigate('MyReports')}
              activeOpacity={0.85}
            >
              <Text style={s.btnPrimaryText}>Ver mis reportes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.btnSecondary}
              onPress={() => navigation.popToTop()}
              activeOpacity={0.85}
            >
              <Text style={s.btnSecondaryText}>Ir al inicio</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.background },
  container:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
    shadowColor: '#10B981', shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 16, elevation: 8,
  },
  icon:         { fontSize: 52, color: '#059669' },
  title:        { fontSize: 26, fontWeight: '800', color: C.primary, textAlign: 'center', marginBottom: 12 },
  subtitle:     { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  actions:      { gap: 12 },
  btnPrimary: {
    backgroundColor: C.primary, paddingVertical: 16,
    borderRadius: 12, alignItems: 'center',
    elevation: 3, shadowColor: C.primary,
    shadowOpacity: 0.25, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnSecondary: {
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.secondary,
  },
  btnSecondaryText: { color: C.secondary, fontSize: 15, fontWeight: '600' },
});
