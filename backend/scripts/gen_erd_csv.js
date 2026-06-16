/**
 * gen_erd_csv.js
 * Genera erd_export.csv en formato Lucidchart ERD a partir del schema public de urbalert.
 * Uso: node backend/scripts/gen_erd_csv.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, 'erd_export.csv');
const DB  = process.env.DB_NAME || 'urbalert';

async function main() {
  const client = new Client({
    host:     process.env.DB_HOST,
    port:     Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await client.connect();

  // ── 1. Tablas del schema public ────────────────────────────────────────────
  const { rows: tables } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('spatial_ref_sys')  -- tabla de sistema PostGIS
    ORDER BY table_name
  `);

  // ── 2. Primary keys ────────────────────────────────────────────────────────
  const { rows: pkRows } = await client.query(`
    SELECT kcu.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema    = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema = 'public'
  `);
  const pkSet = new Set(pkRows.map(r => `${r.table_name}.${r.column_name}`));

  // ── 3. Unique constraints ──────────────────────────────────────────────────
  const { rows: uqRows } = await client.query(`
    SELECT kcu.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema    = kcu.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
      AND tc.table_schema = 'public'
  `);
  const uqSet = new Set(uqRows.map(r => `${r.table_name}.${r.column_name}`));

  // ── 4. Foreign keys ────────────────────────────────────────────────────────
  const { rows: fkRows } = await client.query(`
    SELECT
      kcu.table_name    AS src_table,
      kcu.column_name   AS src_col,
      ccu.table_name    AS ref_table,
      ccu.column_name   AS ref_col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema    = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.table_schema    = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY src_table, src_col
  `);
  // Map: "table.column" -> [{ ref_table, ref_col }]  (puede haber >1 FK por col en edge cases)
  const fkMap = new Map();
  for (const r of fkRows) {
    const key = `${r.src_table}.${r.src_col}`;
    if (!fkMap.has(key)) fkMap.set(key, []);
    fkMap.get(key).push({ ref_table: r.ref_table, ref_col: r.ref_col });
  }

  // ── 5. Columnas de cada tabla ──────────────────────────────────────────────
  const csvLines = [
    'custom,db_name,table_name,column_name,position,data_type,max_length,constraint,db_referenced,table_referenced,column_referenced'
  ];

  for (const { table_name } of tables) {
    const { rows: cols } = await client.query(`
      SELECT
        column_name,
        ordinal_position,
        data_type,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table_name]);

    for (const col of cols) {
      const key    = `${table_name}.${col.column_name}`;
      const isPK   = pkSet.has(key);
      const isUQ   = uqSet.has(key);
      const fkList = fkMap.get(key) ?? [];
      const isFk   = fkList.length > 0;
      const maxLen = col.character_maximum_length != null
                     ? String(col.character_maximum_length)
                     : 'N';

      // Si es FK (con o sin PK): emitir una fila FK por cada referencia
      if (isFk) {
        for (const { ref_table, ref_col } of fkList) {
          csvLines.push(
            `custom,${DB},${table_name},${col.column_name},${col.ordinal_position},${col.data_type},${maxLen},FOREIGN KEY,${DB},${ref_table},${ref_col}`
          );
        }
      }

      // Si es PK (siempre emitir fila PK para que aparezca el indicador en el ERD)
      if (isPK) {
        csvLines.push(
          `custom,${DB},${table_name},${col.column_name},${col.ordinal_position},${col.data_type},${maxLen},PRIMARY KEY,N,N,N`
        );
      }

      // Si no es FK ni PK: emitir fila normal (UNIQUE o ninguno)
      if (!isFk && !isPK) {
        const constraint = isUQ ? 'UNIQUE' : 'N';
        csvLines.push(
          `custom,${DB},${table_name},${col.column_name},${col.ordinal_position},${col.data_type},${maxLen},${constraint},N,N,N`
        );
      }
    }
  }

  // ── 6. Escribir archivo ────────────────────────────────────────────────────
  fs.writeFileSync(OUT, csvLines.join('\n'), 'utf8');

  console.log(`\n✓ Archivo generado: ${OUT}`);
  console.log(`  Total de filas (sin header): ${csvLines.length - 1}\n`);
  console.log('── Primeras 21 líneas ─────────────────────────────────────────');
  csvLines.slice(0, 21).forEach(l => console.log(l));

  await client.end();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
