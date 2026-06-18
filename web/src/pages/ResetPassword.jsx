import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiLock, FiEye, FiEyeOff, FiArrowLeft } from 'react-icons/fi';
import api from '../services/api';

const S = {
  root:     { display: 'flex', height: '100vh', overflow: 'hidden' },
  left: {
    flex: '0 0 42%', backgroundColor: 'var(--color-primary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoWrap: { textAlign: 'center', color: '#fff' },
  logoMark: { fontSize: '4rem', fontWeight: 900, lineHeight: 1 },
  logoAccent:{ color: 'var(--color-accent)' },
  logoText: { fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem', letterSpacing: 1 },
  right: {
    flex: 1, backgroundColor: 'var(--color-surface)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '2rem',
  },
  card: { width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' },
  title:    { fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary)', margin: 0 },
  subtitle: { fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', margin: '-0.5rem 0 0', lineHeight: 1.5 },
  fieldWrap:{ position: 'relative', width: '100%' },
  fieldIcon:{
    position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
    color: 'var(--color-text-muted)', pointerEvents: 'none',
  },
  input: {
    width: '100%', padding: '0.65rem 2.25rem 0.65rem 2.25rem',
    border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem', color: 'var(--color-text)', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
    color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center',
  },
  submitBtn: {
    width: '100%', padding: '0.65rem', backgroundColor: 'var(--color-primary)',
    color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
  },
  error: {
    width: '100%', padding: '0.6rem 0.75rem', backgroundColor: '#FEE2E2',
    border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)',
    color: '#B91C1C', fontSize: '0.83rem',
  },
  tokenError: {
    width: '100%', padding: '0.75rem', backgroundColor: '#FEF3C7',
    border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)',
    color: '#92400E', fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.5,
  },
  backLink: {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    fontSize: '0.82rem', color: 'var(--color-secondary)', textDecoration: 'none',
  },
};

export default function ResetPassword() {
  const [searchParams]          = useSearchParams();
  const token                   = searchParams.get('token');
  const navigate                = useNavigate();

  const [pwd,     setPwd]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showCfm, setShowCfm] = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div style={S.root}>
        <div style={S.left}>
          <div style={S.logoWrap}>
            <div style={S.logoMark}><span style={S.logoAccent}>!U</span></div>
            <div style={S.logoText}>Urbalert</div>
          </div>
        </div>
        <div style={S.right}>
          <div style={S.card}>
            <h1 style={S.title}>Enlace inválido</h1>
            <div style={S.tokenError}>
              Este enlace de recuperación no es válido o ya fue usado.
              Solicita uno nuevo desde la pantalla de recuperación.
            </div>
            <Link to="/forgot-password" style={S.backLink}>
              <FiArrowLeft size={13} /> Solicitar nuevo enlace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (pwd !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (pwd.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, nueva_password: pwd });
      navigate('/login', { state: { resetSuccess: true } });
    } catch (err) {
      setError(err?.response?.data?.message || 'Ocurrió un error. Intenta de nuevo.');
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
          <h1 style={S.title}>Nueva contraseña</h1>
          <p style={S.subtitle}>Elige una contraseña segura de al menos 8 caracteres.</p>

          {error && <div style={S.error}>{error}</div>}

          {/* Nueva contraseña */}
          <div style={S.fieldWrap}>
            <FiLock style={S.fieldIcon} size={15} />
            <input
              style={S.input}
              type={showPwd ? 'text' : 'password'}
              placeholder="Nueva contraseña"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              required
              autoFocus
              autoComplete="new-password"
            />
            <button type="button" style={S.eyeBtn} onClick={() => setShowPwd(v => !v)}>
              {showPwd ? <FiEyeOff size={15} /> : <FiEye size={15} />}
            </button>
          </div>

          {/* Confirmar contraseña */}
          <div style={S.fieldWrap}>
            <FiLock style={S.fieldIcon} size={15} />
            <input
              style={S.input}
              type={showCfm ? 'text' : 'password'}
              placeholder="Confirmar contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
            <button type="button" style={S.eyeBtn} onClick={() => setShowCfm(v => !v)}>
              {showCfm ? <FiEyeOff size={15} /> : <FiEye size={15} />}
            </button>
          </div>

          <button
            type="submit"
            style={{ ...S.submitBtn, ...(loading ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
            disabled={loading}
          >
            {loading ? 'Guardando…' : 'Guardar contraseña'}
          </button>

          <Link to="/login" style={S.backLink}>
            <FiArrowLeft size={13} /> Volver al inicio de sesión
          </Link>
        </form>
      </div>
    </div>
  );
}
