/**
 * Seed: asigna 8 reportes de prueba a la autoridad Zoe Cruz Toledo
 * (zoe642935@gmail.com). Todos usan la categoría asignada a Zoe (Agua y drenaje).
 * Distribución:
 *   3 asignado · 2 en_proceso · 2 resuelto · 1 cerrado
 *
 * Cada reporte incluye historial_estado y una asignación tipo='inicial'.
 * Es idempotente: elimina los registros de prueba antes de insertar.
 *
 * Uso: node backend/scripts/seed-authority-reports.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { db, connectDB } = require('../src/database/connection');

// ── Resolución de IDs ─────────────────────────────────────────────────────────
async function resolveIds() {
  const zoe = await db.oneOrNone(
    `SELECT u.id AS usuario_id, a.id AS autoridad_id, a.categoria_id
     FROM usuario u
     JOIN autoridad a ON a.usuario_id = u.id
     WHERE u.email = $1`,
    ['zoe642935@gmail.com']
  );
  if (!zoe) throw new Error('No se encontró la autoridad zoe642935@gmail.com en la BD.');

  const ciudadano = await db.oneOrNone(
    `SELECT c.id FROM ciudadano c JOIN usuario u ON u.id = c.usuario_id LIMIT 1`
  );
  if (!ciudadano) throw new Error('No existe ningún ciudadano en la BD.');

  // Subcategoría de la misma categoría de Zoe (Agua y drenaje)
  const sub = await db.one(
    `SELECT id AS sub_id, urgencia
     FROM subcategoria
     WHERE categoria_id = $1
     LIMIT 1`,
    [zoe.categoria_id]
  );

  return {
    autoridad_id: zoe.autoridad_id,
    usuario_id:   zoe.usuario_id,
    ciudadano_id: ciudadano.id,
    cat: {
      cat_id:   zoe.categoria_id,
      sub_id:   sub.sub_id,
      urgencia: sub.urgencia,
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function insertReporte(t, { ciudadano_id, autoridad_id, cat, descripcion, calle, colonia, lat, lng, estado }) {
  return t.one(
    `INSERT INTO reporte
       (ciudadano_id, autoridad_id, categoria_id, subcategoria_id, descripcion,
        urgencia, estado, calle, colonia,
        latitud, longitud, ubicacion, ubicacion_baja_precision)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             ST_SetSRID(ST_MakePoint($11, $10), 4326), false)
     RETURNING id`,
    [
      ciudadano_id, autoridad_id, cat.cat_id, cat.sub_id, descripcion,
      cat.urgencia, estado, calle, colonia, lat, lng,
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

// ── Limpieza idempotente ──────────────────────────────────────────────────────
const DESCRIPCIONES = [
  'Fuga de agua potable en tubería subterránea — calle Miguel Blanco',
  'Drenaje tapado con desbordamiento — av. Juárez Centro',
  'Tubería rota con encharcamiento en banqueta — Prisciliano Sánchez',
  'Fuga de agua en toma domiciliaria frente a Mercado Corona',
  'Alcantarilla sin tapa con agua estancada — Calzada Independencia',
  'Fuga reparada en colector pluvial — calle Independencia',
  'Drenaje destapado y sanitizado — av. 16 de Septiembre',
  'Reporte de fuga duplicado — cerrado administrativamente, calle Morelos',
];

async function limpiarSeedAnterior(t) {
  await t.none(
    `DELETE FROM reporte WHERE descripcion = ANY($1::text[])`,
    [DESCRIPCIONES]
  );
}

// ── Datos de prueba — colonias reales del sector Centro de Guadalajara ────────
const REPORTES = [
  // 3 asignado
  { descripcion: DESCRIPCIONES[0], calle: 'Calle Miguel Blanco',       colonia: 'Centro',    lat: 20.6722, lng: -103.3468, estado: 'asignado'   },
  { descripcion: DESCRIPCIONES[1], calle: 'Av. Juárez',                colonia: 'Centro',    lat: 20.6736, lng: -103.3499, estado: 'asignado'   },
  { descripcion: DESCRIPCIONES[2], calle: 'Calle Prisciliano Sánchez', colonia: 'Centro',    lat: 20.6701, lng: -103.3510, estado: 'asignado'   },
  // 2 en_proceso
  { descripcion: DESCRIPCIONES[3], calle: 'Mercado Corona',            colonia: 'Centro',    lat: 20.6743, lng: -103.3488, estado: 'en_proceso' },
  { descripcion: DESCRIPCIONES[4], calle: 'Calzada Independencia',     colonia: 'La Perla',  lat: 20.6699, lng: -103.3359, estado: 'en_proceso' },
  // 2 resuelto
  { descripcion: DESCRIPCIONES[5], calle: 'Calle Independencia',       colonia: 'Centro',    lat: 20.6758, lng: -103.3502, estado: 'resuelto'   },
  { descripcion: DESCRIPCIONES[6], calle: 'Av. 16 de Septiembre',      colonia: 'Centro',    lat: 20.6715, lng: -103.3481, estado: 'resuelto'   },
  // 1 cerrado
  { descripcion: DESCRIPCIONES[7], calle: 'Calle Morelos',             colonia: 'Centro',    lat: 20.6731, lng: -103.3520, estado: 'cerrado'    },
];

function obs(estado) {
  if (estado === 'asignado')   return 'Reporte asignado a autoridad para atención';
  if (estado === 'en_proceso') return 'Autoridad inició acciones de atención';
  if (estado === 'resuelto')   return 'Problema atendido y verificado por autoridad';
  if (estado === 'cerrado')    return 'Reporte cerrado administrativamente';
  return 'Cambio de estado';
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await connectDB();
    const ids = await resolveIds();
    console.log(`\n  Autoridad Zoe → id=${ids.autoridad_id}, usuario_id=${ids.usuario_id}`);
    console.log(`  Categoría     → id=${ids.cat.cat_id} (urgencia: ${ids.cat.urgencia})\n`);

    await db.tx(async (t) => {
      await limpiarSeedAnterior(t);
      console.log('  Datos anteriores eliminados.\n');

      for (const r of REPORTES) {
        const reporte = await insertReporte(t, {
          ciudadano_id: ids.ciudadano_id,
          autoridad_id: ids.autoridad_id,
          cat:          ids.cat,
          descripcion:  r.descripcion,
          calle:        r.calle,
          colonia:      r.colonia,
          lat:          r.lat,
          lng:          r.lng,
          estado:       r.estado,
        });

        // historial: creado → asignado → (estado final si distinto)
        await insertHistorial(t, {
          reporte_id:      reporte.id,
          usuario_id:      null,
          estado_anterior: 'enviado',
          estado_nuevo:    'enviado',
          observacion:     'Reporte creado por ciudadano',
        });
        await insertHistorial(t, {
          reporte_id:      reporte.id,
          usuario_id:      ids.usuario_id,
          estado_anterior: 'enviado',
          estado_nuevo:    'asignado',
          observacion:     'Reporte asignado a autoridad para atención',
        });
        if (r.estado !== 'asignado') {
          await insertHistorial(t, {
            reporte_id:      reporte.id,
            usuario_id:      ids.usuario_id,
            estado_anterior: 'asignado',
            estado_nuevo:    r.estado,
            observacion:     obs(r.estado),
          });
        }

        await insertAsignacion(t, {
          reporte_id:   reporte.id,
          autoridad_id: ids.autoridad_id,
        });

        console.log(`  ✓ [${r.estado.padEnd(10)}]  id=${reporte.id}  — ${r.descripcion.slice(0, 55)}`);
      }
    });

    console.log('\n✓ Seed completado exitosamente.');
  } catch (err) {
    console.error('\n✗ Error:', err.message || err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
