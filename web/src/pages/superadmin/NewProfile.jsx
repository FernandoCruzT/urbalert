import { useState, useEffect } from 'react';
import { FiEye, FiEyeOff, FiCheckCircle, FiUserPlus } from 'react-icons/fi';
import SuperadminLayout from '../../layouts/SuperadminLayout';
import api from '../../services/api';

const S = {
  page:    { padding: '1.5rem', paddingRight: '2rem', maxWidth: 900, margin: '0 auto', height: '100%', overflowY: 'auto', boxSizing: 'border-box' },
  title:   { fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '1.25rem' },
  toggle:  { display: 'flex', gap: 0, marginBottom: '1.5rem', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--color-primary)', width: 'fit-content' },
  togBtn:  (active) => ({
    padding: '0.5rem 1.5rem', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '0.88rem', fontWeight: 600,
    background: active ? 'var(--color-primary)' : 'var(--color-surface)',
    color:      active ? '#fff' : 'var(--color-primary)',
    transition: 'background 0.15s, color 0.15s',
  }),
  cols:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' },
  colSingle: { display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem', maxWidth: 460, margin: '0 auto' },
  card:    { background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '1.5rem' },
  secTitle:{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #F3F4F6' },
  fieldGrp:{ marginBottom: '1rem' },
  label:   { display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  input:   { width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', fontFamily: 'inherit', color: 'var(--color-text)', background: '#fff', boxSizing: 'border-box', outline: 'none' },
  inputErr:{ border: '1px solid #EF4444' },
  pwdWrap: { position: 'relative' },
  eyeBtn:  { position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0, display: 'flex', alignItems: 'center' },
  select:  { width: '100%', padding: '0.55rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', fontFamily: 'inherit', color: 'var(--color-text)', background: '#fff', boxSizing: 'border-box', outline: 'none', cursor: 'pointer' },
  footer:  { display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' },
  btnPrimary: { padding: '0.6rem 1.75rem', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'inherit' },
  errMsg:  { width: '100%', padding: '0.6rem 0.75rem', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-sm)', color: '#B91C1C', fontSize: '0.83rem', marginBottom: '1rem' },
  // Success banner
  success: { background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)', padding: '2rem', textAlign: 'center', maxWidth: 480, margin: '3rem auto' },
  sucIcon: { color: '#388E3C', display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' },
  sucTitle:{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '0.5rem' },
  sucSub:  { fontSize: '0.88rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 },
  sucData: { background: '#F8FAFC', borderRadius: 8, padding: '0.85rem 1rem', marginBottom: '1.25rem', textAlign: 'left' },
  sucRow:  { display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '3px 0' },
  sucKey:  { color: 'var(--color-text-muted)', fontWeight: 600 },
  sucVal:  { color: 'var(--color-text)' },
};

const TIPO_LABELS = { autoridad: 'Autoridad', superadmin: 'Superadmin' };

function Field({ label, error, children }) {
  return (
    <div style={S.fieldGrp}>
      <label style={S.label}>{label}</label>
      {children}
      {error && <div style={{ fontSize: '0.75rem', color: '#EF4444', marginTop: 3 }}>{error}</div>}
    </div>
  );
}

export default function NewProfile() {
  const [tipo,       setTipo]       = useState('autoridad');
  const [form,       setForm]       = useState({ nombre: '', apellido: '', email: '', telefono: '', password: '' });
  const [authForm,   setAuthForm]   = useState({ categoria_id: '', sector_id: '', departamento: '' });
  const [showPwd,    setShowPwd]    = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [sectores,   setSectores]   = useState([]);
  const [errors,     setErrors]     = useState({});
  const [apiError,   setApiError]   = useState('');
  const [busy,       setBusy]       = useState(false);
  const [creado,     setCreado]     = useState(null); // datos del perfil creado

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategorias(data.categorias || [])).catch(() => {});
    api.get('/users/sectors').then(({ data }) => setSectores(data.sectores || [])).catch(() => {});
  }, []);

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setA = (k, v) => setAuthForm(p => ({ ...p, [k]: v }));

  const NAME_RE  = /^[A-Za-záéíóúÁÉÍÓÚñÑüÜ\s]{2,50}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validate() {
    const errs = {};
    if (!form.nombre.trim())   errs.nombre   = 'Campo obligatorio';
    else if (!NAME_RE.test(form.nombre.trim()))   errs.nombre   = 'Solo letras y espacios (2-50 caracteres)';
    if (!form.apellido.trim()) errs.apellido = 'Campo obligatorio';
    else if (!NAME_RE.test(form.apellido.trim())) errs.apellido = 'Solo letras y espacios (2-50 caracteres)';
    if (!form.email.trim())    errs.email    = 'Campo obligatorio';
    else if (!EMAIL_RE.test(form.email))          errs.email    = 'Email inválido';
    if (form.telefono.trim() && !/^\d{10}$/.test(form.telefono.replace(/[\s\-().]/g, '')))
      errs.telefono = 'Debe tener 10 dígitos';
    if (!form.password)        errs.password = 'Campo obligatorio';
    else if (form.password.length < 8)            errs.password = 'Mínimo 8 caracteres';

    if (tipo === 'autoridad') {
      if (!authForm.categoria_id) errs.categoria_id = 'Selecciona una categoría';
      if (!authForm.sector_id)    errs.sector_id    = 'Selecciona un sector';
    }
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setApiError('');
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setBusy(true);

    try {
      if (tipo === 'autoridad') {
        const { data } = await api.post('/users/authority', {
          nombre:       form.nombre.trim(),
          apellido:     form.apellido.trim(),
          email:        form.email.trim(),
          telefono:     form.telefono.trim() || undefined,
          password:     form.password,
          categoria_id: authForm.categoria_id,
          sector_id:    authForm.sector_id,
          departamento: authForm.departamento.trim() || undefined,
        });
        setCreado({
          tipo: 'Autoridad',
          nombre:       `${data.usuario.nombre} ${data.usuario.apellido}`,
          email:        data.usuario.email,
          departamento: data.autoridad.departamento || '—',
          sector:       sectores.find(s => s.id === authForm.sector_id)?.nombre || '—',
          categoria:    categorias.find(c => c.id === authForm.categoria_id)?.nombre || '—',
        });
      } else {
        const { data } = await api.post('/auth/register', {
          nombre:   form.nombre.trim(),
          apellido: form.apellido.trim(),
          email:    form.email.trim(),
          telefono: form.telefono.trim() || undefined,
          password: form.password,
          rol:      'superadmin',
        });
        setCreado({
          tipo:   'Superadmin',
          nombre: `${data.usuario.nombre} ${data.usuario.apellido}`,
          email:  data.usuario.email,
        });
      }
    } catch (err) {
      setApiError(err?.response?.data?.message || 'Error al crear el perfil');
    } finally {
      setBusy(false);
    }
  }

  function handleNuevo() {
    setCreado(null);
    setForm({ nombre: '', apellido: '', email: '', telefono: '', password: '' });
    setAuthForm({ categoria_id: '', sector_id: '', departamento: '' });
    setErrors({});
    setApiError('');
  }

  // ── Pantalla de éxito ──────────────────────────────────────────────────────
  if (creado) {
    return (
      <SuperadminLayout>
        <div style={S.page}>
          <h2 style={S.title}>Nuevo perfil</h2>
          <div style={S.success}>
            <div style={S.sucIcon}><FiCheckCircle size={44} /></div>
            <div style={S.sucTitle}>Perfil creado correctamente</div>
            <div style={S.sucSub}>
              El usuario fue creado y deberá cambiar su contraseña en el primer inicio de sesión.
            </div>
            <div style={S.sucData}>
              {Object.entries({
                Tipo:        creado.tipo,
                Nombre:      creado.nombre,
                'E-mail':    creado.email,
                ...(creado.categoria   ? { Categoría:   creado.categoria }   : {}),
                ...(creado.departamento ? { Departamento: creado.departamento } : {}),
                ...(creado.sector      ? { Sector:       creado.sector }      : {}),
              }).map(([k, v]) => (
                <div key={k} style={S.sucRow}>
                  <span style={S.sucKey}>{k}</span>
                  <span style={S.sucVal}>{v}</span>
                </div>
              ))}
            </div>
            <button style={{ ...S.btnPrimary, display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto' }} onClick={handleNuevo}>
              <FiUserPlus size={15} /> Crear otro perfil
            </button>
          </div>
        </div>
      </SuperadminLayout>
    );
  }

  const isAutoridad = tipo === 'autoridad';

  // ── Formulario ─────────────────────────────────────────────────────────────
  return (
    <SuperadminLayout>
      <div style={S.page}>
        <h2 style={S.title}>Nuevo perfil</h2>

        {/* Toggle Autoridad / Superadmin */}
        <div style={S.toggle}>
          {['autoridad', 'superadmin'].map(t => (
            <button key={t} style={S.togBtn(tipo === t)} onClick={() => { setTipo(t); setErrors({}); setApiError(''); }}>
              {TIPO_LABELS[t]}
            </button>
          ))}
        </div>

        {apiError && <div style={S.errMsg}>{apiError}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div style={isAutoridad ? S.cols : S.colSingle}>
            {/* ── Columna izquierda: datos de usuario ── */}
            <div style={S.card}>
              <div style={S.secTitle}>Datos de usuario</div>

              <Field label="Nombre" error={errors.nombre}>
                <input style={{ ...S.input, ...(errors.nombre ? S.inputErr : {}) }}
                  value={form.nombre} onChange={e => setF('nombre', e.target.value)} placeholder="Nombre" />
              </Field>

              <Field label="Apellido" error={errors.apellido}>
                <input style={{ ...S.input, ...(errors.apellido ? S.inputErr : {}) }}
                  value={form.apellido} onChange={e => setF('apellido', e.target.value)} placeholder="Apellido" />
              </Field>

              <Field label="E-mail" error={errors.email}>
                <input style={{ ...S.input, ...(errors.email ? S.inputErr : {}) }}
                  type="email" value={form.email} onChange={e => setF('email', e.target.value)}
                  placeholder="correo@ejemplo.com" autoComplete="off" />
              </Field>

              <Field label="Teléfono" error={errors.telefono}>
                <input style={{ ...S.input, ...(errors.telefono ? S.inputErr : {}) }} type="tel" value={form.telefono}
                  onChange={e => setF('telefono', e.target.value)} placeholder="10 dígitos (opcional)" />
              </Field>

              <Field label="Contraseña" error={errors.password}>
                <div style={S.pwdWrap}>
                  <input
                    style={{ ...S.input, paddingRight: '2.25rem', ...(errors.password ? S.inputErr : {}) }}
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setF('password', e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                  />
                  <button type="button" style={S.eyeBtn} onClick={() => setShowPwd(v => !v)}>
                    {showPwd ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                  </button>
                </div>
              </Field>
            </div>

            {/* ── Columna derecha: datos de autoridad ── */}
            {isAutoridad && (
              <div style={S.card}>
                <div style={S.secTitle}>Datos de autoridad</div>

                <Field label="Categoría" error={errors.categoria_id}>
                  <select style={{ ...S.select, ...(errors.categoria_id ? S.inputErr : {}) }}
                    value={authForm.categoria_id} onChange={e => setA('categoria_id', e.target.value)}>
                    <option value="">— Selecciona una categoría —</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </Field>

                <Field label="Departamento">
                  <input style={S.input} value={authForm.departamento}
                    onChange={e => setA('departamento', e.target.value)}
                    placeholder="Nombre del departamento (opcional)" />
                </Field>

                <Field label="Sector" error={errors.sector_id}>
                  <select style={{ ...S.select, ...(errors.sector_id ? S.inputErr : {}) }}
                    value={authForm.sector_id} onChange={e => setA('sector_id', e.target.value)}>
                    <option value="">— Selecciona un sector —</option>
                    {sectores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>

          <div style={S.footer}>
            <button type="submit" style={S.btnPrimary} disabled={busy}>
              {busy ? 'Creando…' : 'Crear perfil'}
            </button>
          </div>
        </form>
      </div>
    </SuperadminLayout>
  );
}
