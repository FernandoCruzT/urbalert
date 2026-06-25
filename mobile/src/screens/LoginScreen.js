import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

const WEB_URL = 'urbalert-web.vercel.app';

const C = {
  primary: '#561C24', secondary: '#6D2932', accent: '#C7B7A3',
  background: '#E8D8C4', surface: '#FFFFFF',
};

export default function LoginScreen({ navigation }) {
  const { login, logout } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos requeridos', 'Ingresa tu email y contraseña.');
      return;
    }
    setLoading(true);
    try {
      const u = await login(email.trim().toLowerCase(), password);
      if (u?.role !== 'ciudadano' && u?.rol !== 'ciudadano') {
        await logout();
        Alert.alert(
          'Acceso no permitido',
          `Esta aplicación es exclusiva para ciudadanos. El panel de autoridades y administradores se accede desde el navegador web en ${WEB_URL}`
        );
      }
    } catch (err) {
      Alert.alert('Error al iniciar sesión', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
            <Text style={s.backText}>← Volver</Text>
          </TouchableOpacity>

          <Text style={s.title}>Iniciar sesión</Text>
          <Text style={s.subtitle}>Bienvenido de nuevo</Text>

          {/* Formulario */}
          <View style={s.form}>
            <View style={s.field}>
              <Text style={s.label}>Correo electrónico</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Contraseña</Text>
              <View style={s.passwordRow}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity onPress={() => setShowPass(v => !v)} style={s.eyeBtn}>
                  <Text style={s.eyeText}>{showPass ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[s.btnLogin, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnLoginText}>Iniciar sesión</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={s.link}>
            <Text style={s.linkText}>¿No tienes cuenta? <Text style={s.linkBold}>Regístrate</Text></Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={s.link}>
            <Text style={s.linkText}>¿Olvidaste tu contraseña? <Text style={s.linkBold}>Recupérala</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.background },
  scroll:      { flexGrow: 1, padding: 24 },
  back:        { marginBottom: 24 },
  backText:    { color: C.secondary, fontSize: 15 },
  title:       { fontSize: 28, fontWeight: '800', color: C.primary, marginBottom: 4 },
  subtitle:    { fontSize: 15, color: '#6B7280', marginBottom: 32 },
  form:        { gap: 16, marginBottom: 24 },
  field:       { gap: 6 },
  label:       { fontSize: 13, fontWeight: '600', color: C.primary },
  input: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827',
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn:      { padding: 10 },
  eyeText:     { fontSize: 18 },
  btnLogin: {
    backgroundColor: C.primary, paddingVertical: 16,
    borderRadius: 12, alignItems: 'center',
    shadowColor: C.primary, shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  btnLoginText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link:         { alignItems: 'center', marginTop: 20 },
  linkText:     { fontSize: 14, color: '#6B7280' },
  linkBold:     { color: C.secondary, fontWeight: '700' },
});
