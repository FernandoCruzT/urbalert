import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';

const C = {
  primary: '#561C24', secondary: '#6D2932', accent: '#C7B7A3',
  background: '#E8D8C4', surface: '#FFFFFF',
};

export default function RegisterScreen({ navigation }) {

  const [nombre,    setNombre]    = useState('');
  const [apellido,  setApellido]  = useState('');
  const [email,     setEmail]     = useState('');
  const [telefono,  setTelefono]  = useState('');
  const [password,  setPassword]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [showPass,  setShowPass]  = useState(false);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const NAME_RE  = /^[A-Za-záéíóúÁÉÍÓÚñÑüÜ\s]{2,50}$/;

  const handleRegister = async () => {
    if (!nombre.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Campos requeridos', 'Nombre, email y contraseña son obligatorios.');
      return;
    }
    if (!NAME_RE.test(nombre.trim())) {
      Alert.alert('Nombre inválido', 'El nombre solo puede contener letras y espacios (2-50 caracteres).');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      Alert.alert('Email inválido', 'Ingresa un correo electrónico válido.');
      return;
    }
    if (telefono.trim() && !/^\d{10}$/.test(telefono.replace(/[\s\-().]/g, ''))) {
      Alert.alert('Teléfono inválido', 'El teléfono debe tener exactamente 10 dígitos.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Contraseña muy corta', 'Usa al menos 8 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', {
        nombre:   nombre.trim(),
        apellido: apellido.trim(),
        email:    email.trim().toLowerCase(),
        telefono: telefono.trim() || undefined,
        password,
      });

      // Navegar a verificación de correo antes de completar el login
      navigation.navigate('VerifyEmail', {
        email:    email.trim().toLowerCase(),
        nombre:   nombre.trim(),
        token:    data?.token ?? null,
        userData: data?.usuario ?? data?.user ?? null,
      });
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Ocurrió un error al registrarse.';
      Alert.alert('Error al registrarse', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
            <Text style={s.backText}>← Volver</Text>
          </TouchableOpacity>

          <Text style={s.title}>Crear cuenta</Text>
          <Text style={s.subtitle}>Únete a la comunidad</Text>

          <View style={s.form}>
            <View style={s.row}>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>Nombre *</Text>
                <TextInput style={s.input} value={nombre} onChangeText={setNombre}
                  placeholder="Juan" placeholderTextColor="#9CA3AF" />
              </View>
              <View style={[s.field, { flex: 1 }]}>
                <Text style={s.label}>Apellido</Text>
                <TextInput style={s.input} value={apellido} onChangeText={setApellido}
                  placeholder="Pérez" placeholderTextColor="#9CA3AF" />
              </View>
            </View>

            <View style={s.field}>
              <Text style={s.label}>Correo electrónico *</Text>
              <TextInput
                style={s.input} value={email} onChangeText={setEmail}
                placeholder="tu@email.com" placeholderTextColor="#9CA3AF"
                keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Teléfono</Text>
              <TextInput
                style={s.input} value={telefono} onChangeText={setTelefono}
                placeholder="3312345678" placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Contraseña *</Text>
              <View style={s.passwordRow}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  value={password} onChangeText={setPassword}
                  placeholder="Mín. 8 caracteres" placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity onPress={() => setShowPass(v => !v)} style={s.eyeBtn}>
                  <Text style={s.eyeText}>{showPass ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[s.btnRegister, loading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Crear cuenta</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.link}>
            <Text style={s.linkText}>¿Ya tienes cuenta? <Text style={s.linkBold}>Inicia sesión</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.background },
  scroll:     { flexGrow: 1, padding: 24 },
  back:       { marginBottom: 24 },
  backText:   { color: C.secondary, fontSize: 15 },
  title:      { fontSize: 28, fontWeight: '800', color: C.primary, marginBottom: 4 },
  subtitle:   { fontSize: 15, color: '#6B7280', marginBottom: 32 },
  form:       { gap: 16, marginBottom: 24 },
  row:        { flexDirection: 'row', gap: 12 },
  field:      { gap: 6 },
  label:      { fontSize: 13, fontWeight: '600', color: C.primary },
  input: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827',
  },
  passwordRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn:     { padding: 10 },
  eyeText:    { fontSize: 18 },
  btnRegister:{
    backgroundColor: C.accent, paddingVertical: 16,
    borderRadius: 12, alignItems: 'center',
    shadowColor: C.accent, shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  link:       { alignItems: 'center', marginTop: 20 },
  linkText:   { fontSize: 14, color: '#6B7280' },
  linkBold:   { color: C.secondary, fontWeight: '700' },
});
