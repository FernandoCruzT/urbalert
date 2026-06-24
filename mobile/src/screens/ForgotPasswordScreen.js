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

export default function ForgotPasswordScreen({ navigation }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleSend = async () => {
    if (!email.trim()) {
      Alert.alert('Campo requerido', 'Ingresa tu correo electrónico.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo enviar el enlace.');
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

          <Text style={s.title}>Recuperar contraseña</Text>
          <Text style={s.subtitle}>Te enviaremos un enlace para restablecerla</Text>

          {sent ? (
            <View style={s.successBox}>
              <Text style={s.successIcon}>✉️</Text>
              <Text style={s.successText}>
                Si el correo está registrado recibirás un enlace para restablecer tu contraseña.
              </Text>
              <TouchableOpacity style={s.btnLogin} onPress={() => navigation.navigate('Login')} activeOpacity={0.85}>
                <Text style={s.btnLoginText}>Volver al inicio de sesión</Text>
              </TouchableOpacity>
            </View>
          ) : (
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

              <TouchableOpacity
                style={[s.btnLogin, loading && { opacity: 0.7 }]}
                onPress={handleSend}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnLoginText}>Enviar enlace</Text>
                }
              </TouchableOpacity>
            </View>
          )}

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
  form:        { gap: 20 },
  field:       { gap: 6 },
  label:       { fontSize: 13, fontWeight: '600', color: C.primary },
  input: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827',
  },
  btnLogin: {
    backgroundColor: C.primary, paddingVertical: 16,
    borderRadius: 12, alignItems: 'center',
    shadowColor: C.primary, shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  btnLoginText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  successBox:  { alignItems: 'center', gap: 16, marginTop: 8 },
  successIcon: { fontSize: 48 },
  successText: {
    fontSize: 15, color: '#374151', textAlign: 'center', lineHeight: 22,
    backgroundColor: C.surface, borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
});
