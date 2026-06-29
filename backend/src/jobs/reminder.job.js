const cron = require('node-cron');
const { db }                 = require('../database/connection');
const { createNotification } = require('../services/notification.service');

/**
 * Envía recordatorios para reportes en estado 'en_proceso' y 'asignado':
 *
 *   en_proceso:
 *     — Al ciudadano:  informa que su reporte sigue siendo atendido.
 *     — A la autoridad: recuerda actualizar o cerrar el estado.
 *
 *   asignado (FUNCIÓN 4):
 *     — A la autoridad: recuerda que tiene reportes sin comenzar.
 *
 *   asignado con más de 24 h sin cambio (FUNCIÓN 5):
 *     — Al ciudadano: informa que su reporte está siendo gestionado.
 *       (Se evita spam: solo una vez por día por reporte.)
 */
async function runReminderJob() {
  // ── Reportes en_proceso ────────────────────────────────────────────────────
  const enProceso = await db.any(`
    SELECT r.id, r.descripcion, r.colonia,
           c.usuario_id   AS ciudadano_usuario_id,
           au.usuario_id  AS autoridad_usuario_id
    FROM reporte r
    JOIN ciudadano c  ON c.id  = r.ciudadano_id
    JOIN autoridad au ON au.id = r.autoridad_id
    WHERE r.estado = 'en_proceso'
  `);

  // ── Reportes asignados (recordatorio a la autoridad) ──────────────────────
  const asignados = await db.any(`
    SELECT r.id, r.descripcion, r.colonia,
           au.usuario_id AS autoridad_usuario_id
    FROM reporte r
    JOIN autoridad au ON au.id = r.autoridad_id
    WHERE r.estado = 'asignado'
  `);

  // ── Reportes asignados >24 h (recordatorio al ciudadano, una vez por día) ─
  const asignados24h = await db.any(`
    SELECT r.id,
           c.usuario_id AS ciudadano_usuario_id
    FROM reporte r
    JOIN ciudadano c ON c.id = r.ciudadano_id
    WHERE r.estado = 'asignado'
      AND r.updated_at < NOW() - INTERVAL '24 hours'
      AND NOT EXISTS (
        SELECT 1 FROM notificacion n
        WHERE n.reporte_id = r.id
          AND n.titulo = 'Tu reporte está en proceso de atención'
          AND n.created_at >= CURRENT_DATE
      )
  `);

  const promesas = [];

  for (const r of enProceso) {
    const d = r.descripcion.slice(0, 60);
    promesas.push(
      createNotification(r.ciudadano_usuario_id, r.id,
        'Tu reporte sigue en proceso',
        `Seguimos trabajando en el problema que reportaste: "${d}". Te avisaremos cuando haya novedades.`),
      createNotification(r.autoridad_usuario_id, r.id,
        'Recordatorio: reporte pendiente de actualización',
        `El reporte "${d}" (colonia ${r.colonia}) sigue en estado 'en_proceso'. Por favor confirma su avance o ciérralo.`)
    );
  }

  for (const r of asignados) {
    promesas.push(
      createNotification(r.autoridad_usuario_id, r.id,
        'Reporte pendiente de atención',
        'Tienes reportes asignados que aún no has comenzado a atender')
    );
  }

  for (const r of asignados24h) {
    promesas.push(
      createNotification(r.ciudadano_usuario_id, r.id,
        'Tu reporte está en proceso de atención',
        'Tu reporte ha sido recibido y está siendo gestionado por las autoridades correspondientes')
    );
  }

  if (promesas.length === 0) {
    console.log('[reminder.job] Sin notificaciones que enviar.');
    return;
  }

  const resultados = await Promise.allSettled(promesas);
  const errores    = resultados.filter((r) => r.status === 'rejected').length;
  const ok         = resultados.length - errores;

  console.log(
    `[reminder.job] ${new Date().toISOString()} — ` +
    `en_proceso: ${enProceso.length} | asignados: ${asignados.length} | ` +
    `ciudadanos-24h: ${asignados24h.length} | ` +
    `notificaciones: ${ok} | errores: ${errores}`
  );
}

/**
 * Registra el job de recordatorios.
 * Se ejecuta a las 12:00 y a las 20:00 todos los días.
 */
function startReminderJob() {
  cron.schedule('0 12,20 * * *', async () => {
    try {
      await runReminderJob();
    } catch (err) {
      console.error('[reminder.job] Error inesperado:', err.message);
    }
  });

  console.log('[reminder.job] Job de recordatorios activo (12:00 y 20:00)');
}

module.exports = { startReminderJob, runReminderJob };
