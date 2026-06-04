import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLock, FiEye, FiEyeOff, FiCheckCircle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const S = {
  root: { display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--color-bg)' },
  left: {
    flex: '0 0 38%', backgroundColor: 'var(--color-primary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoWrap:   { textAlign: 'center', color: '#fff' },
  logoMark:   { fontSize: '3.5rem', fontWeight: 900, lineHeight: 1 },
  logoAccent: { color: 'var(--color-accent)' },
  logoText:   { fontSize: '1.25rem', fontWeight: 700, marginTop: '0.5rem', letterSpacing: 1 },
  logoSub:    { fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', marginTop: '0.35rem' },
  right: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '2rem',
  },
  card:    { width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: '1rem' },
  icon:    { display: 'flex', justifyContent: 'center', marginBottom: '0.25rem' },
  title:   { fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-primary)', textAlign: 'center' },
  subtitle:{ fontSize: '0.85rem', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.5, marginBottom: '0.25rem' },
  fieldWrap:{ position: 'relative' },
  fieldIcon:{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' },
  input: {
    width: '100%', padding: '0.65rem 2.5rem 0.65rem 2.25rem',
    border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)',
    fontSize: '0.9rem', color: 'var(--color-text)', fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  },
  inputErr: { border: '1px solid #EF4444' },
  eyeBtn:  { position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' },
  submitBtn: {
    width: '100%', padding: '0.7rem', background: 'var(--color-primary)',
    color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
    fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    marginTop: '0.25rem',
  },
  errMsg: { padding: '0.6rem 0.75rem', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)', color: '#B91C1C', fontSize: '0.83rem' },
  errField: { fontSize: '0.75rem', color: '#EF4444', marginTop: 2 },
  // Success state
  successCard: { width: '100%', maxWidth: 380, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' },
  sucTitle: { fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)' },
  sucSub:   { fontSize: '0.88rem', color: 'var(--color-text-muted)', lineHeight: 1.5 },
};

function PwdField({ value, onChange, placeholder, show, onToggle, error, autoComplete }) {
  return (
    <div>
      <div style={S.fieldWrap}>
        <FiLock style={S.fieldIcon} size={15} />
        <input
          style={{ ...S.input, ...(error ? S.inputErr : {}) }}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        <button type="button" style={S.eyeBtn} onClick={onToggle}>
          {show ? <FiEyeOff size={15} /> : <FiEye size={15} />}
        </button>
      </div>
      {error && <div style={S.errField}>{error}</div>}
    </div>
  );
}

export default function ChangePassword() {
  const [actual,    setActual]    = useState('');
  const [nuevo,     setNuevo]     = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showActual,  setShowActual]  = useState(false);
  const [showNuevo,   setShowNuevo]   = useState(false);
  const [showConf,    setShowConf]    = useState(false);
  const [errors,    setErrors]    = useState({});
  const [apiError,  setApiError]  = useState('');
  const [busy,      setBusy]      = useState(false);
  const [done,      setDone]      = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  function validate() {
    const errs = {};
    if (!actual)                  errs.actual    = 'Ingresa tu contraseña actual';
    if (!nuevo)                   errs.nuevo     = 'Ingresa la nueva contraseña';
    else if (nuevo.length < 8)    errs.nuevo     = 'Mínimo 8 caracteres';
    if (!confirmar)               errs.confirmar = 'Confirma la nueva contraseña';
    else if (nuevo !== confirmar) errs.confirmar = 'Las contraseñas no coinciden';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError('');
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setBusy(true);

    try {
      await api.patch('/auth/change-password', {
        password_actual: actual,
        password_nuevo:  nuevo,
      });
      setDone(true);
    } catch (err) {
      setApiError(err?.response?.data?.message || 'Error al cambiar la contraseña');
    } finally {
      setBusy(false);
    }
  }

  function handleContinuar() {
    const role = user?.role || user?.rol;
    if (role === 'superadmin') navigate('/superadmin/heatmap', { replace: true });
    else                       navigate('/authority/heatmap',  { replace: true });
  }

  return (
    <div style={S.root}>
      {/* Columna izquierda */}
      <div style={S.left}>
        <div style={S.logoWrap}>
          <div style={S.logoMark}><span style={S.logoAccent}>!U</span></div>
          <div style={S.logoText}>Urbalert</div>
          <div style={S.logoSub}>Cambio de contraseña requerido</div>
        </div>
      </div>

      {/* Columna derecha */}
      <div style={S.right}>
        {done ? (
          <div style={S.successCard}>
            <FiCheckCircle size={52} color="#388E3C" />
            <div style={S.sucTitle}>¡Contraseña actualizada!</div>
            <div style={S.sucSub}>Tu contraseña se guardó correctamente. Ahora puedes acceder al sistema.</div>
            <button style={{ ...S.submitBtn, marginTop: '0.5rem' }} onClick={handleContinuar}>
              Continuar al panel
            </button>
          </div>
        ) : (
          <form style={S.card} onSubmit={handleSubmit} noValidate>
            <div style={S.icon}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiLock size={26} color="var(--color-primary)" />
              </div>
            </div>
            <div style={S.title}>Crea tu contraseña</div>
            <div style={S.subtitle}>
              Por seguridad, debes establecer una nueva contraseña antes de continuar.
            </div>

            {apiError && <div style={S.errMsg}>{apiError}</div>}

            <PwdField
              value={actual} onChange={setActual}
              placeholder="Contraseña actual"
              show={showActual} onToggle={() => setShowActual(v => !v)}
              error={errors.actual} autoComplete="current-password"
            />
            <PwdField
              value={nuevo} onChange={setNuevo}
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              show={showNuevo} onToggle={() => setShowNuevo(v => !v)}
              error={errors.nuevo} autoComplete="new-password"
            />
            <PwdField
              value={confirmar} onChange={setConfirmar}
              placeholder="Confirmar nueva contraseña"
              show={showConf} onToggle={() => setShowConf(v => !v)}
              error={errors.confirmar} autoComplete="new-password"
            />

            <button type="submit" style={S.submitBtn} disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
