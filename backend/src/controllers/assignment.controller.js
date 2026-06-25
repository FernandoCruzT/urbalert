const { db }                  = require('../database/connection');
const { assignReport }        = require('../services/assignment.service');
const { createNotification }  = require('../services/notification.service');

// ─── assign (superadmin) ─────────────────────────────────────────────────────

/**
 * POST /api/assignment/assign/:reportId
 * El superadmin fuerza la asignación automática de un reporte específico.
 * El reporte debe estar en estado 'pendiente'.
 */
async function assign(req, res) {
  const { reportId } = req.params;

  try {
    const autoridad = await assignReport(reportId);

    if (!autoridad) {
      return res.status(404).json({
        message: 'No hay autoridades disponibles para la colonia y categoría de este reporte. Quedó en pendiente.',
      });
    }

    return res.json({
      message: 'Reporte asignado correctamente',
      autoridad: {
        id:              autoridad.id,
        nombre:          autoridad.nombre,
        apellido:        autoridad.apellido,
        departamento:    autoridad.departamento,
        carga_ponderada: autoridad.carga_ponderada,
      },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('[assignment.assign]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── escalate (autoridad) ────────────────────────────────────────────────────

/**
 * POST /api/assignment/escalate/:reportId
 * La autoridad dueña del reporte lo escala para revisión del superadmin.
 * Estado: asignado | en_proceso → en_revision
 */
async function escalate(req, res) {
  const { reportId } = req.params;
  const { motivo }   = req.body;

  if (!motivo?.trim()) {
    return res.status(400).json({ message: 'El campo motivo es obligatorio para escalar' });
  }

  try {
    await db.tx(async (t) => {
      const reporte = await t.oneOrNone(
        `SELECT r.id, r.estado, r.autoridad_id, r.colonia,
                cat.nombre AS categoria_nombre,
                u.nombre   AS autoridad_nombre,
                u.apellido AS autoridad_apellido,
                uc.id      AS ciudadano_usuario_id
         FROM reporte r
         JOIN categoria cat ON cat.id = r.categoria_id
         JOIN autoridad a   ON a.id   = r.autoridad_id
         JOIN usuario u     ON u.id   = a.usuario_id
         JOIN ciudadano c   ON c.id   = r.ciudadano_id
         JOIN usuario uc    ON uc.id  = c.usuario_id
         WHERE r.id = $1`,
        reportId
      );
      if (!reporte) throw { status: 404, message: 'Reporte no encontrado' };

      if (reporte.autoridad_id !== req.user.profileId) {
        throw { status: 403, message: 'Solo la autoridad asignada puede escalar este reporte' };
      }
      if (!['asignado', 'en_proceso'].includes(reporte.estado)) {
        throw {
          status: 409,
          message: `No se puede escalar un reporte en estado '${reporte.estado}'`,
        };
      }

      const estado_anterior = reporte.estado;

      await t.none(
        `UPDATE reporte SET estado = 'en_revision' WHERE id = $1`,
        reportId
      );

      await t.none(
        `INSERT INTO asignacion
           (reporte_id, autoridad_id, tipo, motivo, asignado_por)
         VALUES ($1, $2, 'escalado', $3, $4)`,
        [reportId, req.user.profileId, motivo.trim(), req.user.id]
      );

      await t.none(
        `INSERT INTO historial_estado
           (reporte_id, usuario_id, rol_usuario, estado_anterior, estado_nuevo, observacion)
         VALUES ($1, $2, 'autoridad', $3, 'en_revision', $4)`,
        [reportId, req.user.id, estado_anterior, motivo.trim()]
      );

      // Notificar al ciudadano
      await createNotification(
        reporte.ciudadano_usuario_id,
        reportId,
        'Reporte escalado',
        'Tu reporte ha sido escalado para su reasignación.',
        t
      );

      // Notificar a todos los superadmins
      const superadmins = await t.any(
        `SELECT id FROM usuario WHERE rol = 'superadmin'`
      );
      const mensaje = `La autoridad ${reporte.autoridad_nombre} ${reporte.autoridad_apellido} escaló un reporte de ${reporte.categoria_nombre} en ${reporte.colonia || 'ubicación desconocida'}. Motivo: ${motivo.trim()}`;
      await Promise.all(
        superadmins.map(sa =>
          createNotification(sa.id, reportId, 'Reporte escalado', mensaje, t)
        )
      );
    });

    return res.json({ message: 'Reporte escalado a revisión del superadmin' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('[assignment.escalate]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── transfer (autoridad) ────────────────────────────────────────────────────

/**
 * POST /api/assignment/transfer/:reportId
 * La autoridad transfiere el reporte a otra categoría para reasignación.
 * Estado: asignado | en_proceso → pendiente
 * Acepta opcionalmente nueva_subcategoria_id. Si no se envía, la urgencia
 * se conserva y la subcategoría queda técnicamente desvinculada hasta
 * que el superadmin la corrija en la siguiente validación.
 */
async function transfer(req, res) {
  const { reportId }               = req.params;
  const { nueva_categoria_id, motivo, nueva_subcategoria_id = null } = req.body;

  if (!nueva_categoria_id) {
    return res.status(400).json({ message: 'nueva_categoria_id es obligatorio' });
  }
  if (!motivo?.trim()) {
    return res.status(400).json({ message: 'El campo motivo es obligatorio para transferir' });
  }

  try {
    await db.tx(async (t) => {
      const reporte = await t.oneOrNone(
        `SELECT id, estado, autoridad_id, categoria_id FROM reporte WHERE id = $1`,
        reportId
      );
      if (!reporte) throw { status: 404, message: 'Reporte no encontrado' };

      if (reporte.autoridad_id !== req.user.profileId) {
        throw { status: 403, message: 'Solo la autoridad asignada puede transferir este reporte' };
      }
      if (!['asignado', 'en_proceso'].includes(reporte.estado)) {
        throw {
          status: 409,
          message: `No se puede transferir un reporte en estado '${reporte.estado}'`,
        };
      }
      if (reporte.categoria_id === nueva_categoria_id) {
        throw { status: 400, message: 'La nueva categoría es igual a la actual' };
      }

      // Verificar que la nueva categoría existe
      const categoria = await t.oneOrNone(
        `SELECT id FROM categoria WHERE id = $1`, nueva_categoria_id
      );
      if (!categoria) throw { status: 404, message: 'La nueva categoría no existe' };

      // Resolver subcategoría: usar la provista, o la primera de la nueva categoría
      let sub_id  = null;
      let nueva_urgencia = null;

      if (nueva_subcategoria_id) {
        const sub = await t.oneOrNone(
          `SELECT id, urgencia FROM subcategoria WHERE id = $1 AND categoria_id = $2`,
          [nueva_subcategoria_id, nueva_categoria_id]
        );
        if (!sub) throw { status: 400, message: 'La subcategoría no pertenece a la nueva categoría' };
        sub_id         = sub.id;
        nueva_urgencia = sub.urgencia;
      } else {
        // Asignar la primera subcategoría de la nueva categoría para mantener integridad
        const sub = await t.oneOrNone(
          `SELECT id, urgencia FROM subcategoria WHERE categoria_id = $1 ORDER BY nombre LIMIT 1`,
          [nueva_categoria_id]
        );
        if (sub) { sub_id = sub.id; nueva_urgencia = sub.urgencia; }
      }

      if (!sub_id) {
        throw { status: 422, message: 'La nueva categoría no tiene subcategorías disponibles' };
      }

      const estado_anterior = reporte.estado;

      // Actualizar reporte: nueva categoría, limpiar autoridad, volver a pendiente
      await t.none(
        `UPDATE reporte
         SET categoria_id    = $1,
             subcategoria_id = $2,
             urgencia        = $3,
             autoridad_id    = NULL,
             estado          = 'pendiente',
             updated_at      = NOW()
         WHERE id = $4`,
        [nueva_categoria_id, sub_id, nueva_urgencia, reportId]
      );

      // Registrar la transferencia en asignacion
      await t.none(
        `INSERT INTO asignacion
           (reporte_id, autoridad_id, tipo, motivo, asignado_por)
         VALUES ($1, $2, 'transferencia', $3, $4)`,
        [reportId, req.user.profileId, motivo.trim(), req.user.id]
      );

      await t.none(
        `INSERT INTO historial_estado
           (reporte_id, usuario_id, rol_usuario, estado_anterior, estado_nuevo, observacion)
         VALUES ($1, $2, 'autoridad', $3, 'pendiente', $4)`,
        [reportId, req.user.id, estado_anterior, `Transferencia: ${motivo.trim()}`]
      );
    });

    return res.json({
      message: 'Reporte transferido. Quedará pendiente de reasignación automática.',
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('[assignment.transfer]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── adminTransfer (superadmin) ──────────────────────────────────────────────

/**
 * POST /api/assignment/admin-transfer/:reportId
 * Superadmin reasigna un reporte escalado a una nueva categoría.
 * Estado: en_revision → pendiente con nueva categoria
 */
async function adminTransfer(req, res) {
  const { reportId } = req.params;
  const { nueva_categoria_id, motivo } = req.body;

  if (!nueva_categoria_id) return res.status(400).json({ message: 'nueva_categoria_id es obligatorio' });

  try {
    await db.tx(async (t) => {
      const reporte = await t.oneOrNone(
        `SELECT id, estado, categoria_id FROM reporte WHERE id = $1`, reportId
      );
      if (!reporte) throw { status: 404, message: 'Reporte no encontrado' };
      if (!['en_revision', 'pendiente', 'asignado', 'en_proceso'].includes(reporte.estado)) {
        throw { status: 409, message: `Estado '${reporte.estado}' no permite transferencia` };
      }

      const categoria = await t.oneOrNone(`SELECT id FROM categoria WHERE id = $1`, nueva_categoria_id);
      if (!categoria) throw { status: 404, message: 'Categoría no encontrada' };

      const estado_anterior = reporte.estado;

      // Pick first subcategoria of nueva_categoria as default
      const subcat = await t.oneOrNone(
        `SELECT id, urgencia FROM subcategoria WHERE categoria_id = $1 ORDER BY nombre LIMIT 1`,
        nueva_categoria_id
      );

      await t.none(
        `UPDATE reporte
         SET categoria_id = $1,
             subcategoria_id = COALESCE($2, subcategoria_id),
             urgencia = COALESCE($3, urgencia),
             autoridad_id = NULL,
             estado = 'pendiente'
         WHERE id = $4`,
        [nueva_categoria_id, subcat?.id || null, subcat?.urgencia || null, reportId]
      );

      // No registramos autoridad_id en asignacion porque el reporte fue escalado
      // por el sistema (autoridad_id = NULL en reporte). El job de asignación
      // automática se encargará de asignarlo a la autoridad correcta.
      await t.none(
        `INSERT INTO asignacion (reporte_id, autoridad_id, tipo, motivo, asignado_por)
         VALUES ($1, NULL, 'transferencia', $2, $3)`,
        [reportId, motivo || 'Reasignación por superadmin', req.user.id]
      );

      await t.none(
        `INSERT INTO historial_estado (reporte_id, usuario_id, rol_usuario, estado_anterior, estado_nuevo, observacion)
         VALUES ($1, $2, 'superadmin', $3, 'pendiente', $4)`,
        [reportId, req.user.id, estado_anterior, motivo || 'Reasignación de categoría por superadmin']
      );
    });

    return res.json({ message: 'Reporte reasignado correctamente' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('[assignment.adminTransfer]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

module.exports = { assign, escalate, transfer, adminTransfer };
