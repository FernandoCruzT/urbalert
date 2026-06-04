import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SuperadminLayout from '../../layouts/SuperadminLayout';
import api from '../../services/api';

// ── Estilos ───────────────────────────────────────────────────────────────────

const S = {
  page:        { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0.85rem 1rem', boxSizing: 'border-box', gap: '0.75rem' },
  title:       { fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 },
  body:        { display: 'flex', gap: '0.75rem', flex: 1, minHeight: 0 },
  // Columna izquierda
  left:        { width: '40%', flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' },
  listScroll:  { flex: 1, overflowY: 'auto' },
  // Item de la lista
  item:        (selected, leida) => ({
    padding: '0.75rem 0.9rem',
    borderBottom: '1px solid #F3F4F6',
    cursor: 'pointer',
    background: selected ? '#EFF6FF' : leida ? 'var(--color-surface)' : '#F8FAFF',
    borderLeft: selected ? '3px solid var(--color-primary)' : '3px solid transparent',
    transition: 'background 0.1s',
  }),
  itemHeader:  { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' },
  itemTitle:   (leida) => ({ fontSize: '0.83rem', fontWeight: leida ? 400 : 600, color: 'var(--color-text)', lineHeight: 1.4, flex: 1 }),
  badge:       (leida) => ({
    flexShrink: 0,
    display: 'inline-block',
    padding: '1px 7px',
    borderRadius: 20,
    fontSize: '0.68rem',
    fontWeight: 600,
    background: leida ? '#F3F4F6' : '#EFF6FF',
    color:      leida ? '#6B7280' : 'var(--color-primary)',
  }),
  itemDate:    { fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: 4 },
  empty:       { textAlign: 'center', padding: '2.5rem', color: 'var(--color-text-muted)', fontSize: '0.85rem' },
  // Columna derecha
  right:       { flex: 1, background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  detailScroll:{ flex: 1, overflowY: 'auto', padding: '1.25rem' },
  placeholder: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.88rem' },
  // Detalle
  detTitle:    { fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1rem' },
  metaGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', marginBottom: '1rem' },
  metaLabel:   { fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600, marginBottom: 1 },
  metaValue:   { fontSize: '0.85rem', color: 'var(--color-text)' },
  divider:     { border: 'none', borderTop: '1px solid #E5E7EB', margin: '0.75rem 0' },
  mensaje:     { fontSize: '0.88rem', color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  verBtn:      { marginTop: '1.25rem', display: 'inline-block', padding: '0.5rem 1.1rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Detalle ───────────────────────────────────────────────────────────────────

function Detalle({ notif, onVerReporte }) {
  const ciudadano = notif.ciudadano_nombre
    ? `${notif.ciudadano_nombre} ${notif.ciudadano_apellido || ''}`.trim()
    : null;
  const autoridad = notif.autoridad_nombre
    ? `${notif.autoridad_nombre} ${notif.autoridad_apellido || ''}`.trim()
    : null;

  const hasMeta = notif.reporte_id && (
    notif.categoria_nombre || notif.subcategoria_nombre || ciudadano || autoridad
  );

  return (
    <div style={S.detailScroll}>
      <div style={S.detTitle}>{notif.titulo}</div>

      {hasMeta && (
        <>
          <div style={S.metaGrid}>
            {notif.categoria_nombre && (
              <div>
                <div style={S.metaLabel}>Categoría</div>
                <div style={S.metaValue}>{notif.categoria_nombre}</div>
              </div>
            )}
            {notif.subcategoria_nombre && (
              <div>
                <div style={S.metaLabel}>Subcategoría</div>
                <div style={S.metaValue}>{notif.subcategoria_nombre}</div>
              </div>
            )}
            {ciudadano && (
              <div>
                <div style={S.metaLabel}>Ciudadano</div>
                <div style={S.metaValue}>{ciudadano}</div>
              </div>
            )}
            {autoridad && (
              <div>
                <div style={S.metaLabel}>Autoridad</div>
                <div style={S.metaValue}>{autoridad}</div>
              </div>
            )}
          </div>
          <hr style={S.divider} />
        </>
      )}

      <div style={S.mensaje}>{notif.mensaje}</div>

      {notif.reporte_id && (
        <button style={S.verBtn} onClick={() => onVerReporte(notif.reporte_id)}>
          Ver reporte
        </button>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Notifications() {
  const navigate = useNavigate();
  const [notifs,   setNotifs]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/notifications')
      .then(({ data }) => {
        // Ya viene ordenado: pendientes primero, luego leídas por fecha desc
        setNotifs(data.notificaciones || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSelect(notif) {
    setSelected(notif);
    if (!notif.leida) {
      try {
        await api.patch(`/notifications/${notif.id}/read`);
        setNotifs(prev =>
          prev.map(n => n.id === notif.id ? { ...n, leida: true } : n)
        );
        setSelected(prev => prev?.id === notif.id ? { ...prev, leida: true } : prev);
      } catch { /* silencioso */ }
    }
  }

  function handleVerReporte(reporteId) {
    navigate(`/superadmin/review/escalado/${reporteId}`);
  }

  return (
    <SuperadminLayout>
      <div style={S.page}>
        <h2 style={S.title}>Notificaciones</h2>

        <div style={S.body}>
          {/* Columna izquierda */}
          <div style={S.left}>
            <div style={S.listScroll}>
              {loading ? (
                <div style={S.empty}>Cargando…</div>
              ) : notifs.length === 0 ? (
                <div style={S.empty}>No hay notificaciones</div>
              ) : (
                notifs.map(n => (
                  <div
                    key={n.id}
                    style={S.item(selected?.id === n.id, n.leida)}
                    onClick={() => handleSelect(n)}
                  >
                    <div style={S.itemHeader}>
                      <span style={S.itemTitle(n.leida)}>{n.titulo}</span>
                      <span style={S.badge(n.leida)}>{n.leida ? 'Leído' : 'Pendiente'}</span>
                    </div>
                    <div style={S.itemDate}>{fmtDate(n.created_at)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Columna derecha */}
          <div style={S.right}>
            {selected
              ? <Detalle notif={selected} onVerReporte={handleVerReporte} />
              : <div style={S.placeholder}>Selecciona una notificación</div>
            }
          </div>
        </div>
      </div>
    </SuperadminLayout>
  );
}
