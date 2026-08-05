const bcrypt = require('bcryptjs');
const { db }  = require('../database/connection');
const { isValidEmail, isValidPhone, isValidName } = require('../utils/validators');
const { sendWelcomeAuthority } = require('../services/mail.service');
const { createNotification } = require('../services/notification.service');

// ─── createAuthority ─────────────────────────────────────────────────────────

/**
 * POST /api/users/authority
 * Crea un usuario con rol='autoridad' y su perfil en la tabla autoridad.
 * El usuario creado tendrá requiere_cambio_password = TRUE.
 */
async function createAuthority(req, res) {
  const { nombre, apellido, email, telefono, password, categoria_id, municipio, departamento } = req.body;

  const MUNICIPIOS_VALIDOS = ['Guadalajara', 'Zapopan', 'Tonalá', 'San Pedro Tlaquepaque'];

  const faltantes = ['nombre', 'apellido', 'email', 'password', 'categoria_id', 'municipio']
    .filter((k) => !req.body[k]);
  if (faltantes.length) {
    return res.status(400).json({ message: `Faltan campos obligatorios: ${faltantes.join(', ')}` });
  }
  if (!isValidName(nombre))
    return res.status(400).json({ message: 'Nombre inválido: solo letras y espacios (2-50 caracteres)' });
  if (!isValidName(apellido))
    return res.status(400).json({ message: 'Apellido inválido: solo letras y espacios (2-50 caracteres)' });
  if (!isValidEmail(email))
    return res.status(400).json({ message: 'Formato de correo inválido' });
  if (telefono?.trim() && !isValidPhone(telefono))
    return res.status(400).json({ message: 'El teléfono debe tener 10 dígitos' });
  if (!MUNICIPIOS_VALIDOS.includes(municipio))
    return res.status(400).json({ message: `Municipio inválido. Opciones: ${MUNICIPIOS_VALIDOS.join(', ')}` });

  try {
    const result = await db.tx(async (t) => {
      const existe = await t.oneOrNone(
        `SELECT id FROM usuario WHERE email = $1`, email.toLowerCase().trim()
      );
      if (existe) throw { status: 409, message: 'El correo ya está registrado' };

      const cat = await t.oneOrNone(`SELECT id FROM categoria WHERE id = $1`, categoria_id);
      if (!cat) throw { status: 404, message: 'Categoría no encontrada' };

      const password_hash = await bcrypt.hash(password, 12);

      const usuario = await t.one(
        `INSERT INTO usuario (nombre, apellido, email, telefono, password_hash, rol, requiere_cambio_password)
         VALUES ($1, $2, $3, $4, $5, 'autoridad', TRUE)
         RETURNING id, nombre, apellido, email, rol`,
        [nombre.trim(), apellido.trim(), email.toLowerCase().trim(),
         telefono?.trim() || null, password_hash]
      );

      const autoridad = await t.one(
        `INSERT INTO autoridad (usuario_id, categoria_id, municipio, departamento)
         VALUES ($1, $2, $3, $4)
         RETURNING id, departamento, carga_ponderada, reportes_activos, activo`,
        [usuario.id, categoria_id, municipio, departamento?.trim() || null]
      );

      return { usuario, autoridad };
    });

    sendWelcomeAuthority(result.usuario.email, result.usuario.nombre, password)
      .catch(err => console.error('[mail] Error enviando bienvenida:', err.message, JSON.stringify(err)));

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
         a.municipio,
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
         c.nombre    AS categoria_nombre
       FROM autoridad a
       JOIN usuario   u ON u.id = a.usuario_id
       JOIN categoria c ON c.id = a.categoria_id
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
 * GET /api/users/municipios
 * Devuelve los municipios válidos para asignar a una autoridad.
 */
async function listMunicipios(req, res) {
  return res.json({
    municipios: ['Guadalajara', 'Zapopan', 'Tonalá', 'San Pedro Tlaquepaque'],
  });
}

// ─── updateAuthority ─────────────────────────────────────────────────────────

/**
 * PATCH /api/users/authority/:id
 * Edita categoria_id, municipio y/o departamento de una autoridad.
 */
async function updateAuthority(req, res) {
  const { id } = req.params;
  const { categoria_id, municipio, departamento } = req.body;

  if (!categoria_id && !municipio && departamento === undefined) {
    return res.status(400).json({ message: 'No se recibió ningún campo para actualizar' });
  }

  const MUNICIPIOS_VALIDOS = ['Guadalajara', 'Zapopan', 'Tonalá', 'San Pedro Tlaquepaque'];

  if (municipio && !MUNICIPIOS_VALIDOS.includes(municipio)) {
    return res.status(400).json({ message: `Municipio inválido. Opciones: ${MUNICIPIOS_VALIDOS.join(', ')}` });
  }

  try {
    const result = await db.tx(async (t) => {
      const autoridad = await t.oneOrNone(
        `SELECT id, categoria_id, municipio FROM autoridad WHERE id = $1`, id
      );
      if (!autoridad) throw { status: 404, message: 'Autoridad no encontrada' };

      if (categoria_id) {
        const cat = await t.oneOrNone(`SELECT id FROM categoria WHERE id = $1`, categoria_id);
        if (!cat) throw { status: 404, message: 'Categoría no encontrada' };
      }

      const actualizada = await t.one(
        `UPDATE autoridad
         SET categoria_id = COALESCE($1, categoria_id),
             municipio    = COALESCE($2, municipio),
             departamento = COALESCE($3, departamento)
         WHERE id = $4
         RETURNING id, categoria_id, municipio, departamento, carga_ponderada, reportes_activos, activo`,
        [categoria_id || null, municipio || null,
         departamento !== undefined ? departamento.trim() : null, id]
      );

      let reportesReasignados = 0;

      // Si cambió la categoría, los reportes activos que ya no correspondan
      // a la nueva categoría de la autoridad deben reasignarse.
      if (categoria_id && categoria_id !== autoridad.categoria_id) {
        const atascados = await t.any(
          `SELECT r.id, r.categoria_id, r.estado, c.usuario_id AS ciudadano_usuario_id
           FROM reporte r
           JOIN ciudadano c ON c.id = r.ciudadano_id
           WHERE r.autoridad_id = $1
             AND r.estado IN ('asignado', 'en_proceso')
             AND r.categoria_id != $2`,
          [id, categoria_id]
        );

        for (const r of atascados) {
          const nueva = await t.oneOrNone(
            `SELECT a.id, a.usuario_id
             FROM autoridad a
             WHERE a.categoria_id = $1
               AND a.activo = TRUE
               AND a.id != $2
               AND LOWER(a.municipio) = LOWER($3)
             ORDER BY a.carga_ponderada ASC, a.reportes_activos ASC
             LIMIT 1`,
            [r.categoria_id, id, autoridad.municipio]
          );

          if (nueva) {
            await t.none(
              `UPDATE reporte SET autoridad_id = $1, updated_at = NOW() WHERE id = $2`,
              [nueva.id, r.id]
            );

            await t.none(
              `INSERT INTO historial_estado
                 (reporte_id, usuario_id, rol_usuario, estado_anterior, estado_nuevo, observacion)
               VALUES ($1, NULL, 'sistema', $2, $2,
                       'Reasignado automáticamente por cambio de categoría de la autoridad anterior')`,
              [r.id, r.estado]
            );

            await createNotification(
              r.ciudadano_usuario_id, r.id,
              'Reporte reasignado',
              'Tu reporte ha sido reasignado a una nueva autoridad',
              t
            );
          } else {
            await t.none(
              `UPDATE reporte SET autoridad_id = NULL, estado = 'pendiente', updated_at = NOW() WHERE id = $1`,
              [r.id]
            );

            await t.none(
              `INSERT INTO historial_estado
                 (reporte_id, usuario_id, rol_usuario, estado_anterior, estado_nuevo, observacion)
               VALUES ($1, NULL, 'sistema', $2, 'pendiente',
                       'Sin autoridad disponible tras cambio de categoría — reporte liberado para reasignación automática')`,
              [r.id, r.estado]
            );
          }

          reportesReasignados++;
        }
      }

      return { autoridad: actualizada, reportesReasignados };
    });

    return res.json({
      message: 'Autoridad actualizada correctamente',
      ...result.autoridad,
      reportes_reasignados: result.reportesReasignados,
    });
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

// ─── reactivateAuthority ─────────────────────────────────────────────────────

/**
 * PATCH /api/users/authority/:id/reactivate
 * Reactiva una autoridad previamente desactivada (activo = TRUE).
 */
async function reactivateAuthority(req, res) {
  const { id } = req.params;

  try {
    const autoridad = await db.oneOrNone(`SELECT id, activo FROM autoridad WHERE id = $1`, id);
    if (!autoridad) return res.status(404).json({ message: 'Autoridad no encontrada' });
    if (autoridad.activo) return res.status(409).json({ message: 'La autoridad ya está activa' });

    await db.none(`UPDATE autoridad SET activo = TRUE WHERE id = $1`, id);

    return res.json({ message: 'Autoridad reactivada correctamente' });
  } catch (err) {
    console.error('[users.reactivateAuthority]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── listSuperadmins ─────────────────────────────────────────────────────────

/**
 * GET /api/users/superadmins
 * Lista todas las cuentas con rol='superadmin'.
 */
async function listSuperadmins(req, res) {
  try {
    const superadmins = await db.any(
      `SELECT s.id, u.nombre, u.apellido, u.email, u.telefono, u.activo
       FROM superadmin s
       JOIN usuario u ON u.id = s.usuario_id
       ORDER BY u.apellido ASC, u.nombre ASC`
    );
    return res.json({ total: superadmins.length, superadmins });
  } catch (err) {
    console.error('[users.listSuperadmins]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── deactivateSuperadmin ────────────────────────────────────────────────────

/**
 * DELETE /api/users/superadmin/:id
 * Cualquier superadmin autenticado puede desactivar la cuenta de otro
 * (activo = FALSE en usuario), simétrico a cómo un superadmin puede crear
 * a otro. :id es el id de la fila superadmin, no de usuario.
 * No se permite desactivar al último superadmin activo, para evitar dejar
 * el sistema sin ninguna cuenta administradora funcional.
 */
async function deactivateSuperadmin(req, res) {
  const { id } = req.params;

  try {
    const superadmin = await db.oneOrNone(
      `SELECT s.id, s.usuario_id, u.activo
       FROM superadmin s
       JOIN usuario u ON u.id = s.usuario_id
       WHERE s.id = $1`,
      id
    );
    if (!superadmin) return res.status(404).json({ message: 'Cuenta de superadmin no encontrada' });
    if (!superadmin.activo) return res.status(409).json({ message: 'La cuenta ya está desactivada' });

    const { count } = await db.one(
      `SELECT COUNT(*)::int AS count
       FROM superadmin s
       JOIN usuario u ON u.id = s.usuario_id
       WHERE u.activo = TRUE`
    );
    if (count <= 1) {
      return res.status(409).json({ message: 'No puedes desactivar al último superadmin activo' });
    }

    await db.none(`UPDATE usuario SET activo = FALSE WHERE id = $1`, superadmin.usuario_id);

    return res.json({ message: 'Cuenta desactivada correctamente' });
  } catch (err) {
    console.error('[users.deactivateSuperadmin]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── reactivateSuperadmin ────────────────────────────────────────────────────

/**
 * PATCH /api/users/superadmin/:id/reactivate
 * Reactiva una cuenta de superadmin previamente desactivada (activo = TRUE en usuario).
 */
async function reactivateSuperadmin(req, res) {
  const { id } = req.params;

  try {
    const superadmin = await db.oneOrNone(
      `SELECT s.id, s.usuario_id, u.activo
       FROM superadmin s
       JOIN usuario u ON u.id = s.usuario_id
       WHERE s.id = $1`,
      id
    );
    if (!superadmin) return res.status(404).json({ message: 'Cuenta de superadmin no encontrada' });
    if (superadmin.activo) return res.status(409).json({ message: 'La cuenta ya está activa' });

    await db.none(`UPDATE usuario SET activo = TRUE WHERE id = $1`, superadmin.usuario_id);

    return res.json({ message: 'Cuenta reactivada correctamente' });
  } catch (err) {
    console.error('[users.reactivateSuperadmin]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

module.exports = { createAuthority, listAuthorities, getCitizen, suspendCitizen, listCitizens, listMunicipios, updateAuthority, deactivateAuthority, reactivateAuthority, listSuperadmins, deactivateSuperadmin, reactivateSuperadmin };
