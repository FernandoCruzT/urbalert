#!/usr/bin/env node
/**
 * Crea 7 autoridades con sus usuarios, categorías y sectores asignados.
 * Uso: node backend/scripts/seed-authorities.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const { db }  = require('../src/database/connection');

// ── Sectores canónicos (los que tienen colonia_poligono) ──────────────────────
const SECTOR = {
  Norte:    '8cfab605-4922-4335-b19f-9f6881b813cd',
  Sur:      '495f993d-6fc8-479a-ad2c-011ed060cf65',
  Oriente:  '83f18b40-3570-45f4-b61f-16ff7f3f2467',
  Poniente: 'f2bea390-6e94-4d6c-b503-3f89b92f590c',
  Centro:   '5ad4896d-541b-4759-91de-60fd8afa6b0c',
};

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
    sector:     'Norte',
  },
  {
    nombre:     'Omar',
    apellido:   'Cruz Vega',
    email:      'omar.cruz@urbalert.mx',
    password:   'omarsoporte',
    telefono:   '3312345678',
    categoria:  'Alumbrado público',
    sector:     'Centro',
  },
  {
    nombre:     'Karolina',
    apellido:   'Ramírez Flores',
    email:      'karolina.ramirez@urbalert.mx',
    password:   'Karito18',
    telefono:   '3312345678',
    categoria:  'Basura y limpieza urbana',
    sector:     'Sur',
  },
  {
    nombre:     'Emilio',
    apellido:   'Rico Salinas',
    email:      'emilio.rico@urbalert.mx',
    password:   'querico',
    telefono:   '3312345678',
    categoria:  'Seguridad pública',
    sector:     'Oriente',
  },
  {
    nombre:     'Christopher',
    apellido:   'Morales Ibarra',
    email:      'christopher.morales@urbalert.mx',
    password:   'Elpoc',
    telefono:   '3312345678',
    categoria:  'Agua y drenaje',
    sector:     'Poniente',
  },
  {
    nombre:     'Maura',
    apellido:   'Toledo Serrano',
    email:      'maura.toledo@urbalert.mx',
    password:   'EmeAMaura',
    telefono:   '3312345678',
    // "Parques y espacios públicos" no existe; se usa la más cercana
    categoria:  'Espacios públicos',
    sector:     'Norte',
  },
  {
    nombre:     'Daniel',
    apellido:   'Cruz Aguirre',
    email:      'daniel.cruz@urbalert.mx',
    password:   'CuantaPriv.',
    telefono:   '3312345678',
    // "Infraestructura urbana" no existe; se crea como nueva categoría
    categoria:  'Infraestructura urbana',
    sector:     'Centro',
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
    const sector_id = SECTOR[a.sector];
    if (!sector_id) {
      console.error(`✗ Sector no encontrado: "${a.sector}" — saltando ${a.nombre}`);
      continue;
    }

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
             (usuario_id, categoria_id, sector_id, departamento, activo)
           VALUES ($1, $2, $3, $4, TRUE)
           RETURNING id`,
          [usuario.id, categoria_id, sector_id, a.categoria]
        );

        return { usuario_id: usuario.id, autoridad_id: autoridad.id };
      });

      resultados.push({ nombre: `${a.nombre} ${a.apellido}`, email: a.email, categoria: a.categoria, sector: a.sector, usuario_id, autoridad_id });
      console.log(`✓ ${a.nombre} ${a.apellido}`);
      console.log(`  email:        ${a.email}`);
      console.log(`  password:     ${a.password}`);
      console.log(`  categoría:    ${a.categoria}`);
      console.log(`  sector:       ${a.sector}`);
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
