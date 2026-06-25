const { db } = require('../database/connection');
const { getColoniaFromCoords } = require('../services/geocoding.service');
const { createNotification }   = require('../services/notification.service');

// ─── constantes ──────────────────────────────────────────────────────────────

const ESTADOS_ACTIVOS = [
  'enviado', 'en_validacion', 'en_revision',
  'pendiente', 'asignado', 'en_proceso',
];
const RADIO_DUPLICADO_METROS            = 20;
const RADIO_DUPLICADO_PROXIMIDAD_METROS = 20;
const UMBRAL_PRECISION_GPS              = 50;
const JACCARD_MIN_AUTO_CIERRE           = 0.20;

const STOPWORDS_ES = new Set([
  'el','la','los','las','un','una','de','del','en','con',
  'que','es','se','al','por','para','su','lo','le',
]);

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS_ES.has(w));
}

function jaccardSimilitud(a, b) {
  const setA = new Set(normalizarTexto(a));
  const setB = new Set(normalizarTexto(b));
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  const interseccion = [...setA].filter(w => setB.has(w)).length;
  return interseccion / new Set([...setA, ...setB]).size;
}

// ─── helpers internos ────────────────────────────────────────────────────────

/** Inserta un registro en historial_estado. */
async function insertarHistorial(t, { reporte_id, usuario_id = null, rol_usuario, estado_anterior, estado_nuevo, observacion = null }) {
  return t.none(
    `INSERT INTO historial_estado
       (reporte_id, usuario_id, rol_usuario, estado_anterior, estado_nuevo, observacion)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [reporte_id, usuario_id, rol_usuario, estado_anterior, estado_nuevo, observacion]
  );
}

/**
 * Busca un reporte activo en la misma categoría Y subcategoría dentro del radio indicado.
 * Usa PostGIS ST_DWithin con cast a geography para trabajar en metros.
 */
async function buscarDuplicado(t, { latitud, longitud, categoria_id, subcategoria_id, excluir_id = null }) {
  return t.oneOrNone(
    `SELECT
       r.id,
       r.descripcion,
       r.estado,
       r.colonia,
       r.calle,
       r.numero,
       r.created_at,
       r.confirmaciones_duplicado,
       ROUND(
         ST_Distance(
           r.ubicacion::geography,
           ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
         )::numeric, 2
       ) AS distancia_metros,
       c.nombre AS categoria_nombre
     FROM reporte r
     JOIN categoria c ON c.id = r.categoria_id
     WHERE r.categoria_id = $3
       AND r.subcategoria_id = $4
       AND r.estado = ANY($5::text[])
       AND r.ubicacion IS NOT NULL
       AND ($6::uuid IS NULL OR r.id <> $6)
       AND ST_DWithin(
             r.ubicacion::geography,
             ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
             $7
           )
     ORDER BY distancia_metros ASC
     LIMIT 1`,
    [latitud, longitud, categoria_id, subcategoria_id, ESTADOS_ACTIVOS, excluir_id, RADIO_DUPLICADO_METROS]
  );
}

/**
 * Busca un reporte activo en la misma categoría Y subcategoría dentro de 20 m creado en las
 * últimas 24 h. Usado para el cierre automático por proximidad (requiere Jaccard >= 0.20).
 */
async function buscarDuplicadoCercano(t, { latitud, longitud, categoria_id, subcategoria_id }) {
  return t.oneOrNone(
    `SELECT r.id, r.descripcion, r.estado, r.colonia, r.created_at
     FROM reporte r
     WHERE r.categoria_id = $3
       AND r.subcategoria_id = $4
       AND r.estado = ANY($5::text[])
       AND r.ubicacion IS NOT NULL
       AND r.created_at > NOW() - INTERVAL '24 hours'
       AND ST_DWithin(
             r.ubicacion::geography,
             ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
             $6
           )
     ORDER BY ST_Distance(
       r.ubicacion::geography,
       ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
     ) ASC
     LIMIT 1`,
    [latitud, longitud, categoria_id, subcategoria_id, ESTADOS_ACTIVOS, RADIO_DUPLICADO_PROXIMIDAD_METROS]
  );
}

// ─── create ──────────────────────────────────────────────────────────────────

/**
 * POST /api/reports
 * Solo ciudadanos. Detecta duplicados antes de crear.
 * Si omitir_duplicado = true en el body, salta la verificación.
 */
async function create(req, res) {
  const {
    categoria_id,
    subcategoria_id,
    descripcion,
    latitud,
    longitud,
    calle,
    numero,
    colonia,
    precision_gps,
    omitir_duplicado = false,
  } = req.body;

  // Validación básica
  const faltantes = ['categoria_id', 'subcategoria_id', 'descripcion', 'latitud', 'longitud']
    .filter((k) => !req.body[k]);
  if (faltantes.length) {
    return res.status(400).json({ message: `Faltan campos obligatorios: ${faltantes.join(', ')}` });
  }

  const ciudadano_id = req.user.profileId;
  const baja_precision = precision_gps != null && Number(precision_gps) > UMBRAL_PRECISION_GPS;

  // Geocodificación inversa: obtener colonia y sector desde coordenadas
  const geoColonia = await getColoniaFromCoords(latitud, longitud);

  try {
    const resultado = await db.tx(async (t) => {
      // 1. Obtener urgencia de la subcategoría
      const subcategoria = await t.oneOrNone(
        `SELECT id, urgencia, categoria_id FROM subcategoria WHERE id = $1`,
        subcategoria_id
      );
      if (!subcategoria) {
        throw { status: 404, message: 'Subcategoría no encontrada' };
      }
      if (subcategoria.categoria_id !== categoria_id) {
        throw { status: 400, message: 'La subcategoría no pertenece a la categoría indicada' };
      }

      // Geocodificación: colonia final para todos los caminos
      const coloniaFinal = geoColonia?.nombre             ?? colonia ?? null;
      const coloniaPgId  = geoColonia?.colonia_poligono_id            ?? null;

      // 2. Verificar duplicado por proximidad (20 m + 24 h + Jaccard ≥ 0.20) → cierre automático
      if (latitud != null && longitud != null) {
        const duplicadoCercano = await buscarDuplicadoCercano(t, { latitud, longitud, categoria_id, subcategoria_id });
        const jaccard = duplicadoCercano
          ? jaccardSimilitud(descripcion, duplicadoCercano.descripcion)
          : 0;
        if (duplicadoCercano && jaccard >= JACCARD_MIN_AUTO_CIERRE) {
          const reporteCerrado = await t.one(
            `INSERT INTO reporte
               (ciudadano_id, categoria_id, subcategoria_id, descripcion,
                urgencia, estado, calle, numero, colonia,
                latitud, longitud, precision_gps, ubicacion_baja_precision,
                colonia_poligono_id, reporte_padre_id)
             VALUES
               ($1, $2, $3, $4,
                $5, 'cerrado', $6, $7, $8,
                $9, $10, $11, $12,
                $13, $14)
             RETURNING *`,
            [
              ciudadano_id, categoria_id, subcategoria_id, descripcion,
              subcategoria.urgencia, calle || null, numero || null, coloniaFinal,
              latitud, longitud, precision_gps ?? null, baja_precision,
              coloniaPgId, duplicadoCercano.id,
            ]
          );

          await insertarHistorial(t, {
            reporte_id:      reporteCerrado.id,
            usuario_id:      null,
            rol_usuario:     'sistema',
            estado_anterior: 'enviado',
            estado_nuevo:    'cerrado',
            observacion:     `Reporte cerrado automáticamente: ya existe un reporte similar cercano (ID: ${duplicadoCercano.id})`,
          });

          await createNotification(
            req.user.id,
            reporteCerrado.id,
            'Reporte no procesado',
            'Ya existe un reporte similar en tu zona registrado en las últimas 24 horas. Tu reporte fue vinculado al original para reforzar su atención.',
            t
          );

          return { reporte: reporteCerrado, duplicado_id: duplicadoCercano.id };
        }
      }

      // 3. Verificar duplicado interactivo (20 m, sin filtro de tiempo)
      if (!omitir_duplicado && latitud != null && longitud != null) {
        const duplicado = await buscarDuplicado(t, { latitud, longitud, categoria_id, subcategoria_id });
        if (duplicado) {
          throw { status: 409, duplicado };
        }
      }

      // 4. Crear el reporte en estado 'enviado'
      const nuevo = await t.one(
        `INSERT INTO reporte
           (ciudadano_id, categoria_id, subcategoria_id, descripcion,
            urgencia, estado, calle, numero, colonia,
            latitud, longitud, precision_gps, ubicacion_baja_precision,
            colonia_poligono_id)
         VALUES
           ($1, $2, $3, $4,
            $5, 'enviado', $6, $7, $8,
            $9, $10, $11, $12,
            $13)
         RETURNING *`,
        [
          ciudadano_id, categoria_id, subcategoria_id, descripcion,
          subcategoria.urgencia, calle || null, numero || null, coloniaFinal,
          latitud, longitud, precision_gps ?? null, baja_precision,
          coloniaPgId,
        ]
      );

      // 5. Primer registro en historial (rol sistema, estado inicial)
      await insertarHistorial(t, {
        reporte_id:      nuevo.id,
        usuario_id:      null,
        rol_usuario:     'sistema',
        estado_anterior: 'enviado',
        estado_nuevo:    'enviado',
        observacion:     'Reporte creado por ciudadano',
      });

      return { reporte: nuevo, duplicado_id: null };
    });

    if (resultado.duplicado_id) {
      return res.status(201).json({
        reporte:   resultado.reporte,
        message:   'Ya existe un reporte similar en tu zona. Tu reporte fue vinculado al original.',
        duplicado_id: resultado.duplicado_id,
      });
    }
    return res.status(201).json({ reporte: resultado.reporte });
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({
        message: 'Posible reporte duplicado detectado',
        duplicado: err.duplicado,
      });
    }
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('[reports.create]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── mine ────────────────────────────────────────────────────────────────────

/**
 * GET /api/reports/mine
 * Lista los reportes del ciudadano autenticado, más recientes primero.
 */
async function mine(req, res) {
  try {
    const reportes = await db.any(
      `SELECT
         r.id,
         r.descripcion,
         r.urgencia,
         r.estado,
         r.calle,
         r.numero,
         r.colonia,
         r.ubicacion_baja_precision,
         r.confirmaciones_duplicado,
         r.created_at,
         r.updated_at,
         cat.nombre  AS categoria_nombre,
         sub.nombre  AS subcategoria_nombre
       FROM reporte r
       JOIN categoria   cat ON cat.id = r.categoria_id
       JOIN subcategoria sub ON sub.id = r.subcategoria_id
       WHERE r.ciudadano_id = $1
       ORDER BY r.created_at DESC`,
      req.user.profileId
    );

    return res.json({ reportes });
  } catch (err) {
    console.error('[reports.mine]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── getById ─────────────────────────────────────────────────────────────────

/**
 * GET /api/reports/:id
 * Ciudadano: solo sus propios reportes.
 * Autoridad y superadmin: cualquier reporte.
 * Incluye historial, fotos y datos de la autoridad asignada.
 */
async function getById(req, res) {
  const { id } = req.params;
  const { role, profileId } = req.user;

  try {
    const result = await db.task(async (t) => {
      // Reporte principal
      const reporte = await t.oneOrNone(
        `SELECT
           r.*,
           cat.nombre          AS categoria_nombre,
           sub.nombre          AS subcategoria_nombre,
           sub.razon_urgencia
         FROM reporte r
         JOIN categoria    cat ON cat.id = r.categoria_id
         JOIN subcategoria sub ON sub.id = r.subcategoria_id
         WHERE r.id = $1`,
        id
      );

      if (!reporte) throw { status: 404, message: 'Reporte no encontrado' };

      // Control de acceso por rol
      if (role === 'ciudadano' && reporte.ciudadano_id !== profileId) {
        throw { status: 403, message: 'No tienes permiso para ver este reporte' };
      }

      // Fotos
      const fotos = await t.any(
        `SELECT id, url_cloudinary, orden, created_at
         FROM foto_reporte
         WHERE reporte_id = $1
         ORDER BY orden ASC`,
        id
      );

      // Historial de estados
      const historial = await t.any(
        `SELECT
           h.id,
           h.rol_usuario,
           h.estado_anterior,
           h.estado_nuevo,
           h.observacion,
           h.created_at,
           u.nombre   AS usuario_nombre,
           u.apellido AS usuario_apellido
         FROM historial_estado h
         LEFT JOIN usuario u ON u.id = h.usuario_id
         WHERE h.reporte_id = $1
         ORDER BY h.created_at ASC`,
        id
      );

      // Ciudadano que creó el reporte
      const ciudadano = await t.oneOrNone(
        `SELECT u.nombre, u.apellido, u.email, u.telefono, c.estado_cuenta
         FROM ciudadano c
         JOIN usuario u ON u.id = c.usuario_id
         WHERE c.id = $1`,
        reporte.ciudadano_id
      );

      // Autoridad asignada (si existe)
      let autoridad = null;
      if (reporte.autoridad_id) {
        autoridad = await t.oneOrNone(
          `SELECT
             a.id,
             a.departamento,
             a.municipio,
             a.carga_ponderada,
             u.nombre        AS nombre,
             u.apellido      AS apellido,
             u.email         AS email
           FROM autoridad a
           JOIN usuario u ON u.id = a.usuario_id
           WHERE a.id = $1`,
          reporte.autoridad_id
        );
      }

      return { ...reporte, fotos, historial, ciudadano, autoridad };
    });

    return res.json({ reporte: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('[reports.getById]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── confirmDuplicate ────────────────────────────────────────────────────────

/**
 * PATCH /api/reports/:id/confirm-duplicate
 * El ciudadano confirma que su reporte duplica a otro.
 * Body: { reporte_padre_id }
 * - Valida que el reporte pertenece al ciudadano
 * - Enlaza reporte_padre_id
 * - Incrementa confirmaciones_duplicado en el reporte padre
 */
async function confirmDuplicate(req, res) {
  const { id } = req.params;
  const { reporte_padre_id } = req.body;

  if (!reporte_padre_id) {
    return res.status(400).json({ message: 'Falta reporte_padre_id' });
  }
  if (id === reporte_padre_id) {
    return res.status(400).json({ message: 'Un reporte no puede ser duplicado de sí mismo' });
  }

  try {
    await db.tx(async (t) => {
      // Verificar que el reporte pertenece al ciudadano autenticado
      const reporte = await t.oneOrNone(
        `SELECT id, ciudadano_id, reporte_padre_id FROM reporte WHERE id = $1`,
        id
      );
      if (!reporte) throw { status: 404, message: 'Reporte no encontrado' };
      if (reporte.ciudadano_id !== req.user.profileId) {
        throw { status: 403, message: 'No tienes permiso para modificar este reporte' };
      }
      if (reporte.reporte_padre_id) {
        throw { status: 409, message: 'Este reporte ya está vinculado a un duplicado' };
      }

      // Verificar que el reporte padre existe y está activo
      const padre = await t.oneOrNone(
        `SELECT id FROM reporte WHERE id = $1 AND estado = ANY($2::text[])`,
        [reporte_padre_id, ESTADOS_ACTIVOS]
      );
      if (!padre) {
        throw { status: 404, message: 'El reporte padre no existe o ya no está activo' };
      }

      // Vincular y actualizar el contador en una sola operación por reporte
      await t.none(
        `UPDATE reporte SET reporte_padre_id = $1 WHERE id = $2`,
        [reporte_padre_id, id]
      );
      await t.none(
        `UPDATE reporte SET confirmaciones_duplicado = confirmaciones_duplicado + 1 WHERE id = $1`,
        reporte_padre_id
      );
    });

    return res.json({ message: 'Reporte vinculado como duplicado correctamente' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    console.error('[reports.confirmDuplicate]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── getChildReports ─────────────────────────────────────────────────────────

/**
 * GET /api/reports/:id/children
 * Devuelve los reportes que confirmaron al reporte padre (reporte_padre_id = id).
 */
async function getChildReports(req, res) {
  const { id } = req.params;
  try {
    const reportes = await db.any(
      `SELECT
         r.id, r.descripcion, r.estado, r.created_at,
         cat.nombre AS categoria_nombre,
         sub.nombre AS subcategoria_nombre
       FROM reporte r
       JOIN categoria    cat ON cat.id = r.categoria_id
       JOIN subcategoria sub ON sub.id = r.subcategoria_id
       WHERE r.reporte_padre_id = $1
       ORDER BY r.created_at DESC`,
      id
    );
    return res.json({ reportes });
  } catch (err) {
    console.error('[reports.getChildReports]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── authorityReports ─────────────────────────────────────────────────────────

/**
 * GET /api/reports/authority-reports?estado=activo|historico
 * Lista reportes de la autoridad autenticada.
 * activo    → asignado, en_proceso
 * historico → resuelto, cerrado
 */
async function authorityReports(req, res) {
  const { estado = 'activo' } = req.query;
  const esHistorico = estado === 'historico';

  try {
    let reportes;

    if (!esHistorico) {
      // activo: reportes asignados/en_proceso que le pertenecen actualmente
      reportes = await db.any(
        `SELECT
           r.id,
           r.autoridad_id,
           r.descripcion,
           r.urgencia,
           r.estado,
           r.colonia,
           r.created_at,
           r.updated_at,
           cat.nombre  AS categoria_nombre,
           sub.nombre  AS subcategoria_nombre
         FROM reporte r
         JOIN categoria    cat ON cat.id = r.categoria_id
         JOIN subcategoria sub ON sub.id = r.subcategoria_id
         WHERE r.autoridad_id = $1
           AND r.estado = ANY(ARRAY['asignado','en_proceso'])
         ORDER BY r.updated_at DESC`,
        [req.user.profileId]
      );
    } else {
      // historico: resueltos/cerrados propios + escalados/reasignados a otra autoridad
      reportes = await db.any(
        `SELECT
           r.id,
           r.autoridad_id,
           r.descripcion,
           r.urgencia,
           r.estado,
           r.colonia,
           r.created_at,
           r.updated_at,
           cat.nombre  AS categoria_nombre,
           sub.nombre  AS subcategoria_nombre
         FROM reporte r
         JOIN categoria    cat ON cat.id = r.categoria_id
         JOIN subcategoria sub ON sub.id = r.subcategoria_id
         WHERE r.estado = ANY(ARRAY['resuelto','cerrado','en_revision','pendiente','asignado','en_proceso'])
           AND (
             -- Resueltos/cerrados que le pertenecen actualmente
             (r.autoridad_id = $1 AND r.estado = ANY(ARRAY['resuelto','cerrado']))
             OR
             -- Alguna vez suyos pero escalados o reasignados a otra autoridad
             (EXISTS (SELECT 1 FROM asignacion a WHERE a.reporte_id = r.id AND a.autoridad_id = $1)
              AND (r.autoridad_id IS DISTINCT FROM $1))
           )
         ORDER BY r.updated_at DESC`,
        [req.user.profileId]
      );
    }

    return res.json({ reportes });
  } catch (err) {
    console.error('[reports.authorityReports]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── byColonia ───────────────────────────────────────────────────────────────

/**
 * GET /api/reports/by-colonia
 * Lista reportes de una colonia aplicando filtros opcionales.
 * Query params:
 *   colonia      (string, requerido)
 *   municipio    (string, opcional) — distingue colonias homónimas entre municipios
 *   estado       abiertos | cerrados | todos  (default: abiertos)
 *   categoria_id (uuid, opcional)
 *   mine         true | false — si true, filtra por autoridad autenticada
 *
 * La tabla reporte no tiene columna municipio, por eso se hace LEFT JOIN a
 * colonia_poligono (que sí la tiene). Reportes sin colonia_poligono_id solo
 * pueden filtrar por nombre de colonia, no por municipio.
 */
async function byColonia(req, res) {
  const { colonia, municipio, estado = 'abiertos', categoria_id, mine } = req.query;

  if (!colonia) return res.status(400).json({ message: 'Falta parámetro colonia' });

  const ESTADOS_ABIERTOS = ['enviado','en_validacion','en_revision','pendiente','asignado','en_proceso'];
  const ESTADOS_CERRADOS = ['resuelto','cerrado'];

  try {
    const params = [colonia];
    let idx = 2;

    // Filtro de colonia: con o sin municipio, usando colonia_poligono cuando existe
    let coloniaWhere;
    if (municipio) {
      // Reportes con polígono: nombre Y municipio del polígono deben coincidir
      // Reportes sin polígono: solo nombre (no podemos discriminar por municipio)
      coloniaWhere = `(
        (r.colonia_poligono_id IS NOT NULL
         AND LOWER(cp.nombre)     = LOWER($1)
         AND LOWER(cp.municipio)  = LOWER($${idx}))
        OR
        (r.colonia_poligono_id IS NULL
         AND LOWER(r.colonia) = LOWER($1))
      )`;
      params.push(municipio); idx++;
    } else {
      coloniaWhere = `(
        (r.colonia_poligono_id IS NOT NULL AND LOWER(cp.nombre) = LOWER($1))
        OR
        (r.colonia_poligono_id IS NULL     AND LOWER(r.colonia) = LOWER($1))
      )`;
    }

    const conditions = [coloniaWhere];

    if (estado === 'abiertos') {
      conditions.push(`r.estado = ANY($${idx}::text[])`);
      params.push(ESTADOS_ABIERTOS); idx++;
    } else if (estado === 'cerrados') {
      conditions.push(`r.estado = ANY($${idx}::text[])`);
      params.push(ESTADOS_CERRADOS); idx++;
    }

    if (categoria_id) {
      conditions.push(`r.categoria_id = $${idx}::uuid`);
      params.push(categoria_id); idx++;
    }

    if (mine === 'true') {
      conditions.push(`r.autoridad_id = $${idx}::uuid`);
      params.push(req.user.profileId); idx++;
    }

    const reportes = await db.any(
      `SELECT
         r.id,
         r.descripcion,
         r.urgencia,
         r.estado,
         r.created_at,
         r.updated_at,
         cat.nombre AS categoria_nombre,
         sub.nombre AS subcategoria_nombre
       FROM reporte r
       JOIN categoria    cat ON cat.id = r.categoria_id
       JOIN subcategoria sub ON sub.id = r.subcategoria_id
       LEFT JOIN colonia_poligono cp ON cp.id = r.colonia_poligono_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.created_at DESC`,
      params
    );

    return res.json({ reportes });
  } catch (err) {
    console.error('[reports.byColonia]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

module.exports = { create, mine, getById, confirmDuplicate, authorityReports, getChildReports, byColonia };
