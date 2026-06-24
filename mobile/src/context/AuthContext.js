import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const INACTIVITY_MS = 15 * 60 * 1000; // 15 min → logout automático
const WARNING_MS    = 14 * 60 * 1000; // 14 min → alerta de 1 min antes

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  const warningTimerRef = useRef(null);
  const logoutTimerRef  = useRef(null);
  const startTimersRef  = useRef(null);
  const appStateRef     = useRef(AppState.currentState);

  // Restaurar sesión al arrancar
  useEffect(() => {
    (async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        const storedUser  = await AsyncStorage.getItem('user');
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  const _persist = async (t, u) => {
    if (!t) throw new Error('El servidor no devolvió un token válido.');
    if (!u) throw new Error('El servidor no devolvió datos del usuario.');
    await AsyncStorage.setItem('token', t);
    await AsyncStorage.setItem('user', JSON.stringify(u));
    setToken(t);
    setUser(u);
  };

  const logout = useCallback(async () => {
    clearTimeout(warningTimerRef.current);
    clearTimeout(logoutTimerRef.current);
    await AsyncStorage.multiRemove(['token', 'user']);
    setToken(null);
    setUser(null);
  }, []);

  const startTimers = useCallback(() => {
    clearTimeout(warningTimerRef.current);
    clearTimeout(logoutTimerRef.current);

    warningTimerRef.current = setTimeout(() => {
      Alert.alert(
        'Sesión por expirar',
        'Tu sesión cerrará en 1 minuto por inactividad. ¿Deseas continuar?',
        [
          { text: 'Cerrar sesión', style: 'destructive', onPress: logout },
          { text: 'Continuar', onPress: () => startTimersRef.current?.() },
        ],
        { cancelable: false }
      );
    }, WARNING_MS);

    logoutTimerRef.current = setTimeout(logout, INACTIVITY_MS);
  }, [logout]);

  // Mantener ref sincronizada para el callback del Alert (evita closure stale)
  useEffect(() => { startTimersRef.current = startTimers; }, [startTimers]);

  // Exponer resetTimer para que la UI lo llame en cada interacción
  const resetTimer = useCallback(() => {
    if (token) startTimers();
  }, [token, startTimers]);

  // Iniciar/detener timers según estado de autenticación
  useEffect(() => {
    if (token) {
      startTimers();
    } else {
      clearTimeout(warningTimerRef.current);
      clearTimeout(logoutTimerRef.current);
    }
    return () => {
      clearTimeout(warningTimerRef.current);
      clearTimeout(logoutTimerRef.current);
    };
  }, [token, startTimers]);

  // Pausar timers en background, reanudar al volver a foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current === 'active' && nextState !== 'active') {
        clearTimeout(warningTimerRef.current);
        clearTimeout(logoutTimerRef.current);
      } else if (appStateRef.current !== 'active' && nextState === 'active') {
        if (token) startTimers();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [token, startTimers]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const t = data.token;
    const u = data.usuario ?? data.user ?? null;
    await _persist(t, u);
    return u;
  };

  const loginWithData = async (t, u) => {
    await _persist(t, u);
    return u;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, loginWithData, logout, resetTimer }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
