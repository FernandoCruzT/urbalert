import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { FiChevronLeft, FiImage, FiX, FiChevronDown } from 'react-icons/fi';
import AuthorityLayout from '../../layouts/AuthorityLayout';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// ── Semáforo: solo 3 estados accionables ──────────────────────────────────────

const SEMAFORO = [
  { key: 'en_proceso', label: 'En proceso', color: '#2563EB', bg: '#EFF6FF' },
  { key: 'resuelto',   label: 'Resuelto',   color: '#16A34A', bg: '#F0FDF4' },
  { key: 'cerrado',    label: 'Cerrado',    color: '#374151', bg: '#F3F4F6' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function initials(user) {
  if (!user) return '?';
  return `${user.nombre?.[0] || ''}${user.apellido?.[0] || ''}`.toUpperCase();
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const S = {
  page:         { display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
  // Header
  header:       { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 1rem', borderBottom: '1px solid #E5E7EB', flexShrink: 0 },
  backBtn:      { background: 'none', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.65rem', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 },
  spacer:       { flex: 1 },
  headerBtn:    { display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', background: '#fff', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text)', whiteSpace: 'nowrap', flexShrink: 0 },
  avatar:       { width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.82rem', flexShrink: 0 },
  // Dropdown
  dropWrap:     { position: 'relative' },
  dropMenu:     { position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', zIndex: 50, minWidth: 260, maxHeight: 280, overflowY: 'auto' },
  dropItem:     { padding: '0.55rem 0.85rem', borderBottom: '1px solid #F3F4F6', fontSize: '0.82rem', color: 'var(--color-text)' },
  dropEmpty:    { padding: '0.75rem 0.85rem', fontSize: '0.82rem', color: 'var(--color-text-muted)', textAlign: 'center' },
  // Body
  body:         { display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' },
  left:         { width: '55%', overflowY: 'auto', padding: '1rem', borderRight: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '1rem' },
  right:        { flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' },
  // Secciones
  section:      { background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '0.85rem 1rem' },
  secTitle:     { fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.5rem' },
  secText:      { fontSize: '0.88rem', color: 'var(--color-text)', lineHeight: 1.6 },
  metaRow:      { display: 'flex', gap: '1.5rem', flexWrap: 'wrap' },
  metaItem:     { flex: 1, minWidth: 90 },
  metaLabel:    { fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  metaValue:    { fontSize: '0.84rem', color: 'var(--color-text)' },
  // Fotos
  photoGrid:    { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  thumb:        { width: 68, height: 68, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '1px solid #E5E7EB' },
  emptyPhoto:   { display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.82rem' },
  // Semáforo
  semaforoRow:  { display: 'flex', gap: '0.5rem' },
  semaBtn:      (active, color, bg, disabled) => ({
    flex: 1, padding: '0.55rem 0', border: active ? `2px solid ${color}` : '1px solid #D1D5DB',
    borderRadius: 'var(--radius-sm)', background: active ? bg : '#fff',
    color: active ? color : 'var(--color-text-muted)', fontWeight: active ? 700 : 400,
    fontSize: '0.82rem', cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'inherit', transition: 'all 0.15s', opacity: disabled && !active ? 0.45 : 1,
    textAlign: 'center',
  }),
  // Última actualización
  updateText:   { fontSize: '0.78rem', color: 'var(--color-text-muted)' },
  // Urgencia badge
  urgBadge:     (u) => {
    const map = { alta: { bg: '#FEF2F2', c: '#B91C1C' }, media: { bg: '#FFFBEB', c: '#D97706' }, baja: { bg: '#F0FDF4', c: '#166534' } };
    const b = map[u] || { bg: '#F3F4F6', c: '#374151' };
    return { display: 'inline-block', padding: '1px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, background: b.bg, color: b.c, textTransform: 'capitalize' };
  },
  // Modal
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal:        { background: '#fff', borderRadius: 'var(--radius-md)', padding: '1.5rem', width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  modalTitle:   { fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.75rem' },
  modalTextarea:{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '1rem', height: 80, resize: 'vertical' },
  modalRow:     { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' },
  btnPrimary:   { padding: '0.45rem 1rem', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' },
  btnSecondary: { padding: '0.45rem 1rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', background: '#fff', color: 'var(--color-text)', fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' },
  // Lightbox
  lightbox:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  lbClose:      { position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
  // Notice banner (éxito, solo en right)
  sucBanner:    { padding: '0.45rem 0.7rem', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 'var(--radius-sm)', color: '#166534', fontSize: '0.8rem' },
  // Botón escalar
  escalarBtn:   { width: '100%', padding: '0.6rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', background: '#fff', color: 'var(--color-text)', fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'inherit' },
  centered:     { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', fontSize: '0.88rem' },
};

// ── Dropdown del header ───────────────────────────────────────────────────────

function HeaderDropdown({ label, count, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div style={S.dropWrap} ref={ref}>
      <button style={S.headerBtn} onClick={() => setOpen(o => !o)}>
        {label} <strong>{count}</strong> <FiChevronDown size={11} />
      </button>
      {open && <div style={S.dropMenu}>{children}</div>}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }) {
  return (
    <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={S.modal}>
        <div style={S.modalTitle}>{title}</div>
        {children}
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function ReportDetail() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const location     = useLocation();
  const { user }     = useAuth();
  const backTo       = location.state?.from || '/authority/in-progress';

  const [reporte,   setReporte]   = useState(null);
  const [fotos,     setFotos]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [children,  setChildren]  = useState([]);
  const [notifs,    setNotifs]    = useState([]);
  const [notice,    setNotice]    = useState('');
  const [busy,      setBusy]      = useState(false);
  const [modal,     setModal]     = useState(null); // 'confirmar' | 'actualizar' | 'cerrar' | 'escalar'
  const [motivo,    setMotivo]    = useState('');
  const [nota,      setNota]      = useState('');
  const [pendingEstado, setPendingEstado] = useState(null);
  const [lightbox,  setLightbox]  = useState(null);

  useEffect(() => {
    Promise.all([
      api.get(`/reports/${id}`),
      api.get(`/reports/${id}/photos`),
      api.get(`/reports/${id}/children`),
      api.get('/notifications'),
    ]).then(([rRes, fRes, cRes, nRes]) => {
      setReporte(rRes.data.reporte);
      setFotos(fRes.data.fotos || []);
      setChildren(cRes.data.reportes || []);
      const allNotifs = nRes.data.notificaciones || [];
      setNotifs(allNotifs.filter(n => String(n.reporte_id) === String(id)));
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function updateStatus(estado, extra = {}) {
    setBusy(true);
    try {
      await api.patch(`/reports/${id}/status`, { estado, ...extra });
      setReporte(prev => ({ ...prev, estado, updated_at: new Date().toISOString() }));
      setNotice(`Estado actualizado a "${estado.replace('_', ' ')}"`);
      setModal(null);
    } catch (err) {
      setNotice('');
      alert(err?.response?.data?.message || 'Error al actualizar el estado');
    } finally { setBusy(false); }
  }

  async function handleEscalar() {
    if (!motivo.trim()) return;
    setBusy(true);
    try {
      await api.post(`/assignment/escalate/${id}`, { motivo });
      setReporte(prev => ({ ...prev, estado: 'en_revision' }));
      setNotice('Reporte escalado a revisión del superadmin');
      setModal(null);
    } catch (err) {
      alert(err?.response?.data?.message || 'Error al escalar el reporte');
    } finally { setBusy(false); }
  }

  if (loading) {
    return <AuthorityLayout><div style={S.centered}>Cargando…</div></AuthorityLayout>;
  }

  const esPropietario = reporte && reporte.autoridad_id === user.profileId;
  const canEscalar = reporte && esPropietario && ['asignado', 'en_proceso'].includes(reporte.estado);

  function canTransition(buttonKey, estado) {
    if (!estado || estado === 'cerrado') return false;
    if (buttonKey === 'en_proceso' && estado === 'en_proceso') return true; // nota de actualización
    if (buttonKey === estado) return false;
    if (buttonKey === 'cerrado') return true;
    if (buttonKey === 'en_proceso') return estado === 'asignado';
    if (buttonKey === 'resuelto')   return estado === 'en_proceso';
    return false;
  }

  return (
    <AuthorityLayout>
      <div style={S.page}>

        {/* ── Header ── */}
        <div style={S.header}>
          <button style={S.backBtn} onClick={() => navigate(backTo)}>
            <FiChevronLeft size={13} /> Regresar
          </button>

          <div style={S.spacer} />

          {/* Contador */}
          <HeaderDropdown label="Contador" count={children.length}>
            {children.length === 0
              ? <div style={S.dropEmpty}>Sin confirmaciones</div>
              : children.map(c => (
                <div key={c.id} style={S.dropItem}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{c.categoria_nombre} · {c.subcategoria_nombre}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {c.descripcion?.slice(0, 70)}{c.descripcion?.length > 70 ? '…' : ''}
                  </div>
                </div>
              ))
            }
          </HeaderDropdown>

          {/* Notificaciones */}
          <HeaderDropdown label="Notificaciones" count={notifs.length}>
            {notifs.length === 0
              ? <div style={S.dropEmpty}>Sin notificaciones para este reporte</div>
              : notifs.map(n => (
                <div key={n.id} style={S.dropItem}>
                  <div style={{ fontWeight: n.leida ? 400 : 600, fontSize: '0.82rem' }}>{n.titulo}</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {n.mensaje?.slice(0, 80)}{n.mensaje?.length > 80 ? '…' : ''}
                  </div>
                </div>
              ))
            }
          </HeaderDropdown>

          {/* Avatar */}
          <div style={S.avatar}>{initials(user)}</div>
        </div>

        {/* ── Body ── */}
        <div style={S.body}>

          {/* Columna izquierda */}
          <div style={S.left}>

            {/* Categoría / Subcategoría */}
            {reporte && (
              <div style={S.section}>
                <div style={S.secTitle}>Clasificación</div>
                <div style={S.metaRow}>
                  <div style={S.metaItem}>
                    <div style={S.metaLabel}>Categoría</div>
                    <div style={S.metaValue}>{reporte.categoria_nombre}</div>
                  </div>
                  <div style={S.metaItem}>
                    <div style={S.metaLabel}>Subcategoría</div>
                    <div style={S.metaValue}>{reporte.subcategoria_nombre}</div>
                  </div>
                  {reporte.urgencia && (
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <span style={S.urgBadge(reporte.urgencia)}>{reporte.urgencia}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ubicación */}
            {reporte && (
              <div style={S.section}>
                <div style={S.secTitle}>Ubicación</div>
                <div style={S.metaRow}>
                  <div style={S.metaItem}>
                    <div style={S.metaLabel}>Colonia</div>
                    <div style={S.metaValue}>{reporte.colonia || '—'}</div>
                  </div>
                  <div style={S.metaItem}>
                    <div style={S.metaLabel}>Calle</div>
                    <div style={S.metaValue}>{[reporte.calle, reporte.numero].filter(Boolean).join(' ') || '—'}</div>
                  </div>
                  <div style={S.metaItem}>
                    <div style={S.metaLabel}>Precisión GPS</div>
                    <div style={S.metaValue}>
                      {reporte.precision_gps != null ? `${reporte.precision_gps} m` : '—'}
                      {reporte.ubicacion_baja_precision && (
                        <span style={{ color: '#D97706', fontSize: '0.72rem', marginLeft: 5 }}>baja precisión</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Evidencia */}
            <div style={S.section}>
              <div style={S.secTitle}>Evidencia</div>
              {fotos.length === 0
                ? <div style={S.emptyPhoto}><FiImage size={15} /> Sin fotos</div>
                : <div style={S.photoGrid}>
                    {fotos.map(f => (
                      <img
                        key={f.id}
                        src={f.url_cloudinary}
                        alt="evidencia"
                        style={S.thumb}
                        onClick={() => setLightbox(f.url_cloudinary)}
                      />
                    ))}
                  </div>
              }
            </div>

            {/* Semáforo */}
            {reporte && (
              <div style={S.section}>
                <div style={S.secTitle}>Estado</div>
                {esPropietario ? (
                  <>
                    <div style={S.semaforoRow}>
                      {SEMAFORO.map(s => {
                        const isActive = reporte.estado === s.key;
                        const canClick = canTransition(s.key, reporte.estado);
                        const disabled = !canClick;
                        return (
                          <button
                            key={s.key}
                            style={S.semaBtn(isActive, s.color, s.bg, disabled)}
                            disabled={disabled || busy}
                            onClick={() => {
                              if (s.key === 'en_proceso' && reporte.estado === 'en_proceso') { setNota(''); setModal('actualizar'); return; }
                              if (s.key !== 'cerrado') { setPendingEstado(s.key); setModal('confirmar'); return; }
                              if (reporte.estado === 'resuelto') { setPendingEstado('cerrado'); setModal('confirmar'); return; }
                              setMotivo(''); setModal('cerrar');
                            }}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                    {reporte.updated_at && (
                      <div style={{ ...S.updateText, marginTop: '0.5rem' }}>
                        Última actualización: {fmtDate(reporte.updated_at)}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '0.4rem 0' }}>
                    Este reporte fue reasignado o escalado — solo lectura
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Columna derecha */}
          <div style={S.right}>
            {notice && <div style={S.sucBanner}>{notice}</div>}

            {/* Descripción */}
            {reporte && (
              <div style={S.section}>
                <div style={S.secTitle}>Descripción del reporte</div>
                <div style={S.secText}>{reporte.descripcion}</div>
              </div>
            )}

            {/* Escalar */}
            {reporte && esPropietario && (
              <div style={S.section}>
                <div style={S.secTitle}>Acciones</div>
                <button
                  style={S.escalarBtn}
                  disabled={!canEscalar || busy}
                  onClick={() => { setMotivo(''); setModal('escalar'); }}
                >
                  Escalar reporte
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal actualizar (nota en_proceso → en_proceso) */}
      {modal === 'actualizar' && (
        <Modal title="Agregar nota de actualización" onClose={() => setModal(null)}>
          <textarea
            style={S.modalTextarea}
            placeholder="Nota de seguimiento (opcional)"
            value={nota}
            onChange={e => setNota(e.target.value)}
            autoFocus
          />
          <div style={S.modalRow}>
            <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button>
            <button
              style={S.btnPrimary}
              disabled={busy}
              onClick={() => updateStatus('en_proceso', { observacion: nota.trim() || undefined })}
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal confirmar */}
      {modal === 'confirmar' && (
        <Modal title="Confirmar cambio" onClose={() => setModal(null)}>
          <p style={{ fontSize: '0.88rem', color: 'var(--color-text)', marginBottom: '1.25rem' }}>
            ¿Estás seguro de que deseas cambiar el estado a "{SEMAFORO.find(s => s.key === pendingEstado)?.label || pendingEstado}"?
          </p>
          <div style={S.modalRow}>
            <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button>
            <button style={S.btnPrimary} onClick={() => updateStatus(pendingEstado)} disabled={busy}>
              {busy ? 'Guardando…' : 'Confirmar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal cerrar */}
      {modal === 'cerrar' && (
        <Modal title="Cerrar reporte" onClose={() => setModal(null)}>
          <textarea
            style={S.modalTextarea}
            placeholder="Motivo de cierre (obligatorio)"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            autoFocus
          />
          <div style={S.modalRow}>
            <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button>
            <button style={S.btnPrimary} onClick={() => updateStatus('cerrado', { motivo_cierre: motivo })} disabled={!motivo.trim() || busy}>
              {busy ? 'Guardando…' : 'Cerrar reporte'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal escalar */}
      {modal === 'escalar' && (
        <Modal title="Escalar reporte" onClose={() => setModal(null)}>
          <textarea
            style={S.modalTextarea}
            placeholder="Motivo del escalamiento (obligatorio)"
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            autoFocus
          />
          <div style={S.modalRow}>
            <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button>
            <button style={S.btnPrimary} onClick={handleEscalar} disabled={!motivo.trim() || busy}>
              {busy ? 'Procesando…' : 'Escalar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div style={S.lightbox} onClick={() => setLightbox(null)}>
          <button style={S.lbClose} onClick={() => setLightbox(null)}><FiX size={18} /></button>
          <img src={lightbox} alt="foto" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
        </div>
      )}
    </AuthorityLayout>
  );
}
