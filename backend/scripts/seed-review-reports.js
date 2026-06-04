/**
 * Seed: inserta 4 reportes en estado 'en_revision', uno por cada tipo de
 * revisión que maneja el superadmin. Todos provienen del flujo de validación
 * antes de llegar a una autoridad (sin autoridad_id asignada).
 *
 * Es idempotente: borra los registros de prueba anteriores antes de insertar.
 *
 * Uso: node backend/scripts/seed-review-reports.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { db, connectDB } = require('../src/database/connection');

// ── Resolución dinámica de IDs ────────────────────────────────────────────────
async function resolveIds() {
  const ciudadano = await db.oneOrNone(
    `SELECT c.id FROM ciudadano c JOIN usuario u ON u.id = c.usuario_id LIMIT 1`
  );
  if (!ciudadano) throw new Error('No existe ningún ciudadano en la BD.');

  const catBaches    = await db.oneOrNone(`SELECT c.id AS cat_id, s.id AS sub_id, s.urgencia FROM categoria c JOIN subcategoria s ON s.categoria_id = c.id WHERE c.nombre ILIKE '%baches%' LIMIT 1`);
  const catBasura    = await db.oneOrNone(`SELECT c.id AS cat_id, s.id AS sub_id, s.urgencia FROM categoria c JOIN subcategoria s ON s.categoria_id = c.id WHERE c.nombre ILIKE '%basura%' LIMIT 1`);
  const catSeguridad = await db.oneOrNone(`SELECT c.id AS cat_id, s.id AS sub_id, s.urgencia FROM categoria c JOIN subcategoria s ON s.categoria_id = c.id WHERE c.nombre ILIKE '%seguridad%' LIMIT 1`);
  const catAlumbrado = await db.oneOrNone(`SELECT c.id AS cat_id, s.id AS sub_id, s.urgencia FROM categoria c JOIN subcategoria s ON s.categoria_id = c.id WHERE c.nombre ILIKE '%alumbrado%' LIMIT 1`);
  const anycat       = await db.one(`SELECT c.id AS cat_id, s.id AS sub_id, s.urgencia FROM categoria c JOIN subcategoria s ON s.categoria_id = c.id LIMIT 1`);

  const autoridad = await db.oneOrNone(`SELECT a.id AS autoridad_id FROM autoridad a LIMIT 1`);
  if (!autoridad) throw new Error('No existe ninguna autoridad en la BD.');

  return {
    ciudadano_id: ciudadano.id,
    catBaches:    catBaches    || anycat,
    catBasura:    catBasura    || anycat,
    catSeguridad: catSeguridad || anycat,
    catAlumbrado: catAlumbrado || anycat,
    autoridad_id: autoridad.autoridad_id,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Inserta un reporte sin autoridad_id — vienen del flujo de validación. */
async function insertReporte(t, { ciudadano_id, cat, descripcion, calle, colonia, lat, lng, estado = 'en_revision', baja_precision = false, reporte_padre_id = null }) {
  return t.one(
    `INSERT INTO reporte
       (ciudadano_id, categoria_id, subcategoria_id, descripcion,
        urgencia, estado, calle, colonia,
        latitud, longitud, ubicacion,
        ubicacion_baja_precision, reporte_padre_id)
     VALUES
       ($1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, ST_SetSRID(ST_MakePoint($10, $9), 4326),
        $11, $12)
     RETURNING id`,
    [
      ciudadano_id, cat.cat_id, cat.sub_id, descripcion,
      cat.urgencia, estado, calle, colonia,
      lat, lng,
      baja_precision, reporte_padre_id,
    ]
  );
}

