import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SuperadminLayout from '../../layouts/SuperadminLayout';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const S = {
  page:    { padding: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', height: '100%', boxSizing: 'border-box', overflowY: 'auto' },
  card:    { background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '2rem', width: '100%', maxWidth: 480 },
  avatarWrap: { display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' },
  avatar:  { width: 80, height: 80, borderRadius: '50%', backgroundColor: 'var(--color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '2rem', color: '#fff' },
  name:    { textAlign: 'center', fontSize: '1.15rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.25rem' },
  role:    { textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1.5rem', textTransform: 'capitalize' },
  grid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem', marginBottom: '1.75rem' },
  label:   { fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600, marginBottom: 2 },
  value:   { fontSize: '0.88rem', color: 'var(--color-text)' },
  btn:     { width: '100%', padding: '0.65rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnDanger: { width: '100%', padding: '0.65rem', background: 'none', color: '#B91C1C', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginTop: '0.6rem' },
  errBanner: { padding: '0.6rem 0.75rem', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)', color: '#B91C1C', fontSize: '0.83rem', marginBottom: '1rem' },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal:     { background: '#fff', borderRadius: 'var(--radius-md)', padding: '1.5rem', width: '100%', maxWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  modalTitle:{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.75rem' },
  modalText: { fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem', lineHeight: 1.5 },
  modalRow:  { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' },
  btnSecondary:{ padding: '0.42rem 0.8rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', background: '#fff', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text)' },
  btnPrimary:  { padding: '0.42rem 0.8rem', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', color: '#fff', fontWeight: 600 },
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function SuperadminProfile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showDelete, setShowDelete] = useState(false);
  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState('');

  const initials = [user?.nombre?.[0], user?.apellido?.[0]].filter(Boolean).join('').toUpperCase() || 'A';
  const fullName = user ? `${user.nombre} ${user.apellido}` : '—';

  async function handleDelete() {
    setBusy(true);
    try {
      await api.delete(`/users/superadmin/${user.profileId}`);
      logout();
      navigate('/login');
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al borrar la cuenta');
      setShowDelete(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SuperadminLayout>
      <div style={S.page}>
        <div style={S.card}>
          {error && <div style={S.errBanner}>{error}</div>}
          <div style={S.avatarWrap}>
            <div style={S.avatar}>{initials}</div>
          </div>
          <div style={S.name}>{fullName}</div>
          <div style={S.role}>{user?.rol || '—'}</div>
          <div style={S.grid}>
            <div>
              <div style={S.label}>Nombre</div>
              <div style={S.value}>{user?.nombre || '—'}</div>
            </div>
            <div>
              <div style={S.label}>Apellido</div>
              <div style={S.value}>{user?.apellido || '—'}</div>
            </div>
            <div>
              <div style={S.label}>Correo electrónico</div>
              <div style={S.value}>{user?.email || '—'}</div>
            </div>
            <div>
              <div style={S.label}>Teléfono</div>
              <div style={S.value}>{user?.telefono || '—'}</div>
            </div>
            <div>
              <div style={S.label}>Rol</div>
              <div style={S.value}>{user?.rol || '—'}</div>
            </div>
            <div>
              <div style={S.label}>Registro</div>
              <div style={S.value}>{fmtDate(user?.created_at)}</div>
            </div>
          </div>
          <button style={S.btn} onClick={() => navigate('/change-password')}>
            Cambiar contraseña
          </button>
          <button style={S.btnDanger} onClick={() => setShowDelete(true)}>
            Borrar cuenta
          </button>
        </div>
      </div>

      {showDelete && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setShowDelete(false); }}>
          <div style={S.modal}>
            <div style={S.modalTitle}>Borrar cuenta</div>
            <p style={S.modalText}>
              ¿Estás seguro que deseas desactivar tu cuenta de superadmin? Perderás acceso
              inmediatamente y no podrás volver a iniciar sesión con ella.
            </p>
            <div style={S.modalRow}>
              <button style={S.btnSecondary} onClick={() => setShowDelete(false)}>Cancelar</button>
              <button style={{ ...S.btnPrimary, background: '#B91C1C' }} onClick={handleDelete} disabled={busy}>
                {busy ? 'Procesando…' : 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperadminLayout>
  );
}
