import { useNavigate } from 'react-router-dom';
import AuthorityLayout from '../../layouts/AuthorityLayout';
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
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function AuthorityProfile() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const initials = [user?.nombre?.[0], user?.apellido?.[0]].filter(Boolean).join('').toUpperCase() || 'A';
  const fullName = user ? `${user.nombre} ${user.apellido}` : '—';

  return (
    <AuthorityLayout>
      <div style={S.page}>
        <div style={S.card}>
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
        </div>
      </div>
    </AuthorityLayout>
  );
}
