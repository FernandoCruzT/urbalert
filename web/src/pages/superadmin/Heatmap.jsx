import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useNavigate } from 'react-router-dom';
import SuperadminLayout from '../../layouts/SuperadminLayout';
import api from '../../services/api';

const LIBRARIES = [];
const MAP_CENTER  = { lat: 20.6597, lng: -103.3496 };
const CURRENT_YEAR = new Date().getFullYear();
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const SECTORES = ['Norte','Sur','Oriente','Poniente','Centro'];

/* ── color según intensidad ── */
function coloniaColor(colonia, metrica) {
  const valor = metrica === 'urgencia' ? colonia?.peso_total : colonia?.total;
  if (!valor || valor === 0) return null;
  if (metrica === 'urgencia') {
    if (valor <= 2)  return { fill: '#FFF176', opacity: 0.45 }; // amarillo claro
    if (valor <= 5)  return { fill: '#FFB300', opacity: 0.55 }; // ámbar
    if (valor <= 10) return { fill: '#F57C00', opacity: 0.65 }; // naranja
    return                   { fill: '#D32F2F', opacity: 0.75 }; // rojo
  }
  // cantidad
  if (valor <= 1) return { fill: '#FFF176', opacity: 0.45 };
  if (valor <= 3) return { fill: '#FFB300', opacity: 0.55 };
  if (valor <= 6) return { fill: '#F57C00', opacity: 0.65 };
  return              { fill: '#D32F2F', opacity: 0.75 };
}

