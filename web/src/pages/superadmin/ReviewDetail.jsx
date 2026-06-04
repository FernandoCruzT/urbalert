import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiMapPin, FiX, FiImage } from 'react-icons/fi';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import SuperadminLayout from '../../layouts/SuperadminLayout';
import api from '../../services/api';

// ── Ciclo de vida completo del reporte ────────────────────────────────────────
const CICLO_ESTADOS = [
  { key: 'enviado',       label: 'Enviado' },
  { key: 'en_validacion', label: 'Validación' },
  { key: 'en_revision',   label: 'Revisión' },
  { key: 'pendiente',     label: 'Pendiente' },
  { key: 'asignado',      label: 'Asignado' },
  { key: 'en_proceso',    label: 'En proceso' },
  { key: 'resuelto',      label: 'Resuelto' },
  { key: 'cerrado',       label: 'Cerrado' },
];

const TIPO_META = {
  escalado:  { label: 'Escalado' },
  ubicacion: { label: 'Mala ubicación' },
  falso:     { label: 'Falso' },
  repetido:  { label: 'Repetido' },
};

const S = {
  page:    { padding: '1.25rem', maxWidth: 1100, margin: '0 auto', height: '100%', overflowY: 'auto', boxSizing: 'border-box' },
  header:  { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' },
  backBtn: { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-secondary)', fontSize: '0.85rem', padding: '4px 8px', borderRadius: 'var(--radius-sm)' },
  title:   { fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-primary)' },
  cols:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' },
  card:    { background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '1.25rem' },
  label:   { fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value:   { fontSize: '0.88rem', color: 'var(--color-text)' },
  catName: { fontSize: '1.3rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: 2 },
  subcat:  { fontSize: '0.88rem', color: 'var(--color-text-muted)', marginBottom: '1rem' },
  divider: { borderTop: '1px solid #F3F4F6', margin: '0.85rem 0' },
  field:   { marginBottom: '0.75rem' },
  actionSection: { background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '0.75rem' },
  actionTitle: { fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '0.65rem' },
  select: { width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--color-text)', background: '#fff', marginBottom: '0.6rem' },
  input: { width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--color-text)', background: '#fff', marginBottom: '0.6rem' },
  btnPrimary: { padding: '0.55rem 1.25rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit' },
  btnDanger:  { padding: '0.55rem 1.25rem', background: '#D32F2F', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, fontFamily: 'inherit' },
  btnOutline: { padding: '0.55rem 1.25rem', background: 'none', color: 'var(--color-secondary)', border: '1px solid var(--color-secondary)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' },
  btnRow:     { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' },
  descBox:    { fontSize: '0.88rem', color: 'var(--color-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' },
  motivoBox:  { background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 'var(--radius-sm)', padding: '0.75rem', fontSize: '0.85rem', color: '#5D4037', marginTop: '0.5rem' },
  pairCols:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' },
  pairCard:   { background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: '0.85rem', fontSize: '0.83rem' },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal:      { background: '#fff', borderRadius: 'var(--radius-md)', padding: '1.5rem', width: 440, maxWidth: '90vw', boxShadow: 'var(--shadow-md)' },
  modalTitle: { fontWeight: 700, fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--color-primary)' },
  textarea:   { width: '100%', padding: '0.65rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontFamily: 'inherit', minHeight: 90, resize: 'vertical', marginBottom: '0.75rem' },
  loading:    { textAlign: 'center', color: 'var(--color-text-muted)', padding: '3rem' },
  // Thumbnails de fotos
  thumbGrid:  { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' },
  thumb:      { width: 72, height: 72, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '2px solid transparent', transition: 'border-color 0.15s' },
  // Lightbox
  lightbox:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  lightboxImg:{ maxWidth: '90vw', maxHeight: '88vh', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' },
  lightboxClose: { position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', color: '#fff', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

// ── Semáforo de ciclo de vida completo ────────────────────────────────────────
function SemaforoEstado({ estado }) {
  const idx = CICLO_ESTADOS.findIndex(e => e.key === estado);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: 4, gap: 0 }}>
      {CICLO_ESTADOS.map((e, i) => {
        const isPast    = i < idx;
        const isCurrent = i === idx;
        const dotColor  = isCurrent ? 'var(--color-primary)' : isPast ? '#388E3C' : '#D1D5DB';
        const lineColor = i < idx ? '#388E3C' : '#E5E7EB';
        return (
          <div key={e.key} style={{ display: 'flex', alignItems: 'flex-start', flex: isCurrent ? '0 0 auto' : 1, minWidth: 0 }}>
            {i > 0 && (
              <div style={{ height: 2, flex: 1, background: lineColor, alignSelf: 'flex-start', marginTop: 8, minWidth: 4 }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                background: (isPast || isCurrent) ? dotColor : 'transparent',
                border: `2px solid ${dotColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isPast && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1, fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{
                fontSize: '0.6rem', marginTop: 3, whiteSpace: 'nowrap',
                color: isCurrent ? 'var(--color-primary)' : isPast ? '#388E3C' : '#9CA3AF',
                fontWeight: isCurrent ? 700 : 400,
              }}>
                {e.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Modal de confirmación con texto ───────────────────────────────────────────
function ConfirmModal({ title, placeholder, onConfirm, onCancel, loading }) {
  const [texto, setTexto] = useState('');
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={S.modalTitle}>{title}</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}><FiX /></button>
        </div>
        <textarea
          style={S.textarea}
          placeholder={placeholder || 'Explica el motivo…'}
          value={texto}
          onChange={e => setTexto(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button style={S.btnOutline} onClick={onCancel}>Cancelar</button>
          <button style={S.btnDanger} onClick={() => onConfirm(texto)} disabled={loading || !texto.trim()}>
            {loading ? 'Enviando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mapa pequeño con pin arrastrable ─────────────────────────────────────────
function PinMap({ lat, lng, onPositionChange }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY || '',
    libraries: [],
  });
  const [pos, setPos] = useState({ lat: Number(lat), lng: Number(lng) });
  if (!isLoaded || !lat || !lng) return null;
  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: 180, borderRadius: 6, marginTop: 8 }}
      center={pos}
      zoom={16}
      options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false }}
    >
      <Marker
        position={pos}
        draggable
        onDragEnd={e => {
          const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          setPos(newPos);
          onPositionChange(newPos);
        }}
      />
    </GoogleMap>
  );
}

// ── Galería de evidencias ─────────────────────────────────────────────────────
function EvidenciasSection({ fotos }) {
  const [ampliada, setAmpliada] = useState(null);

  if (fotos.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)', fontSize: '0.82rem', marginTop: '0.5rem' }}>
        <FiImage size={14} /> Sin evidencias fotográficas
      </div>
    );
  }

  return (
    <>
      <div style={S.thumbGrid}>
        {fotos.map(f => (
          <img
            key={f.id}
            src={f.url_cloudinary}
            alt="evidencia"
            style={S.thumb}
            onClick={() => setAmpliada(f.url_cloudinary)}
          />
        ))}
      </div>
      {ampliada && (
        <div style={S.lightbox} onClick={() => setAmpliada(null)}>
          <button style={S.lightboxClose} onClick={() => setAmpliada(null)}><FiX size={16} /></button>
          <img
            src={ampliada}
            alt="evidencia ampliada"
            style={S.lightboxImg}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

// ── Sección: quién generó la revisión ────────────────────────────────────────
function GeneradoPorSection({ historial }) {
  // Buscar la entrada que transitó a 'en_revision'
  const entrada = historial.find(h => h.estado_nuevo === 'en_revision');
  if (!entrada) return null;

  let actor;
  if (entrada.rol_usuario === 'sistema') {
    actor = 'Sistema automático';
  } else if (entrada.rol_usuario === 'autoridad') {
    const nombre = [entrada.usuario_nombre, entrada.usuario_apellido].filter(Boolean).join(' ');
    actor = `Autoridad${nombre ? `: ${nombre}` : ''}`;
  } else if (entrada.rol_usuario === 'superadmin') {
    const nombre = [entrada.usuario_nombre, entrada.usuario_apellido].filter(Boolean).join(' ');
    actor = `Superadmin${nombre ? `: ${nombre}` : ''}`;
  } else {
    actor = entrada.rol_usuario;
  }

  return (
    <div style={{ ...S.field }}>
      <div style={S.label}>Generado por</div>
      <div style={{ fontSize: '0.85rem', color: 'var(--color-text)', fontWeight: 600 }}>{actor}</div>
      {entrada.observacion && (
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 3, lineHeight: 1.4 }}>
          {entrada.observacion}
        </div>
      )}
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
        {new Date(entrada.created_at).toLocaleString('es-MX')}
      </div>
    </div>
  );
}

// ── Acciones según tipo ───────────────────────────────────────────────────────
function ActionsEscalado({ reporte, onDone }) {
  const [categorias, setCategorias] = useState([]);
  const [catId,      setCatId]      = useState('');
  const [busy,       setBusy]       = useState(false);

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategorias(data.categorias || [])).catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!catId) return;
    setBusy(true);
    try {
      await api.post(`/assignment/admin-transfer/${reporte.id}`, {
        nueva_categoria_id: catId,
        motivo: 'Reasignación por superadmin tras revisión de escalamiento',
      });
      onDone('Reporte reasignado correctamente');
    } catch (e) {
      alert(e?.response?.data?.message || 'Error al reasignar');
    } finally { setBusy(false); }
  };

  return (
    <div style={S.actionSection}>
      <div style={S.actionTitle}>Reasignar departamento</div>
      <select style={S.select} value={catId} onChange={e => setCatId(e.target.value)}>
        <option value=''>— Selecciona departamento —</option>
        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
      <div style={S.btnRow}>
        <button style={S.btnPrimary} onClick={handleSend} disabled={busy || !catId}>
          {busy ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}

function ActionsMalaUbicacion({ reporte, onDone }) {
  const [newPos,  setNewPos]  = useState({ lat: Number(reporte.latitud), lng: Number(reporte.longitud) });
  const [address, setAddress] = useState('');
  const [modal,   setModal]   = useState(false);
  const [busy,    setBusy]    = useState(false);

  const handleCorregir = async () => {
    setBusy(true);
    try {
      await api.post(`/validation/${reporte.id}/review`, {
        resultado: 'ubicacion_corregida',
        latitud:   newPos.lat,
        longitud:  newPos.lng,
        motivo:    address || 'Ubicación corregida por superadmin',
      });
      onDone('Ubicación corregida');
    } catch (e) {
      alert(e?.response?.data?.message || 'Error');
    } finally { setBusy(false); }
  };

  const handleCerrar = async (motivo) => {
    setBusy(true);
    try {
      await api.post(`/validation/${reporte.id}/review`, { resultado: 'ubicacion_rechazada', motivo });
      onDone('Reporte cerrado por ubicación inválida');
    } catch (e) {
      alert(e?.response?.data?.message || 'Error');
    } finally { setBusy(false); setModal(false); }
  };

  return (
    <>
      <div style={S.actionSection}>
        <div style={S.actionTitle}>Corregir ubicación</div>
        <input style={S.input} placeholder="Nueva dirección (referencia)" value={address} onChange={e => setAddress(e.target.value)} />
        <PinMap lat={reporte.latitud} lng={reporte.longitud} onPositionChange={setNewPos} />
        <div style={S.btnRow}>
          <button style={S.btnPrimary} onClick={handleCorregir} disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar corrección'}
          </button>
          <button style={S.btnDanger} onClick={() => setModal(true)} disabled={busy}>Cerrar reporte</button>
        </div>
      </div>
      {modal && <ConfirmModal title="Cerrar reporte" placeholder="Motivo del cierre…" onConfirm={handleCerrar} onCancel={() => setModal(false)} loading={busy} />}
    </>
  );
}

function ActionsFalso({ reporte, onDone }) {
  const [modal, setModal] = useState(false);
  const [busy,  setBusy]  = useState(false);

  const handleConfirmar = async () => {
    setBusy(true);
    try {
      await api.post(`/validation/${reporte.id}/review`, { resultado: 'sano', motivo: 'Reporte confirmado como auténtico por superadmin' });
      onDone('Reporte confirmado');
    } catch (e) { alert(e?.response?.data?.message || 'Error'); }
    finally { setBusy(false); }
  };

  const handleFalso = async (motivo) => {
    setBusy(true);
    try {
      await api.post(`/validation/${reporte.id}/review`, { resultado: 'falso', motivo });
      onDone('Reporte cerrado como falso');
    } catch (e) { alert(e?.response?.data?.message || 'Error'); }
    finally { setBusy(false); setModal(false); }
  };

  return (
    <>
      <div style={S.actionSection}>
        <div style={S.actionTitle}>Decisión</div>
        <div style={S.btnRow}>
          <button style={S.btnPrimary} onClick={handleConfirmar} disabled={busy}>Confirmar reporte</button>
          <button style={S.btnDanger}  onClick={() => setModal(true)} disabled={busy}>Cerrar como falso</button>
        </div>
      </div>
      {modal && <ConfirmModal title="Cerrar como falso" placeholder="Motivo del cierre…" onConfirm={handleFalso} onCancel={() => setModal(false)} loading={busy} />}
    </>
  );
}

function ActionsRepetido({ reporte, onDone }) {
  const [similares, setSimilares] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleMismo = async () => {
    setBusy(true);
    try {
      await api.post(`/validation/${reporte.id}/review`, {
        resultado: 'duplicado',
        reporte_similar_id: reporte.reporte_padre_id,
        motivo: 'Confirmado como duplicado por superadmin',
      });
      onDone('Marcado como duplicado');
    } catch (e) { alert(e?.response?.data?.message || 'Error'); }
    finally { setBusy(false); }
  };

  const handleNoMismo = async () => {
    setBusy(true);
    try {
      await api.post(`/validation/${reporte.id}/review`, { resultado: 'sano', motivo: 'No es duplicado, confirmado por superadmin' });
      onDone('Reporte confirmado como único');
    } catch (e) { alert(e?.response?.data?.message || 'Error'); }
    finally { setBusy(false); }
  };

  const handleVerSimilares = async () => {
    if (similares) { setSimilares(null); return; }
    try {
      const { data } = await api.get('/validation/queue', { params: { tipo: 'repetido' } });
      setSimilares((data.reportes || []).filter(r => r.id !== reporte.id).slice(0, 5));
    } catch { setSimilares([]); }
  };

  return (
    <div style={S.actionSection}>
      <div style={S.actionTitle}>Comparar reportes</div>
      {reporte.reporte_padre && (
        <div style={S.pairCols}>
          <div style={S.pairCard}>
            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: '0.78rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Reporte actual</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{reporte.categoria_nombre}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{reporte.colonia}</div>
            <div style={{ fontSize: '0.8rem', marginTop: 4 }}>{reporte.descripcion?.slice(0, 80)}{reporte.descripcion?.length > 80 ? '…' : ''}</div>
          </div>
          <div style={S.pairCard}>
            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: '0.78rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Reporte padre</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{reporte.reporte_padre.categoria_nombre}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{reporte.reporte_padre.colonia}</div>
            <div style={{ fontSize: '0.8rem', marginTop: 4 }}>{reporte.reporte_padre.descripcion?.slice(0, 80)}{reporte.reporte_padre.descripcion?.length > 80 ? '…' : ''}</div>
          </div>
        </div>
      )}
      <div style={S.btnRow}>
        <button style={S.btnDanger}   onClick={handleMismo}       disabled={busy}>Es el mismo reporte</button>
        <button style={S.btnPrimary}  onClick={handleNoMismo}     disabled={busy}>No es el mismo</button>
        <button style={S.btnOutline}  onClick={handleVerSimilares}>Ver otros similares</button>
      </div>
      {similares !== null && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}>
          {similares.length === 0
            ? <span style={{ color: 'var(--color-text-muted)' }}>No hay otros reportes repetidos</span>
            : similares.map(s => (
              <div key={s.id} style={{ padding: '0.4rem 0', borderBottom: '1px solid #F3F4F6' }}>
                <strong>{s.categoria_nombre}</strong> — {s.colonia} — {s.descripcion?.slice(0, 60)}
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ReviewDetail() {
  const { tipo, reportId } = useParams();
  const navigate = useNavigate();
  const [reporte,   setReporte]   = useState(null);
  const [historial, setHistorial] = useState([]);
  const [fotos,     setFotos]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [done,      setDone]      = useState(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/validation/queue', { params: { tipo } }),
      api.get(`/reports/${reportId}`).catch(() => ({ data: null })),
      api.get(`/reports/${reportId}/photos`).catch(() => ({ data: { fotos: [] } })),
    ]).then(([queueRes, reportRes, photosRes]) => {
      const found = (queueRes.data.reportes || []).find(r => r.id === reportId);
      setReporte(found || null);
      setHistorial(reportRes.data?.reporte?.historial || []);
      setFotos(photosRes.data?.fotos || []);
    }).catch(() => setReporte(null))
      .finally(() => setLoading(false));
  }, [tipo, reportId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDone = (msg) => setDone(msg);
  const tipoLabel = TIPO_META[tipo]?.label || tipo;

  if (loading) return <SuperadminLayout><div style={S.loading}>Cargando…</div></SuperadminLayout>;

  if (!reporte) return (
    <SuperadminLayout>
      <div style={S.page}>
        <button style={S.backBtn} onClick={() => navigate(`/superadmin/review/${tipo}`)}>
          <FiArrowLeft size={14} /> Regresar
        </button>
        <div style={{ ...S.loading, marginTop: '1rem' }}>Reporte no encontrado</div>
      </div>
    </SuperadminLayout>
  );

  return (
    <SuperadminLayout>
      <div style={S.page}>
        {/* Header */}
        <div style={S.header}>
          <button style={S.backBtn} onClick={() => navigate(`/superadmin/review/${tipo}`)}>
            <FiArrowLeft size={14} /> {tipoLabel}
          </button>
          <h2 style={S.title}>{reporte.categoria_nombre}</h2>
        </div>

        {/* Banner de acción completada */}
        {done && (
          <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', color: '#2E7D32', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{done}</span>
            <button onClick={() => navigate(`/superadmin/review/${tipo}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2E7D32', fontWeight: 600, fontSize: '0.85rem' }}>
              Volver a la lista
            </button>
          </div>
        )}

        <div style={S.cols}>
          {/* ── Columna izquierda: datos del reporte ── */}
          <div>
            <div style={S.card}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: 2 }}>
                {reporte.categoria_nombre}
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                {reporte.subcategoria_nombre}
              </div>

              <div style={S.divider} />

              {/* Descripción original del ciudadano */}
              <div style={S.field}>
                <div style={S.label}>Descripción del ciudadano</div>
                <div style={S.descBox}>{reporte.descripcion}</div>
              </div>

              <div style={S.divider} />

              {/* Ubicación */}
              <div style={S.field}>
                <div style={S.label}>Ubicación</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, ...S.value }}>
                  <FiMapPin size={13} style={{ marginTop: 2, flexShrink: 0, color: 'var(--color-accent)' }} />
                  <span>{[reporte.calle, reporte.numero, reporte.colonia].filter(Boolean).join(', ') || '—'}</span>
                </div>
                {reporte.precision_gps != null && (
                  <div style={{ fontSize: '0.75rem', color: reporte.ubicacion_baja_precision ? '#E8423F' : 'var(--color-text-muted)', marginTop: 2 }}>
                    Precisión GPS: {Number(reporte.precision_gps).toFixed(0)} m
                    {reporte.ubicacion_baja_precision && ' ⚠ Baja precisión'}
                  </div>
                )}
              </div>

              <div style={S.divider} />

              {/* Evidencias fotográficas */}
              <div style={S.field}>
                <div style={S.label}>Evidencias</div>
                <EvidenciasSection fotos={fotos} />
              </div>

              <div style={S.divider} />

              {/* Quién generó la revisión */}
              <GeneradoPorSection historial={historial} />

              <div style={S.divider} />

              {/* Semáforo de ciclo de vida completo */}
              <div style={S.field}>
                <div style={{ ...S.label, marginBottom: 8 }}>Ciclo de vida</div>
                <SemaforoEstado estado={reporte.estado} />
              </div>

              <div style={S.divider} />

              {/* Fecha de creación */}
              <div style={S.field}>
                <div style={S.label}>Reportado el</div>
                <div style={S.value}>{new Date(reporte.created_at).toLocaleString('es-MX')}</div>
              </div>
            </div>
          </div>

          {/* ── Columna derecha: acciones + motivo escalado ── */}
          <div>
            <div style={S.card}>
              {!done && tipo === 'escalado'  && <ActionsEscalado     reporte={reporte} onDone={handleDone} />}
              {!done && tipo === 'ubicacion' && <ActionsMalaUbicacion reporte={reporte} onDone={handleDone} />}
              {!done && tipo === 'falso'     && <ActionsFalso        reporte={reporte} onDone={handleDone} />}
              {!done && tipo === 'repetido'  && <ActionsRepetido     reporte={reporte} onDone={handleDone} />}

              {/* Motivo de escalamiento */}
              {tipo === 'escalado' && reporte.motivo_escalado && (
                <>
                  <div style={S.divider} />
                  <div style={S.field}>
                    <div style={S.label}>Motivo de escalamiento</div>
                    <div style={S.motivoBox}>{reporte.motivo_escalado}</div>
                  </div>
                </>
              )}

              {/* Ciudadano */}
              <div style={S.divider} />
              <div style={S.field}>
                <div style={S.label}>Ciudadano</div>
                <div style={S.value}>
                  {[reporte.ciudadano_nombre, reporte.ciudadano_apellido].filter(Boolean).join(' ') || '—'}
                </div>
                {reporte.reportes_falsos > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#E8423F', marginTop: 2 }}>
                    ⚠ {reporte.reportes_falsos} reporte{reporte.reportes_falsos !== 1 ? 's' : ''} falso{reporte.reportes_falsos !== 1 ? 's' : ''} previo{reporte.reportes_falsos !== 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* Sector */}
              {reporte.sector_nombre && (
                <div style={S.field}>
                  <div style={S.label}>Sector</div>
                  <div style={S.value}>{reporte.sector_nombre}</div>
                </div>
              )}

              {/* Urgencia */}
              <div style={S.field}>
                <div style={S.label}>Urgencia</div>
                <div style={{
                  display: 'inline-block',
                  padding: '2px 10px',
                  borderRadius: 12,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: reporte.urgencia === 'alto' ? '#FFEBEE' : reporte.urgencia === 'medio' ? '#FFF8E1' : '#E8F5E9',
                  color:      reporte.urgencia === 'alto' ? '#C62828' : reporte.urgencia === 'medio' ? '#F57F17' : '#2E7D32',
                }}>
                  {reporte.urgencia}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SuperadminLayout>
  );
}
