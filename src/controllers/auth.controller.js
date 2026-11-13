const Usuario = require('../models/Usuario');
const Estudiante = require('../models/Estudiante');
const { hashPassword, verificarPassword, normalizarUsuario } = require('../utils/password');
const { crearSesion, cerrarSesion, cerrarOtrasSesiones } = require('../middlewares/auth');
const { HttpError } = require('../middlewares/errores');

const LAVADOS_PARA_GRATIS = 10;
const RESERVADOS = ['admin', 'lector'];

// Busca la ficha del estudiante por nombre (sin distinguir mayúsculas/tildes). Solo enlaza si hay UNA coincidencia.
const buscarFicha = async (nombre) => {
  const limpio = String(nombre).trim().replace(/\s+/g, ' ');
  const r = await Estudiante.find({ nombre: limpio }).collation({ locale: 'es', strength: 1 }).limit(2).select('_id');
  return r.length === 1 ? r[0]._id : null;
};

// POST /api/auth/registro  { nombre, password }
// El estudiante crea su cuenta: su USUARIO es el nombre que escribe y su contraseña la que elige.
// No inicia sesión automáticamente: después debe entrar por /login.
exports.registro = async (req, res) => {
  const { nombre, password } = req.body || {};
  const usuario = normalizarUsuario(nombre);

  if (usuario.length < 2 || usuario.length > 60) throw new HttpError(400, 'El nombre debe tener entre 2 y 60 caracteres');
  if (typeof password !== 'string' || password.length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres');
  if (password.length > 100) throw new HttpError(400, 'La contraseña es demasiado larga (máximo 100 caracteres)');
  if (RESERVADOS.includes(usuario)) throw new HttpError(400, 'Ese nombre no está disponible');

  if (await Usuario.exists({ usuario })) throw new HttpError(409, 'Ya existe una cuenta con ese nombre. Inicia sesión o usa otro nombre');

  // Si el administrador ya registró al estudiante con ese mismo nombre, se enlaza la cuenta con su ficha.
  // Si hay 0 o más de 1 coincidencia, queda sin enlazar (nunca se adivina).
  const ficha = await buscarFicha(nombre);
  if (ficha && await Usuario.exists({ estudiante: ficha }))
    throw new HttpError(409, 'Ya tienes una cuenta creada: inicia sesión con tu primer nombre como usuario');

  const nombreVisible = String(nombre).trim().replace(/\s+/g, ' ');
  await Usuario.create({ usuario, nombre: nombreVisible, rol: 'estudiante', passwordHash: hashPassword(password), estudiante: ficha });

  res.status(201).json({ ok: true, mensaje: 'Cuenta creada. Ya puedes iniciar sesión', usuario: nombreVisible });
};

// POST /api/auth/login  { usuario, password }  ->  crea la sesión (cookie) y devuelve los datos del usuario
exports.login = async (req, res) => {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) throw new HttpError(400, 'usuario y password son obligatorios');

  // Acepta el nombre con o sin tildes ("José" o "jose"): las cuentas automáticas se guardan sin tildes
  const escrito = normalizarUsuario(usuario);
  const sinTildes = escrito.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const u = await Usuario.findOne({ usuario: { $in: [...new Set([escrito, sinTildes])] } }).select('+passwordHash');
  // Mismo mensaje si el usuario no existe o la clave es incorrecta (no revela cuál falló)
  if (!u || !verificarPassword(password, u.passwordHash)) throw new HttpError(401, 'Usuario o contraseña incorrectos');

  const datos = { id: String(u._id), usuario: u.usuario, nombre: u.nombre, rol: u.rol };
  crearSesion(res, datos);
  res.status(200).json({ ok: true, usuario: { usuario: u.usuario, nombre: u.nombre, rol: u.rol } });
};

// POST /api/auth/logout -> destruye la sesión en el servidor y borra la cookie
exports.logout = async (req, res) => {
  cerrarSesion(req, res);
  res.status(200).json({ ok: true, mensaje: 'Sesión cerrada' });
};

// GET /api/auth/me (requiere sesión) -> datos del usuario autenticado
exports.me = async (req, res) => {
  const { usuario, nombre, rol } = req.usuario;
  res.status(200).json({ ok: true, usuario: { usuario, nombre, rol } });
};

// GET /api/auth/mi-fidelidad (requiere sesión de estudiante) -> SOLO el progreso del propio estudiante
exports.miFidelidad = async (req, res) => {
  if (req.usuario.rol !== 'estudiante') throw new HttpError(403, 'Solo las cuentas de estudiante tienen esta consulta');
  const u = await Usuario.findById(req.usuario.id);
  if (u && !u.estudiante) {            // aún sin enlazar: quizá el administrador ya lo registró
    u.estudiante = await buscarFicha(u.nombre);
    if (u.estudiante) await u.save();
  }
  const e = u && u.estudiante ? await Estudiante.findById(u.estudiante) : null;
  if (!e) return res.status(200).json({ ok: true, vinculado: false, nombre: req.usuario.nombre });

  res.status(200).json({
    ok: true,
    vinculado: true,
    nombre: e.nombre,
    lavadosPagadosEnCiclo: e.lavadosPagados,
    lavadosRestantesParaGratis: Math.max(LAVADOS_PARA_GRATIS - e.lavadosPagados, 0),
    proximoLavadoGratis: e.lavadosPagados >= LAVADOS_PARA_GRATIS,
    lavadosTotales: e.lavadosTotales,
    lavadosGratisUsados: e.lavadosGratisUsados
  });
};

// POST /api/auth/cambiar-password (requiere sesión)  { passwordActual, passwordNueva }
// Cualquier usuario (estudiante, lector o admin) puede cambiar SU propia contraseña; nunca la de otro.
exports.cambiarPassword = async (req, res) => {
  const { passwordActual, passwordNueva } = req.body || {};
  if (!passwordActual || !passwordNueva) throw new HttpError(400, 'passwordActual y passwordNueva son obligatorias');
  if (typeof passwordNueva !== 'string' || passwordNueva.length < 6) throw new HttpError(400, 'La contraseña nueva debe tener al menos 6 caracteres');
  if (passwordNueva.length > 100) throw new HttpError(400, 'La contraseña nueva es demasiado larga (máximo 100 caracteres)');

  const u = await Usuario.findById(req.usuario.id).select('+passwordHash');
  if (!u) throw new HttpError(401, 'Debes iniciar sesión');
  if (!verificarPassword(passwordActual, u.passwordHash)) throw new HttpError(400, 'La contraseña actual es incorrecta');
  if (passwordNueva === passwordActual) throw new HttpError(400, 'La contraseña nueva debe ser distinta de la actual');

  u.passwordHash = hashPassword(passwordNueva);
  await u.save();
  cerrarOtrasSesiones(req);
  res.status(200).json({ ok: true, mensaje: 'Contraseña actualizada' });
};
