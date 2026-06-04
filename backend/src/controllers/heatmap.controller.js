const { db } = require('../database/connection');

/**
 * Convierte parámetros de temporalidad en rango de fechas [inicio, fin].
 */
function buildDateRange(temporalidad, anio, mes, semana) {
  if (!temporalidad || !anio) return { inicio: null, fin: null };

  switch (temporalidad) {
    case 'año': {
      return {
        inicio: new Date(`${anio}-01-01T00:00:00Z`),
        fin:    new Date(`${anio}-12-31T23:59:59Z`),
      };
    }
    case 'mes': {
      if (!mes || mes < 1 || mes > 12) return { inicio: null, fin: null };
      const inicio = new Date(Date.UTC(anio, mes - 1, 1));
      const fin    = new Date(Date.UTC(anio, mes, 0, 23, 59, 59));
      return { inicio, fin };
    }
    case 'semana': {
      if (!semana || semana < 1 || semana > 53) return { inicio: null, fin: null };
      const jan4 = new Date(Date.UTC(anio, 0, 4));
      const dow  = jan4.getUTCDay() || 7;
      const week1Monday = new Date(jan4);
      week1Monday.setUTCDate(jan4.getUTCDate() - (dow - 1));
      const inicio = new Date(week1Monday);
      inicio.setUTCDate(week1Monday.getUTCDate() + (semana - 1) * 7);
      const fin = new Date(inicio);
      fin.setUTCDate(inicio.getUTCDate() + 6);
      fin.setUTCHours(23, 59, 59, 999);
      return { inicio, fin };
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
    temporalidad  = null,
    anio          = null,
    mes           = null,
    semana        = null,
    categoria_id  = null,
    subcategoria  = null,
    sector_nombre = null,
    estado        = 'abiertos',
    metrica       = 'cantidad',
    mine          = false,
  } = req.query;

  const anioNum   = anio   ? parseInt(anio,   10) : null;
  const mesNum    = mes    ? parseInt(mes,     10) : null;
  const semanaNum = semana ? parseInt(semana,  10) : null;

  const { inicio, fin } = buildDateRange(temporalidad, anioNum, mesNum, semanaNum);

  const pesoExpr = metrica === 'urgencia'
    ? `CASE r.urgencia WHEN 'alto' THEN 3 WHEN 'medio' THEN 2 ELSE 1 END`
    : '1';

  const isMine = mine === 'true' || mine === true;

  const estadoFilter = estado === 'cerrados'
    ? `r.estado IN ('resuelto', 'cerrado')`
    : estado === 'todos'
      ? `r.estado IN ('enviado','en_validacion','en_revision','pendiente','asignado','en_proceso','resuelto','cerrado')`
      : `r.estado IN ('asignado', 'en_proceso')`;

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
       LEFT JOIN colonia_sector cs  ON LOWER(cs.nombre_colonia) = LOWER(r.colonia)
       LEFT JOIN sector         sec ON sec.id  = cs.sector_id
       LEFT JOIN colonia_poligono cp ON cp.id  = r.colonia_poligono_id
       WHERE ${estadoFilter}
         AND r.colonia    IS NOT NULL
         AND r.latitud    IS NOT NULL
         AND r.longitud   IS NOT NULL
         AND ($1::uuid        IS NULL OR r.categoria_id = $1)
         AND ($2::text        IS NULL OR sub.nombre ILIKE $2)
         AND ($3::text        IS NULL OR LOWER(sec.nombre) = LOWER($3))
         AND ($4::timestamptz IS NULL OR r.created_at >= $4)
         AND ($5::timestamptz IS NULL OR r.created_at <= $5)
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

module.exports = { heatmap };
