const { db } = require('../database/connection');

// ─── constantes ──────────────────────────────────────────────────────────────

const RESULTADOS_VALIDOS = ['sano', 'falso', 'duplicado', 'ubicacion_corregida', 'ubicacion_rechazada'];

/** Estado destino según el resultado de la validación. */
const ESTADO_POR_RESULTADO = {
  sano:                'pendiente',
  falso:               'cerrado',
  duplicado:           'cerrado',
  ubicacion_corregida: 'pendiente',
  ubicacion_rechazada: 'cerrado',
};

/**
 * Calcula el nuevo estado_cuenta y tipo_sancion a partir
 * del total acumulado de reportes falsos.
 */
function calcularSancion(reportes_falsos) {
  if (reportes_falsos >= 4) return { estado_cuenta: 'suspendida',   tipo_sancion: 'suspension'  };
  if (reportes_falsos >= 2) return { estado_cuenta: 'restringida',  tipo_sancion: 'restriccion' };
  return                         { estado_cuenta: 'advertida',    tipo_sancion: 'advertencia' };
}

/** Inserta un registro en historial_estado. */
async function insertarHistorial(t, { reporte_id, usuario_id, estado_anterior, estado_nuevo, observacion = null }) {
  return t.none(
    `INSERT INTO historial_estado
       (reporte_id, usuario_id, rol_usuario, estado_anterior, estado_nuevo, observacion)
     VALUES ($1, $2, 'superadmin', $3, $4, $5)`,
    [reporte_id, usuario_id, estado_anterior, estado_nuevo, observacion]
  );
}

// ─── queue ───────────────────────────────────────────────────────────────────

/**
 * GET /api/validation/queue
 * Reportes en estado 'en_revision' pendientes de decisión del superadmin.
 * Acepta query param opcional `tipo` (escalado | ubicacion | falso | repetido).
 */
