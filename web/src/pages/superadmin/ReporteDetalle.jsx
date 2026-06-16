import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import SuperadminLayout from '../../layouts/SuperadminLayout';
import api from '../../services/api';

// ── Colores ───────────────────────────────────────────────────────────────────

const ESTADO_BADGE = {
  enviado:       { bg: '#EFF6FF', color: '#1D4ED8' },
  en_validacion: { bg: '#E0F2FE', color: '#0369A1' },
  en_revision:   { bg: '#FFFBEB', color: '#92400E' },
  pendiente:     { bg: '#FFF7ED', color: '#C2410C' },
  asignado:      { bg: '#EDE9FE', color: '#6D28D9' },
  en_proceso:    { bg: '#FDF4FF', color: '#9333EA' },
  resuelto:      { bg: '#ECFDF5', color: '#065F46' },
  cerrado:       { bg: '#F0FDF4', color: '#166534' },
};

const URGENCIA_BADGE = {
  alto:  { bg: '#FEE2E2', color: '#B91C1C' },
  medio: { bg: '#FEF3C7', color: '#92400E' },
  bajo:  { bg: '#D1FAE5', color: '#065F46' },
};

// ── Estilos ───────────────────────────────────────────────────────────────────

const S = {
  page:     { padding: '1rem 1.25rem', overflowY: 'auto', height: '100%', boxSizing: 'border-box' },
  topbar:   { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.1rem', flexWrap: 'wrap' },
  backBtn:  {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    background: 'none', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)',
    padding: '0.38rem 0.75rem', cursor: 'pointer', fontSize: '0.82rem',
    color: 'var(--color-text)', fontFamily: 'inherit', flexShrink: 0,
  },
  title:    { fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-primary)', flex: 1 },
  badge:    (c) => ({
    display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: 20,
    fontSize: '0.72rem', fontWeight: 700, background: c.bg, color: c.color,
    textTransform: 'capitalize', whiteSpace: 'nowrap',
  }),
  cardFull: {
    background: 'var(--color-surface)', borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-sm)', padding: '1rem 1.1rem', marginBottom: '1rem',
  },
  grid2:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' },
  card:     { background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '1rem 1.1rem' },
  secTitle: { fontSize: '0.71rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.65rem' },
  row:      { display: 'flex', gap: '0.4rem', marginBottom: '0.42rem', fontSize: '0.84rem', alignItems: 'flex-start' },
  lbl:      { color: 'var(--color-text-muted)', minWidth: 115, flexShrink: 0, paddingTop: 1 },
  val:      { color: 'var(--color-text)', fontWeight: 500, flex: 1, wordBreak: 'break-word', lineHeight: 1.5 },
  empty:    { fontSize: '0.82rem', color: 'var(--color-text-muted)', fontStyle: 'italic' },
  photos:   { display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.35rem' },
  photo:    { width: 130, height: 95, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '1px solid #E5E7EB' },
  // Timeline
  tl:       { position: 'relative', paddingLeft: '1.6rem', marginTop: '0.15rem' },
  tlLine:   { position: 'absolute', left: '0.45rem', top: 8, bottom: 0, width: 2, background: '#E5E7EB' },
  tlEntry:  { position: 'relative', marginBottom: '1.05rem' },
  tlDot:    { position: 'absolute', left: '-1.6rem', top: 5, width: 10, height: 10, borderRadius: '50%', background: 'var(--color-primary)', border: '2px solid #fff', boxShadow: '0 0 0 2px var(--color-primary)' },
  tlDate:   { fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: 4 },
  tlStates: { display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: 4 },
  tlArrow:  { fontSize: '0.78rem', color: '#9CA3AF' },
  tlObs:    { fontSize: '0.78rem', color: 'var(--color-text)', lineHeight: 1.45, marginTop: 2 },
  tlWho:    { fontSize: '0.69rem', color: 'var(--color-text-muted)', marginTop: 3 },
  // Estados pantalla completa
  loading:  { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--color-text-muted)', fontSize: '0.88rem' },
  errMsg:   { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', color: '#C62828', fontSize: '0.88rem' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function EstadoBadge({ estado }) {
  const c = ESTADO_BADGE[estado] || { bg: '#F3F4F6', color: '#6B7280' };
  return <span style={S.badge(c)}>{estado?.replace(/_/g, ' ') || '—'}</span>;
}

function UrgBadge({ urgencia }) {
  const c = URGENCIA_BADGE[urgencia] || { bg: '#F3F4F6', color: '#6B7280' };
  return <span style={S.badge(c)}>{urgencia || '—'}</span>;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ReporteDetalle() {
  const { reportId } = useParams();
  const navigate     = useNavigate();
  const [reporte,  setReporte]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    api.get(`/reports/${reportId}`)
      .then(({ data }) => setReporte(data.reporte))
      .catch(err => setErrorMsg(err.response?.data?.message || 'Error al cargar el reporte'))
      .finally(() => setLoading(false));
  }, [reportId]);

  const shortId = reporte?.id?.slice(-8).toUpperCase() ?? '';

  return (
    <SuperadminLayout>
      <div style={S.page}>

        {/* ── Topbar ── */}
        <div style={S.topbar}>
          <button style={S.backBtn} onClick={() => navigate('/superadmin/heatmap')}>
            <FiArrowLeft size={14} /> Regresar al mapa
          </button>
          {reporte && (
            <>
              <span style={S.title}>Reporte #{shortId}</span>
              <EstadoBadge estado={reporte.estado} />
              <UrgBadge urgencia={reporte.urgencia} />
            </>
          )}
        </div>

        {loading  && <div style={S.loading}>Cargando reporte…</div>}
        {errorMsg && <div style={S.errMsg}>{errorMsg}</div>}

        {reporte && (
          <>
            {/* ── Datos del reporte ── */}
            <div style={S.cardFull}>
              <div style={S.secTitle}>Datos del reporte</div>
              <div style={S.row}>
                <span style={S.lbl}>Descripción</span>
                <span style={{ ...S.val, whiteSpace: 'pre-wrap' }}>{reporte.descripcion || '—'}</span>
              </div>
              <div style={S.row}>
                <span style={S.lbl}>Categoría</span>
                <span style={S.val}>{reporte.categoria_nombre || '—'}</span>
              </div>
              <div style={S.row}>
                <span style={S.lbl}>Subcategoría</span>
                <span style={S.val}>{reporte.subcategoria_nombre || '—'}</span>
              </div>
              <div style={S.row}>
                <span style={S.lbl}>Colonia</span>
                <span style={S.val}>{reporte.colonia || '—'}</span>
              </div>
              {reporte.calle && (
                <div style={S.row}>
                  <span style={S.lbl}>Dirección</span>
                  <span style={S.val}>{reporte.calle}{reporte.numero ? ` #${reporte.numero}` : ''}</span>
                </div>
              )}
              <div style={S.row}>
                <span style={S.lbl}>Creado</span>
                <span style={S.val}>{fmtDate(reporte.created_at)}</span>
              </div>
              <div style={S.row}>
                <span style={S.lbl}>Última actualiz.</span>
                <span style={S.val}>{fmtDate(reporte.updated_at)}</span>
              </div>
            </div>

            {/* ── Ciudadano y Autoridad ── */}
            <div style={S.grid2}>
              <div style={S.card}>
                <div style={S.secTitle}>Ciudadano</div>
                {reporte.ciudadano ? (
                  <>
                    <div style={S.row}>
                      <span style={S.lbl}>Nombre</span>
                      <span style={S.val}>{reporte.ciudadano.nombre} {reporte.ciudadano.apellido}</span>
                    </div>
                    <div style={S.row}>
                      <span style={S.lbl}>E-mail</span>
                      <span style={S.val}>{reporte.ciudadano.email}</span>
                    </div>
                    <div style={S.row}>
                      <span style={S.lbl}>Teléfono</span>
                      <span style={S.val}>{reporte.ciudadano.telefono || '—'}</span>
                    </div>
                    <div style={S.row}>
                      <span style={S.lbl}>Estado cuenta</span>
                      <span style={S.val}>{reporte.ciudadano.estado_cuenta}</span>
                    </div>
                  </>
                ) : (
                  <span style={S.empty}>Sin datos del ciudadano</span>
                )}
              </div>

              <div style={S.card}>
                <div style={S.secTitle}>Autoridad asignada</div>
                {reporte.autoridad ? (
                  <>
                    <div style={S.row}>
                      <span style={S.lbl}>Nombre</span>
                      <span style={S.val}>{reporte.autoridad.nombre} {reporte.autoridad.apellido}</span>
                    </div>
                    <div style={S.row}>
                      <span style={S.lbl}>Departamento</span>
                      <span style={S.val}>{reporte.autoridad.departamento || '—'}</span>
                    </div>
                    <div style={S.row}>
                      <span style={S.lbl}>Municipio</span>
                      <span style={S.val}>{reporte.autoridad.municipio || '—'}</span>
                    </div>
                    <div style={S.row}>
                      <span style={S.lbl}>Carga</span>
                      <span style={S.val}>
                        {reporte.autoridad.carga_ponderada != null
                          ? Number(reporte.autoridad.carga_ponderada).toFixed(1)
                          : '—'}
                      </span>
                    </div>
                  </>
                ) : (
                  <span style={S.empty}>Sin autoridad asignada</span>
                )}
              </div>
            </div>

            {/* ── Fotos ── */}
            {reporte.fotos?.length > 0 && (
              <div style={S.cardFull}>
                <div style={S.secTitle}>Fotos ({reporte.fotos.length})</div>
                <div style={S.photos}>
                  {reporte.fotos.map(f => (
                    <img
                      key={f.id}
                      src={f.url_cloudinary}
                      alt="Foto del reporte"
                      style={S.photo}
                      onClick={() => window.open(f.url_cloudinary, '_blank')}
                      title="Abrir en nueva pestaña"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Historial de estados ── */}
            <div style={S.cardFull}>
              <div style={S.secTitle}>
                Historial de estados ({reporte.historial?.length ?? 0} evento{reporte.historial?.length !== 1 ? 's' : ''})
              </div>
              {!reporte.historial?.length && <span style={S.empty}>Sin historial registrado</span>}
              {reporte.historial?.length > 0 && (
                <div style={S.tl}>
                  <div style={S.tlLine} />
                  {reporte.historial.map(h => (
                    <div key={h.id} style={S.tlEntry}>
                      <div style={S.tlDot} />
                      <div style={S.tlDate}>{fmtDate(h.created_at)}</div>
                      <div style={S.tlStates}>
                        <EstadoBadge estado={h.estado_anterior} />
                        <span style={S.tlArrow}>→</span>
                        <EstadoBadge estado={h.estado_nuevo} />
                      </div>
                      {h.observacion && <div style={S.tlObs}>{h.observacion}</div>}
                      <div style={S.tlWho}>
                        {h.rol_usuario === 'sistema'
                          ? 'Sistema automático'
                          : h.usuario_nombre
                            ? `${h.usuario_nombre} ${h.usuario_apellido || ''} · ${h.rol_usuario}`
                            : h.rol_usuario}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </SuperadminLayout>
  );
}
