#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { db } = require('../src/database/connection');

async function main() {
  // 1. Verificar categorías y sus subcategorías
  console.log('═══════════════════════════════════════════════════════');
  console.log('CATEGORÍAS Y SUBCATEGORÍAS');
  console.log('═══════════════════════════════════════════════════════');
  const cats = await db.any(`
    SELECT c.id, c.nombre, COUNT(s.id)::int AS subcategorias
    FROM categoria c
    LEFT JOIN subcategoria s ON s.categoria_id = c.id
    GROUP BY c.id, c.nombre
    ORDER BY c.nombre
  `);
  console.table(cats.map(c => ({
    nombre:       c.nombre,
    subcategorias: c.subcategorias,
    id:           c.id,
  })));

  const sinSub = cats.filter(c => c.subcategorias === 0);
  console.log(`\nCategorías sin subcategorías: ${sinSub.length}`);
  sinSub.forEach(c => console.log(`  ✗ "${c.nombre}" (${c.id})`));

  // 2. Reasignar Daniel Cruz a "Espacios públicos" antes de borrar
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('REASIGNANDO AUTORIDAD daniel.cruz@urbalert.mx');
  console.log('═══════════════════════════════════════════════════════');

  const catDestino = await db.oneOrNone(
    `SELECT id, nombre FROM categoria WHERE nombre ILIKE '%espacios%' LIMIT 1`
  );
  if (!catDestino) {
    console.error('No se encontró categoría "Espacios públicos". Abortando.');
    return;
  }
  console.log(`Categoría destino: "${catDestino.nombre}" (${catDestino.id})`);

  const upd = await db.result(`
    UPDATE autoridad
    SET categoria_id = $1
    WHERE usuario_id = (SELECT id FROM usuario WHERE email = 'daniel.cruz@urbalert.mx')
  `, [catDestino.id]);
  console.log(`Filas actualizadas: ${upd.rowCount}`);

  // 3. Eliminar "Infraestructura urbana" si no tiene subcategorías
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('ELIMINANDO CATEGORÍA SIN SUBCATEGORÍAS');
  console.log('═══════════════════════════════════════════════════════');

  const del = await db.result(`
    DELETE FROM categoria
    WHERE nombre = 'Infraestructura urbana'
      AND id NOT IN (SELECT DISTINCT categoria_id FROM subcategoria)
  `);
  console.log(`Categorías eliminadas: ${del.rowCount}`);

  // 4. Estado final
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('ESTADO FINAL');
  console.log('═══════════════════════════════════════════════════════');
  const final = await db.any(`
    SELECT c.nombre, COUNT(s.id)::int AS subcategorias,
           STRING_AGG(s.nombre, ', ' ORDER BY s.nombre) AS lista
    FROM categoria c
    LEFT JOIN subcategoria s ON s.categoria_id = c.id
    GROUP BY c.id, c.nombre
    ORDER BY c.nombre
  `);
  console.table(final.map(c => ({
    nombre:        c.nombre,
    subcategorias: c.subcategorias,
    lista:         c.lista ?? '—',
  })));

  const daniel = await db.oneOrNone(`
    SELECT u.nombre, u.apellido, u.email, cat.nombre AS categoria, a.departamento
    FROM autoridad a
    JOIN usuario u    ON u.id  = a.usuario_id
    JOIN categoria cat ON cat.id = a.categoria_id
    WHERE u.email = 'daniel.cruz@urbalert.mx'
  `);
  if (daniel) {
    console.log(`\nDaniel Cruz → categoría actual: "${daniel.categoria}"`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
