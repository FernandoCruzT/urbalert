const { db }                   = require('../database/connection');
const { createNotification }   = require('./notification.service');

// ─── helpers ─────────────────────────────────────────────────────────────────

async function insertarHistorial(t, { reporte_id, estado_anterior, estado_nuevo, observacion }) {
  return t.none(
    `INSERT INTO historial_estado
       (reporte_id, usuario_id, rol_usuario, estado_anterior, estado_nuevo, observacion)
     VALUES ($1, NULL, 'sistema', $2, $3, $4)`,
    [reporte_id, estado_anterior, estado_nuevo, observacion]
  );
}

// ─── assignReport ─────────────────────────────────────────────────────────────

/**
 * Intenta asignar un reporte a la autoridad más adecuada.
 *
 * Criterios de selección:
 *   1. categoria_id del reporte coincide con categoria_id de la autoridad
 *   2. sector_id de la autoridad cubre la colonia del reporte
 *      (via colonia_sector, comparación case-insensitive)
 *   3. Menor carga_ponderada; en empate, menor reportes_activos
 *
 * @param {string} reporte_id
 * @returns {Promise<object|null>} Autoridad asignada o null si no hay disponible
 */
async function assignReport(reporte_id) {
  return db.tx(async (t) => {

    // 1. Cargar el reporte — solo procesamos si está en 'pendiente'
    const reporte = await t.oneOrNone(
      `SELECT r.id, r.estado, r.categoria_id, r.colonia, r.autoridad_id,
              r.colonia_poligono_id, r.latitud, r.longitud,
              c.usuario_id  AS ciudadano_usuario_id,
              cat.nombre    AS categoria_nombre
       FROM reporte r
       JOIN ciudadano c   ON c.id   = r.ciudadano_id
       JOIN categoria cat ON cat.id = r.categoria_id
       WHERE r.id = $1`,
      reporte_id
    );

    if (!reporte) throw Object.assign(new Error('Reporte no encontrado'), { status: 404 });
    if (reporte.estado !== 'pendiente') {
      throw Object.assign(
        new Error(`El reporte está en estado '${reporte.estado}', se esperaba 'pendiente'`),
        { status: 409 }
      );
    }

    // 2. Buscar autoridad óptima
    // Prioridad A: colonia_poligono_id ya conocido
    //           B: lookup GPS con ST_Contains contra colonia_poligono
    //           C: fallback por texto en colonia_sector
    const autoridad = await t.oneOrNone(
      `SELECT
         a.id,
         a.usuario_id,
         a.departamento,
         a.carga_ponderada,
         a.reportes_activos,
         u.nombre   AS nombre,
         u.apellido AS apellido
       FROM autoridad a
       JOIN usuario u ON u.id = a.usuario_id
       WHERE a.categoria_id = $1
         AND a.activo = TRUE
         AND (
           -- Opción A: sector del polígono ya asignado al reporte
           ($3::uuid IS NOT NULL
            AND a.sector_id = (SELECT sector_id FROM colonia_poligono WHERE id = $3))
           OR
           -- Opción B: lookup por coordenadas GPS vía ST_Contains
           ($3::uuid IS NULL
            AND $4::float IS NOT NULL
            AND $5::float IS NOT NULL
            AND a.sector_id = (
              SELECT cp.sector_id FROM colonia_poligono cp
              WHERE ST_Contains(cp.geom, ST_SetSRID(ST_MakePoint($5, $4), 4326))
              LIMIT 1
            ))
           OR
           -- Opción C: fallback por texto en colonia_sector
           ($3::uuid IS NULL
            AND ($4::float IS NULL OR $5::float IS NULL)
            AND EXISTS (
              SELECT 1 FROM colonia_sector cs
              WHERE cs.sector_id = a.sector_id
                AND LOWER(cs.nombre_colonia) = LOWER($2)
            ))
         )
       ORDER BY a.carga_ponderada ASC, a.reportes_activos ASC
       LIMIT 1`,
      [
        reporte.categoria_id,
        reporte.colonia,
        reporte.colonia_poligono_id || null,
        reporte.latitud             || null,
        reporte.longitud            || null,
      ]
    );

    // 3a. Sin autoridad disponible — historial y salida
    if (!autoridad) {
      await insertarHistorial(t, {
        reporte_id,
        estado_anterior: 'pendiente',
        estado_nuevo:    'pendiente',
        observacion:     `Sin autoridad disponible para colonia '${reporte.colonia}' en esta categoría`,
      });
      return null;
    }

    // 3b. Autoridad encontrada — asignar

    // Insertar en tabla asignacion
    await t.none(
      `INSERT INTO asignacion
         (reporte_id, autoridad_id, tipo, motivo, asignado_por)
       VALUES ($1, $2, 'inicial', NULL, NULL)`,
      [reporte_id, autoridad.id]
    );

    // Actualizar reporte (el trigger fn_trg_carga_autoridad recalculará la carga)
    await t.none(
      `UPDATE reporte
       SET autoridad_id = $1, estado = 'asignado'
       WHERE id = $2`,
      [autoridad.id, reporte_id]
    );

    await insertarHistorial(t, {
      reporte_id,
      estado_anterior: 'pendiente',
      estado_nuevo:    'asignado',
      observacion:     `Asignado automáticamente a ${autoridad.nombre} ${autoridad.apellido}`,
    });

    await createNotification(
      reporte.ciudadano_usuario_id,
      reporte_id,
      'Reporte asignado',
      'Tu reporte ha sido asignado a una autoridad que se encargará de atenderlo',
      t
    );

    await createNotification(
      autoridad.usuario_id,
      reporte_id,
      'Nuevo reporte asignado',
      `Se te ha asignado un nuevo reporte de ${reporte.categoria_nombre} en ${reporte.colonia || 'ubicación desconocida'}`,
      t
    );

    return autoridad;
  });
}

module.exports = { assignReport };
