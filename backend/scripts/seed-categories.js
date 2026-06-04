/**
 * Script de un solo uso: inserta categorías y subcategorías del sistema Urbalert.
 * Uso: node backend/scripts/seed-categories.js
 * Es idempotente: omite lo que ya exista.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { db, connectDB } = require('../src/database/connection');

const DATA = [
  {
    nombre: 'Seguridad pública',
    subcategorias: [
      { nombre: 'Actividad sospechosa',            urgencia: 'alto'  },
      { nombre: 'Robo',                             urgencia: 'alto'  },
      { nombre: 'Vandalismo',                       urgencia: 'medio' },
      { nombre: 'Alumbrado apagado en zona insegura', urgencia: 'alto' },
    ],
  },
  {
    nombre: 'Baches y daños en vialidades',
    subcategorias: [
      { nombre: 'Baches',                  urgencia: 'medio' },
      { nombre: 'Hundimientos',             urgencia: 'alto'  },
      { nombre: 'Señalización dañada',      urgencia: 'medio' },
      { nombre: 'Semáforos descompuestos',  urgencia: 'alto'  },
    ],
  },
  {
    nombre: 'Basura y limpieza urbana',
    subcategorias: [
      { nombre: 'Acumulación de basura',            urgencia: 'medio' },
      { nombre: 'Tiraderos clandestinos',            urgencia: 'medio' },
      { nombre: 'Contenedores llenos',               urgencia: 'bajo'  },
      { nombre: 'Exceso de hierba mala en vía pública', urgencia: 'bajo' },
    ],
  },
  {
    nombre: 'Alumbrado público',
    subcategorias: [
      { nombre: 'Lámpara fundida',   urgencia: 'bajo'  },
      { nombre: 'Poste dañado',      urgencia: 'medio' },
      { nombre: 'Cableado expuesto', urgencia: 'alto'  },
    ],
  },
  {
    nombre: 'Agua y drenaje',
    subcategorias: [
      { nombre: 'Fugas de agua',    urgencia: 'medio' },
      { nombre: 'Drenaje tapado',   urgencia: 'medio' },
      { nombre: 'Inundaciones',     urgencia: 'alto'  },
    ],
  },
  {
    nombre: 'Espacios públicos',
    subcategorias: [
      { nombre: 'Parques descuidados',         urgencia: 'bajo'  },
      { nombre: 'Juegos infantiles dañados',   urgencia: 'medio' },
      { nombre: 'Grafiti excesivo',            urgencia: 'bajo'  },
      { nombre: 'Plagas en espacios públicos', urgencia: 'medio' },
      { nombre: 'Hierba invasiva',             urgencia: 'bajo'  },
    ],
  },
  {
    nombre: 'Transporte y movilidad',
    subcategorias: [
      { nombre: 'Paradas dañadas',              urgencia: 'bajo'  },
      { nombre: 'Señalización vial incorrecta', urgencia: 'medio' },
      { nombre: 'Problemas con ciclovías',      urgencia: 'medio' },
    ],
  },
  {
    nombre: 'Protección civil',
    subcategorias: [
      { nombre: 'Árbol en riesgo de caída', urgencia: 'alto' },
      { nombre: 'Estructura peligrosa',     urgencia: 'alto' },
      { nombre: 'Cableado en riesgo',       urgencia: 'alto' },
    ],
  },
];

(async () => {
  try {
    await connectDB();

    let catsCreadas = 0;
    let subcatsCreadas = 0;
    let omitidas = 0;

    await db.tx(async (t) => {
      for (const cat of DATA) {
        // Buscar o insertar categoría
        let row = await t.oneOrNone(
          'SELECT id FROM categoria WHERE LOWER(nombre) = LOWER($1)',
          cat.nombre
        );

        if (!row) {
          row = await t.one(
            'INSERT INTO categoria (nombre) VALUES ($1) RETURNING id',
            cat.nombre
          );
          catsCreadas++;
          console.log(`  + Categoría: ${cat.nombre}`);
        } else {
          console.log(`  ~ Categoría ya existe: ${cat.nombre}`);
        }

        const categoriaId = row.id;

        for (const sub of cat.subcategorias) {
          const existe = await t.oneOrNone(
            'SELECT id FROM subcategoria WHERE categoria_id = $1 AND LOWER(nombre) = LOWER($2)',
            [categoriaId, sub.nombre]
          );

          if (!existe) {
            await t.none(
              'INSERT INTO subcategoria (categoria_id, nombre, urgencia) VALUES ($1, $2, $3)',
              [categoriaId, sub.nombre, sub.urgencia]
            );
            subcatsCreadas++;
            console.log(`      + Subcategoría: ${sub.nombre} (${sub.urgencia})`);
          } else {
            omitidas++;
          }
        }
      }
    });

    console.log('\n✓ Seed completado');
    console.log(`  Categorías insertadas  : ${catsCreadas}`);
    console.log(`  Subcategorías insertadas: ${subcatsCreadas}`);
    console.log(`  Omitidas (ya existían) : ${omitidas}`);

  } catch (err) {
    console.error('✗ Error:', err.message || err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
