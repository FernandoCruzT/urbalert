const bcrypt = require('bcryptjs');
const { db }  = require('../database/connection');

// ─── createAuthority ─────────────────────────────────────────────────────────

/**
 * POST /api/users/authority
 * Crea un usuario con rol='autoridad' y su perfil en la tabla autoridad.
 * El usuario creado tendrá requiere_cambio_password = TRUE.
 */
async function createAuthority(req, res) {
  const { nombre, apellido, email, telefono, password, categoria_id, sector_id, departamento } = req.body;

  const faltantes = ['nombre', 'apellido', 'email', 'password', 'categoria_id', 'sector_id']
    .filter((k) => !req.body[k]);
  if (faltantes.length) {
    return res.status(400).json({ message: `Faltan campos obligatorios: ${faltantes.join(', ')}` });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
  }

  try {
    const result = await db.tx(async (t) => {
      const existe = await t.oneOrNone(
        `SELECT id FROM usuario WHERE email = $1`, email.toLowerCase().trim()
      );
      if (existe) throw { status: 409, message: 'El correo ya está registrado' };

      const cat = await t.oneOrNone(`SELECT id FROM categoria WHERE id = $1`, categoria_id);
      if (!cat) throw { status: 404, message: 'Categoría no encontrada' };
      const sec = await t.oneOrNone(`SELECT id FROM sector WHERE id = $1`, sector_id);
      if (!sec) throw { status: 404, message: 'Sector no encontrado' };

      const password_hash = await bcrypt.hash(password, 12);

      const usuario = await t.one(
        `INSERT INTO usuario (nombre, apellido, email, telefono, password_hash, rol, requiere_cambio_password)
         VALUES ($1, $2, $3, $4, $5, 'autoridad', TRUE)
         RETURNING id, nombre, apellido, email, rol`,
        [nombre.trim(), apellido.trim(), email.toLowerCase().trim(),
         telefono?.trim() || null, password_hash]
      );

      const autoridad = await t.one(
        `INSERT INTO autoridad (usuario_id, categoria_id, sector_id, departamento)
         VALUES ($1, $2, $3, $4)
         RETURNING id, departamento, carga_ponderada, reportes_activos, activo`,
        [usuario.id, categoria_id, sector_id, departamento?.trim() || null]
      );

      return { usuario, autoridad };
    });

    return res.status(201).json({
      message: 'Autoridad creada correctamente',
      usuario:   result.usuario,
      autoridad: result.autoridad,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('[users.createAuthority]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── listAuthorities ─────────────────────────────────────────────────────────

/**
 * GET /api/users/authorities
 * Lista todas las autoridades (activas e inactivas) con sus datos completos.
 */
async function listAuthorities(req, res) {
  try {
    const autoridades = await db.any(
      `SELECT
         a.id,
         a.departamento,
         a.carga_ponderada,
         a.reportes_activos,
         a.activo,
         u.id        AS usuario_id,
         u.nombre,
         u.apellido,
         u.email,
         u.telefono,
         u.created_at,
         c.id        AS categoria_id,
         c.nombre    AS categoria_nombre,
         s.id        AS sector_id,
         s.nombre    AS sector_nombre
       FROM autoridad a
       JOIN usuario   u ON u.id = a.usuario_id
       JOIN categoria c ON c.id = a.categoria_id
       JOIN sector    s ON s.id = a.sector_id
       ORDER BY a.activo DESC, u.apellido ASC, u.nombre ASC`
    );

    return res.json({ total: autoridades.length, autoridades });
  } catch (err) {
    console.error('[users.listAuthorities]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── getCitizen ──────────────────────────────────────────────────────────────

/**
 * GET /api/users/citizen/:usuarioId
 * Datos completos de un ciudadano con conteo de reportes.
 */
async function getCitizen(req, res) {
  const { usuarioId } = req.params;
  try {
    const row = await db.oneOrNone(
      `SELECT
         u.id              AS usuario_id,
         u.nombre,
         u.apellido,
         u.email,
         u.telefono,
         u.created_at,
         c.id              AS ciudadano_id,
         c.estado_cuenta,
         c.reportes_falsos,
         COUNT(r.id) FILTER (WHERE r.estado NOT IN ('resuelto','cerrado'))::int AS reportes_abiertos,
         COUNT(r.id) FILTER (WHERE r.estado IN ('resuelto','cerrado'))::int     AS reportes_cerrados
       FROM ciudadano c
       JOIN usuario u ON u.id = c.usuario_id
       LEFT JOIN reporte r ON r.ciudadano_id = c.id
       WHERE u.id = $1
       GROUP BY u.id, c.id`,
      usuarioId
    );
    if (!row) return res.status(404).json({ message: 'Ciudadano no encontrado' });
    return res.json({ ciudadano: row });
  } catch (err) {
    console.error('[users.getCitizen]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── suspendCitizen ───────────────────────────────────────────────────────────

/**
 * PATCH /api/users/citizen/:usuarioId/suspend
 * Pone estado_cuenta = 'suspendida'.
 */
async function suspendCitizen(req, res) {
  const { usuarioId } = req.params;
  try {
    const c = await db.oneOrNone(
      `SELECT c.id FROM ciudadano c WHERE c.usuario_id = $1`, usuarioId
    );
    if (!c) return res.status(404).json({ message: 'Ciudadano no encontrado' });

    await db.none(
      `UPDATE ciudadano SET estado_cuenta = 'suspendida' WHERE id = $1`, c.id
    );
    return res.json({ message: 'Cuenta suspendida correctamente' });
  } catch (err) {
    console.error('[users.suspendCitizen]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── listCitizens ────────────────────────────────────────────────────────────

/**
 * GET /api/users/citizens?search=texto
 * Busca ciudadanos por nombre, apellido o email (case insensitive).
 * Solo superadmin.
 */
async function listCitizens(req, res) {
  const { search = '' } = req.query;
  const term = `%${search.trim()}%`;

  try {
    const ciudadanos = await db.any(
      `SELECT
         u.id,
         u.nombre,
         u.apellido,
         u.email,
         u.telefono,
         u.created_at,
         c.id              AS ciudadano_id,
         c.estado_cuenta,
         c.reportes_falsos
       FROM ciudadano c
       JOIN usuario u ON u.id = c.usuario_id
       WHERE (
         u.nombre  ILIKE $1 OR
         u.apellido ILIKE $1 OR
         u.email   ILIKE $1 OR
         (u.nombre || ' ' || u.apellido) ILIKE $1
       )
       ORDER BY u.apellido ASC, u.nombre ASC
       LIMIT 100`,
      [term]
    );

    return res.json({ total: ciudadanos.length, ciudadanos });
  } catch (err) {
    console.error('[users.listCitizens]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── listSectors ─────────────────────────────────────────────────────────────

/**
 * GET /api/users/sectors
 * Devuelve un sector por nombre (evita duplicados de la migración).
 */
async function listSectors(req, res) {
  try {
    const sectores = await db.any(
      `SELECT DISTINCT ON (nombre) id, nombre FROM sector ORDER BY nombre, id`
    );
    return res.json({ sectores });
  } catch (err) {
    console.error('[users.listSectors]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── updateAuthority ─────────────────────────────────────────────────────────

/**
 * PATCH /api/users/authority/:id
 * Edita categoria_id, sector_id y/o departamento de una autoridad.
 */
async function updateAuthority(req, res) {
  const { id } = req.params;
  const { categoria_id, sector_id, departamento } = req.body;

  if (!categoria_id && !sector_id && departamento === undefined) {
    return res.status(400).json({ message: 'No se recibió ningún campo para actualizar' });
  }

  try {
    await db.tx(async (t) => {
      const autoridad = await t.oneOrNone(`SELECT id FROM autoridad WHERE id = $1`, id);
      if (!autoridad) throw { status: 404, message: 'Autoridad no encontrada' };

      if (categoria_id) {
        const cat = await t.oneOrNone(`SELECT id FROM categoria WHERE id = $1`, categoria_id);
        if (!cat) throw { status: 404, message: 'Categoría no encontrada' };
      }
      if (sector_id) {
        const sec = await t.oneOrNone(`SELECT id FROM sector WHERE id = $1`, sector_id);
        if (!sec) throw { status: 404, message: 'Sector no encontrado' };
      }

      await t.none(
        `UPDATE autoridad
         SET categoria_id  = COALESCE($1, categoria_id),
             sector_id     = COALESCE($2, sector_id),
             departamento  = COALESCE($3, departamento)
         WHERE id = $4`,
        [categoria_id || null, sector_id || null,
         departamento !== undefined ? departamento.trim() : null, id]
      );
    });

    return res.json({ message: 'Autoridad actualizada correctamente' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('[users.updateAuthority]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── deactivateAuthority ─────────────────────────────────────────────────────

/**
 * DELETE /api/users/authority/:id
 * Desactiva una autoridad (activo = FALSE).
 */
async function deactivateAuthority(req, res) {
  const { id } = req.params;

  try {
    const reportesLiberados = await db.tx(async (t) => {
      const autoridad = await t.oneOrNone(`SELECT id, activo FROM autoridad WHERE id = $1`, id);
      if (!autoridad) throw { status: 404, message: 'Autoridad no encontrada' };
      if (!autoridad.activo) throw { status: 409, message: 'La autoridad ya está desactivada' };

      const reportes = await t.any(
        `SELECT id, estado FROM reporte
         WHERE autoridad_id = $1 AND estado NOT IN ('resuelto', 'cerrado')`,
        id
      );

      await t.none(`UPDATE autoridad SET activo = FALSE WHERE id = $1`, id);

      if (reportes.length > 0) {
        await t.none(
          `UPDATE reporte SET estado = 'pendiente', autoridad_id = NULL
           WHERE autoridad_id = $1 AND estado NOT IN ('resuelto', 'cerrado')`,
          id
        );
        for (const r of reportes) {
          await t.none(
            `INSERT INTO historial_estado
               (reporte_id, usuario_id, rol_usuario, estado_anterior, estado_nuevo, observacion)
             VALUES ($1, NULL, 'sistema', $2, 'pendiente',
                     'Autoridad desactivada — reporte liberado para reasignación automática')`,
            [r.id, r.estado]
          );
        }
      }

      return reportes.length;
    });

    return res.json({
      message: 'Autoridad desactivada correctamente',
      reportes_liberados: reportesLiberados,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('[users.deactivateAuthority]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

module.exports = { createAuthority, listAuthorities, getCitizen, suspendCitizen, listCitizens, listSectors, updateAuthority, deactivateAuthority };
