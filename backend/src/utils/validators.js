/**
 * validators.js — reglas de validación compartidas entre controladores.
 * Las mismas reglas se replican (manualmente sincronizadas) en web y mobile.
 */

const dns = require('dns').promises;

const PASSWORD_MIN_LENGTH = 8;

// Letras latinas (incluyendo acentos, ñ, ü), espacios. 2-50 caracteres.
const NAME_RE = /^[A-Za-záéíóúÁÉÍÓÚñÑüÜ\s]{2,50}$/;

// Email estándar: algo@algo.algo
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Exactamente 10 dígitos (se limpian espacios, guiones y paréntesis antes de validar)
const PHONE_STRIP_RE = /[\s\-().]/g;
const PHONE_RE       = /^\d{10}$/;

function isValidEmail(email) {
  return EMAIL_RE.test(String(email ?? '').trim());
}

function isValidPhone(phone) {
  const cleaned = String(phone ?? '').replace(PHONE_STRIP_RE, '');
  return PHONE_RE.test(cleaned);
}

function isValidName(name) {
  return NAME_RE.test(String(name ?? '').trim());
}

/**
 * Verifica que el dominio del email tiene al menos un registro MX.
 * Devuelve false si el dominio no existe o no puede recibir correos.
 */
async function isValidEmailDomain(email) {
  try {
    const domain  = String(email ?? '').trim().split('@')[1];
    if (!domain) return false;
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

module.exports = { isValidEmail, isValidPhone, isValidName, isValidEmailDomain, PASSWORD_MIN_LENGTH };
