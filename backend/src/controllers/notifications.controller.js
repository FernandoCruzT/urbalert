const { db } = require('../database/connection');

const PAGE_SIZE = 30;

/**
 * GET /api/notifications
 * Lista las notificaciones del usuario autenticado, más recientes primero.
 * Soporta paginación por cursor: ?before=<ISO timestamp> devuelve las
 * notificaciones anteriores a ese momento. Devuelve máximo 30 por página.
 * La respuesta incluye hasMore:true si existen más notificaciones.
 */
async function list(req, res) {
  const { before = null } = req.query;

  const beforeDate = before ? new Date(before) : null;
  if (before && isNaN(beforeDate?.getTime())) {
    return res.status(400).json({ message: 'Parámetro before inválido — debe ser una fecha ISO válida' });
  }

  try {
    const notificaciones = await db.any(
      `SELECT
         n.id,
         n.titulo,
         n.mensaje,
         n.leida,
         n.created_at,
         n.reporte_id,
         r.estado              AS reporte_estado,
         r.descripcion         AS reporte_descripcion,
         cat.nombre            AS categoria_nombre,
         sub.nombre            AS subcategoria_nombre,
         uc.nombre             AS ciudadano_nombre,
         uc.apellido           AS ciudadano_apellido,
         ua.nombre             AS autoridad_nombre,
         ua.apellido           AS autoridad_apellido
       FROM notificacion n
       LEFT JOIN reporte    r   ON r.id   = n.reporte_id
       LEFT JOIN categoria  cat ON cat.id = r.categoria_id
       LEFT JOIN subcategoria sub ON sub.id = r.subcategoria_id
       LEFT JOIN ciudadano  c   ON c.id   = r.ciudadano_id
       LEFT JOIN usuario    uc  ON uc.id  = c.usuario_id
       LEFT JOIN autoridad  a   ON a.id   = r.autoridad_id
       LEFT JOIN usuario    ua  ON ua.id  = a.usuario_id
       WHERE n.usuario_id = $1
         AND ($2::timestamptz IS NULL OR n.created_at < $2)
       ORDER BY n.leida ASC, n.created_at DESC
       LIMIT $3`,
      [req.user.id, beforeDate, PAGE_SIZE + 1]
    );

    const hasMore = notificaciones.length > PAGE_SIZE;
    if (hasMore) notificaciones.pop();

    return res.json({ notificaciones, hasMore });
  } catch (err) {
    console.error('[notifications.list]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Marca una notificación como leída. Solo el dueño puede hacerlo.
 */
async function markRead(req, res) {
  const { id } = req.params;

  try {
    const notif = await db.oneOrNone(
      `SELECT id, usuario_id, leida FROM notificacion WHERE id = $1`,
      id
    );

    if (!notif) return res.status(404).json({ message: 'Notificación no encontrada' });
    if (notif.usuario_id !== req.user.id) {
      return res.status(403).json({ message: 'No tienes permiso para modificar esta notificación' });
    }
    if (notif.leida) {
      return res.json({ message: 'La notificación ya estaba marcada como leída' });
    }

    await db.none(`UPDATE notificacion SET leida = TRUE WHERE id = $1`, id);

    return res.json({ message: 'Notificación marcada como leída' });
  } catch (err) {
    console.error('[notifications.markRead]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/**
 * PATCH /api/notifications/read-all
 * Marca todas las notificaciones no leídas del usuario autenticado como leídas.
 */
async function markAllRead(req, res) {
  try {
    const result = await db.result(
      `UPDATE notificacion SET leida = TRUE
       WHERE usuario_id = $1 AND leida = FALSE`,
      req.user.id
    );
    return res.json({ updated: result.rowCount });
  } catch (err) {
    console.error('[notifications.markAllRead]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

/**
 * GET /api/notifications/unread-count
 * Número de notificaciones no leídas del usuario autenticado.
 */
async function unreadCount(req, res) {
  try {
    const { count } = await db.one(
      `SELECT COUNT(*)::int AS count
       FROM notificacion
       WHERE usuario_id = $1 AND leida = FALSE`,
      req.user.id
    );

    return res.json({ unread: count });
  } catch (err) {
    console.error('[notifications.unreadCount]', err);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}

module.exports = { list, markRead, markAllRead, unreadCount };
