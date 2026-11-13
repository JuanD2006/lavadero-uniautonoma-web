const Usuario = require('../models/Usuario');
const Estudiante = require('../models/Estudiante');
const { hashPassword, normalizarUsuario } = require('./password');

const quitarTildes = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Regla de cuentas para estudiantes ya registrados en el lavadero:
//   usuario    = su primer nombre, en minúsculas y sin tildes   (Juan Pérez  -> "juan")
//   contraseña = primer nombre + "123"                           (-> "juan123")
// Si el primer nombre ya lo usa otra persona, el usuario pasa a ser "primer nombre + primer apellido"
// (-> "juan perez"); la contraseña sigue siendo "juan123".
exports.crearCuentaEstudiante = async (est) => {
  if (await Usuario.exists({ estudiante: est._id })) return null;   // ya tiene cuenta

  const palabras = quitarTildes(normalizarUsuario(est.nombre)).split(' ').filter(Boolean);
  if (!palabras.length) return null;
  const password = `${palabras[0]}123`;
  const candidatos = [...new Set([palabras[0], palabras.slice(0, 2).join(' ')])];

  for (const usuario of candidatos) {
    if (await Usuario.exists({ usuario })) continue;                 // ocupado (incluye admin y lector)
    await Usuario.create({
      usuario, nombre: est.nombre, rol: 'estudiante',
      passwordHash: hashPassword(password), estudiante: est._id
    });
    return usuario;
  }
  return null;   // no hubo nombre libre: el administrador deberá resolverlo a mano
};

// Se ejecuta al arrancar el servidor: crea la cuenta de todos los estudiantes que aún no tienen una.
exports.sincronizarCuentasEstudiantes = async () => {
  const conCuenta = new Set((await Usuario.find({ estudiante: { $ne: null } }).select('estudiante'))
    .map(u => String(u.estudiante)));
  let creadas = 0; const sinCuenta = [];
  for (const est of await Estudiante.find().sort({ createdAt: 1 })) {
    if (conCuenta.has(String(est._id))) continue;
    const usuario = await exports.crearCuentaEstudiante(est);
    usuario ? creadas++ : sinCuenta.push(est.nombre);
  }
  if (creadas) console.log(`👤 Cuentas creadas para ${creadas} estudiante(s) (usuario = primer nombre, contraseña = nombre123)`);
  if (sinCuenta.length) console.warn(`⚠️  Sin cuenta (nombre de usuario ocupado): ${sinCuenta.join(', ')}`);
};
