import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const C = {
  primary:    '#561C24',
  secondary:  '#6D2932',
  accent:     '#C7B7A3',
  background: '#E8D8C4',
  surface:    '#FFFFFF',
};

export default function WelcomeScreen({ navigation }) {
  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Logo / branding */}
      <View style={s.hero}>
        <View style={s.logoBox}>
          <Text style={s.logoIcon}>📍</Text>
        </View>
        <Text style={s.appName}>Urbalert</Text>
        <Text style={s.tagline}>Reporta, seguimos, mejoramos</Text>
      </View>

      {/* Botones */}
      <View style={s.actions}>
        <TouchableOpacity
          style={s.btnPrimary}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.85}
        >
          <Text style={s.btnPrimaryText}>Iniciar sesión</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.btnOutline}
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.85}
        >
          <Text style={s.btnOutlineText}>Crear cuenta</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.footer}>Tu ciudad, tu voz</Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.primary, justifyContent: 'space-between' },
  hero:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  logoBox:    {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  logoIcon:   { fontSize: 48 },
  appName:    { fontSize: 36, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1.5 },
  tagline:    { fontSize: 15, color: 'rgba(255,255,255,0.65)', marginTop: 8, textAlign: 'center' },
  actions:    { paddingHorizontal: 32, paddingBottom: 16, gap: 12 },
  btnPrimary: {
    backgroundColor: C.accent,
    paddingVertical: 16, borderRadius: 12,
    alignItems: 'center',
    shadowColor: C.accent, shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 5,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnOutline: {
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    paddingVertical: 14, borderRadius: 12, alignItems: 'center',
  },
  btnOutlineText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  footer: {
    textAlign: 'center', color: 'rgba(255,255,255,0.35)',
    fontSize: 12, paddingBottom: 20,
  },
});
