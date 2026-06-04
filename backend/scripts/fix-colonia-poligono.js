#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { db } = require('../src/database/connection');

async function main() {
  // 1. Estado actual
  console.log('═══════════════════════════════════════════════════════');
  console.log('1. ESTADO ACTUAL DE REPORTES REALES');
  console.log('═══════════════════════════════════════════════════════');
  const antes = await db.any(`
    SELECT r.id, r.colonia, r.latitud, r.longitud,
           cp.nombre AS poligono_nombre, cp.municipio, r.estado
    FROM reporte r
    LEFT JOIN colonia_poligono cp ON cp.id = r.colonia_poligono_id
    WHERE r.descripcion NOT LIKE '%seed%'
    ORDER BY r.created_at DESC
  `);
  console.table(antes.map(r => ({
    id:             r.id,
    colonia_texto:  r.colonia,
    poligono_nombre:r.poligono_nombre ?? '(sin polígono)',
    municipio:      r.municipio ?? '—',
    lat:            r.latitud  != null ? Number(r.latitud).toFixed(5)  : 'NULL',
    lng:            r.longitud != null ? Number(r.longitud).toFixed(5) : 'NULL',
    estado:         r.estado,
    inconsistente:  r.poligono_nombre && r.colonia !== r.poligono_nombre ? '⚠️ SÍ' : 'OK',
  })));

  const sinPoligono   = antes.filter(r => !r.poligono_nombre && r.latitud != null);
  const inconsistente = antes.filter(r => r.poligono_nombre && r.colonia !== r.poligono_nombre);
  console.log(`\nSin colonia_poligono_id pero con GPS: ${sinPoligono.length}`);
  console.log(`Inconsistentes (texto ≠ polígono):    ${inconsistente.length}\n`);

  // 2. Asignar colonia_poligono_id donde falte (ST_Contains)
  console.log('═══════════════════════════════════════════════════════');
  console.log('2. UPDATE colonia_poligono_id via ST_Contains');
  console.log('═══════════════════════════════════════════════════════');
  const r2 = await db.result(`
    UPDATE reporte r
    SET colonia_poligono_id = cp.id
    FROM colonia_poligono cp
    WHERE r.colonia_poligono_id IS NULL
      AND r.latitud  IS NOT NULL
      AND ST_Contains(cp.geom, ST_SetSRID(ST_MakePoint(r.longitud, r.latitud), 4326))
  `);
  console.log(`Filas actualizadas: ${r2.rowCount}\n`);

  // 3. Sincronizar campo colonia (texto) con nombre del polígono
  console.log('═══════════════════════════════════════════════════════');
  console.log('3. UPDATE colonia (texto) para que coincida con polígono');
  console.log('═══════════════════════════════════════════════════════');
  const r3 = await db.result(`
    UPDATE reporte r
    SET colonia = cp.nombre
    FROM colonia_poligono cp
    WHERE cp.id = r.colonia_poligono_id
      AND r.colonia IS DISTINCT FROM cp.nombre
  `);
  console.log(`Filas actualizadas: ${r3.rowCount}\n`);

  // 4. Estado final
  console.log('═══════════════════════════════════════════════════════');
  console.log('4. ESTADO FINAL');
  console.log('═══════════════════════════════════════════════════════');
  const despues = await db.any(`
    SELECT r.id, r.colonia, r.latitud, r.longitud,
           cp.nombre AS poligono_nombre, cp.municipio, r.estado
    FROM reporte r
    LEFT JOIN colonia_poligono cp ON cp.id = r.colonia_poligono_id
    WHERE r.descripcion NOT LIKE '%seed%'
    ORDER BY r.created_at DESC
  `);
  console.table(despues.map(r => ({
    id:             r.id,
    colonia_texto:  r.colonia,
    poligono_nombre:r.poligono_nombre ?? '(sin polígono)',
    municipio:      r.municipio ?? '—',
    lat:            r.latitud  != null ? Number(r.latitud).toFixed(5)  : 'NULL',
    lng:            r.longitud != null ? Number(r.longitud).toFixed(5) : 'NULL',
    estado:         r.estado,
    ok:             r.poligono_nombre
                      ? (r.colonia === r.poligono_nombre ? '✓' : '⚠️')
                      : (r.latitud != null ? '⚠️ sin polígono' : '—'),
  })));

  const sinPoligonoFinal = despues.filter(r => !r.poligono_nombre && r.latitud != null);
  console.log(`\nReportes sin polígono pero con GPS (no cubiertos por geom): ${sinPoligonoFinal.length}`);
  if (sinPoligonoFinal.length > 0) {
    sinPoligonoFinal.forEach(r =>
      console.log(`  ⚠️  ${r.id} | lat ${r.latitud} lng ${r.longitud} | colonia: "${r.colonia}"`)
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error('Error:', e.message); process.exit(1); });
