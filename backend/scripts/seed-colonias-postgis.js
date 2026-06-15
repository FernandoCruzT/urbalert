/**
 * Seed: inserta las colonias del GeoJSON oficial (IIEG 2024) en colonia_poligono.
 * - Asigna sector según posición del centroide (calculado por PostGIS)
 * - Es idempotente: trunca y re-inserta en cada ejecución
 *
 * Uso: node backend/scripts/seed-colonias-postgis.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const fs   = require('fs');
const path = require('path');
const { db, connectDB } = require('../src/database/connection');

const GEOJSON_PATH = path.resolve(__dirname, '../../web/public/colonias-zmg.geojson');

// Reglas de asignación de sector por centroide (vialidades reales ZMG)
// Se evalúan en orden; la primera que coincide gana.
const SECTOR_RULES = [
  // Centro: entre Calzada Independencia (E) y Av. Federalismo (O), a la altura de Av. Washington
  { nombre: 'Centro',   test: (lat, lng) => lng >= -103.3565 && lng <= -103.3364 && lat >= 20.660 && lat <= 20.690 },
  // Norte: por encima de Calzada Circunvalación División del Norte
  { nombre: 'Norte',    test: (lat, lng) => lat > 20.712 },
  // Sur: por debajo de Av. Washington, hacia Miravalle y Tlaquepaque
  { nombre: 'Sur',      test: (lat, lng) => lat < 20.6678 },
  // Oriente: al oriente de Calzada Independencia
  { nombre: 'Oriente',  test: (lat, lng) => lng > -103.3364 },
  // Poniente: al poniente de Av. Federalismo / Américas
  { nombre: 'Poniente', test: (lat, lng) => lng < -103.3565 },
  // Fallback: cualquier remanente cae en Centro
  { nombre: 'Centro',   test: () => true },
];

/** Calcula el centroide aproximado de un polígono o multipolígono GeoJSON. */
function centroide(geometry) {
  let coords = [];
  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0];                      // exterior ring
  } else if (geometry.type === 'MultiPolygon') {
    coords = geometry.coordinates[0][0];                   // primer anillo del primer polígono
  }
  if (!coords.length) return null;
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return { lat, lng };
}

/** Convierte geometría GeoJSON (Polygon o MultiPolygon) en WKT MultiPolygon. */
function toMultiPolygonWKT(geometry) {
  function ringToWKT(ring) {
    return '(' + ring.map(([x, y]) => `${x} ${y}`).join(',') + ')';
  }
  function polygonToWKT(rings) {
    return '(' + rings.map(ringToWKT).join(',') + ')';
  }
  if (geometry.type === 'Polygon') {
    return `MULTIPOLYGON(${polygonToWKT(geometry.coordinates)})`;
  }
  if (geometry.type === 'MultiPolygon') {
    return 'MULTIPOLYGON(' + geometry.coordinates.map(polygonToWKT).join(',') + ')';
  }
  return null;
}

(async () => {
  try {
    await connectDB();

    // Cargar GeoJSON
    const geojson = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
    const features = geojson.features.filter(f => f.geometry);
    console.log(`GeoJSON cargado: ${features.length} features`);

    // Cargar UUIDs de sectores
    const sectores = await db.any('SELECT id, nombre FROM sector');
    const sectorMap = {};
    sectores.forEach(s => { sectorMap[s.nombre] = s.id; });

    const sectorNames = Object.keys(sectorMap);
    console.log('Sectores disponibles:', sectorNames.join(', '));

    const faltantes = ['Norte','Sur','Oriente','Poniente','Centro'].filter(n => !sectorMap[n]);
    if (faltantes.length) {
      throw new Error(`Sectores faltantes en BD: ${faltantes.join(', ')}. Ejecuta la migración 003 primero.`);
    }

    // Limpiar tabla para re-inserción limpia.
    // DELETE (no TRUNCATE CASCADE) para respetar ON DELETE SET NULL en reporte.
    await db.none('DELETE FROM colonia_poligono');
    console.log('Tabla colonia_poligono vaciada.');

    const conteo = { Norte: 0, Sur: 0, Oriente: 0, Poniente: 0, Centro: 0, errores: 0 };

    // Insertar en lotes de 100
    const BATCH = 100;
    let insertadas = 0;

    for (let i = 0; i < features.length; i += BATCH) {
      const batch = features.slice(i, i + BATCH);
      await db.tx(async (t) => {
        for (const feat of batch) {
          const { nombre, municipio, cp } = feat.properties;
          const wkt = toMultiPolygonWKT(feat.geometry);
          if (!wkt) { conteo.errores++; continue; }

          const centro = centroide(feat.geometry);
          if (!centro) { conteo.errores++; continue; }

          const rule = SECTOR_RULES.find(r => r.test(centro.lat, centro.lng));
          const sector_id = sectorMap[rule.nombre];
          conteo[rule.nombre]++;

          await t.none(
            `INSERT INTO colonia_poligono (nombre, municipio, cp, sector_id, geom)
             VALUES ($1, $2, $3, $4, ST_GeomFromText($5, 4326))`,
            [nombre, municipio || null, cp || null, sector_id, wkt]
          );
          insertadas++;
        }
      });

      process.stdout.write(`\r  Insertadas: ${insertadas}/${features.length}`);
    }

    console.log('\n');
    console.log('✓ Seed completado');
    console.log(`  Total insertadas : ${insertadas}`);
    console.log(`  Errores omitidos : ${conteo.errores}`);
    console.log('\n  Distribución por sector:');
    ['Norte','Sur','Oriente','Poniente','Centro'].forEach(s => {
      console.log(`    ${s.padEnd(10)}: ${conteo[s]}`);
    });

    // Verificar con ST_Centroid de PostGIS (muestra primeras 5)
    console.log('\n  Muestra (centroide PostGIS):');
    const sample = await db.any(
      `SELECT nombre, municipio,
         ROUND(ST_Y(ST_Centroid(geom))::numeric, 4) AS lat,
         ROUND(ST_X(ST_Centroid(geom))::numeric, 4) AS lng,
         (SELECT nombre FROM sector WHERE id = sector_id) AS sector
       FROM colonia_poligono
       LIMIT 5`
    );
    sample.forEach(r => console.log(`    ${r.nombre} (${r.municipio}) → ${r.sector} [${r.lat}, ${r.lng}]`));

  } catch (err) {
    console.error('\n✗ Error:', err.message || err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