/* ── estilos generales ── */
const S = {
  page:    { display:'flex', flexDirection:'column', height:'100%', padding:'1rem', gap:'0.75rem' },
  title:   { fontSize:'1.2rem', fontWeight:700, color:'var(--color-primary)' },
  filters: { display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'flex-start' },
  mapWrap: { flex:1, borderRadius:'var(--radius-md)', overflow:'hidden', minHeight:0, position:'relative' },
  dropWrap:{ position:'relative' },
  dropBtn: {
    padding:'0.42rem 0.8rem', border:'1px solid #D1D5DB', borderRadius:'var(--radius-sm)',
    background:'var(--color-surface)', cursor:'pointer', fontSize:'0.82rem',
    display:'flex', alignItems:'center', gap:'0.3rem', fontFamily:'inherit',
    color:'var(--color-text)', whiteSpace:'nowrap',
  },
  dropBtnActive: { borderColor:'var(--color-primary)', background:'var(--color-primary)', color:'#fff' },
  menu: {
    position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:50,
    backgroundColor:'var(--color-surface)', boxShadow:'var(--shadow-md)',
    borderRadius:'var(--radius-sm)', minWidth:160, overflow:'hidden',
  },
  menuItem: (active) => ({
    display:'block', width:'100%', padding:'0.5rem 0.85rem',
    background: active ? 'var(--color-primary)' : 'none', border:'none',
    color: active ? '#fff' : 'var(--color-text)', fontSize:'0.82rem',
    textAlign:'left', cursor:'pointer', fontFamily:'inherit',
  }),
  numInput: {
    padding:'0.4rem 0.5rem', border:'1px solid #D1D5DB', borderRadius:'var(--radius-sm)',
    fontSize:'0.82rem', fontFamily:'inherit', color:'var(--color-text)', width:72, outline:'none',
  },
  yearFixed: {
    padding:'0.42rem 0.7rem', border:'1px solid #E5E7EB', borderRadius:'var(--radius-sm)',
    fontSize:'0.82rem', color:'var(--color-text-muted)', background:'#F9FAFB', userSelect:'none',
  },
  filterGroup: { display:'flex', alignItems:'center', gap:'0.35rem' },
  tooltip: {
    position:'absolute', background:'rgba(0,0,0,0.78)', color:'#fff',
    padding:'0.4rem 0.7rem', borderRadius:6, fontSize:'0.78rem',
    pointerEvents:'none', whiteSpace:'nowrap', zIndex:20,
    transform:'translate(-50%, -110%)',
  },
  legend: {
    position:'absolute', bottom:24, right:12, background:'rgba(255,255,255,0.92)',
    padding:'0.5rem 0.75rem', borderRadius:8, boxShadow:'var(--shadow-sm)',
    fontSize:'0.75rem', zIndex:10, display:'flex', flexDirection:'column', gap:4,
  },
  legendRow: { display:'flex', alignItems:'center', gap:6 },
  legendBox: (color) => ({ width:14, height:14, borderRadius:3, background:color, flexShrink:0 }),
  drawer: {
    position:'absolute', top:0, right:0, height:'100%', width:340,
    background:'var(--color-surface)', boxShadow:'-4px 0 20px rgba(0,0,0,0.13)',
    display:'flex', flexDirection:'column', zIndex:30,
    borderRadius:'0 var(--radius-md) var(--radius-md) 0',
  },
  drawerHeader: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'0.75rem 1rem', borderBottom:'1px solid var(--color-border)', flexShrink:0,
  },
  drawerTitle: { fontSize:'0.9rem', fontWeight:700, color:'var(--color-primary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  drawerClose: { background:'none', border:'none', cursor:'pointer', fontSize:'1.15rem', color:'var(--color-text-muted)', padding:'0.15rem 0.3rem', lineHeight:1, flexShrink:0 },
  drawerBody: { flex:1, overflowY:'auto', padding:'0.4rem 0.5rem' },
  drawerEmpty: { padding:'2rem 1rem', textAlign:'center', color:'var(--color-text-muted)', fontSize:'0.84rem' },
  drawerLoading: { padding:'2rem 1rem', textAlign:'center', color:'var(--color-text-muted)', fontSize:'0.84rem' },
  reportCard: (hovered) => ({
    padding:'0.6rem 0.7rem', borderRadius:'var(--radius-sm)', cursor:'pointer',
    borderBottom:'1px solid var(--color-border)',
    background: hovered ? 'var(--color-bg)' : 'transparent', transition:'background 0.12s',
  }),
  reportMeta: { display:'flex', alignItems:'center', gap:4, marginBottom:3, flexWrap:'wrap' },
  urgBadge: (u) => ({
    display:'inline-block', fontSize:'0.66rem', fontWeight:700, borderRadius:3,
    padding:'1px 5px', textTransform:'uppercase', flexShrink:0,
    background: u==='alto' ? '#FEE2E2' : u==='medio' ? '#FEF3C7' : '#D1FAE5',
    color:       u==='alto' ? '#B91C1C' : u==='medio' ? '#92400E' : '#065F46',
  }),
  reportSubcat: { fontSize:'0.75rem', fontWeight:600, color:'var(--color-text)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  reportDesc: { fontSize:'0.78rem', color:'var(--color-text-muted)', margin:'2px 0', lineHeight:1.4 },
  reportDate: { fontSize:'0.7rem', color:'var(--color-text-muted)' },
  expandedDesc: { fontSize:'0.78rem', color:'var(--color-text)', margin:'4px 0 2px', lineHeight:1.5, whiteSpace:'pre-wrap', wordBreak:'break-word' },
};

/* ── helpers ── */
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
}

