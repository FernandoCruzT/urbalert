const { db } = require('../database/connection');

// Offset fijo de México Central (CST = UTC-6).
// Jalisco no observa DST desde 2023, por lo que el offset es constante.
const MX_OFFSET_MS = 6 * 60 * 60 * 1000;

/**
 * Convierte parámetros de temporalidad en rango de fechas [inicio, fin] en UTC,
 * ajustado a la zona horaria de México (CST, UTC-6) para que los límites
 * correspondan a medianoche y fin de día en hora local.
 *
 * inicio = medianoche local  → 00:00 MX = 06:00 UTC
 * fin    = fin de día local  → 23:59:59 MX = 05:59:59 UTC del día siguiente
 */
function buildDateRange(temporalidad, anio, mes, semana, vista = 'periodo') {
  if (!temporalidad || !anio) return { inicio: null, fin: null };

  const inicioAnio = new Date(Date.UTC(anio, 0, 1, 6, 0, 0, 0));

  switch (temporalidad) {
    case 'año': {
      // Acumulado y periodo son equivalentes para vista anual
      return {
        inicio: inicioAnio,
        fin:    new Date(Date.UTC(anio, 11, 32, 5, 59, 59, 999)),
      };
    }
    case 'mes': {
      if (!mes || mes < 1 || mes > 12) return { inicio: null, fin: null };
      return {
        inicio: vista === 'acumulado'
          ? inicioAnio
          : new Date(Date.UTC(anio, mes - 1, 1, 6, 0, 0, 0)),
        fin: new Date(Date.UTC(anio, mes, 1, 5, 59, 59, 999)),
      };
    }
    case 'semana': {
      if (!semana || semana < 1 || semana > 53) return { inicio: null, fin: null };
      return {
        inicio: vista === 'acumulado'
          ? inicioAnio
          : new Date(Date.UTC(anio, 0, 1 + (semana - 1) * 7, 6,  0,  0,   0)),
        fin: new Date(Date.UTC(anio, 0, 7 + (semana - 1) * 7, 5, 59, 59, 999)),
      };
    }
    default:
      return { inicio: null, fin: null };
  }
}

/**
 * GET /api/heatmap
 * Devuelve reportes agrupados por colonia:
 *   { colonia, total, peso_total, lat_centroid, lng_centroid }
 *
 * Filtros:
 *   temporalidad   : 'año' | 'mes' | 'semana'
 *   anio           : number
 *   mes            : number 1-12
 *   semana         : number 1-52
 *   categoria_id   : uuid
 *   subcategoria_id: uuid
 *   sector_nombre  : string
 *   estado         : 'abiertos' | 'cerrados'
 *   metrica        : 'cantidad' | 'urgencia'
 *   mine           : boolean
 */
