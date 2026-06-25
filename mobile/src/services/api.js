import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://urbalert-backend-production.up.railway.app/api';

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

// Normaliza errores del servidor y preserva el body de la respuesta en error.data
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const serverData = err.response?.data;
    const message = serverData?.message || err.message || 'Error de conexión';
    const error = new Error(message);
    if (serverData) error.data = serverData;
    return Promise.reject(error);
  }
);

export default api;
