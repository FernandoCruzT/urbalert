import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthorityLayout from '../../layouts/AuthorityLayout';
import api from '../../services/api';

const BADGE = {
  resuelto: { bg: '#F0FDF4', color: '#166534' },
  cerrado:  { bg: '#F3F4F6', color: '#374151' },
};

const S = {
  page:      { padding: '0.85rem 1rem', height: '100%', overflowY: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  title:     { fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary)' },
  tableWrap: { background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', flex: 1 },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { textAlign: 'left', padding: '0.55rem 0.85rem', fontSize: '0.72rem', color: 'var(--color-text-muted)', borderBottom: '2px solid #E5E7EB', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, background: 'var(--color-surface)', whiteSpace: 'nowrap' },
  tr:        (hov) => ({ background: hov ? '#F1F5F9' : 'transparent', cursor: 'pointer', transition: 'background 0.1s' }),
  td:        { padding: '0.6rem 0.85rem', fontSize: '0.83rem', color: 'var(--color-text)', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle' },
  badge:     (estado) => {
    const b = BADGE[estado] || { bg: '#F3F4F6', color: '#6B7280' };
    return { display: 'inline-block', padding: '1px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, background: b.bg, color: b.color, whiteSpace: 'nowrap', textTransform: 'capitalize' };
  },
  empty:     { textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function History() {
  const navigate = useNavigate();
  const [reportes, setReportes] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [hovered,  setHovered]  = useState(null);

  useEffect(() => {
    api.get('/reports/authority-reports', { params: { estado: 'historico' } })
      .then(({ data }) => setReportes(data.reportes || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthorityLayout>
      <div style={S.page}>
        <h2 style={S.title}>Historial</h2>
        <div style={S.tableWrap}>
          {loading ? (
            <div style={S.empty}>Cargando…</div>
          ) : reportes.length === 0 ? (
            <div style={S.empty}>Sin reportes en el historial</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Fecha</th>
                  <th style={S.th}>Subcategoría</th>
                  <th style={S.th}>Estatus</th>
                  <th style={S.th}>Descripción</th>
                </tr>
              </thead>
              <tbody>
                {reportes.map(r => (
                  <tr
                    key={r.id}
                    style={S.tr(hovered === r.id)}
                    onMouseEnter={() => setHovered(r.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => navigate(`/authority/report/${r.id}`, { state: { from: '/authority/history' } })}
                  >
                    <td style={{ ...S.td, whiteSpace: 'nowrap' }}>{fmtDate(r.updated_at)}</td>
                    <td style={S.td}>{r.subcategoria_nombre}</td>
                    <td style={S.td}><span style={S.badge(r.estado)}>{r.estado.replace('_', ' ')}</span></td>
                    <td style={S.td}>
                      <span title={r.descripcion}>
                        {r.descripcion?.length > 80 ? r.descripcion.slice(0, 80) + '…' : r.descripcion}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AuthorityLayout>
  );
}
