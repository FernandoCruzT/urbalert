import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const C = {
  primary: '#561C24', secondary: '#6D2932', accent: '#C7B7A3',
  background: '#E8D8C4', surface: '#FFFFFF',
};

function InfoRow({ icon, label, value }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoIcon}>{icon}</Text>
      <View style={s.infoBody}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passActual,  setPassActual]  = useState('');
  const [passNueva,   setPassNueva]   = useState('');
  const [passConfirm, setPassConfirm] = useState('');
  const [loadingPass, setLoadingPass] = useState(false);

  const handleChangePassword = async () => {
    if (!passActual || !passNueva || !passConfirm) {
      Alert.alert('Campos requeridos', 'Completa todos los campos.');
      return;
    }
    if (passNueva !== passConfirm) {
      Alert.alert('Error', 'Las contraseñas nuevas no coinciden.');
      return;
    }
    if (passNueva.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setLoadingPass(true);
    try {
      await api.put('/auth/change-password', {
        password_actual: passActual,
        password_nuevo:  passNueva,
      });
      Alert.alert('Éxito', 'Contraseña actualizada correctamente.');
      setShowChangePassword(false);
      setPassActual(''); setPassNueva(''); setPassConfirm('');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoadingPass(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: logout },
    ]);
  };

  const initials = `${user?.nombre?.[0] ?? ''}${user?.apellido?.[0] ?? ''}`.toUpperCase();

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Mi perfil</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            <Text style={s.fullName}>{user?.nombre} {user?.apellido}</Text>
            <View style={s.roleBadge}>
              <Text style={s.roleText}>Ciudadano</Text>
            </View>
          </View>

          {/* Info */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Información personal</Text>
            <InfoRow icon="👤" label="Nombre"   value={`${user?.nombre ?? ''} ${user?.apellido ?? ''}`.trim()} />
            <InfoRow icon="✉️" label="Email"    value={user?.email} />
            <InfoRow icon="📱" label="Teléfono" value={user?.telefono} />
          </View>

          {/* Cambiar contraseña */}
          <TouchableOpacity
            style={s.changePassBtn}
            onPress={() => setShowChangePassword(v => !v)}
            activeOpacity={0.8}
          >
            <Text style={s.changePassIcon}>🔑</Text>
            <Text style={s.changePassText}>Cambiar contraseña</Text>
            <Text style={s.chevron}>{showChangePassword ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showChangePassword && (
            <View style={s.passForm}>
              <Text style={s.passLabel}>Contraseña actual</Text>
              <TextInput
                style={s.passInput}
                value={passActual}
                onChangeText={setPassActual}
                placeholder="••••••••"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
              />
              <Text style={s.passLabel}>Nueva contraseña</Text>
              <TextInput
                style={s.passInput}
                value={passNueva}
                onChangeText={setPassNueva}
                placeholder="Mín. 6 caracteres"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
              />
              <Text style={s.passLabel}>Confirmar nueva contraseña</Text>
              <TextInput
                style={s.passInput}
                value={passConfirm}
                onChangeText={setPassConfirm}
                placeholder="Repite la contraseña"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
              />
              <TouchableOpacity
                style={[s.btnSave, loadingPass && { opacity: 0.7 }]}
                onPress={handleChangePassword}
                disabled={loadingPass}
                activeOpacity={0.85}
              >
                {loadingPass
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.btnSaveText}>Guardar contraseña</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Cerrar sesión */}
          <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={s.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.background },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: C.background, alignItems: 'center', justifyContent: 'center' },
  backText:     { fontSize: 24, color: C.primary },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.primary },
  scroll:       { padding: 20, paddingBottom: 40 },
  avatarWrap:   { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: C.primary, shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 5,
  },
  avatarText:   { fontSize: 28, fontWeight: '700', color: '#fff' },
  fullName:     { fontSize: 20, fontWeight: '700', color: C.primary, marginBottom: 6 },
  roleBadge:    { backgroundColor: '#DBEAFE', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 20 },
  roleText:     { fontSize: 12, fontWeight: '600', color: '#1E40AF' },
  card:         { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle:    { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  infoIcon:     { fontSize: 18, marginRight: 12, width: 28, textAlign: 'center' },
  infoBody:     { flex: 1 },
  infoLabel:    { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 2 },
  infoValue:    { fontSize: 14, color: '#111827', fontWeight: '500' },
  changePassBtn:{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  changePassIcon:{ fontSize: 18, marginRight: 12 },
  changePassText:{ flex: 1, fontSize: 15, fontWeight: '600', color: C.primary },
  chevron:      { fontSize: 12, color: '#9CA3AF' },
  passForm:     { backgroundColor: C.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', gap: 8 },
  passLabel:    { fontSize: 12, fontWeight: '600', color: C.primary, marginTop: 4 },
  passInput:    { backgroundColor: C.background, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: '#111827' },
  btnSave:      { backgroundColor: C.secondary, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  btnSaveText:  { color: '#fff', fontSize: 15, fontWeight: '700' },
  logoutBtn:    { marginTop: 8, paddingVertical: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: C.accent },
  logoutText:   { color: C.accent, fontSize: 15, fontWeight: '700' },
});
