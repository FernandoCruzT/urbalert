/**
 * Formats a date string to a localized Spanish date.
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Maps a ReportStatus to a human-readable Spanish label.
 * @param {string} status
 * @returns {string}
 */
function statusLabel(status) {
  const labels = {
    pending: 'Pendiente',
    in_progress: 'En proceso',
    resolved: 'Resuelto',
    rejected: 'Rechazado',
  };
  return labels[status] ?? status;
}

module.exports = { formatDate, statusLabel };
