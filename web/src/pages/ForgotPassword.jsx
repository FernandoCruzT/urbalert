import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMail, FiArrowLeft } from 'react-icons/fi';
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
    width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.25rem',
    border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem', color: 'var(--color-text)', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  },
  submitBtn: {
    width: '100%', padding: '0.65rem', backgroundColor: 'var(--color-primary)',
    color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
  },
  submitBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  error: {
    width: '100%', padding: '0.6rem 0.75rem', backgroundColor: '#FEE2E2',
    border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)',
    color: '#B91C1C', fontSize: '0.83rem',
  },
  success: {
    width: '100%', padding: '0.75rem', backgroundColor: '#DCFCE7',
    border: '1px solid #86EFAC', borderRadius: 'var(--radius-sm)',
    color: '#166534', fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.5,
  },
  backLink: {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    fontSize: '0.82rem', color: 'var(--color-secondary)', textDecoration: 'none',
  },
};

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('');
  const [status,  setStatus]  = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() });
      setMessage(data.message);
      setStatus('success');
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Ocurrió un error. Intenta de nuevo.');
      setStatus('error');
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
        <div style={S.card}>
          <h1 style={S.title}>Recuperar contraseña</h1>
          <p style={S.subtitle}>
            Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
          </p>

          {status === 'error'   && <div style={S.error}>{message}</div>}
          {status === 'success' && <div style={S.success}>{message}</div>}

          {status !== 'success' && (
            <form style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}
                  onSubmit={handleSubmit}>
              <div style={S.fieldWrap}>
                <FiMail style={S.fieldIcon} size={15} />
                <input
                  style={S.input}
                  type="email"
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                style={{ ...S.submitBtn, ...(status === 'loading' ? S.submitBtnDisabled : {}) }}
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Enviando…' : 'Enviar enlace'}
              </button>
            </form>
          )}

          <Link to="/login" style={S.backLink}>
            <FiArrowLeft size={13} /> Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
