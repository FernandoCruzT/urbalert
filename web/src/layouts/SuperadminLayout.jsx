import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  FiMenu, FiX, FiMap, FiUserPlus, FiSearch,
  FiBell, FiClipboard, FiRefreshCw,
  FiLogOut, FiChevronDown, FiUser,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const NAV_ITEMS = [
  { label: 'Mapa de calor',           icon: FiMap,       path: '/superadmin/heatmap' },
  { label: 'Nuevo perfil',            icon: FiUserPlus,  path: '/superadmin/new-profile' },
  { label: 'Búsqueda de usuarios',    icon: FiSearch,    path: '/superadmin/users' },
  { label: 'Notificaciones',          icon: FiBell,      path: '/superadmin/notifications' },
  { label: 'Revisión de reportes',    icon: FiClipboard, path: '/superadmin/review' },
  { label: 'Reasignación de reportes',icon: FiRefreshCw, path: '/superadmin/reassign' },
];

const S = {
  root:    { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
  navbar:  {
    backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '0 1.25rem', height: 56, flexShrink: 0, zIndex: 100,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  iconBtn: { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 },
  logo:    { color: '#fff', fontWeight: 700, fontSize: '1.05rem', letterSpacing: 0.3, userSelect: 'none' },
  accent:  { color: 'var(--color-accent)', fontWeight: 900 },
  body:    { display: 'flex', flex: 1, overflow: 'hidden' },
  aside:   {
    backgroundColor: 'var(--color-primary)', flexShrink: 0,
    overflowX: 'hidden', transition: 'width 0.22s ease',
  },
  asideInner: { width: 224, paddingTop: 8 },
  navLink: (active) => ({
    display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.7rem 1.1rem',
    color: '#fff', textDecoration: 'none', fontSize: '0.85rem', whiteSpace: 'nowrap',
    backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'transparent',
    transition: 'background-color 0.15s',
  }),
  main: {
    flex: 1, overflowY: 'auto', overflowX: 'hidden', backgroundColor: 'var(--color-bg)',
    display: 'flex', flexDirection: 'column',
  },
  avatarBtn: {
    background: 'none', border: 'none', color: '#fff',
    display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
  },
  avatar: {
    width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--color-secondary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: '0.85rem', color: '#fff', flexShrink: 0,
  },
  dropdown: {
    position: 'absolute', right: 0, top: 'calc(100% + 6px)',
    backgroundColor: 'var(--color-surface)', boxShadow: 'var(--shadow-md)',
    borderRadius: 'var(--radius-md)', minWidth: 160, zIndex: 200, overflow: 'hidden',
  },
  dropItem: {
    width: '100%', padding: '0.7rem 1rem', background: 'none', border: 'none',
    display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
    color: 'var(--color-text)', fontSize: '0.85rem', textAlign: 'left',
  },
  badge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, borderRadius: 9, backgroundColor: 'var(--color-accent)',
    color: '#fff', fontSize: '0.68rem', fontWeight: 700, padding: '0 4px', marginLeft: 'auto',
  },
};

export default function SuperadminLayout({ children }) {
  const [open,        setOpen]        = useState(false);
  const [dropOpen,    setDropOpen]    = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropRef  = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Recargar conteo de no leídas al montar y al cambiar de ruta
  useEffect(() => {
    api.get('/notifications/unread-count')
      .then(res => setUnreadCount(res.data.count ?? 0))
      .catch(() => {});
  }, [location.pathname]);

  const initial = user?.nombre?.[0]?.toUpperCase() ?? 'A';
  const fullName = user ? `${user.nombre} ${user.apellido}` : '';

  return (
    <div style={S.root}>
      {/* ── Navbar ── */}
      <nav style={S.navbar}>
        <div style={S.navLeft}>
          <button style={{ ...S.iconBtn, fontSize: '1.2rem' }} onClick={() => setOpen(o => !o)}>
            {open ? <FiX /> : <FiMenu />}
          </button>
          <span style={S.logo}><span style={S.accent}>!U</span> Urbalert</span>
        </div>

        <div style={{ position: 'relative' }} ref={dropRef}>
          <button style={S.avatarBtn} onClick={() => setDropOpen(o => !o)}>
            <div style={S.avatar}>{initial}</div>
            <span style={{ fontSize: '0.83rem' }}>{fullName}</span>
            <FiChevronDown size={13} />
          </button>
          {dropOpen && (
            <div style={S.dropdown}>
              <button style={S.dropItem} onClick={() => { setDropOpen(false); navigate('/superadmin/profile'); }}>
                <FiUser size={14} /> Mi perfil
              </button>
              <button style={S.dropItem} onClick={() => { localStorage.removeItem('heatmap_filters'); logout(); navigate('/login'); }}>
                <FiLogOut size={14} /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ── Body ── */}
      <div style={S.body}>
        {/* Sidebar */}
        <aside style={{ ...S.aside, width: open ? 224 : 0 }}>
          <div style={S.asideInner}>
            {NAV_ITEMS.map(({ label, icon: Icon, path }) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setOpen(false)}
                style={({ isActive }) => S.navLink(isActive)}
              >
                <Icon size={16} />
                {label}
                {label === 'Notificaciones' && unreadCount > 0 && (
                  <span style={S.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
              </NavLink>
            ))}
          </div>
        </aside>

        {/* Contenido principal */}
        <main style={S.main}>{children}</main>
      </div>
    </div>
  );
}
