const { hashPassword } = require('../utils/password');
const Usuario = require('../models/Usuario');

// Crea los usuarios iniciales si la colección está vacía.
// Las contraseñas se toman del .env (o usan un valor por defecto SOLO para desarrollo).
module.exports = async function crearUsuariosIniciales() {
  if (await Usuario.estimatedDocumentCount() > 0) return;

  const usuarios = [
    { usuario: 'admin', nombre: 'Administrador', rol: 'admin', pass: process.env.ADMIN_PASSWORD || 'admin123' },
    { usuario: 'lector', nombre: 'Consulta (solo lectura)', rol: 'lector', pass: process.env.LECTOR_PASSWORD || 'lector123' }
  ];
  for (const u of usuarios) {
    await Usuario.create({
      usuario: u.usuario, nombre: u.nombre, rol: u.rol,
      passwordHash: hashPassword(u.pass)
    });
  }
  console.log('👤 Usuarios iniciales creados: admin y lector (cambia las contraseñas en el .env)');
};
