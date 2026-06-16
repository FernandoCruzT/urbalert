import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiChevronDown } from 'react-icons/fi';
import SuperadminLayout from '../../layouts/SuperadminLayout';
import api from '../../services/api';

// ── Estilos ───────────────────────────────────────────────────────────────────

const S = {
  page:       { padding: '0.85rem 1rem', height: '100%', overflowY: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '1rem' },
  header:     { display: 'flex', alignItems: 'baseline', gap: '0.6rem', flexWrap: 'wrap' },
  title:      { fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary)' },
  subtitle:   { fontSize: '0.78rem', color: 'var(--color-text-muted)' },
  backBtn:    { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.7rem', fontSize: '0.82rem', color: 'var(--color-text)', cursor: 'pointer', fontFamily: 'inherit' },
  // Card superior
  card:       { background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '1rem 1.2rem', display: 'flex', gap: '1.2rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  avatar:     { width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.3rem', fontWeight: 700, flexShrink: 0 },
  info:       { flex: 1, minWidth: 180 },
  name:       { fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' },
  meta:       { fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.6 },
  rolBadge:   { display: 'inline-block', padding: '1px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600, background: '#EFF6FF', color: 'var(--color-primary)', marginTop: 4 },
  actions:    { display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  // Botones de acción
  btn:        { padding: '0.42rem 0.8rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', background: '#fff', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' },
  btnDanger:  { padding: '0.42rem 0.8rem', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)', background: '#FEF2F2', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' },
  btnPrimary: { padding: '0.42rem 0.8rem', border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--color-primary)', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', color: '#fff', fontWeight: 600 },
  btnSecondary:{ padding: '0.42rem 0.8rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', background: '#fff', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--color-text)' },
  // Dropdown
  dropWrap:   { position: 'relative' },
  dropMenu:   { position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-sm)', zIndex: 10, minWidth: 160 },
  dropItem:   (active) => ({ padding: '0.45rem 0.85rem', fontSize: '0.82rem', cursor: 'pointer', background: active ? '#EFF6FF' : 'transparent', color: active ? 'var(--color-primary)' : 'var(--color-text)' }),
  // Tabla inferior
  tableWrap:  { background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' },
  table:      { width: '100%', borderCollapse: 'collapse' },
  th:         { textAlign: 'left', padding: '0.55rem 0.85rem', fontSize: '0.72rem', color: 'var(--color-text-muted)', borderBottom: '2px solid #E5E7EB', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, background: 'var(--color-surface)' },
  td:         { padding: '0.65rem 0.85rem', fontSize: '0.85rem', color: 'var(--color-text)', borderBottom: '1px solid #F3F4F6' },
  // Estado badge
  badge:      (estado) => {
    const map = {
      activa:      { bg: '#E8F5E9', color: '#2E7D32' },
      advertida:   { bg: '#FFFDE7', color: '#F57F17' },
      restringida: { bg: '#FFF3E0', color: '#E65100' },
      suspendida:  { bg: '#FFEBEE', color: '#C62828' },
    };
    const b = map[estado] || { bg: '#F3F4F6', color: '#6B7280' };
    return { display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: b.bg, color: b.color, textTransform: 'capitalize' };
  },
  // Modal
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal:      { background: '#fff', borderRadius: 'var(--radius-md)', padding: '1.5rem', width: '100%', maxWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  modalTitle: { fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '0.75rem' },
  modalText:  { fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '1rem', lineHeight: 1.5 },
  modalInput: { width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '1rem' },
  modalSelect:{ width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '1rem', background: '#fff' },
  modalRow:   { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' },
  // Loading / error
  centered:   { textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)', fontSize: '0.88rem' },
  errBanner:  { padding: '0.6rem 0.75rem', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)', color: '#B91C1C', fontSize: '0.83rem' },
  sucBanner:  { padding: '0.6rem 0.75rem', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 'var(--radius-sm)', color: '#166534', fontSize: '0.83rem' },
};

const FECHAS_OPTS = [
  { label: 'Última semana', value: 'semana' },
  { label: 'Último mes',    value: 'mes' },
  { label: 'Último año',    value: 'anio' },
  { label: 'Todo',          value: 'todo' },
];

// ── Dropdown genérico ─────────────────────────────────────────────────────────

function Dropdown({ label, options, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const current = options.find(o => o.value === selected);

  return (
    <div style={S.dropWrap} ref={ref}>
      <button style={S.btn} onClick={() => setOpen(v => !v)}>
        {current?.label || label} <FiChevronDown size={12} />
      </button>
      {open && (
        <div style={S.dropMenu}>
          {options.map(o => (
            <div
              key={o.value}
              style={S.dropItem(selected === o.value)}
              onClick={() => { onSelect(o.value); setOpen(false); }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Modal genérico ────────────────────────────────────────────────────────────

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

// ── Perfil Ciudadano ──────────────────────────────────────────────────────────

function EditCiudadano({ usuarioId }) {
  const navigate = useNavigate();
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [notice,      setNotice]      = useState('');
  const [fechaFiltro, setFechaFiltro] = useState('todo');
  const [showSuspend, setShowSuspend] = useState(false);
  const [busy,        setBusy]        = useState(false);

  useEffect(() => {
    api.get(`/users/citizen/${usuarioId}`)
      .then(({ data: d }) => setData(d.ciudadano))
      .catch(() => setError('No se pudo cargar el perfil del ciudadano'))
      .finally(() => setLoading(false));
  }, [usuarioId]);

  async function handleSuspend() {
    setBusy(true);
    try {
      await api.patch(`/users/citizen/${usuarioId}/suspend`);
      setData(prev => ({ ...prev, estado_cuenta: 'suspendida' }));
      setNotice('Cuenta suspendida correctamente');
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al suspender la cuenta');
    } finally {
      setBusy(false);
      setShowSuspend(false);
    }
  }

  if (loading) return <div style={S.centered}>Cargando…</div>;
  if (error && !data) return <div style={{ ...S.centered, color: '#B91C1C' }}>{error}</div>;

  const initials = data
    ? `${data.nombre?.[0] || ''}${data.apellido?.[0] || ''}`.toUpperCase()
    : '?';

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h2 style={S.title}>Edición de perfiles</h2>
        <span style={S.subtitle}>(previa selección en búsqueda)</span>
        <button style={S.backBtn} onClick={() => navigate('/superadmin/users')}>
          <FiChevronLeft size={13} /> Regresar
        </button>
      </div>

      {notice && <div style={S.sucBanner}>{notice}</div>}
      {error  && <div style={S.errBanner}>{error}</div>}

      {/* Card */}
      <div style={S.card}>
        <div style={S.avatar}>{initials}</div>
        <div style={S.info}>
          <div style={S.name}>{data.nombre} {data.apellido}</div>
          <div style={S.meta}>
            {data.email}<br />
            {data.telefono || 'Sin teléfono'}
          </div>
          <span style={S.rolBadge}>Ciudadano</span>
        </div>
        <div style={S.actions}>
          <Dropdown
            label="Fechas"
            options={FECHAS_OPTS}
            selected={fechaFiltro}
            onSelect={setFechaFiltro}
          />
          {data.estado_cuenta !== 'suspendida' && (
            <button style={S.btnDanger} onClick={() => setShowSuspend(true)}>
              Desactivar cuenta
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Estado de cuenta</th>
              <th style={S.th}>Reportes falsos</th>
              <th style={S.th}>Reportes abiertos</th>
              <th style={S.th}>Reportes cerrados</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={S.td}><span style={S.badge(data.estado_cuenta)}>{data.estado_cuenta}</span></td>
              <td style={{ ...S.td, textAlign: 'center' }}>
                {data.reportes_falsos > 0
                  ? <span style={{ color: '#C62828', fontWeight: 600 }}>{data.reportes_falsos}</span>
                  : 0}
              </td>
              <td style={{ ...S.td, textAlign: 'center' }}>{data.reportes_abiertos ?? 0}</td>
              <td style={{ ...S.td, textAlign: 'center' }}>{data.reportes_cerrados ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Modal suspender */}
      {showSuspend && (
        <Modal title="Desactivar cuenta" onClose={() => setShowSuspend(false)}>
          <p style={S.modalText}>
            ¿Estás seguro que deseas suspender la cuenta de <strong>{data.nombre} {data.apellido}</strong>?
            El ciudadano no podrá acceder al sistema ni crear reportes.
          </p>
          <div style={S.modalRow}>
            <button style={S.btnSecondary} onClick={() => setShowSuspend(false)}>Cancelar</button>
            <button style={{ ...S.btnPrimary, background: '#B91C1C' }} onClick={handleSuspend} disabled={busy}>
              {busy ? 'Procesando…' : 'Suspender'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Perfil Autoridad ──────────────────────────────────────────────────────────

function EditAutoridad({ autoridadId }) {
  const navigate = useNavigate();
  const MUNICIPIOS = ['Guadalajara', 'Zapopan', 'Tonalá', 'San Pedro Tlaquepaque'];

  const [data,          setData]          = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [notice,        setNotice]        = useState('');
  const [fechaFiltro,   setFechaFiltro]   = useState('todo');
  const [modal,         setModal]         = useState(null); // 'depto' | 'municipio' | 'borrar'
  const [deptoInput,    setDeptoInput]    = useState('');
  const [municipioSel,  setMunicipioSel]  = useState('');
  const [busy,          setBusy]          = useState(false);

  useEffect(() => {
    api.get('/users/authorities').then(authRes => {
      const found = (authRes.data.autoridades || []).find(a => String(a.id) === String(autoridadId));
      if (!found) { setError('Autoridad no encontrada'); return; }
      setData(found);
      setDeptoInput(found.departamento || '');
      setMunicipioSel(found.municipio || '');
    }).catch(() => setError('No se pudo cargar el perfil de la autoridad'))
      .finally(() => setLoading(false));
  }, [autoridadId]);

  async function handleUpdateDepto() {
    setBusy(true);
    try {
      await api.patch(`/users/authority/${autoridadId}`, { departamento: deptoInput });
      setData(prev => ({ ...prev, departamento: deptoInput }));
      setNotice('Departamento actualizado correctamente');
      setModal(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al actualizar el departamento');
    } finally { setBusy(false); }
  }

  async function handleUpdateMunicipio() {
    setBusy(true);
    try {
      await api.patch(`/users/authority/${autoridadId}`, { municipio: municipioSel });
      setData(prev => ({ ...prev, municipio: municipioSel }));
      setNotice('Municipio actualizado correctamente');
      setModal(null);
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al actualizar el municipio');
    } finally { setBusy(false); }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await api.delete(`/users/authority/${autoridadId}`);
      navigate('/superadmin/users');
    } catch (err) {
      setError(err?.response?.data?.message || 'Error al borrar la cuenta');
      setModal(null);
    } finally { setBusy(false); }
  }

  if (loading) return <div style={S.centered}>Cargando…</div>;
  if (error && !data) return <div style={{ ...S.centered, color: '#B91C1C' }}>{error}</div>;

  const initials = data
    ? `${data.nombre?.[0] || ''}${data.apellido?.[0] || ''}`.toUpperCase()
    : '?';

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <h2 style={S.title}>Edición de perfiles</h2>
        <span style={S.subtitle}>(previa selección en búsqueda)</span>
        <button style={S.backBtn} onClick={() => navigate('/superadmin/users')}>
          <FiChevronLeft size={13} /> Regresar
        </button>
      </div>

      {notice && <div style={S.sucBanner}>{notice}</div>}
      {error  && <div style={S.errBanner}>{error}</div>}

      {/* Card */}
      <div style={S.card}>
        <div style={S.avatar}>{initials}</div>
        <div style={S.info}>
          <div style={S.name}>{data.nombre} {data.apellido}</div>
          <div style={S.meta}>
            {data.email}<br />
            {data.telefono || 'Sin teléfono'}
          </div>
          <span style={S.rolBadge}>Autoridad</span>
        </div>
        <div style={S.actions}>
          <Dropdown
            label="Fechas"
            options={FECHAS_OPTS}
            selected={fechaFiltro}
            onSelect={setFechaFiltro}
          />
          <button style={S.btn} onClick={() => { setDeptoInput(data.departamento || ''); setModal('depto'); }}>
            Cambiar departamento
          </button>
          <button style={S.btn} onClick={() => { setMunicipioSel(data.municipio || ''); setModal('municipio'); }}>
            Cambiar municipio
          </button>
          <button style={S.btnDanger} onClick={() => setModal('borrar')}>
            Borrar cuenta
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Categoría</th>
              <th style={S.th}>Municipio</th>
              <th style={S.th}>Departamento</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Carga</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Reportes activos</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={S.td}>{data.categoria_nombre || '—'}</td>
              <td style={S.td}>{data.municipio || '—'}</td>
              <td style={S.td}>{data.departamento || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
              <td style={{ ...S.td, textAlign: 'center' }}>
                {data.carga_ponderada != null ? Number(data.carga_ponderada).toFixed(1) : '—'}
              </td>
              <td style={{ ...S.td, textAlign: 'center' }}>{data.reportes_activos ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Modal departamento */}
      {modal === 'depto' && (
        <Modal title="Cambiar departamento" onClose={() => setModal(null)}>
          <input
            style={S.modalInput}
            placeholder="Nombre del departamento"
            value={deptoInput}
            onChange={e => setDeptoInput(e.target.value)}
            autoFocus
          />
          <div style={S.modalRow}>
            <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button>
            <button style={S.btnPrimary} onClick={handleUpdateDepto} disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal municipio */}
      {modal === 'municipio' && (
        <Modal title="Cambiar municipio" onClose={() => setModal(null)}>
          <select
            style={S.modalSelect}
            value={municipioSel}
            onChange={e => setMunicipioSel(e.target.value)}
          >
            <option value="">— Selecciona un municipio —</option>
            {MUNICIPIOS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <div style={S.modalRow}>
            <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button>
            <button style={S.btnPrimary} onClick={handleUpdateMunicipio} disabled={busy || !municipioSel}>
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal borrar */}
      {modal === 'borrar' && (
        <Modal title="Borrar cuenta" onClose={() => setModal(null)}>
          <p style={S.modalText}>
            ¿Estás seguro que deseas borrar la cuenta de <strong>{data.nombre} {data.apellido}</strong>?
            Los reportes activos serán liberados para reasignación automática.
          </p>
          <div style={S.modalRow}>
            <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancelar</button>
            <button style={{ ...S.btnPrimary, background: '#B91C1C' }} onClick={handleDelete} disabled={busy}>
              {busy ? 'Procesando…' : 'Aceptar'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function EditProfile() {
  const { tipo, id } = useParams();

  return (
    <SuperadminLayout>
      {tipo === 'ciudadano'
        ? <EditCiudadano usuarioId={id} />
        : <EditAutoridad autoridadId={id} />
      }
    </SuperadminLayout>
  );
}
