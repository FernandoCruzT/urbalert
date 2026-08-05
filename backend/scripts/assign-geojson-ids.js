/**
 * Asigna un id (UUID) único de nivel superior a cada feature de
 * web/public/colonias-zmg.geojson que aún no lo tenga.
 *
 * Este id es el que seed-colonias-postgis.js usa como colonia_poligono.id,
 * dando una correspondencia 1:1 explícita entre polígono del GeoJSON y fila
 * en la base de datos (antes el match era implícito por orden de inserción).
 *
 * Idempotente: no reasigna id a features que ya lo tengan, así que correrlo
 * de nuevo tras editar el GeoJSON no rompe la correspondencia existente.
 *
 * Uso: node backend/scripts/assign-geojson-ids.js
 */
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const GEOJSON_PATH = path.resolve(__dirname, '../../web/public/colonias-zmg.geojson');

const geojson = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));

let asignados = 0;
for (const feature of geojson.features) {
  if (!feature.id) {
    feature.id = crypto.randomUUID();
    asignados++;
  }
}

fs.writeFileSync(GEOJSON_PATH, JSON.stringify(geojson));

console.log(`Features totales      : ${geojson.features.length}`);
console.log(`IDs asignados ahora   : ${asignados}`);
console.log(`IDs ya existentes     : ${geojson.features.length - asignados}`);
