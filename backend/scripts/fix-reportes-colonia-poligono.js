/**
 * Fix: vincula reporte.colonia_poligono_id usando match por nombre de colonia.
 * - Si hay múltiples coincidencias (homónimas en distintos municipios), toma
 *   la primera por orden alfabético de municipio y emite una advertencia.
 * - Si no hay ningún match, deja NULL y registra el caso.
 *
 * Uso: node backend/scripts/fix-reportes-colonia-poligono.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { db, connectDB } = require('../src/database/connection');

(async () => {
  try {
    await connectDB();

    const reportes = await db.any(
      `SELECT id, colonia FROM reporte WHERE colonia_poligono_id IS NULL AND colonia IS NOT NULL`
    );
    console.log(`Reportes con colonia_poligono_id NULL: ${reportes.length}`);

    if (reportes.length === 0) {
      console.log('Nada que corregir.');
      return;
    }

    const conteo = { actualizados: 0, advertencias: 0, sin_match: 0 };

    for (const r of reportes) {
      const matches = await db.any(
        `SELECT id, nombre, municipio
         FROM colonia_poligono
         WHERE LOWER(nombre) = LOWER($1)
         ORDER BY municipio ASC`,
        [r.colonia]
      );

      if (matches.length === 0) {
        console.warn(`  [SIN MATCH]  reporte ${r.id} — colonia: "${r.colonia}"`);
        conteo.sin_match++;
        continue;
      }

      if (matches.length > 1) {
        const lista = matches.map(m => m.municipio).join(', ');
        console.warn(`  [ADVERTENCIA] reporte ${r.id} — "${r.colonia}" existe en ${matches.length} municipios: ${lista}. Usando: ${matches[0].municipio}`);
        conteo.advertencias++;
      }

      await db.none(
        `UPDATE reporte SET colonia_poligono_id = $1 WHERE id = $2`,
        [matches[0].id, r.id]
      );
      conteo.actualizados++;
    }

    console.log('\n✓ Script completado');
    console.log(`  Actualizados  : ${conteo.actualizados}`);
    console.log(`  Advertencias  : ${conteo.advertencias}`);
    console.log(`  Sin match     : ${conteo.sin_match}`);

    const resumen = await db.any(
      `SELECT colonia_poligono_id IS NULL as sin_vinculo, COUNT(*) FROM reporte GROUP BY colonia_poligono_id IS NULL`
    );
    console.log('\nEstado final:');
    resumen.forEach(row =>
      console.log(`  ${row.sin_vinculo ? 'Sin vínculo' : 'Con vínculo'}: ${row.count}`)
    );

  } catch (err) {
    console.error('\n✗ Error:', err.message || err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
