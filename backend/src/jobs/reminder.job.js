const cron = require('node-cron');
const { db }                 = require('../database/connection');
const { createNotification } = require('../services/notification.service');

/**
 * Envía recordatorios para todos los reportes en estado 'en_proceso':
 *   — Al ciudadano:  informa que su reporte sigue siendo atendido.
 *   — A la autoridad: le recuerda confirmar o actualizar el estado.
 */
async function runReminderJob() {
  const reportes = await db.any(
    `SELECT
       r.id,
       r.descripcion,
       r.colonia,
       c.usuario_id   AS ciudadano_usuario_id,
       au.usuario_id  AS autoridad_usuario_id
     FROM reporte r
     JOIN ciudadano c  ON c.id  = r.ciudadano_id
     JOIN autoridad au ON au.id = r.autoridad_id
     WHERE r.estado = 'en_proceso'`
  );

  if (reportes.length === 0) {
    console.log('[reminder.job] Sin reportes en proceso, no se enviaron recordatorios.');
    return;
  }

  const resultados = await Promise.allSettled(
    reportes.flatMap((r) => {
      const descripcionCorta = r.descripcion.slice(0, 60);

      return [
        // Notificación al ciudadano
        createNotification(
          r.ciudadano_usuario_id,
          r.id,
          'Tu reporte sigue en proceso',
          `Seguimos trabajando en el problema que reportaste: "${descripcionCorta}". Te avisaremos cuando haya novedades.`
        ),
        // Notificación a la autoridad
        createNotification(
          r.autoridad_usuario_id,
          r.id,
          'Recordatorio: reporte pendiente de actualización',
          `El reporte "${descripcionCorta}" (colonia ${r.colonia}) sigue en estado 'en_proceso'. Por favor confirma su avance o ciérralo.`
        ),
      ];
    })
  );

  const errores = resultados.filter((r) => r.status === 'rejected').length;
  const ok      = resultados.length - errores;

  console.log(
    `[reminder.job] ${new Date().toISOString()} — ` +
    `reportes: ${reportes.length} | notificaciones enviadas: ${ok} | errores: ${errores}`
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
