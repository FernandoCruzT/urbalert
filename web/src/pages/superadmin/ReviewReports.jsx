import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SuperadminLayout from '../../layouts/SuperadminLayout';
import api from '../../services/api';

const TIPOS = [
  { key: 'escalado',  label: 'Escalado',        desc: 'Reportes escalados por autoridad',          color: '#E8423F' },
  { key: 'ubicacion', label: 'Mala ubicación',   desc: 'GPS de baja precisión',                     color: '#FF9800' },
  { key: 'falso',     label: 'Falso',            desc: 'Posibles reportes inválidos',               color: '#9C27B0' },
  { key: 'repetido',  label: 'Repetido',         desc: 'Reportes con duplicado confirmado',         color: '#2196F3' },
];

const S = {
  page:    { padding: '1.5rem', maxWidth: 900, margin: '0 auto' },
  title:   { fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '1.5rem' },
  grid:    { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' },
  card: (color) => ({
    background: 'var(--color-surface)', borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-sm)', padding: '1.25rem 1.5rem',
    borderLeft: `4px solid ${color}`, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    transition: 'box-shadow 0.15s, transform 0.1s',
  }),
  cardLeft:  { display: 'flex', flexDirection: 'column', gap: 4 },
  cardLabel: { fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)' },
  cardDesc:  { fontSize: '0.8rem', color: 'var(--color-text-muted)' },
  badge: (color) => ({
    fontSize: '1.6rem', fontWeight: 800, color,
    minWidth: 48, textAlign: 'right',
  }),
  loading: { textAlign: 'center', color: 'var(--color-text-muted)', padding: '3rem' },
};

export default function ReviewReports() {
  const [counts, setCounts] = useState({ escalado: 0, ubicacion: 0, falso: 0, repetido: 0 });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/validation/stats')
      .then(({ data }) => {
        if (data.revision) setCounts(data.revision);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SuperadminLayout><div style={S.loading}>Cargando…</div></SuperadminLayout>;

  return (
    <SuperadminLayout>
      <div style={S.page}>
        <h2 style={S.title}>Revisión de reportes</h2>
        <div style={S.grid}>
          {TIPOS.map(({ key, label, desc, color }) => (
            <div
              key={key}
              style={S.card(color)}
              onClick={() => navigate(`/superadmin/review/${key}`)}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={S.cardLeft}>
                <span style={S.cardLabel}>{label}</span>
                <span style={S.cardDesc}>{desc}</span>
              </div>
              <span style={S.badge(color)}>{counts[key] ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </SuperadminLayout>
  );
}
