const { db }                  = require('../database/connection');
const { createNotification }  = require('../services/notification.service');

const ESTADOS_PERMITIDOS = ['en_proceso', 'resuelto', 'cerrado'];

// Transiciones válidas por estado de origen
// en_proceso → en_proceso permite agregar una nota de actualización sin cambiar estado
const TRANSICIONES = {
  asignado:   ['en_proceso', 'cerrado'],
  en_proceso: ['en_proceso', 'resuelto', 'cerrado'],
  resuelto:   ['cerrado'],
};

// Mensajes de notificación para el ciudadano según el nuevo estado
const NOTIFICACION = {
  en_proceso: {
    titulo:  'Tu reporte está siendo atendido',
    mensaje: 'Las autoridades ya están trabajando en resolver el problema que reportaste.',
  },
  resuelto: {
    titulo:  'Tu reporte fue resuelto',
    mensaje: 'El problema que reportaste ha sido resuelto. ¡Gracias por tu participación!',
  },
  cerrado: (motivo) => ({
    titulo:  'Tu reporte fue cerrado',
    mensaje: motivo
      ? `Tu reporte ha sido cerrado por la autoridad responsable. Motivo: ${motivo}`
      : 'Tu reporte ha sido cerrado por la autoridad responsable.',
  }),
};

/**
 * PATCH /api/reports/:id/status
 * La autoridad dueña del reporte actualiza su estado.
 */
async function updateStatus(req, res) {
  const { id }          = req.params;
  const { estado, motivo_cierre = null, observacion: observacionBody = null } = req.body;

  // ── validación de entrada ─────────────────────────────────────────────────
  if (!estado || !ESTADOS_PERMITIDOS.includes(estado)) {
    return res.status(400).json({
      message: `estado inválido. Valores permitidos: ${ESTADOS_PERMITIDOS.join(', ')}`,
    });
  }

  try {
    await db.tx(async (t) => {

      // Cargar reporte con usuario_id del ciudadano (para notificación)
      const reporte = await t.oneOrNone(
        `SELECT
           r.id, r.estado, r.autoridad_id,
           r.ciudadano_id,
           c.usuario_id  AS ciudadano_usuario_id,
           r.colonia, r.descripcion
         FROM reporte r
         JOIN ciudadano c ON c.id = r.ciudadano_id
         WHERE r.id = $1`,
        id
      );

      if (!reporte) throw { status: 404, message: 'Reporte no encontrado' };

      if (reporte.autoridad_id !== req.user.profileId) {
        throw { status: 403, message: 'Solo la autoridad asignada puede actualizar el estado' };
      }

      const transPermitidas = TRANSICIONES[reporte.estado];
      if (!transPermitidas) {
        throw {
          status: 409,
          message: `No se puede cambiar el estado desde '${reporte.estado}'`,
        };
      }
      if (!transPermitidas.includes(estado)) {
        throw {
          status: 409,
          message: `Transición no permitida: '${reporte.estado}' → '${estado}'`,
        };
      }

      // motivo_cierre requerido solo cuando el origen NO es 'resuelto'
      if (estado === 'cerrado' && reporte.estado !== 'resuelto' && !motivo_cierre?.trim()) {
        throw { status: 400, message: 'motivo_cierre es obligatorio al cerrar desde este estado' };
      }

      const estado_anterior = reporte.estado;
      const esNotaActualizacion = estado === 'en_proceso' && estado_anterior === 'en_proceso';

      let observacion = null;
      if (esNotaActualizacion) {
        observacion = observacionBody?.trim() || null;
      } else if (estado === 'cerrado') {
        observacion = estado_anterior === 'resuelto'
          ? 'Reporte cerrado por resolución'
          : (motivo_cierre?.trim() || null);
      }

      // Actualizar updated_at siempre (aunque el estado no cambie, la nota sí)
      await t.none(
        `UPDATE reporte SET estado = $1, updated_at = NOW() WHERE id = $2`,
        [estado, id]
      );

      // Historial
      await t.none(
        `INSERT INTO historial_estado
           (reporte_id, usuario_id, rol_usuario, estado_anterior, estado_nuevo, observacion)
         VALUES ($1, $2, 'autoridad', $3, $4, $5)`,
        [id, req.user.id, estado_anterior, estado, observacion]
      );

      // Notificación al ciudadano
      if (esNotaActualizacion) {
        const mensajeNota = observacion || 'La autoridad ha actualizado el estado de tu reporte';
        await createNotification(
          reporte.ciudadano_usuario_id, id,
          'Actualización de tu reporte', mensajeNota, t
        );
      } else {
        const notif = estado === 'cerrado'
          ? NOTIFICACION.cerrado(motivo_cierre?.trim() || null)
          : NOTIFICACION[estado];
        await createNotification(
          reporte.ciudadano_usuario_id, id, notif.titulo, notif.mensaje, t
        );
      }
    });

    return res.json({ message: `Estado actualizado a '${estado}'` });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('[status.updateStatus]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

module.exports = { updateStatus };
