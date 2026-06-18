import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';
import AuthorityLayout from '../../layouts/AuthorityLayout';
import api from '../../services/api';
import Toast from '../../components/Toast';

const LIBRARIES     = [];
const MAP_CENTER    = { lat: 20.6597, lng: -103.3496 };
const CURRENT_YEAR  = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const MIN_YEAR      = 2026;
const YEARS         = Array.from({ length: CURRENT_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i);

const TEMPORALIDAD_OPTS = ['año', 'mes', 'semana'];
const ESTADO_OPTS       = ['todos', 'abiertos', 'cerrados'];
const METRICA_OPTS      = ['cantidad', 'urgencia'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function maxSemanaForAnio(anio) {
  if (anio < CURRENT_YEAR) return 52;
  return Math.max(1, Math.min(52, Math.ceil((new Date() - new Date(anio, 0, 1)) / (7 * 24 * 60 * 60 * 1000))));
}

/* Dispara fn en updates pero no en el montaje inicial. */
function useDidUpdateEffect(fn, deps) {
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    fn();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ── Choropleth helpers ────────────────────────────────────────────────────────

function coloniaColor(colonia, metrica) {
  const valor = metrica === 'urgencia' ? colonia?.peso_total : colonia?.total;
  if (!valor || valor === 0) return null;
  if (metrica === 'urgencia') {
    if (valor <= 2)  return { fill: '#FFF176', opacity: 0.45 };
    if (valor <= 5)  return { fill: '#FFB300', opacity: 0.55 };
    if (valor <= 10) return { fill: '#F57C00', opacity: 0.65 };
    return                   { fill: '#D32F2F', opacity: 0.75 };
  }
  if (valor <= 1) return { fill: '#FFF176', opacity: 0.45 };
  if (valor <= 3) return { fill: '#FFB300', opacity: 0.55 };
  if (valor <= 6) return { fill: '#F57C00', opacity: 0.65 };
  return              { fill: '#D32F2F', opacity: 0.75 };
}

function applyStyles(dataLayer, lookup, metrica, activeMunicipio, municipioLookup) {
  dataLayer.setStyle((feature) => {
    const nombre      = feature.getProperty('nombre');
    const key         = nombre?.toLowerCase().trim();
    const data        = lookup[key];
    const color       = coloniaColor(data, metrica);
    const inMunicipio = activeMunicipio
      ? (municipioLookup[key] === activeMunicipio)
      : true;

    if (!color) {
      if (activeMunicipio && inMunicipio) {
        return { fillColor: '#888', fillOpacity: 0.04, strokeColor: '#1F4E79', strokeWeight: 2.5, strokeOpacity: 0.45 };
      }
      return {
        fillColor:    '#888',
        fillOpacity:  activeMunicipio ? 0.02 : 0.04,
        strokeColor:  activeMunicipio ? '#ccc' : '#aaa',
        strokeWeight: activeMunicipio ? 0.3  : 0.6,
        strokeOpacity:activeMunicipio ? 0.2  : 0.4,
      };
    }

    if (activeMunicipio) {
      if (inMunicipio) {
        return { fillColor: color.fill, fillOpacity: color.opacity, strokeColor: '#1F4E79', strokeWeight: 2.5, strokeOpacity: 1 };
      }
      return { fillColor: color.fill, fillOpacity: 0.18, strokeColor: '#bbb', strokeWeight: 0.4, strokeOpacity: 0.3 };
    }

    return { fillColor: color.fill, fillOpacity: color.opacity, strokeColor: '#555', strokeWeight: 1, strokeOpacity: 0.7 };
  });
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const S = {
  page:        { display: 'flex', flexDirection: 'column', height: '100%', padding: '0.75rem', gap: '0.6rem', overflow: 'hidden' },
  pageTitle:   { fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 },
  filters:     { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 },
  mapWrap:     { flex: 1, borderRadius: 'var(--radius-md)', overflow: 'hidden', minHeight: 0, position: 'relative' },
  dropWrap:    { position: 'relative' },
  dropBtn:     { padding: '0.42rem 0.8rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontFamily: 'inherit', color: 'var(--color-text)', whiteSpace: 'nowrap' },
  dropBtnActive:{ borderColor: 'var(--color-primary)', background: 'var(--color-primary)', color: '#fff' },
  menu:        { position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50, backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-md)', borderRadius: 'var(--radius-sm)', minWidth: 150, overflow: 'hidden' },
  menuItem:    (active) => ({ display: 'block', width: '100%', padding: '0.5rem 0.85rem', background: active ? 'var(--color-primary)' : 'none', border: 'none', color: active ? '#fff' : 'var(--color-text)', fontSize: '0.82rem', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }),
  numInput:    { padding: '0.4rem 0.5rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', fontFamily: 'inherit', color: 'var(--color-text)', width: 72, outline: 'none' },
  yearSelect:  { padding: '0.4rem 0.5rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', fontFamily: 'inherit', color: 'var(--color-text)', outline: 'none', cursor: 'pointer' },
  filterGroup: { display: 'flex', alignItems: 'center', gap: '0.35rem' },
  clearBtn:    { background:'none', border:'1px solid #D1D5DB', borderRadius:'50%', cursor:'pointer', fontSize:'0.72rem', color:'var(--color-text-muted)', width:20, height:20, padding:0, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  legend:      { position: 'absolute', bottom: 24, right: 12, background: 'rgba(255,255,255,0.92)', padding: '0.5rem 0.75rem', borderRadius: 8, boxShadow: 'var(--shadow-sm)', fontSize: '0.75rem', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 4 },
  legendRow:   { display: 'flex', alignItems: 'center', gap: 6 },
  legendBox:   (color) => ({ width: 14, height: 14, borderRadius: 3, background: color, flexShrink: 0 }),
  tooltip:     { position: 'absolute', background: 'rgba(0,0,0,0.78)', color: '#fff', padding: '0.4rem 0.7rem', borderRadius: 6, fontSize: '0.78rem', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 20, transform: 'translate(-50%, -110%)' },
  drawer:      { position: 'absolute', top: 0, right: 0, height: '100%', width: 320, background: 'var(--color-surface)', boxShadow: '-4px 0 20px rgba(0,0,0,0.13)', display: 'flex', flexDirection: 'column', zIndex: 30, borderRadius: '0 var(--radius-md) var(--radius-md) 0' },
  drawerHeader:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', flexShrink: 0 },
  drawerTitle: { fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  drawerClose: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.15rem', color: 'var(--color-text-muted)', padding: '0.15rem 0.3rem', lineHeight: 1, flexShrink: 0 },
  drawerBody:  { flex: 1, overflowY: 'auto', padding: '0.4rem 0.5rem' },
  drawerEmpty: { padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.84rem' },
  drawerLoading:{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.84rem' },
  reportCard:  (hovered) => ({ padding: '0.6rem 0.7rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', background: hovered ? 'var(--color-bg)' : 'transparent', transition: 'background 0.12s' }),
  reportMeta:  { display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3, flexWrap: 'wrap' },
  urgBadge:    (u) => ({ display: 'inline-block', fontSize: '0.66rem', fontWeight: 700, borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase', flexShrink: 0, background: u==='alto' ? '#FEE2E2' : u==='medio' ? '#FEF3C7' : '#D1FAE5', color: u==='alto' ? '#B91C1C' : u==='medio' ? '#92400E' : '#065F46' }),
  reportSubcat:{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  reportDesc:  { fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '2px 0', lineHeight: 1.4 },
  reportDate:  { fontSize: '0.7rem', color: 'var(--color-text-muted)' },
  municipioLabel: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.38rem 0.75rem',
    border: '1px solid var(--color-primary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.82rem', fontWeight: 600,
    color: 'var(--color-primary)',
    background: 'var(--color-surface)',
    whiteSpace: 'nowrap',
  },
  toggleLabel: (disabled) => ({
    display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem',
    color: disabled ? '#C0C0C0' : 'var(--color-text-muted)',
    userSelect: 'none', cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
    opacity: disabled ? 0.5 : 1,
  }),
};

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── ColoniaDrawer ─────────────────────────────────────────────────────────────

function ColoniaDrawer({ colonia, municipio, reportes, loading, onClose, onNavigate }) {
  const [hoveredId, setHoveredId] = useState(null);
  const titulo = municipio ? `${colonia} — ${municipio}` : colonia;
  return (
    <div style={S.drawer}>
      <div style={S.drawerHeader}>
        <span style={S.drawerTitle} title={titulo}>{titulo}</span>
        <button style={S.drawerClose} onClick={onClose}>✕</button>
      </div>
      <div style={S.drawerBody}>
        {loading && <div style={S.drawerLoading}>Cargando reportes…</div>}
        {!loading && reportes.length === 0 && (
          <div style={S.drawerEmpty}>Sin reportes propios en esta colonia con los filtros activos.</div>
        )}
        {!loading && reportes.map(r => (
          <div
            key={r.id}
            style={S.reportCard(hoveredId === r.id)}
            onMouseEnter={() => setHoveredId(r.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onNavigate(r.id)}
          >
            <div style={S.reportMeta}>
              <span style={S.urgBadge(r.urgencia)}>{r.urgencia}</span>
              <span style={S.reportSubcat}>{r.subcategoria_nombre}</span>
            </div>
            <div style={S.reportDesc}>
              {(r.descripcion || '').length > 110 ? r.descripcion.slice(0, 110) + '…' : r.descripcion}
            </div>
            <div style={S.reportDate}>{fmtDate(r.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

function Dropdown({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const isActive = value !== null && value !== undefined;
  const btnStyle = isActive ? { ...S.dropBtn, ...S.dropBtnActive } : S.dropBtn;
  return (
    <div style={S.dropWrap} ref={ref}>
      <button style={btnStyle} onClick={() => setOpen(o => !o)}>
        {label}{value ? `: ${value}` : ''} ▾
      </button>
      {open && (
        <div style={S.menu}>
          {options.map(opt => {
            const lbl = opt.label ?? opt;
            const val = opt.value ?? opt;
            return (
              <button key={val} style={S.menuItem(lbl === value || val === value)}
                onClick={() => { onChange(val, lbl); setOpen(false); }}>
                {lbl}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ChoroplethMap ─────────────────────────────────────────────────────────────

function ChoroplethMap({ coloniaData, metrica, municipio, showBorders, municipioLookupRef, onColoniaClick }) {
  const mapRef            = useRef(null);
  const dataLayerRef      = useRef(null);
  const geojsonLoaded     = useRef(false);
  const onColoniaClickRef = useRef(onColoniaClick);
  const [tooltip, setTooltip] = useState(null);
  const lookup = useRef({});

  useEffect(() => { onColoniaClickRef.current = onColoniaClick; }, [onColoniaClick]);

  useEffect(() => {
    const map = {};
    coloniaData.forEach(c => { const key = c.colonia?.toLowerCase().trim(); if (key) map[key] = c; });
    lookup.current = map;
  }, [coloniaData]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    const dataLayer = new window.google.maps.Data({ map });
    dataLayerRef.current = dataLayer;
    dataLayer.loadGeoJson('/colonias-zmg.geojson', {}, () => {
      geojsonLoaded.current = true;
      applyStyles(dataLayer, lookup.current, metrica, null, municipioLookupRef.current);
    });
    dataLayer.addListener('mouseover', (event) => {
      const nombre = event.feature.getProperty('nombre');
      const key    = nombre?.toLowerCase().trim();
      const data   = lookup.current[key];
      map.setOptions({ draggableCursor: 'pointer' });
      const latLng = event.latLng;
      const bounds = map.getBounds();
      if (bounds) {
        const ne = bounds.getNorthEast(); const sw = bounds.getSouthWest();
        const mapDiv = map.getDiv();
        const x = ((latLng.lng() - sw.lng()) / (ne.lng() - sw.lng())) * mapDiv.offsetWidth;
        const y = ((ne.lat() - latLng.lat()) / (ne.lat() - sw.lat())) * mapDiv.offsetHeight;
        setTooltip({ x, y, nombre, total: data?.total ?? 0 });
      }
      dataLayer.overrideStyle(event.feature, { strokeWeight: 2.5, strokeColor: '#1B2A4A' });
    });
    dataLayer.addListener('mouseout', (event) => {
      map.setOptions({ draggableCursor: null }); setTooltip(null); dataLayer.revertStyle(event.feature);
    });
    dataLayer.addListener('click', (event) => {
      const nombre    = event.feature.getProperty('nombre');
      const municipio = event.feature.getProperty('municipio');
      if (nombre) onColoniaClickRef.current?.(nombre, municipio);
    });
  }, []);

  useEffect(() => {
    if (dataLayerRef.current && geojsonLoaded.current) {
      applyStyles(dataLayerRef.current, lookup.current, metrica, showBorders ? municipio : null, municipioLookupRef.current);
    }
  }, [coloniaData, metrica, municipio, showBorders]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={MAP_CENTER} zoom={12}
        onLoad={onMapLoad} options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false }} />
      {tooltip && (
        <div style={{ ...S.tooltip, left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.nombre}</strong>{' — '}{tooltip.total} reporte{tooltip.total !== 1 ? 's' : ''}
        </div>
      )}
      <div style={S.legend}>
        <strong style={{ fontSize: '0.73rem', marginBottom: 2 }}>Reportes por colonia</strong>
        <div style={S.legendRow}><div style={S.legendBox('#FFF176')} /> 1 reporte</div>
        <div style={S.legendRow}><div style={S.legendBox('#FFB300')} /> 2–3 reportes</div>
        <div style={S.legendRow}><div style={S.legendBox('#F57C00')} /> 4–6 reportes</div>
        <div style={S.legendRow}><div style={S.legendBox('#D32F2F')} /> 7+ reportes</div>
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function AuthorityHeatmap() {
  const navigate = useNavigate();
  const [municipioPropio,  setMunicipioPropio]  = useState(null);
  const [temporalidad,     setTemporalidad]     = useState('mes');
  const [anio,             setAnio]             = useState(CURRENT_YEAR);
  const [mes,              setMes]              = useState(CURRENT_MONTH);
  const [semana,           setSemana]           = useState(1);
  const [subcategorias,    setSubcategorias]    = useState([]);
  const [subcatId,         setSubcatId]         = useState(null);
  const [subcatNombre,     setSubcatNombre]     = useState(null);
  const [estado,           setEstado]           = useState('abiertos');
  const [vista,            setVista]            = useState('periodo');
  const [metrica,          setMetrica]          = useState('cantidad');
  const [coloniaData,      setColoniaData]      = useState([]);
  const [showBorders,      setShowBorders]      = useState(false);
  const [drawer, setDrawer] = useState({ open: false, colonia: null, reportes: [], loading: false });
  const [toastMsg, setToastMsg] = useState('');
  const municipioLookupRef = useRef({});

  function showToast(msg) { setToastMsg(msg); }

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY || '',
    libraries: LIBRARIES,
  });

  /* Cargar municipio propio de la autoridad autenticada */
  useEffect(() => {
    api.get('/auth/me')
      .then(({ data }) => {
        const m = data?.user?.perfil?.municipio;
        if (m) setMunicipioPropio(m);
      })
      .catch(() => {});
  }, []);

  /* Cargar lookup colonia → municipio para el resaltado visual */
  useEffect(() => {
    api.get('/heatmap/municipios')
      .then(({ data }) => {
        const normalized = {};
        Object.entries(data).forEach(([k, v]) => {
          normalized[k.toLowerCase().trim()] = v;
        });
        municipioLookupRef.current = normalized;
      })
      .catch(() => {});
  }, []);

  /* Cargar subcategorías propias de la autoridad */
  useEffect(() => {
    api.get('/heatmap', { params: { mine: true } })
      .then(({ data }) => {
        const names = [...new Set((data.subcategorias || []).filter(Boolean))];
        setSubcategorias(names.map(n => ({ label: n, value: n })));
      }).catch(() => {});
  }, []);

  /* Clampear semana si cambia el año */
  useEffect(() => {
    if (temporalidad === 'semana') {
      setSemana(s => Math.max(1, Math.min(maxSemanaForAnio(anio), s)));
    }
  }, [anio, temporalidad]);

  /* Si al cambiar el año el mes queda en el futuro, resetear al mes actual */
  useDidUpdateEffect(() => {
    if (anio === CURRENT_YEAR && mes > CURRENT_MONTH) {
      setMes(CURRENT_MONTH);
      showToast('Mes ajustado al mes actual');
    }
  }, [anio]);

  const fetchData = useCallback(() => {
    const params = { mine: true, estado, metrica, vista, temporalidad, anio };
    if (temporalidad === 'mes')    params.mes    = mes;
    if (temporalidad === 'semana') params.semana = semana;
    if (subcatId)        params.subcategoria    = subcatNombre;
    if (municipioPropio) params.municipio_nombre = municipioPropio;
    api.get('/heatmap', { params })
      .then(({ data }) => setColoniaData(data.colonias || []))
      .catch(() => setColoniaData([]));
  }, [temporalidad, anio, mes, semana, subcatId, subcatNombre, estado, vista, metrica, municipioPropio]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* Toasts por cambio de filtro (no en montaje inicial) */
  useDidUpdateEffect(() => showToast(`Filtrando por ${temporalidad}`),                                    [temporalidad]);
  useDidUpdateEffect(() => showToast(`Año: ${anio}`),                                                     [anio]);
  useDidUpdateEffect(() => showToast(`Mes: ${MESES[mes - 1]}`),                                           [mes]);
  useDidUpdateEffect(() => showToast(`Semana ${semana} — ${anio}`),                                       [semana]);
  useDidUpdateEffect(() => showToast(`Vista: ${vista}`),                                                  [vista]);
  useDidUpdateEffect(() => showToast(`Reportes: ${estado}`),                                              [estado]);
  useDidUpdateEffect(() => showToast(`Métrica: ${metrica}`),                                              [metrica]);
  useDidUpdateEffect(() => showToast(subcatNombre ? `Subcategoría: ${subcatNombre}` : 'Sin filtro de subcategoría'), [subcatId]);

  const handleColoniaClick = useCallback((nombre, municipio) => {
    setDrawer({ open: true, colonia: nombre, municipio: municipio || null, reportes: [], loading: true });
    const params = { colonia: nombre, estado, mine: true };
    if (municipio) params.municipio = municipio;
    api.get('/reports/by-colonia', { params })
      .then(({ data }) => setDrawer(d => ({ ...d, loading: false, reportes: data.reportes || [] })))
      .catch(() => setDrawer(d => ({ ...d, loading: false, reportes: [] })));
  }, [estado]);

  const maxSemana = maxSemanaForAnio(anio);

  return (
    <AuthorityLayout>
      <div style={S.page}>
        <div style={S.pageTitle}>Mapa de calor</div>

        <div style={S.filters}>

          {/* ── Temporalidad ── */}
          <div style={S.filterGroup}>
            <Dropdown label="Temporalidad" options={TEMPORALIDAD_OPTS} value={temporalidad} onChange={v => setTemporalidad(v)} />
            {temporalidad === 'año' && (
              <select style={S.yearSelect} value={anio} onChange={e => setAnio(Number(e.target.value))}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {temporalidad === 'mes' && (
              <>
                <select
                  style={S.yearSelect}
                  value={mes}
                  onChange={e => {
                    const newMes = Number(e.target.value);
                    if (anio === CURRENT_YEAR && newMes > CURRENT_MONTH) {
                      showToast('No puedes filtrar por meses futuros');
                      return;
                    }
                    setMes(newMes);
                  }}
                >
                  {MESES.map((m, i) => (
                    <option key={i + 1} value={i + 1} disabled={anio === CURRENT_YEAR && i + 1 > CURRENT_MONTH}>
                      {m}
                    </option>
                  ))}
                </select>
                <select style={S.yearSelect} value={anio} onChange={e => setAnio(Number(e.target.value))}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            )}
            {temporalidad === 'semana' && (
              <>
                <input
                  style={S.numInput}
                  type="number"
                  min="1"
                  max={maxSemana}
                  value={semana}
                  onChange={e => setSemana(Math.max(1, Math.min(maxSemana, Number(e.target.value))))}
                  placeholder="Semana"
                />
                <select style={S.yearSelect} value={anio} onChange={e => setAnio(Number(e.target.value))}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </>
            )}
          </div>

          {/* ── Subcategoría ── */}
          <div style={S.filterGroup}>
            <Dropdown label="Subcategoría" options={subcategorias} value={subcatNombre}
              onChange={(v, lbl) => { setSubcatId(v); setSubcatNombre(lbl); }} />
            {subcatId && (
              <button
                style={S.clearBtn}
                onClick={() => { setSubcatId(null); setSubcatNombre(null); showToast('Sin filtro de subcategoría'); }}
                title="Limpiar subcategoría"
              >×</button>
            )}
          </div>

          {/* ── Estado ── */}
          <Dropdown label="Reportes" options={ESTADO_OPTS} value={estado} onChange={v => setEstado(v)} />

          {/* ── Vista ── */}
          <Dropdown label="Vista" options={['periodo', 'acumulado']} value={vista} onChange={v => setVista(v)} />

          {/* ── Métrica ── */}
          <Dropdown label="Métrica" options={METRICA_OPTS} value={metrica} onChange={v => setMetrica(v)} />

          {/* ── Municipio fijo + toggle límites ── */}
          {municipioPropio && (
            <div style={S.filterGroup}>
              <span style={S.municipioLabel}>Municipio: {municipioPropio}</span>
              <label style={S.toggleLabel(false)}>
                <input
                  type="checkbox"
                  checked={showBorders}
                  onChange={e => setShowBorders(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Mostrar límites del municipio
              </label>
            </div>
          )}

        </div>

        <div style={S.mapWrap}>
          {isLoaded
            ? <ChoroplethMap
                coloniaData={coloniaData}
                metrica={metrica}
                municipio={municipioPropio}
                showBorders={showBorders}
                municipioLookupRef={municipioLookupRef}
                onColoniaClick={handleColoniaClick}
              />
            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>Cargando mapa…</div>
          }
          {drawer.open && (
            <ColoniaDrawer
              colonia={drawer.colonia}
              municipio={drawer.municipio}
              reportes={drawer.reportes}
              loading={drawer.loading}
              onClose={() => setDrawer(d => ({ ...d, open: false }))}
              onNavigate={(id) => navigate(`/authority/report/${id}`)}
            />
          )}
        </div>
      </div>
      <Toast message={toastMsg} visible={!!toastMsg} />
    </AuthorityLayout>
  );
}