async function heatmap(req, res) {
  const {
    temporalidad          = null,
    anio                  = null,
    mes                   = null,
    semana                = null,
    categoria_id          = null,
    subcategoria          = null,
    sector_nombre         = null,
    estado                = 'abiertos',
    metrica               = 'cantidad',
    vista                 = 'periodo',
    mine                  = false,
    fecha_inicio_override = null,   // ISO date — sustituye el inicio calculado solo en vista=acumulado
  } = req.query;

  const anioNum   = anio   ? parseInt(anio,   10) : null;
  const mesNum    = mes    ? parseInt(mes,     10) : null;
  const semanaNum = semana ? parseInt(semana,  10) : null;

  let { inicio, fin } = buildDateRange(temporalidad, anioNum, mesNum, semanaNum, vista);

  // Permite al cliente fijar su propio inicio de acumulado (ej. inicio del mes en mobile)
  if (vista === 'acumulado' && fecha_inicio_override) {
    const parsed = new Date(fecha_inicio_override);
    if (!isNaN(parsed.getTime())) inicio = parsed;
  }

  const pesoExpr = metrica === 'urgencia'
    ? `CASE r.urgencia WHEN 'alto' THEN 3 WHEN 'medio' THEN 2 ELSE 1 END`
    : '1';

  const isMine = mine === 'true' || mine === true;

  const estadoFilter = estado === 'cerrados'
    ? `r.estado IN ('resuelto', 'cerrado')`
    : estado === 'todos'
      ? `r.estado IN ('enviado','en_validacion','en_revision','pendiente','asignado','en_proceso','resuelto','cerrado')`
      : `r.estado IN ('asignado', 'en_proceso')`;

  // buildDateRange ya calcula el rango correcto según vista:
  //   periodo   → [inicio del periodo, fin del periodo]
  //   acumulado → [1 ene del año,      fin del periodo]
  const dateCondition = `AND ($4::timestamptz IS NULL OR r.created_at >= $4)
       AND ($5::timestamptz IS NULL OR r.created_at <= $5)`;

  const mineFilter = isMine
    ? `AND r.autoridad_id = (SELECT id FROM autoridad WHERE usuario_id = $7)`
    : `AND ($7::uuid IS NULL OR TRUE)`;

  const autoridad_usuario_id = isMine ? req.user.id : null;

  try {
    const rows = await db.any(
      `SELECT
         r.colonia,
         COUNT(*)::int                        AS total,
         SUM(${pesoExpr})::int                AS peso_total,
         COALESCE(
           ST_Y(ST_Centroid(ST_Collect(cp.geom))),
           AVG(r.latitud)
         )::float                             AS lat_centroid,
         COALESCE(
           ST_X(ST_Centroid(ST_Collect(cp.geom))),
           AVG(r.longitud)
         )::float                             AS lng_centroid
       FROM reporte r
       LEFT JOIN subcategoria   sub ON sub.id  = r.subcategoria_id
       LEFT JOIN colonia_poligono cp ON cp.id  = r.colonia_poligono_id
       WHERE ${estadoFilter}
         AND r.colonia    IS NOT NULL
         AND r.latitud    IS NOT NULL
         AND r.longitud   IS NOT NULL
         AND ($1::uuid        IS NULL OR r.categoria_id = $1)
         AND ($2::text        IS NULL OR sub.nombre ILIKE $2)
         AND ($3::text IS NULL OR (
           r.colonia_poligono_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM colonia_poligono cp_s
             JOIN sector s ON s.id = cp_s.sector_id
             WHERE cp_s.id = r.colonia_poligono_id
               AND LOWER(s.nombre) = LOWER($3)
           )
         ))
         ${dateCondition}
         ${mineFilter}
       GROUP BY r.colonia
       ORDER BY total DESC
       LIMIT $6`,
      [
        categoria_id || null,
        subcategoria || null,
        sector_nombre || null,
        inicio       || null,
        fin          || null,
        200,
        autoridad_usuario_id,
      ]
    );

    // When mine=true devolver las subcategorías de la categoría asignada a la autoridad
    let subcategorias = [];
    if (mine === 'true' || mine === true) {
      const subRows = await db.any(
        `SELECT s.nombre
         FROM subcategoria s
         JOIN autoridad a ON a.categoria_id = s.categoria_id
         WHERE a.usuario_id = $1
         ORDER BY s.nombre`,
        [req.user.id]
      );
      subcategorias = subRows.map(r => r.nombre);
    }

    return res.json({ total: rows.length, colonias: rows, subcategorias });
  } catch (err) {
    console.error('[heatmap]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/**
 * GET /api/heatmap/sectores
 * Devuelve un objeto { colonia_nombre: sector_nombre } para todas las colonias con sector asignado.
 * Usado por el frontend para resaltar colonias de un sector en el mapa choropleth.
 */
async function sectores(req, res) {
  try {
    const rows = await db.any(
      `SELECT cp.nombre AS colonia_nombre, s.nombre AS sector_nombre
       FROM colonia_poligono cp
       JOIN sector s ON s.id = cp.sector_id`
    );
    const map = {};
    rows.forEach(r => { map[r.colonia_nombre] = r.sector_nombre; });
    return res.json(map);
  } catch (err) {
    console.error('[heatmap/sectores]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

module.exports = { heatmap, sectores };
