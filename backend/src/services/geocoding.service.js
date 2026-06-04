const { db } = require('../database/connection');

/**
 * Dado un par de coordenadas, busca en qué polígono de colonia_poligono caen
 * usando PostGIS ST_Contains.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<{nombre, municipio, sector_id, colonia_poligono_id}|null>}
 */
async function getColoniaFromCoords(lat, lng) {
  if (lat == null || lng == null) return null;

  try {
    const row = await db.oneOrNone(
      `SELECT
         cp.id          AS colonia_poligono_id,
         cp.nombre,
         cp.municipio,
         cp.sector_id
       FROM colonia_poligono cp
       WHERE ST_Contains(
         cp.geom,
         ST_SetSRID(ST_MakePoint($2, $1), 4326)
       )
       LIMIT 1`,
      [lat, lng]
    );

    if (row) return row;

    // Fallback: colonia más cercana si el punto no cae dentro de ningún polígono
    // (p. ej. coordenada en una calle en el borde entre dos colonias)
    const nearest = await db.oneOrNone(
      `SELECT
         cp.id          AS colonia_poligono_id,
         cp.nombre,
         cp.municipio,
         cp.sector_id,
         ST_Distance(
           cp.geom::geography,
           ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
         ) AS distancia_m
       FROM colonia_poligono cp
       ORDER BY cp.geom <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)
       LIMIT 1`,
      [lat, lng]
    );

    // Solo usar el fallback si la colonia más cercana está a menos de 200 m
    if (nearest && nearest.distancia_m <= 200) return nearest;

    return null;
  } catch (err) {
    console.error('[geocoding.getColoniaFromCoords]', err.message);
    return null;
  }
}

module.exports = { getColoniaFromCoords };