async function queue(req, res) {
  const { tipo = null } = req.query;

  // Build WHERE clause based on tipo
  let tipoFilter = '';
  if (tipo === 'escalado') {
    tipoFilter = `AND EXISTS (SELECT 1 FROM asignacion a WHERE a.reporte_id = r.id AND a.tipo = 'escalado')`;
  } else if (tipo === 'ubicacion') {
    tipoFilter = `AND r.ubicacion_baja_precision = true AND NOT EXISTS (SELECT 1 FROM asignacion a WHERE a.reporte_id = r.id AND a.tipo = 'escalado')`;
  } else if (tipo === 'repetido') {
    tipoFilter = `AND r.reporte_padre_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM asignacion a WHERE a.reporte_id = r.id AND a.tipo = 'escalado') AND r.ubicacion_baja_precision = false`;
  } else if (tipo === 'falso') {
    tipoFilter = `AND r.reporte_padre_id IS NULL AND r.ubicacion_baja_precision = false AND NOT EXISTS (SELECT 1 FROM asignacion a WHERE a.reporte_id = r.id AND a.tipo = 'escalado')`;
  }

  try {
    const reportes = await db.any(
      `SELECT
         r.id,
         r.descripcion,
         r.urgencia,
         r.estado,
         r.calle,
         r.numero,
         r.colonia,
         r.latitud,
         r.longitud,
         r.precision_gps,
         r.ubicacion_baja_precision,
         r.confirmaciones_duplicado,
         r.reporte_padre_id,
         r.autoridad_id,
         r.created_at,
         r.updated_at,
         cat.nombre                              AS categoria_nombre,
         cat.id                                  AS categoria_id,
         sub.nombre                              AS subcategoria_nombre,
         sub.razon_urgencia,
         ua.nombre                               AS autoridad_nombre,
         ua.apellido                             AS autoridad_apellido,
         aut.departamento                        AS autoridad_departamento,
         sec.nombre                              AS sector_nombre,
         uc.nombre                               AS ciudadano_nombre,
         uc.apellido                             AS ciudadano_apellido,
         cit.reportes_falsos,
         COUNT(fp.id)::int                       AS total_fotos,
         MIN(fp.url_cloudinary)                  AS primera_foto,
         (SELECT a2.motivo FROM asignacion a2
          WHERE a2.reporte_id = r.id AND a2.tipo = 'escalado'
          ORDER BY a2.created_at DESC LIMIT 1)   AS motivo_escalado
       FROM reporte r
       JOIN categoria    cat  ON cat.id   = r.categoria_id
       JOIN subcategoria sub  ON sub.id   = r.subcategoria_id
       JOIN ciudadano    cit  ON cit.id   = r.ciudadano_id
       JOIN usuario      uc   ON uc.id    = cit.usuario_id
       LEFT JOIN autoridad    aut  ON aut.id   = r.autoridad_id
       LEFT JOIN usuario      ua   ON ua.id    = aut.usuario_id
       LEFT JOIN colonia_poligono cp ON cp.id  = r.colonia_poligono_id
       LEFT JOIN sector           sec ON sec.id = cp.sector_id
       LEFT JOIN foto_reporte     fp  ON fp.reporte_id = r.id
       WHERE r.estado = 'en_revision'
       ${tipoFilter}
       GROUP BY r.id, cat.nombre, cat.id, sub.nombre, sub.razon_urgencia,
                ua.nombre, ua.apellido, aut.departamento,
                sec.nombre, uc.nombre, uc.apellido, cit.reportes_falsos
       ORDER BY
         CASE r.urgencia WHEN 'alto' THEN 1 WHEN 'medio' THEN 2 ELSE 3 END,
         r.created_at ASC`
    );

    // For 'repetido' type, fetch padre summary
    if (tipo === 'repetido') {
      const padreIds = [...new Set(reportes.map(r => r.reporte_padre_id).filter(Boolean))];
      let padreMap = {};
      if (padreIds.length) {
        const padres = await db.any(
          `SELECT r.id, r.descripcion, r.estado, r.colonia, r.created_at,
                  cat.nombre AS categoria_nombre
           FROM reporte r JOIN categoria cat ON cat.id = r.categoria_id
           WHERE r.id = ANY($1::uuid[])`,
          [padreIds]
        );
        padres.forEach(p => { padreMap[p.id] = p; });
      }
      reportes.forEach(r => { r.reporte_padre = padreMap[r.reporte_padre_id] || null; });
    }

    return res.json({ total: reportes.length, reportes });
  } catch (err) {
    console.error('[validation.queue]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── review ──────────────────────────────────────────────────────────────────

/**
 * POST /api/validation/:reportId/review
 * El superadmin toma una decisión sobre el reporte.
 */
async function review(req, res) {
  const { reportId } = req.params;
  const {
    resultado,
    motivo          = null,
    reporte_similar_id = null,
    latitud         = null,
    longitud        = null,
    similitud_texto  = null,
    distancia_duplicado = null,
  } = req.body;

  // ── validación de entrada ───────────────────────────────────────────────
  if (!resultado || !RESULTADOS_VALIDOS.includes(resultado)) {
    return res.status(400).json({
      message: `resultado inválido. Valores permitidos: ${RESULTADOS_VALIDOS.join(', ')}`,
    });
  }
  if (resultado === 'duplicado' && !reporte_similar_id) {
    return res.status(400).json({ message: 'reporte_similar_id es obligatorio para resultado "duplicado"' });
  }

  const superadmin_id   = req.user.profileId;  // superadmin.id del JWT
  const usuario_id      = req.user.id;          // usuario.id del JWT (para historial)
  const estado_nuevo    = ESTADO_POR_RESULTADO[resultado];

  try {
    await db.tx(async (t) => {

      // 1. Cargar el reporte (debe estar en en_validacion o en_revision)
      const reporte = await t.oneOrNone(
        `SELECT r.id, r.estado, r.ciudadano_id, r.categoria_id,
                r.reporte_padre_id, r.urgencia
         FROM reporte r
         WHERE r.id = $1`,
        reportId
      );
      if (!reporte) throw { status: 404, message: 'Reporte no encontrado' };
      if (!['en_validacion', 'en_revision'].includes(reporte.estado)) {
        throw {
          status: 409,
          message: `El reporte está en estado '${reporte.estado}' y no puede ser revisado`,
        };
      }

      const estado_anterior = reporte.estado;

      // 2. Registrar en tabla validacion
      await t.none(
        `INSERT INTO validacion
           (reporte_id, superadmin_id, resultado, motivo,
            similitud_texto, distancia_duplicado, reporte_similar_id, revisado_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [reportId, superadmin_id, resultado, motivo,
         similitud_texto, distancia_duplicado, reporte_similar_id]
      );

      // 3. Lógica específica por resultado ──────────────────────────────────

      if (resultado === 'sano') {
        // ── sano: pasa a pendiente para ser asignado ─────────────────────
        await t.none(`UPDATE reporte SET estado = 'pendiente' WHERE id = $1`, reportId);

        await insertarHistorial(t, {
          reporte_id: reportId, usuario_id,
          estado_anterior, estado_nuevo: 'pendiente',
          observacion: motivo || 'Reporte validado como auténtico',
        });

      } else if (resultado === 'falso') {
        // ── falso: cierre + penalización al ciudadano ────────────────────
        await t.none(`UPDATE reporte SET estado = 'cerrado' WHERE id = $1`, reportId);

        await insertarHistorial(t, {
          reporte_id: reportId, usuario_id,
          estado_anterior, estado_nuevo: 'cerrado',
          observacion: motivo || 'Reporte marcado como falso',
        });

        // Incrementar contador y calcular nueva sanción
        const ciudadano = await t.one(
          `UPDATE ciudadano
           SET reportes_falsos = reportes_falsos + 1
           WHERE id = $1
           RETURNING id, reportes_falsos`,
          reporte.ciudadano_id
        );

        const { estado_cuenta, tipo_sancion } = calcularSancion(ciudadano.reportes_falsos);

        await t.none(
          `UPDATE ciudadano SET estado_cuenta = $1 WHERE id = $2`,
          [estado_cuenta, reporte.ciudadano_id]
        );

        await t.none(
          `INSERT INTO penalizacion
             (ciudadano_id, reporte_id, tipo_sancion, descripcion)
           VALUES ($1, $2, $3, $4)`,
          [reporte.ciudadano_id, reportId, tipo_sancion,
           motivo || `Reporte falso #${ciudadano.reportes_falsos} registrado`]
        );

      } else if (resultado === 'duplicado') {
        // ── duplicado: cierre + enlace al reporte padre ──────────────────
        const padre = await t.oneOrNone(
          `SELECT id FROM reporte WHERE id = $1 AND estado <> 'cerrado'`,
          reporte_similar_id
        );
        if (!padre) throw { status: 404, message: 'El reporte_similar_id no existe o ya está cerrado' };

        await t.none(
          `UPDATE reporte
           SET estado = 'cerrado', reporte_padre_id = $1
           WHERE id = $2`,
          [reporte_similar_id, reportId]
        );

        await t.none(
          `UPDATE reporte
           SET confirmaciones_duplicado = confirmaciones_duplicado + 1
           WHERE id = $1`,
          reporte_similar_id
        );

        await insertarHistorial(t, {
          reporte_id: reportId, usuario_id,
          estado_anterior, estado_nuevo: 'cerrado',
          observacion: motivo || `Marcado como duplicado del reporte ${reporte_similar_id}`,
        });

      } else if (resultado === 'ubicacion_corregida') {
        // ── ubicacion_corregida: actualiza coords si se enviaron ─────────
        if (latitud != null && longitud != null) {
          // El trigger trg_reporte_sync_ubicacion actualiza el campo geometry
          await t.none(
            `UPDATE reporte
             SET estado = 'pendiente', latitud = $1, longitud = $2
             WHERE id = $3`,
            [latitud, longitud, reportId]
          );
        } else {
          await t.none(`UPDATE reporte SET estado = 'pendiente' WHERE id = $1`, reportId);
        }

        await insertarHistorial(t, {
          reporte_id: reportId, usuario_id,
          estado_anterior, estado_nuevo: 'pendiente',
          observacion: motivo || 'Ubicación corregida por superadmin',
        });

      } else if (resultado === 'ubicacion_rechazada') {
        // ── ubicacion_rechazada: cierre por ubicación no válida ──────────
        await t.none(`UPDATE reporte SET estado = 'cerrado' WHERE id = $1`, reportId);

        await insertarHistorial(t, {
          reporte_id: reportId, usuario_id,
          estado_anterior, estado_nuevo: 'cerrado',
          observacion: motivo || 'Reporte rechazado por ubicación inválida',
        });
      }
    });

    return res.json({ message: `Reporte procesado correctamente: ${resultado}` });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('[validation.review]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── stats ───────────────────────────────────────────────────────────────────

/**
 * GET /api/validation/stats
 * Conteo de reportes por estado para el dashboard del superadmin.
 * Incluye desglose de los 4 tipos de revisión para reportes en_revision.
 */
async function stats(req, res) {
  try {
    // General counts by estado
    const rows = await db.any(`SELECT estado, COUNT(*)::int AS total FROM reporte GROUP BY estado ORDER BY CASE estado WHEN 'enviado' THEN 1 WHEN 'en_validacion' THEN 2 WHEN 'en_revision' THEN 3 WHEN 'pendiente' THEN 4 WHEN 'asignado' THEN 5 WHEN 'en_proceso' THEN 6 WHEN 'resuelto' THEN 7 WHEN 'cerrado' THEN 8 END`);
    const porEstado = Object.fromEntries(rows.map(r => [r.estado, r.total]));
    const totalGeneral = rows.reduce((a, r) => a + r.total, 0);
    const totalActivos = rows.filter(r => !['resuelto','cerrado'].includes(r.estado)).reduce((a,r)=>a+r.total,0);

    // 4 review types from en_revision reports
    const rev = await db.one(`
      SELECT
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM asignacion a WHERE a.reporte_id = r.id AND a.tipo = 'escalado'
        ))::int AS escalado,
        COUNT(*) FILTER (WHERE r.ubicacion_baja_precision = true
          AND NOT EXISTS (SELECT 1 FROM asignacion a WHERE a.reporte_id = r.id AND a.tipo = 'escalado')
        )::int AS ubicacion,
        COUNT(*) FILTER (WHERE r.reporte_padre_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM asignacion a WHERE a.reporte_id = r.id AND a.tipo = 'escalado')
          AND r.ubicacion_baja_precision = false
        )::int AS repetido,
        COUNT(*) FILTER (WHERE r.reporte_padre_id IS NULL
          AND r.ubicacion_baja_precision = false
          AND NOT EXISTS (SELECT 1 FROM asignacion a WHERE a.reporte_id = r.id AND a.tipo = 'escalado')
        )::int AS falso
      FROM reporte r
      WHERE r.estado = 'en_revision'
    `);

    return res.json({ totalGeneral, totalActivos, porEstado, detalle: rows, revision: rev });
  } catch (err) {
    console.error('[validation.stats]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

module.exports = { queue, review, stats };
