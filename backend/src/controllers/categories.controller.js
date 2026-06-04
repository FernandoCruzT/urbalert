const { db } = require('../database/connection');

/**
 * GET /api/categories
 * Devuelve todas las categorías con sus subcategorías anidadas.
 */
async function getCategories(req, res) {
  try {
    const rows = await db.any(
      `SELECT
         c.id   AS categoria_id,
         c.nombre AS categoria_nombre,
         s.id   AS subcategoria_id,
         s.nombre AS subcategoria_nombre,
         s.urgencia
       FROM categoria c
       LEFT JOIN subcategoria s ON s.categoria_id = c.id
       ORDER BY c.nombre, s.nombre`
    );

    // Agrupar subcategorías dentro de cada categoría
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.categoria_id)) {
        map.set(row.categoria_id, {
          id:            row.categoria_id,
          nombre:        row.categoria_nombre,
          subcategorias: [],
        });
      }
      if (row.subcategoria_id) {
        map.get(row.categoria_id).subcategorias.push({
          id:      row.subcategoria_id,
          nombre:  row.subcategoria_nombre,
          urgencia: row.urgencia,
        });
      }
    }

    return res.json({ categorias: [...map.values()] });
  } catch (err) {
    console.error('[getCategories]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

module.exports = { getCategories };