/* ── ColoniaDrawer ── */
function ColoniaDrawer({ colonia, municipio, reportes, loading, expandedId, onToggleExpand, onClose, onNavigate }) {
  const [hoveredId, setHoveredId] = useState(null);
  const titulo = municipio ? `${colonia} — ${municipio}` : colonia;

  return (
    <div style={S.drawer}>
      <div style={S.drawerHeader}>
        <span style={S.drawerTitle} title={titulo}>{titulo}</span>
        <button style={S.drawerClose} onClick={onClose} title="Cerrar">✕</button>
      </div>
      <div style={S.drawerBody}>
        {loading && <div style={S.drawerLoading}>Cargando reportes…</div>}
        {!loading && reportes.length === 0 && (
          <div style={S.drawerEmpty}>Sin reportes en esta colonia con los filtros activos.</div>
        )}
        {!loading && reportes.map(r => {
          const isExpanded = expandedId === r.id;
          const esRevision = r.estado === 'en_revision';
          const desc = r.descripcion || '';
          return (
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
                <span style={{ fontSize:'0.66rem', color:'var(--color-primary)', fontWeight:600, flexShrink:0 }}>→ ver</span>
              </div>
              {isExpanded
                ? <div style={S.expandedDesc}>{desc}</div>
                : <div style={S.reportDesc}>{desc.length > 110 ? desc.slice(0, 110) + '…' : desc}</div>
              }
              <div style={S.reportDate}>{fmtDate(r.created_at)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Dropdown genérico ── */
function Dropdown({ label, options, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const isActive = value !== null && value !== undefined;
  const btnStyle = disabled
    ? { ...S.dropBtn, opacity:0.45, cursor:'not-allowed' }
    : isActive ? { ...S.dropBtn, ...S.dropBtnActive } : S.dropBtn;
  return (
    <div style={S.dropWrap} ref={ref}>
      <button style={btnStyle} onClick={() => !disabled && setOpen(o => !o)}>
        {label}{value ? `: ${value}` : ''} ▾
      </button>
      {open && !disabled && (
        <div style={S.menu}>
          {options.length === 0
            ? <span style={{ ...S.menuItem(false), display:'block', padding:'0.5rem 0.85rem', color:'var(--color-text-muted)', fontStyle:'italic' }}>Sin opciones</span>
            : options.map(opt => (
              <button
                key={opt.value ?? opt}
                style={S.menuItem((opt.label ?? opt) === value)}
                onClick={() => { onChange(opt.value ?? opt, opt.label ?? opt); setOpen(false); }}
              >
                {opt.label ?? opt}
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
}

/* ── Mapa con choropleth por colonias ── */
function ChoroplethMap({ coloniaData, metrica, onColoniaClick }) {
  const mapRef            = useRef(null);
  const dataLayerRef      = useRef(null);
  const geojsonLoaded     = useRef(false);
  const onColoniaClickRef = useRef(onColoniaClick);
  const [tooltip, setTooltip] = useState(null); // { x, y, nombre, total }

  useEffect(() => { onColoniaClickRef.current = onColoniaClick; }, [onColoniaClick]);

  /* Construir lookup normalizado: nombre → { total, peso_total } */
  const lookup = useRef({});
  useEffect(() => {
    const map = {};
    coloniaData.forEach(c => {
      const key = c.colonia?.toLowerCase().trim();
      if (key) map[key] = c;
    });
    lookup.current = map;
  }, [coloniaData]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;

    // Crear Data Layer
    const dataLayer = new window.google.maps.Data({ map });
    dataLayerRef.current = dataLayer;

    // Cargar GeoJSON de colonias
    dataLayer.loadGeoJson('/colonias-zmg.geojson', {}, () => {
      geojsonLoaded.current = true;
      applyStyles(dataLayer, lookup.current, metrica);
    });

    // Hover: mostrar tooltip
    dataLayer.addListener('mouseover', (event) => {
      const nombre = event.feature.getProperty('nombre');
      const key    = nombre?.toLowerCase().trim();
      const data   = lookup.current[key];
      map.setOptions({ draggableCursor: 'pointer' });
      const latLng = event.latLng;
      const proj   = map.getProjection();
      const bounds = map.getBounds();
      if (proj && bounds) {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const mapDiv = map.getDiv();
        const w = mapDiv.offsetWidth;
        const h = mapDiv.offsetHeight;
        const x = ((latLng.lng() - sw.lng()) / (ne.lng() - sw.lng())) * w;
        const y = ((ne.lat() - latLng.lat()) / (ne.lat() - sw.lat())) * h;
        setTooltip({ x, y, nombre, total: data?.total ?? 0 });
      }
      dataLayer.overrideStyle(event.feature, { strokeWeight: 2.5, strokeColor: '#1B2A4A' });
    });

    dataLayer.addListener('mouseout', (event) => {
      map.setOptions({ draggableCursor: null });
      setTooltip(null);
      dataLayer.revertStyle(event.feature);
    });

    // Click: abrir drawer de la colonia
    dataLayer.addListener('click', (event) => {
      const nombre    = event.feature.getProperty('nombre');
      const municipio = event.feature.getProperty('municipio');
      if (nombre) onColoniaClickRef.current?.(nombre, municipio);
    });
  }, []);

  /* Re-aplicar estilos cuando cambian los datos o la métrica */
  useEffect(() => {
    if (dataLayerRef.current && geojsonLoaded.current) {
      applyStyles(dataLayerRef.current, lookup.current, metrica);
    }
  }, [coloniaData, metrica]);

  return (
    <div style={{ width:'100%', height:'100%', position:'relative' }}>
      <GoogleMap
        mapContainerStyle={{ width:'100%', height:'100%' }}
        center={MAP_CENTER}
        zoom={12}
        onLoad={onMapLoad}
        options={{ mapTypeControl:false, streetViewControl:false, fullscreenControl:false }}
      />

      {/* Tooltip flotante */}
      {tooltip && (
        <div style={{ ...S.tooltip, left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.nombre}</strong>
          {' — '}{tooltip.total} reporte{tooltip.total !== 1 ? 's' : ''}
        </div>
      )}

      {/* Leyenda */}
      <div style={S.legend}>
        <strong style={{ fontSize:'0.73rem', marginBottom:2 }}>Reportes por colonia</strong>
        <div style={S.legendRow}><div style={S.legendBox('#FFF176')} /> 1 reporte</div>
        <div style={S.legendRow}><div style={S.legendBox('#FFB300')} /> 2–3 reportes</div>
        <div style={S.legendRow}><div style={S.legendBox('#F57C00')} /> 4–6 reportes</div>
        <div style={S.legendRow}><div style={S.legendBox('#D32F2F')} /> 7+ reportes</div>
      </div>
    </div>
  );
}

function applyStyles(dataLayer, lookup, metrica) {
  dataLayer.setStyle((feature) => {
    const nombre = feature.getProperty('nombre');
    const key    = nombre?.toLowerCase().trim();
    const data   = lookup[key];
    const color  = coloniaColor(data, metrica);
    if (!color) {
      return { fillColor:'#888', fillOpacity:0.04, strokeColor:'#aaa', strokeWeight:0.6, strokeOpacity:0.4 };
    }
    return {
      fillColor:    color.fill,
      fillOpacity:  color.opacity,
      strokeColor:  '#555',
      strokeWeight: 1,
      strokeOpacity: 0.7,
    };
  });
}

/* ── Página principal ── */
export default function SuperadminHeatmap() {
  const navigate = useNavigate();
  const [temporalidad,    setTemporalidad]    = useState('mes');
  const [anio,            setAnio]            = useState(CURRENT_YEAR);
  const [mes,             setMes]             = useState(new Date().getMonth() + 1);
  const [semana,          setSemana]          = useState(1);
  const [categorias,      setCategorias]      = useState([]);
  const [categoriaId,     setCategoriaId]     = useState(null);
  const [categoriaNombre, setCategoriaNombre] = useState(null);
  const [subcategorias,   setSubcategorias]   = useState([]);
  const [subcategoriaId,  setSubcategoriaId]  = useState(null);
  const [subcatNombre,    setSubcatNombre]    = useState(null);
  const [sector,          setSector]          = useState(null);
  const [estado,          setEstado]          = useState('abiertos');
  const [metrica,         setMetrica]         = useState('cantidad');
  const [coloniaData,     setColoniaData]     = useState([]);
  const [drawer, setDrawer] = useState({ open:false, colonia:null, reportes:[], loading:false, expandedId:null });

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY || '',
    libraries: LIBRARIES,
  });

  useEffect(() => {
    api.get('/categories')
      .then(({ data }) => setCategorias(data.categorias || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const cat = categorias.find(c => c.id === categoriaId);
    setSubcategorias(cat ? cat.subcategorias : []);
    setSubcategoriaId(null);
    setSubcatNombre(null);
  }, [categoriaId, categorias]);

  const fetchData = useCallback(() => {
    const params = { estado, metrica };
    if (temporalidad) {
      params.temporalidad = temporalidad;
      params.anio = anio;
      if (temporalidad === 'mes')    params.mes    = mes;
      if (temporalidad === 'semana') params.semana = semana;
    }
    if (categoriaId)    params.categoria_id    = categoriaId;
    if (subcategoriaId) params.subcategoria_id = subcategoriaId;
    if (sector)         params.sector_nombre   = sector;

    api.get('/heatmap', { params })
      .then(({ data }) => setColoniaData(data.colonias || []))
      .catch(() => setColoniaData([]));
  }, [temporalidad, anio, mes, semana, categoriaId, subcategoriaId, sector, estado, metrica]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleColoniaClick = useCallback((nombre, municipio) => {
    setDrawer({ open:true, colonia:nombre, municipio: municipio || null, reportes:[], loading:true, expandedId:null });
    const params = { colonia: nombre, estado };
    if (municipio)   params.municipio    = municipio;
    if (categoriaId) params.categoria_id = categoriaId;
    api.get('/reports/by-colonia', { params })
      .then(({ data }) => setDrawer(d => ({ ...d, loading:false, reportes: data.reportes || [] })))
      .catch(() => setDrawer(d => ({ ...d, loading:false, reportes:[] })));
  }, [estado, categoriaId]);

  const catOpts    = categorias.map(c => ({ value: c.id, label: c.nombre }));
  const subcatOpts = subcategorias.map(s => ({ value: s.id, label: s.nombre }));

  return (
    <SuperadminLayout>
      <div style={S.page}>
        <h2 style={S.title}>Mapa de calor</h2>

        <div style={S.filters}>
          {/* Temporalidad */}
          <div style={S.filterGroup}>
            <Dropdown
              label="Temporalidad"
              options={['año','mes','semana']}
              value={temporalidad}
              onChange={v => setTemporalidad(v)}
            />
            {temporalidad === 'año' && (
              <input style={S.numInput} type="number" min="2000" max="2099"
                value={anio} onChange={e => setAnio(Number(e.target.value))} />
            )}
            {temporalidad === 'mes' && (
              <>
                <Dropdown
                  label="Mes"
                  options={MESES.map((m, i) => ({ value: i + 1, label: m }))}
                  value={MESES[mes - 1]}
                  onChange={v => setMes(Number(v))}
                />
                <input style={S.numInput} type="number" min="2000" max="2099"
                  value={anio} onChange={e => setAnio(Number(e.target.value))} />
              </>
            )}
            {temporalidad === 'semana' && (
              <>
                <input style={S.numInput} type="number" min="1" max="52"
                  value={semana} onChange={e => setSemana(Number(e.target.value))} placeholder="Semana" />
                <span style={S.yearFixed}>{CURRENT_YEAR}</span>
              </>
            )}
          </div>

          {/* Categoría */}
          <Dropdown
            label="Categoría"
            options={catOpts}
            value={categoriaNombre}
            onChange={(id, label) => { setCategoriaId(id); setCategoriaNombre(label); }}
          />

          {/* Subcategoría */}
          {categoriaId ? (
            <Dropdown
              label="Subcategoría"
              options={subcatOpts}
              value={subcatNombre}
              onChange={(id, label) => { setSubcategoriaId(id); setSubcatNombre(label); }}
            />
          ) : (
            <button style={{ ...S.dropBtn, opacity:0.5, cursor:'not-allowed' }} disabled>
              Subcategoría ▾
            </button>
          )}

          {/* Sector */}
          <Dropdown label="Sector" options={SECTORES} value={sector} onChange={v => setSector(v)} />

          {/* Reportes */}
          <Dropdown label="Reportes" options={['abiertos','cerrados']} value={estado} onChange={v => setEstado(v)} />

          {/* Métrica */}
          <Dropdown label="Métrica" options={['cantidad','urgencia']} value={metrica} onChange={v => setMetrica(v)} />
        </div>

        {/* Mapa */}
        <div style={S.mapWrap}>
          {isLoaded ? (
            <ChoroplethMap coloniaData={coloniaData} metrica={metrica} onColoniaClick={handleColoniaClick} />
          ) : (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--color-text-muted)' }}>
              Cargando mapa…
            </div>
          )}
          {drawer.open && (
            <ColoniaDrawer
              colonia={drawer.colonia}
              municipio={drawer.municipio}
              reportes={drawer.reportes}
              loading={drawer.loading}
              expandedId={drawer.expandedId}
              onToggleExpand={(id) => setDrawer(d => ({ ...d, expandedId: d.expandedId === id ? null : id }))}
              onClose={() => setDrawer(d => ({ ...d, open:false }))}
              onNavigate={(id) => navigate(`/superadmin/review/escalado/${id}`)}
            />
          )}
        </div>
      </div>
    </SuperadminLayout>
  );
}
