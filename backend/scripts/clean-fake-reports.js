#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { db } = require('../src/database/connection');

async function main() {
  // 1. Estado actual
  console.log('═══════════════════════════════════════════════════════');
  console.log('ESTADO ACTUAL');
  console.log('═══════════════════════════════════════════════════════');
  const todos = await db.any(`
    SELECT r.id, r.descripcion, r.colonia, r.latitud, r.longitud,
           r.estado, u.email, r.created_at
    FROM reporte r
    JOIN ciudadano c ON c.id = r.ciudadano_id
    JOIN usuario u   ON u.id = c.usuario_id
    ORDER BY r.created_at DESC
  `);
  console.table(todos.map(r => ({
    id:          r.id,
    email:       r.email,
    colonia:     r.colonia,
    estado:      r.estado,
    lat:         r.latitud  != null ? Number(r.latitud).toFixed(5)  : 'NULL',
    lng:         r.longitud != null ? Number(r.longitud).toFixed(5) : 'NULL',
    descripcion: r.descripcion?.slice(0, 50),
    created_at:  r.created_at?.toISOString().slice(0, 19),
  })));
  console.log(`Total antes: ${todos.length}\n`);

  // 2. Identificar reportes a conservar y a eliminar
  const conservar = todos.filter(r =>
    r.email === 'pacocruz01@gmail.com' &&
    r.latitud  != null && r.longitud != null &&
    Number(r.latitud)  >= 20.5 && Number(r.latitud)  <= 20.8 &&
    Number(r.longitud) >= -103.5 && Number(r.longitud) <= -103.2
  );
  const eliminar = todos.filter(r => !conservar.some(c => c.id === r.id));

  console.log(`Reportes a CONSERVAR: ${conservar.length}`);
  conservar.forEach(r => console.log(`  ✓ ${r.id} | ${r.email} | ${r.colonia} | ${r.estado}`));
  console.log(`\nReportes a ELIMINAR: ${eliminar.length}`);
  eliminar.forEach(r => console.log(`  ✗ ${r.id} | ${r.email} | ${r.descripcion?.slice(0, 45)}`));

  if (eliminar.length === 0) {
    console.log('\nNada que eliminar.');
    return;
  }

  const ids = eliminar.map(r => r.id);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('ELIMINANDO EN ORDEN FK-SAFE…');
  console.log('═══════════════════════════════════════════════════════');

  await db.tx(async t => {
    const p = await t.result(`DELETE FROM penalizacion   WHERE reporte_id = ANY($1::uuid[])`, [ids]);
    console.log(`penalizacion eliminadas:     ${p.rowCount}`);

    const n = await t.result(`DELETE FROM notificacion   WHERE reporte_id = ANY($1::uuid[])`, [ids]);
    console.log(`notificacion eliminadas:     ${n.rowCount}`);

    const f = await t.result(`DELETE FROM foto_reporte   WHERE reporte_id = ANY($1::uuid[])`, [ids]);
    console.log(`foto_reporte eliminadas:     ${f.rowCount}`);

    const h = await t.result(`DELETE FROM historial_estado WHERE reporte_id = ANY($1::uuid[])`, [ids]);
    console.log(`historial_estado eliminados: ${h.rowCount}`);

    const v = await t.result(`DELETE FROM validacion      WHERE reporte_id = ANY($1::uuid[])`, [ids]);
    console.log(`validacion eliminadas:       ${v.rowCount}`);

    const a = await t.result(`DELETE FROM asignacion      WHERE reporte_id = ANY($1::uuid[])`, [ids]);
    console.log(`asignacion eliminadas:       ${a.rowCount}`);

    // Hijos (reporte_padre_id apunta a uno de los ids a eliminar)
    const hijos = await t.result(`DELETE FROM reporte WHERE reporte_padre_id = ANY($1::uuid[])`, [ids]);
    console.log(`reportes hijo eliminados:    ${hijos.rowCount}`);

    const rep = await t.result(`DELETE FROM reporte WHERE id = ANY($1::uuid[])`, [ids]);
    console.log(`reportes eliminados:         ${rep.rowCount}`);
  });

  console.log('\n✓ Borrado completado.');

  // 3. Estado final
  const restantes = await db.one(`SELECT COUNT(*) FROM reporte`);
  console.log(`\nReportes restantes en BD: ${restantes.count}`);

  const detalle = await db.any(`
    SELECT r.id, r.colonia, r.estado, u.email, r.created_at
    FROM reporte r
    JOIN ciudadano c ON c.id = r.ciudadano_id
    JOIN usuario u   ON u.id = c.usuario_id
    ORDER BY r.created_at DESC
  `);
  console.table(detalle.map(r => ({
    id:         r.id,
    email:      r.email,
    colonia:    r.colonia,
    estado:     r.estado,
    created_at: r.created_at?.toISOString().slice(0, 19),
  })));
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
