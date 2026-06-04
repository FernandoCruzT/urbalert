#!/usr/bin/env node
/**
 * Ejecuta un archivo de migración SQL contra la BD urbalert.
 * Uso: node run-migration.js <nombre_sin_extension>
 * Ej:  node run-migration.js 006_asignacion_autoridad_nullable
 */
require('dotenv').config({ path: __dirname + '/.env' });

const pgp  = require('pg-promise')();
const path = require('path');
const fs   = require('fs');

const db = pgp({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'urbalert',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

const arg = process.argv[2];
if (!arg) {
  console.error('Uso: node run-migration.js <nombre_archivo_sin_.sql>');
  process.exit(1);
}

const migrationsDir = path.join(__dirname, 'src', 'database', 'migrations');
// Acepta nombre exacto o prefijo numérico (ej. "006")
let file = path.join(migrationsDir, arg.endsWith('.sql') ? arg : `${arg}.sql`);
if (!fs.existsSync(file)) {
  // Buscar por prefijo
  const match = fs.readdirSync(migrationsDir).find(f => f.startsWith(arg));
  if (!match) {
    console.error(`No se encontró migración: ${arg}`);
    process.exit(1);
  }
  file = path.join(migrationsDir, match);
}

const sql = fs.readFileSync(file, 'utf8');
console.log(`\nEjecutando: ${path.basename(file)}`);
console.log('SQL:\n' + sql.trim() + '\n');

db.none(sql)
  .then(() => {
    console.log('✓ Migración aplicada correctamente.');
    // Verificar que la constraint fue eliminada
    return db.any(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'asignacion'
        AND column_name = 'autoridad_id'
    `);
  })
  .then(rows => {
    if (rows.length) {
      console.log('\nVerificación columna autoridad_id:');
      console.table(rows);
    }
    pgp.end();
  })
  .catch(err => {
    console.error('✗ Error al ejecutar migración:', err.message);
    pgp.end();
    process.exit(1);
  });