async function insertarHistorial(t, { reporte_id, usuario_id = null, rol_usuario, estado_anterior, estado_nuevo, observacion = null }) {
  return t.none(
    `INSERT INTO historial_estado (reporte_id, usuario_id, rol_usuario, estado_anterior, estado_nuevo, observacion)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [reporte_id, usuario_id, rol_usuario, estado_anterior, estado_nuevo, observacion]
  );
}

// ── Limpieza de datos anteriores ──────────────────────────────────────────────
async function limpiarSeedAnterior(t) {
  const descripciones = [
    'Bache profundo en la calzada — reporte original activo',
    'Bache enorme lleno de agua en colonia Jardines — escalado para revisión',
    'Tiradero clandestino reportado con GPS poco preciso',
    'Posible actividad de pandillas — reporte sin evidencia clara',
    'Bache en Av. Vallarta — posiblemente el mismo que ya fue reportado',
  ];
  await t.none(
    `DELETE FROM reporte WHERE descripcion = ANY($1::text[])`,
    [descripciones]
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await connectDB();
    const ids = await resolveIds();

    const resultado = await db.tx(async (t) => {
      await limpiarSeedAnterior(t);
      console.log('  Datos de seed anteriores eliminados.');

      // ── 0. Reporte "padre" activo (referencia para el caso repetido) ────────
      // Este SÍ puede tener autoridad_id porque ya está en proceso normal.
      const padre = await t.one(
        `INSERT INTO reporte
           (ciudadano_id, categoria_id, subcategoria_id, descripcion,
            urgencia, estado, calle, colonia,
            latitud, longitud, ubicacion,
            ubicacion_baja_precision, autoridad_id)
         VALUES ($1, $2, $3, $4, $5, 'en_proceso', $6, $7, $8, $9,
                 ST_SetSRID(ST_MakePoint($9, $8), 4326), false, $10)
         RETURNING id`,
        [
          ids.ciudadano_id, ids.catBaches.cat_id, ids.catBaches.sub_id,
          'Bache profundo en la calzada — reporte original activo',
          ids.catBaches.urgencia,
          'Av. Vallarta', 'Americana',
          20.6729, -103.3815,
          ids.autoridad_id,
        ]
      );
      await insertarHistorial(t, {
        reporte_id:      padre.id,
        rol_usuario:     'sistema',
        estado_anterior: 'enviado',
        estado_nuevo:    'enviado',
        observacion:     'Reporte creado por ciudadano',
      });
      await insertarHistorial(t, {
        reporte_id:      padre.id,
        rol_usuario:     'sistema',
        estado_anterior: 'enviado',
        estado_nuevo:    'en_proceso',
        observacion:     'Reporte asignado y en atención por autoridad',
      });

      // ── 1. ESCALADO ─────────────────────────────────────────────────────────
      // Reporte en_revision cuyo sistema automático lo marcó para revisión
      // superior por alta urgencia. Sin autoridad_id (no llegó a asignarse).
      const escalado = await insertReporte(t, {
        ciudadano_id: ids.ciudadano_id,
        cat:          ids.catBaches,
        descripcion:  'Bache enorme lleno de agua en colonia Jardines — escalado para revisión',
        calle:        'Calle Mezquite',
        colonia:      'Jardines del Sol',
        lat:          20.6841, lng: -103.3982,
      });
      await insertarHistorial(t, {
        reporte_id:      escalado.id,
        rol_usuario:     'sistema',
        estado_anterior: 'enviado',
        estado_nuevo:    'enviado',
        observacion:     'Reporte creado por ciudadano',
      });
      await insertarHistorial(t, {
        reporte_id:      escalado.id,
        rol_usuario:     'sistema',
        estado_anterior: 'enviado',
        estado_nuevo:    'en_revision',
        observacion:     'Escalado automáticamente por el sistema: magnitud del daño supera criterios normales',
      });
      await t.none(
        `INSERT INTO asignacion (reporte_id, autoridad_id, tipo, motivo, asignado_por)
         VALUES ($1, $2, 'escalado', $3, NULL)`,
        [
          escalado.id,
          ids.autoridad_id,
          'La magnitud del bache supera la capacidad de respuesta normal. Se requiere intervención de infraestructura vial mayor.',
        ]
      );
      console.log(`✓ ESCALADO       → ${escalado.id}`);

      // ── 2. MALA UBICACIÓN ───────────────────────────────────────────────────
      // Reporte en_revision porque la precisión GPS superó los 50 m.
      // Sin autoridad_id (el sistema lo detectó antes de asignarlo).
      const malaUbicacion = await insertReporte(t, {
        ciudadano_id:   ids.ciudadano_id,
        cat:            ids.catBasura,
        descripcion:    'Tiradero clandestino reportado con GPS poco preciso',
        calle:          'Av. Patria',
        colonia:        'Lomas del Valle',
        lat:            20.7103, lng: -103.4201,
        baja_precision: true,
      });
      await insertarHistorial(t, {
        reporte_id:      malaUbicacion.id,
        rol_usuario:     'sistema',
        estado_anterior: 'enviado',
        estado_nuevo:    'enviado',
        observacion:     'Reporte creado por ciudadano',
      });
      await insertarHistorial(t, {
        reporte_id:      malaUbicacion.id,
        rol_usuario:     'sistema',
        estado_anterior: 'enviado',
        estado_nuevo:    'en_revision',
        observacion:     'Enviado a revisión automáticamente: precisión GPS superior a 50 m — se requiere validar ubicación',
      });
      console.log(`✓ MALA UBICACIÓN → ${malaUbicacion.id}`);

      // ── 3. FALSO ─────────────────────────────────────────────────────────────
      // Reporte en_revision porque el sistema detectó inconsistencias.
      // Sin autoridad_id (nunca llegó a asignarse).
      const falso = await insertReporte(t, {
        ciudadano_id: ids.ciudadano_id,
        cat:          ids.catSeguridad,
        descripcion:  'Posible actividad de pandillas — reporte sin evidencia clara',
        calle:        'Calle López Cotilla',
        colonia:      'Arcos Vallarta',
        lat:          20.6682, lng: -103.4021,
      });
      await insertarHistorial(t, {
        reporte_id:      falso.id,
        rol_usuario:     'sistema',
        estado_anterior: 'enviado',
        estado_nuevo:    'enviado',
        observacion:     'Reporte creado por ciudadano',
      });
      await insertarHistorial(t, {
        reporte_id:      falso.id,
        rol_usuario:     'sistema',
        estado_anterior: 'enviado',
        estado_nuevo:    'en_revision',
        observacion:     'Enviado a revisión: descripción genérica sin detalles verificables — posible reporte falso',
      });
      console.log(`✓ FALSO          → ${falso.id}`);

      // ── 4. REPETIDO ──────────────────────────────────────────────────────────
      // Reporte en_revision porque PostGIS detectó un reporte activo cercano
      // de la misma categoría. Sin autoridad_id.
      const repetido = await insertReporte(t, {
        ciudadano_id:     ids.ciudadano_id,
        cat:              ids.catBaches,
        descripcion:      'Bache en Av. Vallarta — posiblemente el mismo que ya fue reportado',
        calle:            'Av. Vallarta',
        colonia:          'Americana',
        lat:              20.6731, lng: -103.3817,
        reporte_padre_id: padre.id,
      });
      await insertarHistorial(t, {
        reporte_id:      repetido.id,
        rol_usuario:     'sistema',
        estado_anterior: 'enviado',
        estado_nuevo:    'enviado',
        observacion:     'Reporte creado por ciudadano',
      });
      await insertarHistorial(t, {
        reporte_id:      repetido.id,
        rol_usuario:     'sistema',
        estado_anterior: 'enviado',
        estado_nuevo:    'en_revision',
        observacion:     `Enviado a revisión: posible duplicado del reporte ${padre.id} (mismo tipo, a menos de 20 m)`,
      });
      console.log(`✓ REPETIDO       → ${repetido.id}`);
      console.log(`  (padre)        → ${padre.id}`);

      return { padre, escalado, malaUbicacion, falso, repetido };
    });

    console.log('\n✓ Seed completado — IDs finales:');
    console.log(`  Padre (en_proceso):  ${resultado.padre.id}`);
    console.log(`  Escalado:            ${resultado.escalado.id}`);
    console.log(`  Mala ubicación:      ${resultado.malaUbicacion.id}`);
    console.log(`  Falso:               ${resultado.falso.id}`);
    console.log(`  Repetido:            ${resultado.repetido.id}`);

  } catch (err) {
    console.error('\n✗ Error:', err.message || err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
