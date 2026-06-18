const cron = require('node-cron');
const { db }                  = require('../database/connection');
const { assignReport }        = require('../services/assignment.service');
const { createNotification }  = require('../services/notification.service');

/**
 * Devuelve true si la descripción no supera las validaciones mínimas de contenido.
 * Criterios de rechazo:
 *   - null o vacía
 *   - menos de 10 caracteres
 *   - más del 60 % de los caracteres no son letras, dígitos ni espacios
 */
function isDescripcionInvalida(descripcion) {
  if (!descripcion || descripcion.trim().length === 0) return true;
  if (descripcion.trim().length < 10) return true;
  const noValidos = descripcion.split('').filter(
    c => !/[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\d ]/.test(c)
  ).length;
  return noValidos / descripcion.length > 0.6;
}

/**
 * Valida y mueve reportes atascados en 'enviado' o 'en_validacion'.
 * Rechaza (→ 'cerrado') los que tengan ubicación imprecisa o descripción inválida.
 * Aprueba (→ 'pendiente') los que superen todas las validaciones.
 * Registra entrada en historial_estado con rol 'sistema'.
 */
async function runAutoValidationJob() {
  const atascados = await db.any(`
    SELECT r.id, r.descripcion, r.ubicacion_baja_precision,
           c.usuario_id AS ciudadano_usuario_id
    FROM reporte r
    JOIN ciudadano c ON c.id = r.ciudadano_id
    WHERE r.estado IN ('enviado', 'en_validacion')
      AND r.created_at < NOW() - INTERVAL '1 minute'
      AND r.reporte_padre_id IS NULL
    ORDER BY r.created_at ASC
  `);

  if (atascados.length === 0) return;

  let aprobados = 0;
  let rechazados = 0;

  await db.tx(async t => {
    for (const r of atascados) {

      // ── Validación 1: ubicación GPS imprecisa ──────────────────────────────
      if (r.ubicacion_baja_precision) {
        const obs = 'Reporte rechazado: ubicación GPS imprecisa. Intenta reportar de nuevo en un área con mejor señal.';
        await t.none(
          `INSERT INTO historial_estado
             (reporte_id, estado_anterior, estado_nuevo, rol_usuario, observacion, created_at)
           SELECT id, estado, 'cerrado', 'sistema', $2, NOW() FROM reporte WHERE id = $1`,
          [r.id, obs]
        );
        await t.none(
          `UPDATE reporte SET estado = 'cerrado', updated_at = NOW() WHERE id = $1`,
          [r.id]
        );
        await createNotification(
          r.ciudadano_usuario_id, r.id,
          'Reporte no procesado',
          obs,
          t
        );
        rechazados++;
        continue;
      }

      // ── Validación 2: descripción inválida ─────────────────────────────────
      if (isDescripcionInvalida(r.descripcion)) {
        const obs = 'Reporte rechazado automáticamente: descripción inválida';
        await t.none(
          `INSERT INTO historial_estado
             (reporte_id, estado_anterior, estado_nuevo, rol_usuario, observacion, created_at)
           SELECT id, estado, 'cerrado', 'sistema', $2, NOW() FROM reporte WHERE id = $1`,
          [r.id, obs]
        );
        await t.none(
          `UPDATE reporte SET estado = 'cerrado', updated_at = NOW() WHERE id = $1`,
          [r.id]
        );
        await createNotification(
          r.ciudadano_usuario_id, r.id,
          'Reporte no procesado',
          'Tu reporte fue rechazado porque la descripción no es válida. Por favor, proporciona al menos 10 caracteres con información clara sobre el problema.',
          t
        );
        rechazados++;
        continue;
      }

      // ── Aprobado: mover a pendiente ────────────────────────────────────────
      await t.none(
        `INSERT INTO historial_estado
           (reporte_id, estado_anterior, estado_nuevo, rol_usuario, created_at)
         SELECT id, estado, 'pendiente', 'sistema', NOW() FROM reporte WHERE id = $1`,
        [r.id]
      );
      await t.none(
        `UPDATE reporte SET estado = 'pendiente', updated_at = NOW() WHERE id = $1`,
        [r.id]
      );
      await createNotification(
        r.ciudadano_usuario_id, r.id,
        'Reporte recibido',
        'Tu reporte ha sido recibido y está siendo procesado',
        t
      );
      aprobados++;
    }
  });

  console.log(
    `[auto-validation.job] ${new Date().toISOString()} — ` +
    `aprobados: ${aprobados} | rechazados: ${rechazados}`
  );
}

/**
 * Procesa los reportes en estado 'pendiente' en lotes de 5 para no saturar
 * el pool de conexiones (10 por defecto en pg-promise).
 * Llamado por el cron y también exportado para tests o ejecución manual.
 */
async function runAssignmentJob() {
  const pendientes = await db.any(
    `SELECT id FROM reporte WHERE estado = 'pendiente' ORDER BY created_at ASC`
  );

  if (pendientes.length === 0) return;

  let asignados  = 0;
  let sinAsignar = 0;
  let errores    = 0;

  const BATCH = 5;
  for (let i = 0; i < pendientes.length; i += BATCH) {
    const lote = pendientes.slice(i, i + BATCH);
    const resultados = await Promise.allSettled(lote.map((r) => assignReport(r.id)));

    resultados.forEach((r, j) => {
      if (r.status === 'fulfilled') {
        if (r.value !== null) asignados++;
        else                  sinAsignar++;
      } else {
        errores++;
        console.error(`[assignment.job] Error en reporte ${lote[j].id}:`, r.reason?.message);
      }
    });
  }

  console.log(
    `[assignment.job] ${new Date().toISOString()} — ` +
    `procesados: ${pendientes.length} | asignados: ${asignados} | ` +
    `sin autoridad: ${sinAsignar} | errores: ${errores}`
  );
}

// Previene solapamiento entre ejecuciones del cron si el job tarda más de 2 min.
let jobRunning = false;

/**
 * Registra el job de asignación automática.
 * Corre cada 2 minutos.
 */
function startAssignmentJob() {
  cron.schedule('*/2 * * * *', async () => {
    if (jobRunning) {
      console.warn('[assignment.job] Ejecución anterior aún activa — tick omitido');
      return;
    }
    jobRunning = true;
    try {
      await runAutoValidationJob();
      await runAssignmentJob();
    } catch (err) {
      console.error('[assignment.job] Error inesperado:', err.message);
    } finally {
      jobRunning = false;
    }
  });

  console.log('[assignment.job] Job de asignación automática activo (cada 2 min)');
}

module.exports = { startAssignmentJob, runAssignmentJob, runAutoValidationJob };
