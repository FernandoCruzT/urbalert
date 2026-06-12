/**
 * Seed: crea 12 reportes distribuidos en abril–junio 2026 con fechas realistas,
 * distintas autoridades y colonia_poligono_id vinculado a la tabla colonia_poligono.
 *
 * Distribución:
 *   3 abril   → cerrado
 *   4 mayo    → cerrado
 *   3 junio   → en_proceso / asignado
 *   2 junio   → en_revision (sin autoridad)
 *
 * Es idempotente: elimina registros de seeds anteriores por descripción antes de insertar.
 *
 * Uso: node backend/scripts/seed-authority-reports.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { db, connectDB } = require('../src/database/connection');

// ── Descripciones únicas (clave de idempotencia) ──────────────────────────────
const DESCRIPCIONES_NUEVAS = [
  // abril
  'Bache profundo frente a farmacia — Av. Américas, Americana',
  'Fuga de agua en toma domiciliaria — Calle Las Rosas, Jardines del Sol',
  'Contenedor de basura desbordado — Blvd. Puerta de Hierro, Lomas del Valle',
  // mayo
  'Lámpara fundida en crucero peatonal — Av. Niños Héroes, Arcos Vallarta',
  'Actividad sospechosa frente a bodega abandonada — Av. Providencia',
  'Juegos infantiles dañados en parque central — Calle Marsella, Americana',
  'Grafiti excesivo en barda de escuela — Av. 16 de Septiembre, Centro',
  // junio activos
  'Bache con hundimiento en carril rápido — Av. Circunvalación, Atlas',
  'Drenaje tapado con riesgo de inundación — Calzada Independencia, La Perla',
  'Inundación por obstrucción de colector pluvial — Calle Alcalde, Centro',
  // junio en_revision
  'Semáforo descompuesto en cruce escolar — Calzada Gobernador, Oblatos',
  'Hierba invasiva obstruye banqueta — Blvd. Puerta de Hierro 500, Lomas del Valle',
];

// Descripciones del seed anterior (para limpiarlas también)
const DESCRIPCIONES_VIEJAS = [
  'Fuga de agua potable en tubería subterránea — calle Miguel Blanco',
  'Drenaje tapado con desbordamiento — av. Juárez Centro',
  'Tubería rota con encharcamiento en banqueta — Prisciliano Sánchez',
  'Fuga de agua en toma domiciliaria frente a Mercado Corona',
  'Alcantarilla sin tapa con agua estancada — Calzada Independencia',
  'Fuga reparada en colector pluvial — calle Independencia',
  'Drenaje destapado y sanitizado — av. 16 de Septiembre',
  'Reporte de fuga duplicado — cerrado administrativamente, calle Morelos',
];

// ── Definición de reportes ────────────────────────────────────────────────────
// [email_autoridad|null, colonia_nombre, calle, estado, created_at_iso, lat, lng]
const REPORTES_DEF = [
  // Abril – cerrado
  ['fernanda.toledo@urbalert.mx',     'Americana',        'Av. Américas',              'cerrado',    '2026-04-05T10:23:00-06:00', 20.6729, -103.3768],
  ['christopher.morales@urbalert.mx', 'Jardines del Sol', 'Calle Las Rosas',           'cerrado',    '2026-04-12T09:15:00-06:00', 20.6811, -103.4152],
  ['karolina.ramirez@urbalert.mx',    'Lomas del Valle',  'Blvd. Puerta de Hierro',    'cerrado',    '2026-04-22T14:40:00-06:00', 20.7131, -103.4352],
  // Mayo – cerrado
  ['omar.cruz@urbalert.mx',           'Arcos Vallarta',   'Av. Niños Héroes',          'cerrado',    '2026-05-03T08:50:00-06:00', 20.6661, -103.3922],
  ['emilio.rico@urbalert.mx',         'Providencia',      'Av. Providencia',           'cerrado',    '2026-05-10T16:20:00-06:00', 20.6900, -103.3750],
  ['maura.toledo@urbalert.mx',        'Americana',        'Calle Marsella',            'cerrado',    '2026-05-18T11:05:00-06:00', 20.6744, -103.3790],
  ['daniel.cruz@urbalert.mx',         'Centro',           'Av. 16 de Septiembre',      'cerrado',    '2026-05-28T07:30:00-06:00', 20.6714, -103.3481],
  // Junio activos – en_proceso / asignado
  ['fernanda.toledo@urbalert.mx',     'Atlas',            'Av. Circunvalación',        'en_proceso', '2026-06-02T09:45:00-06:00', 20.6586, -103.2971],
  ['zoe642935@gmail.com',             'La Perla',         'Calzada Independencia',     'asignado',   '2026-06-05T15:10:00-06:00', 20.6699, -103.3359],
  ['christopher.morales@urbalert.mx', 'Centro',           'Calle Alcalde',             'en_proceso', '2026-06-08T12:00:00-06:00', 20.6745, -103.3502],
  // Junio – en_revision sin autoridad
  [null,                              'Oblatos',          'Calzada Gobernador',        'en_revision','2026-06-10T08:30:00-06:00', 20.6699, -103.3189],
  [null,                              'Lomas del Valle',  'Blvd. Puerta de Hierro 500','en_revision','2026-06-11T11:20:00-06:00', 20.7135, -103.4352],
];

// ── Resolución de IDs desde la BD ─────────────────────────────────────────────
async function resolveData() {
  const coloniaNames = [...new Set(REPORTES_DEF.map(r => r[1]))];
  const coloniaRows = await db.any(
    `SELECT DISTINCT ON (lower(nombre)) id, nombre
     FROM colonia_poligono
     WHERE lower(nombre) = ANY($1::text[])
     ORDER BY lower(nombre), id`,
    [coloniaNames.map(n => n.toLowerCase())]
  );
  const coloniaMap = {};
  for (const row of coloniaRows) coloniaMap[row.nombre.toLowerCase()] = row.id;

  const emails = [...new Set(REPORTES_DEF.map(r => r[0]).filter(Boolean))];
  const autRows = await db.any(
    `SELECT u.email, u.id AS usuario_id, a.id AS autoridad_id, a.categoria_id,
            (SELECT id       FROM subcategoria WHERE categoria_id = a.categoria_id ORDER BY nombre LIMIT 1) AS sub_id,
            (SELECT urgencia FROM subcategoria WHERE categoria_id = a.categoria_id ORDER BY nombre LIMIT 1) AS urgencia
     FROM usuario u
     JOIN autoridad a ON a.usuario_id = u.id
     WHERE u.email = ANY($1::text[]) AND a.activo = true`,
    [emails]
  );
  const autMap = {};
  for (const row of autRows) autMap[row.email] = row;

  // Categoría fallback para reportes sin autoridad (en_revision)
  const fallbackCat = await db.one(
    `SELECT c.id AS cat_id,
            (SELECT id       FROM subcategoria WHERE categoria_id = c.id LIMIT 1) AS sub_id,
            (SELECT urgencia FROM subcategoria WHERE categoria_id = c.id LIMIT 1) AS urgencia
     FROM categoria c LIMIT 1`
  );

  const { id: ciudadano_id } = await db.one(`SELECT c.id FROM ciudadano c LIMIT 1`);

  return { coloniaMap, autMap, ciudadano_id, fallbackCat };
}

// ── Helpers de inserción ──────────────────────────────────────────────────────
async function insertReporte(t, f) {
  return t.one(
    `INSERT INTO reporte
       (ciudadano_id, autoridad_id, categoria_id, subcategoria_id, descripcion,
        urgencia, estado, calle, colonia, colonia_poligono_id,
        latitud, longitud, ubicacion, ubicacion_baja_precision, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, ST_SetSRID(ST_MakePoint($12, $11), 4326), false, $13, $13)
     RETURNING id`,
    [
      f.ciudadano_id, f.autoridad_id, f.cat_id, f.sub_id,
      f.descripcion, f.urgencia, f.estado, f.calle, f.colonia,
      f.colonia_poligono_id, f.lat, f.lng, f.created_at,
    ]
  );
}

async function insertHistorial(t, { reporte_id, usuario_id, estado_anterior, estado_nuevo, observacion }) {
  return t.none(
    `INSERT INTO historial_estado (reporte_id, usuario_id, rol_usuario, estado_anterior, estado_nuevo, observacion)
     VALUES ($1, $2, 'sistema', $3, $4, $5)`,
    [reporte_id, usuario_id || null, estado_anterior, estado_nuevo, observacion]
  );
}

async function insertAsignacion(t, { reporte_id, autoridad_id }) {
  return t.none(
    `INSERT INTO asignacion (reporte_id, autoridad_id, tipo, motivo, asignado_por)
     VALUES ($1, $2, 'inicial', 'Asignación inicial por sistema de distribución', NULL)`,
    [reporte_id, autoridad_id]
  );
}

async function limpiarSeedsAnteriores(t) {
  const todas = [...DESCRIPCIONES_NUEVAS, ...DESCRIPCIONES_VIEJAS];
  const result = await t.result(`DELETE FROM reporte WHERE descripcion = ANY($1::text[])`, [todas]);
  return result.rowCount;
}

function obsEstado(estado) {
  const m = {
    asignado:    'Reporte asignado a autoridad para atención',
    en_proceso:  'Autoridad inició acciones de atención',
    resuelto:    'Problema atendido y verificado por autoridad',
    cerrado:     'Reporte cerrado administrativamente',
    en_revision: 'Reporte en revisión pendiente de asignación',
  };
  return m[estado] || 'Cambio de estado';
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await connectDB();
    const { coloniaMap, autMap, ciudadano_id, fallbackCat } = await resolveData();

    console.log(`\n  Ciudadano base  → ${ciudadano_id}`);
    console.log(`  Colonias resueltas (${Object.keys(coloniaMap).length}): ${Object.keys(coloniaMap).join(', ')}`);
    console.log(`  Autoridades resueltas (${Object.keys(autMap).length}): ${Object.keys(autMap).map(e => e.split('@')[0]).join(', ')}\n`);

    await db.tx(async (t) => {
      await limpiarSeedsAnteriores(t);
      console.log('  Registros de seeds anteriores eliminados.\n');

      for (let i = 0; i < REPORTES_DEF.length; i++) {
        const [email, coloniaNombre, calle, estado, created_at, lat, lng] = REPORTES_DEF[i];
        const descripcion = DESCRIPCIONES_NUEVAS[i];

        const aut = email ? autMap[email] : null;
        if (email && !aut) {
          console.warn(`  ⚠ Autoridad no encontrada o inactiva: ${email} — usando sin asignar`);
        }

        const cat = aut
          ? { cat_id: aut.categoria_id, sub_id: aut.sub_id, urgencia: aut.urgencia }
          : fallbackCat;

        const colonia_poligono_id = coloniaMap[coloniaNombre.toLowerCase()] || null;
        if (!colonia_poligono_id) {
          console.warn(`  ⚠ Colonia no encontrada en colonia_poligono: "${coloniaNombre}"`);
        }

        const reporte = await insertReporte(t, {
          ciudadano_id,
          autoridad_id:       aut ? aut.autoridad_id : null,
          cat_id:             cat.cat_id,
          sub_id:             cat.sub_id,
          urgencia:           cat.urgencia,
          descripcion,
          estado,
          calle,
          colonia:            coloniaNombre,
          colonia_poligono_id,
          lat,
          lng,
          created_at,
        });

        await insertHistorial(t, {
          reporte_id: reporte.id, usuario_id: null,
          estado_anterior: 'enviado', estado_nuevo: 'enviado',
          observacion: 'Reporte creado por ciudadano',
        });

        if (aut) {
          await insertHistorial(t, {
            reporte_id: reporte.id, usuario_id: aut.usuario_id,
            estado_anterior: 'enviado', estado_nuevo: 'asignado',
            observacion: 'Reporte asignado a autoridad',
          });
          if (estado !== 'asignado') {
            await insertHistorial(t, {
              reporte_id: reporte.id, usuario_id: aut.usuario_id,
              estado_anterior: 'asignado', estado_nuevo: estado,
              observacion: obsEstado(estado),
            });
          }
          await insertAsignacion(t, { reporte_id: reporte.id, autoridad_id: aut.autoridad_id });
        } else {
          await insertHistorial(t, {
            reporte_id: reporte.id, usuario_id: null,
            estado_anterior: 'enviado', estado_nuevo: 'en_revision',
            observacion: obsEstado('en_revision'),
          });
        }

        const cpShort = colonia_poligono_id ? colonia_poligono_id.slice(0, 8) + '…' : 'null    ';
        const aut_label = aut ? aut.email.split('@')[0].padEnd(18) : '(sin autoridad)   ';
        console.log(`  ✓ [${estado.padEnd(11)}] ${created_at.slice(0, 10)}  ${coloniaNombre.padEnd(16)} cp=${cpShort}  ${aut_label} — ${descripcion.slice(0, 45)}`);
      }
    });

    console.log('\n✓ Seed completado. 12 reportes insertados con fechas y colonias reales.');
  } catch (err) {
    console.error('\n✗ Error:', err.message || err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
