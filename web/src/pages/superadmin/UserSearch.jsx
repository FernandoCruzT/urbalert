import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import SuperadminLayout from '../../layouts/SuperadminLayout';
import api from '../../services/api';

// ── Constantes ────────────────────────────────────────────────────────────────

const TIPOS = ['Ciudadano', 'Autoridad'];
const PAGE_SIZE = 20;

const ESTADO_BADGE = {
  activa:      { bg: '#E8F5E9', color: '#2E7D32' },
  advertida:   { bg: '#FFFDE7', color: '#F57F17' },
  restringida: { bg: '#FFF3E0', color: '#E65100' },
  suspendida:  { bg: '#FFEBEE', color: '#C62828' },
};

// ── Estilos ───────────────────────────────────────────────────────────────────

const S = {
  page:       { padding: '0.85rem 1rem', height: '100%', overflowY: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' },
  header:     { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' },
  title:      { fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 },
  select:     { padding: '0.42rem 0.65rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--color-text)', background: '#fff', cursor: 'pointer', outline: 'none', flexShrink: 0 },
  searchWrap: { position: 'relative', flex: 1, minWidth: 180 },
  searchInput:{ width: '100%', padding: '0.42rem 2.4rem 0.42rem 0.65rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' },
  searchBtn:  { position: 'absolute', right: 0, top: 0, bottom: 0, width: 36, background: 'var(--color-primary)', border: 'none', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
  filterBar:  { display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem', flexWrap: 'wrap' },
  pill:       (active) => ({ padding: '0.26rem 0.75rem', borderRadius: 20, fontSize: '0.76rem', fontWeight: active ? 700 : 400, border: `1px solid ${active ? 'var(--color-primary)' : '#D1D5DB'}`, background: active ? 'var(--color-primary)' : '#fff', color: active ? '#fff' : 'var(--color-text)', cursor: 'pointer', transition: 'all 0.15s' }),
  filterSel:  { padding: '0.26rem 0.65rem', border: '1px solid #D1D5DB', borderRadius: 20, fontSize: '0.76rem', fontFamily: 'inherit', color: 'var(--color-text)', background: '#fff', cursor: 'pointer', outline: 'none' },
  // Tabla
  tableWrap:  { background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' },
  tableScroll:{ overflowX: 'auto', flex: 1 },
  tableBar:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.85rem', borderBottom: '1px solid #F3F4F6' },
  barLeft:    { fontSize: '0.78rem', color: 'var(--color-text-muted)' },
  pagination: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  pageBtn:    (disabled) => ({ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', padding: '3px 7px', color: disabled ? '#D1D5DB' : 'var(--color-primary)', display: 'flex', alignItems: 'center', lineHeight: 1 }),
  pageInfo:   { fontSize: '0.78rem', color: 'var(--color-text-muted)', userSelect: 'none' },
  table:      { width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' },
  th:         { textAlign: 'left', padding: '0.55rem 0.85rem', fontSize: '0.72rem', color: 'var(--color-text-muted)', borderBottom: '2px solid #E5E7EB', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', background: 'var(--color-surface)' },
  tr:         (hover) => ({ background: hover ? '#F1F5F9' : 'var(--color-surface)', cursor: 'pointer', transition: 'background 0.1s' }),
  td:         { padding: '0.6rem 0.85rem', fontSize: '0.83rem', color: 'var(--color-text)', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle', whiteSpace: 'nowrap' },
  tdWrap:     { whiteSpace: 'normal', minWidth: 120 },
  badge:      (estado) => {
    const b = ESTADO_BADGE[estado] || { bg: '#F3F4F6', color: '#6B7280' };
    return { display: 'inline-block', padding: '1px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, background: b.bg, color: b.color, textTransform: 'capitalize' };
  },
  empty:      { textAlign: 'center', color: 'var(--color-text-muted)', padding: '2.5rem', fontSize: '0.88rem' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function highlightText(text, query) {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = String(text).split(new RegExp(`(${escaped})`, 'gi'));
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1
      ? <span key={i} style={{ background: '#FFF176', color: '#000' }}>{part}</span>
      : part
  );
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Hook de paginación ────────────────────────────────────────────────────────

function usePagination(rows) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [rows]);
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const slice = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  return { slice, page, totalPages, setPage };
}

// ── Filter bars ───────────────────────────────────────────────────────────────

function FilterBarCiudadanos({ filter, onChange }) {
  const opts = [
    { key: 'todos',       label: 'Todos' },
    { key: 'activos',     label: 'Activos' },
    { key: 'suspendidos', label: 'Suspendidos' },
  ];
  return (
    <div style={S.filterBar}>
      {opts.map(o => (
        <button key={o.key} type="button" style={S.pill(filter === o.key)} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

const AUTORIDAD_COLS = [
  { key: 'todos',        label: 'Todos' },
  { key: 'categoria',    label: 'Categoría' },
  { key: 'sector',       label: 'Sector' },
  { key: 'departamento', label: 'Departamento' },
];

function FilterBarAutoridades({ filterCol, filterVal, onColChange, onValChange, options }) {
  return (
    <div style={S.filterBar}>
      {AUTORIDAD_COLS.map(c => (
        <button key={c.key} type="button" style={S.pill(filterCol === c.key)} onClick={() => onColChange(c.key)}>
          {c.label}
        </button>
      ))}
      {filterCol !== 'todos' && (
        <select style={S.filterSel} value={filterVal} onChange={e => onValChange(e.target.value)}>
          <option value="">Todos</option>
          {options.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      )}
    </div>
  );
}

// ── Tabla ciudadanos ──────────────────────────────────────────────────────────

function TablaCiudadanos({ rows, navigate, query }) {
  const [hovered, setHovered] = useState(null);
  const { slice, page, totalPages, setPage } = usePagination(rows);

  if (rows.length === 0) return <div style={S.empty}>Sin resultados</div>;

  return (
    <>
      <div style={S.tableBar}>
        <span style={S.barLeft}>{rows.length} resultado{rows.length !== 1 ? 's' : ''}</span>
        {totalPages > 1 && (
          <div style={S.pagination}>
            <button style={S.pageBtn(page === 0)} disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <FiChevronLeft size={13} />
            </button>
            <span style={S.pageInfo}>{page + 1} / {totalPages}</span>
            <button style={S.pageBtn(page >= totalPages - 1)} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <FiChevronRight size={13} />
            </button>
          </div>
        )}
      </div>
      <div style={S.tableScroll}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Nombre completo</th>
              <th style={S.th}>E-mail</th>
              <th style={S.th}>Teléfono</th>
              <th style={S.th}>Estado de cuenta</th>
              <th style={S.th}>Rep. falsos</th>
            </tr>
          </thead>
          <tbody>
            {slice.map(r => (
              <tr
                key={r.id}
                style={S.tr(hovered === r.id)}
                onMouseEnter={() => setHovered(r.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => navigate(`/superadmin/edit-profile/ciudadano/${r.id}`)}
              >
                <td style={S.td}>{highlightText(`${r.nombre} ${r.apellido}`, query)}</td>
                <td style={S.td}>{highlightText(r.email, query)}</td>
                <td style={S.td}>{r.telefono || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                <td style={S.td}><span style={S.badge(r.estado_cuenta)}>{r.estado_cuenta}</span></td>
                <td style={{ ...S.td, textAlign: 'center' }}>
                  {r.reportes_falsos > 0
                    ? <span style={{ color: '#C62828', fontWeight: 600 }}>{r.reportes_falsos}</span>
                    : 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Tabla autoridades ─────────────────────────────────────────────────────────

function TablaAutoridades({ rows, navigate, query }) {
  const [hovered, setHovered] = useState(null);
  const { slice, page, totalPages, setPage } = usePagination(rows);

  if (rows.length === 0) return <div style={S.empty}>Sin resultados</div>;

  return (
    <>
      <div style={S.tableBar}>
        <span style={S.barLeft}>{rows.length} resultado{rows.length !== 1 ? 's' : ''}</span>
        {totalPages > 1 && (
          <div style={S.pagination}>
            <button style={S.pageBtn(page === 0)} disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <FiChevronLeft size={13} />
            </button>
            <span style={S.pageInfo}>{page + 1} / {totalPages}</span>
            <button style={S.pageBtn(page >= totalPages - 1)} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <FiChevronRight size={13} />
            </button>
          </div>
        )}
      </div>
      <div style={S.tableScroll}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Nombre completo</th>
              <th style={S.th}>E-mail</th>
              <th style={S.th}>Teléfono</th>
              <th style={S.th}>Categoría</th>
              <th style={S.th}>Sector</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Reportes</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Carga</th>
              <th style={S.th}>Departamento</th>
            </tr>
          </thead>
          <tbody>
            {slice.map(r => (
              <tr
                key={r.id}
                style={S.tr(hovered === r.id)}
                onMouseEnter={() => setHovered(r.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => navigate(`/superadmin/edit-profile/autoridad/${r.id}`)}
              >
                <td style={S.td}>{highlightText(`${r.nombre} ${r.apellido}`, query)}</td>
                <td style={S.td}>{highlightText(r.email, query)}</td>
                <td style={S.td}>{r.telefono || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                <td style={S.td}>{r.categoria_nombre || '—'}</td>
                <td style={S.td}>{r.sector_nombre || '—'}</td>
                <td style={{ ...S.td, textAlign: 'center' }}>{r.reportes_activos ?? 0}</td>
                <td style={{ ...S.td, textAlign: 'center' }}>
                  {r.carga_ponderada != null ? Number(r.carga_ponderada).toFixed(1) : '—'}
                </td>
                <td style={S.td}>{r.departamento || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function UserSearch() {
  const navigate = useNavigate();
  const [tipo,           setTipo]           = useState('Ciudadano');
  const [query,          setQuery]          = useState('');
  const [allCiudadanos,  setAllCiudadanos]  = useState([]);
  const [allAutoridades, setAllAutoridades] = useState([]);
  const [loading,        setLoading]        = useState(false);
  const inputRef = useRef(null);

  const debouncedQuery = useDebounce(query, 300);

  // Filtros navbar
  const [ciudadanoFilter,    setCiudadanoFilter]    = useState('todos');
  const [autoridadFilterCol, setAutoridadFilterCol] = useState('todos');
  const [autoridadFilterVal, setAutoridadFilterVal] = useState('');

  // Carga inicial de todos los datos
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const [ciudRes, autRes] = await Promise.all([
          api.get('/users/citizens'),
          api.get('/users/authorities'),
        ]);
        setAllCiudadanos(ciudRes.data.ciudadanos || []);
        setAllAutoridades(autRes.data.autoridades || []);
      } catch {
        // mantener arrays vacíos
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  // Valores únicos para el select del filtro de autoridades
  const autoridadFilterOptions = useMemo(() => {
    const fieldMap = { categoria: 'categoria_nombre', sector: 'sector_nombre', departamento: 'departamento' };
    const field = fieldMap[autoridadFilterCol];
    if (!field) return [];
    return [...new Set(allAutoridades.map(r => r[field]).filter(Boolean))].sort();
  }, [allAutoridades, autoridadFilterCol]);

  // Filas filtradas (texto + navbar), computadas en cliente
  const filteredRows = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();

    if (tipo === 'Ciudadano') {
      let rows = allCiudadanos;
      if (q) rows = rows.filter(r =>
        `${r.nombre} ${r.apellido}`.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      );
      if (ciudadanoFilter === 'activos')     rows = rows.filter(r => r.estado_cuenta === 'activa');
      if (ciudadanoFilter === 'suspendidos') rows = rows.filter(r => r.estado_cuenta === 'suspendida');
      return rows;
    } else {
      let rows = allAutoridades;
      if (q) rows = rows.filter(r =>
        `${r.nombre} ${r.apellido}`.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      );
      if (autoridadFilterCol !== 'todos' && autoridadFilterVal) {
        const fieldMap = { categoria: 'categoria_nombre', sector: 'sector_nombre', departamento: 'departamento' };
        rows = rows.filter(r => r[fieldMap[autoridadFilterCol]] === autoridadFilterVal);
      }
      return rows;
    }
  }, [tipo, debouncedQuery, allCiudadanos, allAutoridades, ciudadanoFilter, autoridadFilterCol, autoridadFilterVal]);

  function handleTipoChange(nuevoTipo) {
    setTipo(nuevoTipo);
    setQuery('');
    setCiudadanoFilter('todos');
    setAutoridadFilterCol('todos');
    setAutoridadFilterVal('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleAutoridadColChange(col) {
    setAutoridadFilterCol(col);
    setAutoridadFilterVal('');
  }

  return (
    <SuperadminLayout>
      <div style={S.page}>
        {/* Header + toolbar en una sola línea */}
        <form style={S.header} onSubmit={e => e.preventDefault()}>
          <h2 style={S.title}>Búsqueda de usuarios</h2>
          <select style={S.select} value={tipo} onChange={e => handleTipoChange(e.target.value)}>
            {TIPOS.map(t => <option key={t}>{t}</option>)}
          </select>
          <div style={S.searchWrap}>
            <input
              ref={inputRef}
              style={S.searchInput}
              placeholder="Buscar por nombre o email…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <button type="submit" style={S.searchBtn}>
              <FiSearch size={14} />
            </button>
          </div>
        </form>

        {/* Navbar de filtros */}
        {tipo === 'Ciudadano'
          ? <FilterBarCiudadanos filter={ciudadanoFilter} onChange={setCiudadanoFilter} />
          : <FilterBarAutoridades
              filterCol={autoridadFilterCol}
              filterVal={autoridadFilterVal}
              onColChange={handleAutoridadColChange}
              onValChange={setAutoridadFilterVal}
              options={autoridadFilterOptions}
            />
        }

        {/* Resultados */}
        {loading ? (
          <div style={S.empty}>Cargando…</div>
        ) : (
          <div style={S.tableWrap}>
            {tipo === 'Ciudadano'
              ? <TablaCiudadanos rows={filteredRows} navigate={navigate} query={debouncedQuery} />
              : <TablaAutoridades rows={filteredRows} navigate={navigate} query={debouncedQuery} />
            }
          </div>
        )}
      </div>
    </SuperadminLayout>
  );
}
