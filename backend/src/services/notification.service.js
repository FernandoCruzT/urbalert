const { db } = require('../database/connection');

/**
 * Inserta una notificación en la tabla notificacion.
 *
 * @param {string}      usuario_id   — destinatario
 * @param {string|null} reporte_id   — reporte relacionado (puede ser null)
 * @param {string}      titulo
 * @param {string}      mensaje
 * @param {object}      [t=db]       — transacción activa o instancia db directa
 */
async function createNotification(usuario_id, reporte_id, titulo, mensaje, t = db) {
  return t.none(
    `INSERT INTO notificacion (usuario_id, reporte_id, titulo, mensaje)
     VALUES ($1, $2, $3, $4)`,
    [usuario_id, reporte_id, titulo, mensaje]
  );
}

module.exports = { createNotification };
