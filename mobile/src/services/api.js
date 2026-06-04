import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Android emulator → 10.0.2.2 apunta al localhost del host
// iOS simulator   → cambiar a http://localhost:4000/api
const BASE_URL = 'http://192.168.100.229:4000/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Adjunta el token JWT en cada petición
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normaliza errores del servidor
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message ||
      err.message ||
      'Error de conexión';
    return Promise.reject(new Error(message));
  }
);

export default api;
