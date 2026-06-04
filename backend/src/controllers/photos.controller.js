const { db }          = require('../database/connection');
const { uploadBuffer } = require('../services/cloudinary');

const MAX_FOTOS = 2;

// ─── uploadPhotos ─────────────────────────────────────────────────────────────

/**
 * POST /api/reports/:id/photos
 * Solo el ciudadano dueño del reporte puede subir fotos.
 * - Entre 1 y 2 fotos por llamada.
 * - Si el reporte ya tiene 2 fotos → 400.
 * - Después de subir, si el estado es 'enviado' → transiciona a 'en_validacion'.
 */
async function uploadPhotos(req, res) {
  const { id } = req.params;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: 'Se requiere al menos una foto' });
  }

  try {
    const fotos = await db.tx(async (t) => {
      // 1. Verificar que el reporte existe y pertenece al ciudadano
      const reporte = await t.oneOrNone(
        `SELECT id, ciudadano_id, estado FROM reporte WHERE id = $1`,
        id
      );
      if (!reporte) throw { status: 404, message: 'Reporte no encontrado' };
      if (reporte.ciudadano_id !== req.user.profileId) {
        throw { status: 403, message: 'No tienes permiso para modificar este reporte' };
      }

      // 2. Contar fotos existentes
      const { count } = await t.one(
        `SELECT COUNT(*)::int AS count FROM foto_reporte WHERE reporte_id = $1`,
        id
      );
      if (count >= MAX_FOTOS) {
        throw { status: 400, message: `El reporte ya tiene el máximo de ${MAX_FOTOS} fotos` };
      }
      const slots = MAX_FOTOS - count;
      if (req.files.length > slots) {
        throw {
          status: 400,
          message: `El reporte tiene ${count} foto(s); solo puedes subir ${slots} más`,
        };
      }

      // 3. Subir cada archivo a Cloudinary
      const uploads = await Promise.all(
        req.files.map((file, i) => {
          const publicId = `reporte_${id}_${count + i + 1}_${Date.now()}`;
          return uploadBuffer(file.buffer, publicId);
        })
      );

      // 4. Insertar registros en foto_reporte
      const nuevasFotos = await Promise.all(
        uploads.map((result, i) =>
          t.one(
            `INSERT INTO foto_reporte (reporte_id, url_cloudinary, orden)
             VALUES ($1, $2, $3)
             RETURNING id, url_cloudinary, orden, created_at`,
            [id, result.secure_url, count + i + 1]
          )
        )
      );

      // 5. Transición de estado si corresponde
      if (reporte.estado === 'enviado') {
        await t.none(
          `UPDATE reporte SET estado = 'en_validacion' WHERE id = $1`,
          id
        );
        await t.none(
          `INSERT INTO historial_estado
             (reporte_id, usuario_id, rol_usuario, estado_anterior, estado_nuevo, observacion)
           VALUES ($1, NULL, 'sistema', 'enviado', 'en_validacion', 'Fotos adjuntadas, reporte enviado a validación')`,
          id
        );
      }

      return nuevasFotos;
    });

    return res.status(201).json({ fotos });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    // Error de tipo de archivo lanzado por multer
    if (err.message?.includes('JPG') || err.message?.includes('PNG')) {
      return res.status(400).json({ message: err.message });
    }
    // Error de tamaño lanzado por multer
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Cada foto debe pesar menos de 5 MB' });
    }
    console.error('[photos.uploadPhotos]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// ─── getPhotos ────────────────────────────────────────────────────────────────

/**
 * GET /api/reports/:id/photos
 * Ciudadano: solo fotos de sus propios reportes.
 * Autoridad y superadmin: cualquier reporte.
 */
async function getPhotos(req, res) {
  const { id } = req.params;

  try {
    const reporte = await db.oneOrNone(
      `SELECT id, ciudadano_id FROM reporte WHERE id = $1`,
      id
    );
    if (!reporte) return res.status(404).json({ message: 'Reporte no encontrado' });

    if (req.user.role === 'ciudadano' && reporte.ciudadano_id !== req.user.profileId) {
      return res.status(403).json({ message: 'No tienes permiso para ver este reporte' });
    }

    const fotos = await db.any(
      `SELECT id, url_cloudinary, orden, created_at
       FROM foto_reporte
       WHERE reporte_id = $1
       ORDER BY orden ASC`,
      id
    );

    return res.json({ fotos });
  } catch (err) {
    console.error('[photos.getPhotos]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

module.exports = { uploadPhotos, getPhotos };
