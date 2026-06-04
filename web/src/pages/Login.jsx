import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const S = {
  root: { display: 'flex', height: '100vh', overflow: 'hidden' },
  left: {
    flex: '0 0 42%', backgroundColor: 'var(--color-primary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoWrap: { textAlign: 'center', color: '#fff' },
  logoMark: { fontSize: '4rem', fontWeight: 900, lineHeight: 1 },
  logoAccent: { color: 'var(--color-accent)' },
  logoText: { fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem', letterSpacing: 1 },
  right: {
    flex: 1, backgroundColor: 'var(--color-surface)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '2rem',
  },
  card: { width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' },
  avatar: {
    width: 72, height: 72, borderRadius: '50%', backgroundColor: '#D1D5DB',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-primary)' },
  fieldWrap: { position: 'relative', width: '100%' },
  fieldIcon: {
    position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
    color: 'var(--color-text-muted)', pointerEvents: 'none',
  },
  input: {
    width: '100%', padding: '0.65rem 2.25rem 0.65rem 2.25rem',
    border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem', color: 'var(--color-text)', outline: 'none',
    fontFamily: 'inherit',
  },
  eyeBtn: {
    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center',
  },
  actionsRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  forgotLink: { fontSize: '0.8rem', color: 'var(--color-secondary)', textDecoration: 'none' },
  submitBtn: {
    padding: '0.55rem 1.4rem', backgroundColor: 'var(--color-primary)',
    color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
  },
  error: {
    width: '100%', padding: '0.6rem 0.75rem', backgroundColor: '#FEE2E2',
    border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)',
    color: '#B91C1C', fontSize: '0.83rem',
  },
};

export default function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user, requiere_cambio } = await login(email, password);
      if (requiere_cambio) {
        navigate('/change-password', { replace: true });
      } else if (user.role === 'superadmin') {
        navigate('/superadmin/heatmap', { replace: true });
      } else {
        navigate('/authority/heatmap', { replace: true });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || '';
      if (msg.toLowerCase().includes('suspend')) {
        setError('Tu cuenta está suspendida. Contacta al administrador.');
      } else {
        setError('Credenciales incorrectas. Verifica tu correo y contraseña.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.root}>
      {/* Columna izquierda */}
      <div style={S.left}>
        <div style={S.logoWrap}>
          <div style={S.logoMark}>
            <span style={S.logoAccent}>!U</span>
          </div>
          <div style={S.logoText}>Urbalert</div>
        </div>
      </div>

      {/* Columna derecha */}
      <div style={S.right}>
        <form style={S.card} onSubmit={handleSubmit}>
          {/* Avatar */}
          <div style={S.avatar}>
            <FiUser size={32} color="#9CA3AF" />
          </div>

          <h1 style={S.title}>Urbalert</h1>

          {error && <div style={S.error}>{error}</div>}

          {/* Email */}
          <div style={S.fieldWrap}>
            <FiUser style={S.fieldIcon} size={15} />
            <input
              style={S.input}
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          {/* Contraseña */}
          <div style={S.fieldWrap}>
            <FiLock style={S.fieldIcon} size={15} />
            <input
              style={S.input}
              type={showPwd ? 'text' : 'password'}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button type="button" style={S.eyeBtn} onClick={() => setShowPwd(v => !v)}>
              {showPwd ? <FiEyeOff size={15} /> : <FiEye size={15} />}
            </button>
          </div>

          {/* Forgot / Submit */}
          <div style={S.actionsRow}>
            <a href="#" style={S.forgotLink}>¿Olvidaste tu contraseña?</a>
            <button type="submit" style={S.submitBtn} disabled={loading}>
              {loading ? 'Entrando…' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
