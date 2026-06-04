/**
 * @typedef {'superadmin' | 'authority' | 'citizen'} UserRole
 */

/**
 * @typedef {'pending' | 'in_progress' | 'resolved' | 'rejected'} ReportStatus
 */

/**
 * @typedef {Object} Report
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {ReportStatus} status
 * @property {string} createdAt
 * @property {{ lat: number, lng: number }} location
 * @property {string} citizenId
 */

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} email
 * @property {UserRole} role
 */

module.exports = {};
