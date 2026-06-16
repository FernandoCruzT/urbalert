const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/connection');
const { isValidEmail, isValidPhone, isValidName, PASSWORD_MIN_LENGTH } = require('../utils/validators');

// ─── helpers ─────────────────────────────────────────────────────────────────

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

/** Devuelve el perfil de rol y valida restricciones según el rol del usuario. */
async function fetchProfile(t, usuario) {
  switch (usuario.rol) {
    case 'ciudadano': {
      const perfil = await t.oneOrNone(
        'SELECT id, estado_cuenta, reportes_falsos FROM ciudadano WHERE usuario_id = $1',
        usuario.id
      );
      if (!perfil) throw { status: 404, message: 'Perfil de ciudadano no encontrado' };
      if (perfil.estado_cuenta === 'suspendida') {
        throw { status: 403, message: 'Cuenta suspendida. Contacta al administrador.' };
      }
      return perfil;
    }
    case 'autoridad': {
      const perfil = await t.oneOrNone(
        'SELECT id, departamento, carga_ponderada, reportes_activos FROM autoridad WHERE usuario_id = $1',
        usuario.id
      );
      if (!perfil) throw { status: 404, message: 'Perfil de autoridad no encontrado' };
      return perfil;
    }
    case 'superadmin': {
      const perfil = await t.oneOrNone(
        'SELECT id FROM superadmin WHERE usuario_id = $1',
        usuario.id
      );
      if (!perfil) throw { status: 404, message: 'Perfil de superadmin no encontrado' };
      return perfil;
    }
    default:
      throw { status: 400, message: 'Rol no reconocido' };
  }
}

// ─── register ────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * - Sin rol (o rol='ciudadano'): registro público de ciudadano.
 * - rol='superadmin': crea superadmin, requiere JWT de superadmin en el header.
 */
