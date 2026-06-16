#!/usr/bin/env node
/**
 * Crea 7 autoridades con sus usuarios, categorías y municipios asignados.
 * Uso: node backend/scripts/seed-authorities.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { db }  = require('../src/database/connection');

// ── Definición de las 7 autoridades ──────────────────────────────────────────
//   password: la clave que usarán para iniciar sesión
const AUTORIDADES = [
  {
    nombre:     'Fernanda',
    apellido:   'Ríos Mendoza',
    email:      'fernanda.toledo@urbalert.mx',
    password:   'fertoledo16',
    telefono:   '3312345678',
    categoria:  'Baches y daños en vialidades',
    municipio:  'Zapopan',
  },
  {
    nombre:     'Omar',
    apellido:   'Cruz Vega',
    email:      'omar.cruz@urbalert.mx',
    password:   'omarsoporte',
    telefono:   '3312345678',
    categoria:  'Alumbrado público',
    municipio:  'Guadalajara',
  },
  {
    nombre:     'Karolina',
    apellido:   'Ramírez Flores',
    email:      'karolina.ramirez@urbalert.mx',
    password:   'Karito18',
    telefono:   '3312345678',
    categoria:  'Basura y limpieza urbana',
    municipio:  'San Pedro Tlaquepaque',
  },
  {
    nombre:     'Emilio',
    apellido:   'Rico Salinas',
    email:      'emilio.rico@urbalert.mx',
    password:   'querico',
    telefono:   '3312345678',
    categoria:  'Seguridad pública',
    municipio:  'Tonalá',
  },
  {
    nombre:     'Christopher',
    apellido:   'Morales Ibarra',
    email:      'christopher.morales@urbalert.mx',
    password:   'Elpoc',
    telefono:   '3312345678',
    categoria:  'Agua y drenaje',
    municipio:  'Zapopan',
  },
  {
    nombre:     'Maura',
    apellido:   'Toledo Serrano',
    email:      'maura.toledo@urbalert.mx',
    password:   'EmeAMaura',
    telefono:   '3312345678',
    // "Parques y espacios públicos" no existe; se usa la más cercana
    categoria:  'Espacios públicos',
    municipio:  'Zapopan',
  },
  {
    nombre:     'Daniel',
    apellido:   'Cruz Aguirre',
    email:      'daniel.cruz@urbalert.mx',
    password:   'CuantaPriv.',
    telefono:   '3312345678',
    // "Infraestructura urbana" no existe; se crea como nueva categoría
    categoria:  'Infraestructura urbana',
    municipio:  'Guadalajara',
  },
];

async function main() {
  console.log('Iniciando seed de autoridades…\n');

  // 1. Cargar categorías existentes
  const categorias = await db.any('SELECT id, nombre FROM categoria');
  const catMap = Object.fromEntries(categorias.map(c => [c.nombre, c.id]));

  // 2. Crear categoría "Infraestructura urbana" si no existe
  if (!catMap['Infraestructura urbana']) {
    const nueva = await db.one(
      `INSERT INTO categoria (nombre) VALUES ('Infraestructura urbana') RETURNING id, nombre`
    );
    catMap[nueva.nombre] = nueva.id;
    console.log(`Categoría creada: ${nueva.nombre} (${nueva.id})\n`);
  }

  const resultados = [];

  for (const a of AUTORIDADES) {
    const categoria_id = catMap[a.categoria];
    if (!categoria_id) {
      console.error(`✗ Categoría no encontrada: "${a.categoria}" — saltando ${a.nombre}`);
      continue;
    }
    const municipio = a.municipio;

    try {
      const { usuario_id, autoridad_id } = await db.tx(async t => {
        const password_hash = await bcrypt.hash(a.password, 12);

        const usuario = await t.one(
          `INSERT INTO usuario
             (nombre, apellido, email, telefono, password_hash, rol, requiere_cambio_password)
           VALUES ($1, $2, $3, $4, $5, 'autoridad', FALSE)
           RETURNING id`,
          [a.nombre, a.apellido, a.email, a.telefono, password_hash]
        );

        const autoridad = await t.one(
          `INSERT INTO autoridad
             (usuario_id, categoria_id, municipio, departamento, activo)
           VALUES ($1, $2, $3, $4, TRUE)
           RETURNING id`,
          [usuario.id, categoria_id, municipio, a.categoria]
        );

        return { usuario_id: usuario.id, autoridad_id: autoridad.id };
      });

      resultados.push({ nombre: `${a.nombre} ${a.apellido}`, email: a.email, categoria: a.categoria, municipio, usuario_id, autoridad_id });
      console.log(`✓ ${a.nombre} ${a.apellido}`);
      console.log(`  email:        ${a.email}`);
      console.log(`  password:     ${a.password}`);
      console.log(`  categoría:    ${a.categoria}`);
      console.log(`  municipio:    ${municipio}`);
      console.log(`  usuario_id:   ${usuario_id}`);
      console.log(`  autoridad_id: ${autoridad_id}\n`);

    } catch (err) {
      if (err.code === '23505') {
        console.error(`✗ ${a.nombre}: email ya registrado (${a.email})\n`);
      } else {
        console.error(`✗ ${a.nombre}: ${err.message}\n`);
      }
    }
  }

  console.log(`\nResumen: ${resultados.length}/${AUTORIDADES.length} autoridades creadas.`);

  // Verificación final
  const total = await db.one('SELECT COUNT(*) FROM autoridad WHERE activo = TRUE');
  console.log(`Total autoridades activas en BD: ${total.count}`);
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error(e.message); process.exit(1); });
