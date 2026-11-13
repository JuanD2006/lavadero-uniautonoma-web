const crypto = require('crypto');

// Contraseñas cifradas con scrypt (viene incluido en Node, no requiere instalar nada).
// Se guarda "salt:hash". Nunca se guarda la contraseña en texto plano.
exports.hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

exports.verificarPassword = (password, guardado) => {
  const [salt, hash] = String(guardado || '').split(':');
  if (!salt || !hash) return false;
  const calculado = crypto.scryptSync(String(password), salt, 64);
  const original = Buffer.from(hash, 'hex');
  return calculado.length === original.length && crypto.timingSafeEqual(calculado, original);
};

// El nombre de usuario es el nombre que escribe la persona: se quitan espacios sobrantes y se ignoran
// mayúsculas ("  Juan   PÉREZ " y "juan pérez" son el mismo usuario).
exports.normalizarUsuario = (texto) => String(texto || '').trim().replace(/\s+/g, ' ').toLowerCase();