async function register(req, res) {
  const { nombre, apellido, email, telefono, password, rol: rolSolicitado = 'ciudadano' } = req.body;

  // Superadmin solo puede crearlo otro superadmin autenticado
  if (rolSolicitado === 'superadmin') {
    const tokenHeader = req.headers.authorization?.split(' ')[1];
    if (!tokenHeader) {
      return res.status(401).json({ message: 'Se requiere autenticación para crear un superadmin' });
    }
    try {
      const decoded = jwt.verify(tokenHeader, process.env.JWT_SECRET);
      if (decoded.role !== 'superadmin') {
        return res.status(403).json({ message: 'Solo un superadmin puede crear otro superadmin' });
      }
    } catch {
      return res.status(401).json({ message: 'Token inválido' });
    }
  }

  if (!nombre || !apellido || !email || !password) {
    return res.status(400).json({ message: 'Faltan campos obligatorios: nombre, apellido, email, password' });
  }
  if (!isValidName(nombre))
    return res.status(400).json({ message: 'Nombre inválido: solo letras y espacios (2-50 caracteres)' });
  if (!isValidName(apellido))
    return res.status(400).json({ message: 'Apellido inválido: solo letras y espacios (2-50 caracteres)' });
  if (!isValidEmail(email))
    return res.status(400).json({ message: 'Formato de correo inválido' });
  if (telefono?.trim() && !isValidPhone(telefono))
    return res.status(400).json({ message: 'El teléfono debe tener 10 dígitos' });
  if (password.length < PASSWORD_MIN_LENGTH)
    return res.status(400).json({ message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres` });

  try {
    const result = await db.tx(async (t) => {
      const existe = await t.oneOrNone(
        'SELECT id FROM usuario WHERE email = $1',
        email.toLowerCase().trim()
      );
      if (existe) throw { status: 409, message: 'El correo ya está registrado' };

      const password_hash = await bcrypt.hash(password, 12);

      if (rolSolicitado === 'superadmin') {
        const usuario = await t.one(
          `INSERT INTO usuario (nombre, apellido, email, telefono, password_hash, rol, requiere_cambio_password)
           VALUES ($1, $2, $3, $4, $5, 'superadmin', TRUE)
           RETURNING id, nombre, apellido, email, rol`,
          [nombre.trim(), apellido.trim(), email.toLowerCase().trim(),
           telefono?.trim() || null, password_hash]
        );
        const superadmin = await t.one(
          'INSERT INTO superadmin (usuario_id) VALUES ($1) RETURNING id',
          usuario.id
        );
        return { usuario, perfil: superadmin, tipo: 'superadmin' };
      }

      // Ciudadano (ruta pública)
      const usuario = await t.one(
        `INSERT INTO usuario (nombre, apellido, email, telefono, password_hash, rol)
         VALUES ($1, $2, $3, $4, $5, 'ciudadano')
         RETURNING id, nombre, apellido, email, rol`,
        [nombre.trim(), apellido.trim(), email.toLowerCase().trim(),
         telefono?.trim() || null, password_hash]
      );
      const ciudadano = await t.one(
        'INSERT INTO ciudadano (usuario_id) VALUES ($1) RETURNING id, estado_cuenta',
        usuario.id
      );
      return { usuario, perfil: ciudadano, tipo: 'ciudadano' };
    });

    if (result.tipo === 'superadmin') {
      return res.status(201).json({
        message: 'Superadmin creado correctamente',
        usuario:    result.usuario,
        superadmin: result.perfil,
      });
    }

    // Respuesta ciudadano: incluye token para login inmediato
    const token = signToken({
      id:        result.usuario.id,
      profileId: result.perfil.id,
      email:     result.usuario.email,
      role:      result.usuario.rol,
    });

    return res.status(201).json({
      token,
      user: {
        id:           result.usuario.id,
        profileId:    result.perfil.id,
        nombre:       result.usuario.nombre,
        apellido:     result.usuario.apellido,
        email:        result.usuario.email,
        role:         result.usuario.rol,
        estadoCuenta: result.perfil.estado_cuenta,
      },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('[register]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── login ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Válido para ciudadano, autoridad y superadmin.
 * Si requiere_cambio_password=true incluye requiere_cambio:true en la respuesta.
 */
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email y contraseña son obligatorios' });
  }

  try {
    const result = await db.task(async (t) => {
      const usuario = await t.oneOrNone(
        `SELECT id, nombre, apellido, email, telefono, password_hash, rol,
                requiere_cambio_password, created_at
         FROM usuario WHERE email = $1`,
        email.toLowerCase().trim()
      );
      if (!usuario) throw { status: 401, message: 'Credenciales incorrectas' };

      const passwordOk = await bcrypt.compare(password, usuario.password_hash);
      if (!passwordOk) throw { status: 401, message: 'Credenciales incorrectas' };

      const perfil = await fetchProfile(t, usuario);
      return { usuario, perfil };
    });

    const token = signToken({
      id:        result.usuario.id,
      profileId: result.perfil.id,
      email:     result.usuario.email,
      role:      result.usuario.rol,
    });

    const { password_hash, requiere_cambio_password, ...usuarioPublico } = result.usuario;

    return res.json({
      token,
      requiere_cambio: requiere_cambio_password || false,
      user: {
        ...usuarioPublico,
        role:      usuarioPublico.rol,
        profileId: result.perfil.id,
        perfil:    result.perfil,
      },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('[login]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── me ──────────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/me
 * Devuelve el usuario autenticado junto con su perfil de rol.
 */
async function me(req, res) {
  try {
    const result = await db.task(async (t) => {
      const usuario = await t.oneOrNone(
        `SELECT id, nombre, apellido, email, telefono, rol, created_at
         FROM usuario WHERE id = $1`,
        req.user.id
      );
      if (!usuario) throw { status: 404, message: 'Usuario no encontrado' };

      const perfil = await fetchProfile(t, usuario);
      return { usuario, perfil };
    });

    return res.json({
      user: {
        ...result.usuario,
        role:      result.usuario.rol,
        profileId: result.perfil.id,
        perfil:    result.perfil,
      },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('[me]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── changePassword ──────────────────────────────────────────────────────────

/**
 * PATCH /api/auth/change-password
 * Valida contraseña actual y reemplaza con la nueva hasheada.
 * Pone requiere_cambio_password = FALSE.
 */
async function changePassword(req, res) {
  const { password_actual, password_nuevo } = req.body;

  if (!password_actual || !password_nuevo) {
    return res.status(400).json({ message: 'Faltan campos: password_actual, password_nuevo' });
  }
  if (password_nuevo.length < 8) {
    return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const usuario = await db.oneOrNone(
      'SELECT id, password_hash FROM usuario WHERE id = $1',
      req.user.id
    );
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });

    const ok = await bcrypt.compare(password_actual, usuario.password_hash);
    if (!ok) return res.status(401).json({ message: 'La contraseña actual es incorrecta' });

    const nuevo_hash = await bcrypt.hash(password_nuevo, 12);
    await db.none(
      'UPDATE usuario SET password_hash = $1, requiere_cambio_password = FALSE WHERE id = $2',
      [nuevo_hash, usuario.id]
    );

    return res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('[changePassword]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

module.exports = { register, login, me, changePassword };
