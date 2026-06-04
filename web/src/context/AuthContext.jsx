import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [rol,     setRol]     = useState(null);
  const [loading, setLoading] = useState(true);

  // Al montar: validar token guardado
  useEffect(() => {
    const saved = localStorage.getItem('token');
    if (!saved) { setLoading(false); return; }

    api.get('/auth/me')
      .then(({ data }) => {
        setToken(saved);
        setUser(data.user);
        setRol(data.user.role);
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    setRol(data.user.role);
    return { user: data.user, requiere_cambio: data.requiere_cambio || false };
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setRol(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, rol, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
