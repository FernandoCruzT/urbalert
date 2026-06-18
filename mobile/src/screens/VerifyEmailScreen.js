import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const C = {
  primary: '#561C24', secondary: '#6D2932', accent: '#C7B7A3',
  background: '#E8D8C4', surface: '#FFFFFF',
};

const COOLDOWN_SECONDS = 60;

export default function VerifyEmailScreen({ route, navigation }) {
  const { email, nombre, token, userData } = route.params ?? {};
  const { loginWithData } = useAuth();

  const [codigo,    setCodigo]    = useState('');
  const [loading,   setLoading]   = useState(false);
  const [cooldown,  setCooldown]  = useState(0);
  const intervalRef = useRef(null);

  // Arrancar cuenta regresiva
  const startCooldown = useCallback(() => {
    setCooldown(COOLDOWN_SECONDS);
    intervalRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Enviar código inicial al montar (el backend ya lo envió en el registro,
  // pero si el usuario llega aquí sin haberlo recibido puede reenviarlo)
  useEffect(() => {
    startCooldown();
    return () => clearInterval(intervalRef.current);
  }, [startCooldown]);

  const handleVerify = async () => {
    if (codigo.length !== 6) {
      Alert.alert('Código incompleto', 'Ingresa el código de 6 dígitos que recibiste.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/verify-email', { email, codigo });

      // Iniciar sesión con los datos que ya teníamos del registro
      if (token && userData) {
        await loginWithData(token, userData);
        // El navigator cambia automáticamente al stack autenticado
      } else {
        // Fallback: redirigir al login para que inicie sesión manualmente
        Alert.alert(
          '¡Correo verificado!',
          'Tu cuenta está activa. Inicia sesión para continuar.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        );
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Código inválido o expirado. Intenta de nuevo.';
      Alert.alert('Error de verificación', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await api.post('/auth/resend-verification', { email });
      startCooldown();
      Alert.alert('Código reenviado', `Enviamos un nuevo código a ${email}`);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'No se pudo reenviar el código.');
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={s.container}>
          {/* Icono decorativo */}
          <View style={s.iconWrap}>
            <Text style={s.icon}>✉️</Text>
          </View>

          <Text style={s.title}>Verifica tu correo</Text>
          <Text style={s.subtitle}>
            Enviamos un código de 6 dígitos a{'\n'}
            <Text style={s.emailText}>{email}</Text>
          </Text>

          {/* Campo de código */}
          <TextInput
            style={s.codeInput}
            value={codigo}
            onChangeText={t => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="numeric"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor="#C4A99A"
            textAlign="center"
            autoFocus
          />

          {/* Botón Verificar */}
          <TouchableOpacity
            style={[s.btnVerify, (loading || codigo.length !== 6) && s.btnDisabled]}
            onPress={handleVerify}
            disabled={loading || codigo.length !== 6}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Verificar</Text>
            }
          </TouchableOpacity>

          {/* Reenviar con cooldown */}
          <TouchableOpacity
            style={[s.btnResend, cooldown > 0 && s.btnResendDisabled]}
            onPress={handleResend}
            disabled={cooldown > 0}
            activeOpacity={0.7}
          >
            <Text style={[s.btnResendText, cooldown > 0 && s.btnResendTextDisabled]}>
              {cooldown > 0
                ? `Reenviar en ${cooldown}s…`
                : 'Reenviar código'
              }
            </Text>
          </TouchableOpacity>

          {/* Volver */}
          <TouchableOpacity
            style={s.link}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={s.linkText}>¿Correo incorrecto? <Text style={s.linkBold}>Volver</Text></Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: C.background },
  container:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },

  iconWrap:   {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000', shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  icon:       { fontSize: 36 },

  title:      { fontSize: 26, fontWeight: '800', color: C.primary, marginBottom: 10, textAlign: 'center' },
  subtitle:   { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  emailText:  { color: C.secondary, fontWeight: '700' },

  codeInput:  {
    backgroundColor: C.surface,
    borderWidth: 2, borderColor: C.primary,
    borderRadius: 14, width: '70%',
    paddingVertical: 18,
    fontSize: 36, fontWeight: '800',
    color: C.primary, letterSpacing: 10,
    marginBottom: 28,
    shadowColor: C.primary, shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 6, elevation: 3,
  },

  btnVerify:  {
    backgroundColor: C.accent, width: '100%',
    paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', marginBottom: 14,
    shadowColor: C.accent, shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 4,
  },
  btnDisabled:{ opacity: 0.5 },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '700' },

  btnResend:  { paddingVertical: 10, paddingHorizontal: 20 },
  btnResendDisabled: { opacity: 0.45 },
  btnResendText:     { fontSize: 14, color: C.secondary, fontWeight: '600', textDecorationLine: 'underline' },
  btnResendTextDisabled: { textDecorationLine: 'none', color: '#9CA3AF' },

  link:       { marginTop: 28 },
  linkText:   { fontSize: 13, color: '#6B7280' },
  linkBold:   { color: C.secondary, fontWeight: '700' },
});
