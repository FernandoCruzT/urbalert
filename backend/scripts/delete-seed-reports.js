#!/usr/bin/env node
/**
 * Elimina los reportes de prueba del seed en orden FK-safe.
 * Uso: node backend/scripts/delete-seed-reports.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { db } = require('../src/database/connection');

const FILTER = `
  descripcion LIKE '%tubería subterránea%'
  OR descripcion LIKE '%desbordamiento%'
  OR descripcion LIKE '%encharcamiento en banqueta%'
  OR descripcion LIKE '%toma domiciliaria frente a Mercado Corona%'
  OR descripcion LIKE '%Calzada Independencia%'
  OR descripcion LIKE '%colector pluvial%'
  OR descripcion LIKE '%sanitizado%'
  OR descripcion LIKE '%duplicado%'
  OR descripcion LIKE '%Jardines del Sol%'
  OR descripcion LIKE '%Bache de gran tamaño%'
`;

async function main() {
  const reportes = await db.any(`SELECT id, descripcion FROM reporte WHERE ${FILTER}`);

  if (reportes.length === 0) {
    console.log('No se encontraron reportes de prueba. Nada que eliminar.');
    return;
  }

  console.log(`Reportes encontrados: ${reportes.length}`);
  reportes.forEach(r => console.log(`  - ${r.id}: ${r.descripcion.substring(0, 60)}`));

  const ids = reportes.map(r => r.id);

  await db.tx(async t => {
    // 1. penalizacion
    const p = await t.result(
      `DELETE FROM penalizacion WHERE reporte_id = ANY($1::uuid[])`, [ids]
    );
    console.log(`\npenalizacion eliminadas:    ${p.rowCount}`);

    // 2. notificacion
    const n = await t.result(
      `DELETE FROM notificacion WHERE reporte_id = ANY($1::uuid[])`, [ids]
    );
    console.log(`notificacion eliminadas:    ${n.rowCount}`);

    // 3. foto_reporte
    const f = await t.result(
      `DELETE FROM foto_reporte WHERE reporte_id = ANY($1::uuid[])`, [ids]
    );
    console.log(`foto_reporte eliminadas:    ${f.rowCount}`);

    // 4. historial_estado
    const h = await t.result(
      `DELETE FROM historial_estado WHERE reporte_id = ANY($1::uuid[])`, [ids]
    );
    console.log(`historial_estado eliminados: ${h.rowCount}`);

    // 5. validacion
    const v = await t.result(
      `DELETE FROM validacion WHERE reporte_id = ANY($1::uuid[])`, [ids]
    );
    console.log(`validacion eliminadas:      ${v.rowCount}`);

    // 6. asignacion
    const a = await t.result(
      `DELETE FROM asignacion WHERE reporte_id = ANY($1::uuid[])`, [ids]
    );
    console.log(`asignacion eliminadas:      ${a.rowCount}`);

    // 7. reporte (padre primero si hay hijos — reporte_padre_id apunta a otros reportes)
    //    Primero eliminar hijos (reporte_padre_id IN ids), luego los propios ids
    const hijos = await t.result(
      `DELETE FROM reporte WHERE reporte_padre_id = ANY($1::uuid[])`, [ids]
    );
    console.log(`reportes hijo eliminados:  ${hijos.rowCount}`);

    const rep = await t.result(
      `DELETE FROM reporte WHERE id = ANY($1::uuid[])`, [ids]
    );
    console.log(`reportes eliminados:        ${rep.rowCount}`);
  });

  console.log('\n✓ Borrado completado correctamente.');

  const remaining = await db.one('SELECT COUNT(*) FROM reporte');
  console.log(`Reportes restantes en BD: ${remaining.count}`);
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
