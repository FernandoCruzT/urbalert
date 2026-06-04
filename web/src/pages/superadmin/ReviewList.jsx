import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiAlertCircle } from 'react-icons/fi';
import SuperadminLayout from '../../layouts/SuperadminLayout';
import api from '../../services/api';

const TIPO_META = {
  escalado:  { label: 'Escalado',       color: '#E8423F' },
  ubicacion: { label: 'Mala ubicación', color: '#FF9800' },
  falso:     { label: 'Falso',          color: '#9C27B0' },
  repetido:  { label: 'Repetido',       color: '#2196F3' },
};

const URGENCIA_COLOR = { alto: '#D32F2F', medio: '#FF9800', bajo: '#388E3C' };

const S = {
  page:    { padding: '1.25rem', maxWidth: 1000, margin: '0 auto', height: '100%', overflowY: 'auto', boxSizing: 'border-box' },
  header:  { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' },
  backBtn: {
    display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
    cursor: 'pointer', color: 'var(--color-secondary)', fontSize: '0.85rem', padding: '4px 8px',
    borderRadius: 'var(--radius-sm)',
  },
  title:   { fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-primary)' },
  empty:   { textAlign: 'center', color: 'var(--color-text-muted)', padding: '3rem', fontSize: '0.9rem' },
  table:   { width: '100%', borderCollapse: 'collapse' },
  th:      { textAlign: 'left', padding: '0.6rem 1rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', borderBottom: '2px solid #E5E7EB', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 },
  tr: (hover) => ({
    background: hover ? '#F1F5F9' : 'var(--color-surface)',
    cursor: 'pointer', transition: 'background 0.1s',
  }),
  td:      { padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--color-text)', borderBottom: '1px solid #F3F4F6' },
  urgBadge: (u) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 20,
    fontSize: '0.72rem', fontWeight: 600, color: '#fff',
    background: URGENCIA_COLOR[u] || '#888',
  }),
  ageDot: { width: 8, height: 8, borderRadius: '50%', background: '#E8423F', display: 'inline-block', marginRight: 4 },
};

function daysAgo(dateStr) {
  const d = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  return d === 0 ? 'hoy' : `${d}d`;
}

export default function ReviewList() {
  const { tipo } = useParams();
  const navigate = useNavigate();
  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(null);
  const meta = TIPO_META[tipo] || { label: tipo, color: '#888' };

  useEffect(() => {
    setLoading(true);
    api.get('/validation/queue', { params: { tipo } })
      .then(({ data }) => setReportes(data.reportes || []))
      .catch(() => setReportes([]))
      .finally(() => setLoading(false));
  }, [tipo]);

  return (
    <SuperadminLayout>
      <div style={S.page}>
        <div style={S.header}>
          <button style={S.backBtn} onClick={() => navigate('/superadmin/review')}>
            <FiArrowLeft size={14} /> Regresar
          </button>
          <h2 style={{ ...S.title, borderLeft: `3px solid ${meta.color}`, paddingLeft: '0.6rem' }}>
            {meta.label} — {reportes.length} reporte{reportes.length !== 1 ? 's' : ''}
          </h2>
        </div>

        {loading ? (
          <div style={S.empty}>Cargando…</div>
        ) : reportes.length === 0 ? (
          <div style={S.empty}>
            <FiAlertCircle size={28} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
            No hay reportes en esta categoría
          </div>
        ) : (
          <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Categoría</th>
                  <th style={S.th}>Urgencia</th>
                  <th style={S.th}>Colonia / Sector</th>
                  <th style={S.th}>Autoridad</th>
                  <th style={S.th}>Antigüedad</th>
                </tr>
              </thead>
              <tbody>
                {reportes.map(r => (
                  <tr
                    key={r.id}
                    style={S.tr(hovered === r.id)}
                    onMouseEnter={() => setHovered(r.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => navigate(`/superadmin/review/${tipo}/${r.id}`)}
                  >
                    <td style={S.td}>
                      <div style={{ fontWeight: 600 }}>{r.categoria_nombre}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{r.subcategoria_nombre}</div>
                    </td>
                    <td style={S.td}><span style={S.urgBadge(r.urgencia)}>{r.urgencia}</span></td>
                    <td style={S.td}>
                      <div>{r.colonia || '—'}</div>
                      {r.sector_nombre && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{r.sector_nombre}</div>}
                    </td>
                    <td style={S.td}>
                      {r.autoridad_nombre
                        ? <><div>{r.autoridad_nombre} {r.autoridad_apellido}</div><div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{r.autoridad_departamento}</div></>
                        : <span style={{ color: 'var(--color-text-muted)' }}>Sin asignar</span>}
                    </td>
                    <td style={S.td}>
                      <span style={S.ageDot} />
                      {daysAgo(r.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SuperadminLayout>
  );
}
