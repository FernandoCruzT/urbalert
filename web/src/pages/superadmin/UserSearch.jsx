import { useState, useCallback, useRef } from 'react';
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
  page:      { padding: '0.85rem 1rem', height: '100%', overflowY: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' },
  header:    { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' },
  title:     { fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary)', flexShrink: 0 },
  select:    { padding: '0.42rem 0.65rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--color-text)', background: '#fff', cursor: 'pointer', outline: 'none', flexShrink: 0 },
  searchWrap:{ position: 'relative', flex: 1, minWidth: 180 },
  searchInput:{ width: '100%', padding: '0.42rem 2.4rem 0.42rem 0.65rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' },
  searchBtn: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 36, background: 'var(--color-primary)', border: 'none', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' },
  // Tabla
  tableWrap: { background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' },
  tableScroll:{ overflowX: 'auto', flex: 1 },
  tableBar:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.85rem', borderBottom: '1px solid #F3F4F6' },
  barLeft:   { fontSize: '0.78rem', color: 'var(--color-text-muted)' },
  pagination:{ display: 'flex', alignItems: 'center', gap: '0.5rem' },
  pageBtn:   (disabled) => ({ background: 'none', border: '1px solid #E5E7EB', borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', padding: '3px 7px', color: disabled ? '#D1D5DB' : 'var(--color-primary)', display: 'flex', alignItems: 'center', lineHeight: 1 }),
  pageInfo:  { fontSize: '0.78rem', color: 'var(--color-text-muted)', userSelect: 'none' },
  table:     { width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' },
  th:        { textAlign: 'left', padding: '0.55rem 0.85rem', fontSize: '0.72rem', color: 'var(--color-text-muted)', borderBottom: '2px solid #E5E7EB', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, whiteSpace: 'nowrap', background: 'var(--color-surface)' },
  tr:        (hover) => ({ background: hover ? '#F1F5F9' : 'var(--color-surface)', cursor: 'pointer', transition: 'background 0.1s' }),
  td:        { padding: '0.6rem 0.85rem', fontSize: '0.83rem', color: 'var(--color-text)', borderBottom: '1px solid #F3F4F6', verticalAlign: 'middle', whiteSpace: 'nowrap' },
  tdWrap:    { whiteSpace: 'normal', minWidth: 120 },
  badge:     (estado) => {
    const b = ESTADO_BADGE[estado] || { bg: '#F3F4F6', color: '#6B7280' };
    return { display: 'inline-block', padding: '1px 8px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, background: b.bg, color: b.color, textTransform: 'capitalize' };
  },
  empty:     { textAlign: 'center', color: 'var(--color-text-muted)', padding: '2.5rem', fontSize: '0.88rem' },
};

// ── Hook de paginación ────────────────────────────────────────────────────────

function usePagination(rows) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const slice = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const reset = () => setPage(0);
  return { slice, page, totalPages, setPage, reset };
}

// ── Tabla ciudadanos ──────────────────────────────────────────────────────────

function TablaCiudadanos({ rows, navigate }) {
  const [hovered, setHovered] = useState(null);
  const { slice, page, totalPages, setPage, reset } = usePagination(rows);

  // Reset page si rows cambia
  useState(() => reset(), [rows]);

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
                <td style={S.td}>{r.nombre} {r.apellido}</td>
                <td style={S.td}>{r.email}</td>
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

// ── Tabla autoridades (una sola vista, scroll horizontal) ─────────────────────

function TablaAutoridades({ rows, navigate }) {
  const [hovered, setHovered] = useState(null);
  const { slice, page, totalPages, setPage, reset } = usePagination(rows);

  useState(() => reset(), [rows]);

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
                <td style={S.td}>{r.nombre} {r.apellido}</td>
                <td style={S.td}>{r.email}</td>
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
  const [tipo,     setTipo]     = useState('Ciudadano');
  const [query,    setQuery]    = useState('');
  const [rows,     setRows]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef(null);

  const fetchData = useCallback(async (searchQuery, tipoActual) => {
    setLoading(true);
    setSearched(true);
    try {
      if (tipoActual === 'Ciudadano') {
        const { data } = await api.get('/users/citizens', { params: { search: searchQuery } });
        setRows(data.ciudadanos || []);
      } else {
        const { data } = await api.get('/users/authorities');
        const q = searchQuery.toLowerCase().trim();
        const filtered = q
          ? (data.autoridades || []).filter(a =>
              `${a.nombre} ${a.apellido}`.toLowerCase().includes(q) ||
              a.email.toLowerCase().includes(q)
            )
          : (data.autoridades || []);
        setRows(filtered);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    fetchData(query, tipo);
  }

  function handleTipoChange(nuevoTipo) {
    setTipo(nuevoTipo);
    setRows([]);
    setSearched(false);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <SuperadminLayout>
      <div style={S.page}>
        {/* Header + toolbar en una sola línea */}
        <form style={S.header} onSubmit={handleSearch}>
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

        {/* Resultados */}
        {loading ? (
          <div style={S.empty}>Buscando…</div>
        ) : searched ? (
          <div style={S.tableWrap}>
            {tipo === 'Ciudadano'
              ? <TablaCiudadanos rows={rows} navigate={navigate} />
              : <TablaAutoridades rows={rows} navigate={navigate} />
            }
          </div>
        ) : (
          <div style={S.empty}>Escribe un nombre o email y presiona buscar</div>
        )}
      </div>
    </SuperadminLayout>
  );
}
