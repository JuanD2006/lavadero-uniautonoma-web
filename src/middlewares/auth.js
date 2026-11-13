const crypto = require('crypto');
const { HttpError } = require('./errores');

// SESIONES EN EL SERVIDOR: al iniciar sesión se crea un identificador aleatorio que se guarda aquí
// y se entrega al navegador en una cookie. En cada petición el servidor busca ese identificador.
const HORAS = Number(process.env.SESSION_HOURS) || 2;
const DURACION_MS = HORAS * 60 * 60 * 1000;
const COOKIE = 'lavadero_sid';
const sesiones = new Map(); // id -> { usuario: {id, usuario, nombre, rol}, expira }

setInterval(() => {                                    // limpia sesiones vencidas
  const ahora = Date.now();
  for (const [id, s] of sesiones) if (s.expira < ahora) sesiones.delete(id);
}, 10 * 60 * 1000).unref();

const leerCookie = (req) => {
  const m = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(COOKIE + '='));
  return m ? decodeURIComponent(m.slice(COOKIE.length + 1)) : null;
};

const opcionesCookie = (maxAgeSeg) =>
  `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeg}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

exports.crearSesion = (res, usuario) => {
  const id = crypto.randomBytes(32).toString('hex');   // 256 bits aleatorios: imposible de adivinar
  sesiones.set(id, { usuario, expira: Date.now() + DURACION_MS });
  res.setHeader('Set-Cookie', `${COOKIE}=${id}; ${opcionesCookie(DURACION_MS / 1000)}`);
};

exports.cerrarSesion = (req, res) => {
  const id = leerCookie(req);
  if (id) sesiones.delete(id);
  res.setHeader('Set-Cookie', `${COOKIE}=; ${opcionesCookie(0)}`);
};

// 1) AUTENTICACIÓN: ¿quién eres? Exige una sesión válida (cookie de login)
exports.verificarSesion = (req, res, next) => {
  const id = leerCookie(req);
  const s = id && sesiones.get(id);
  if (!s) return next(new HttpError(401, 'Debes iniciar sesión'));
  if (s.expira < Date.now()) {
    sesiones.delete(id);
    return next(new HttpError(401, 'La sesión expiró, inicia sesión de nuevo'));
  }
  req.usuario = s.usuario;
  next();
};

// 2) AUTORIZACIÓN: ¿qué puedes hacer? El rol "lector" es SOLO LECTURA: únicamente peticiones GET.
exports.soloLecturaParaLector = (req, res, next) => {
  if (req.usuario.rol === 'lector' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method))
    return next(new HttpError(403, 'Tu usuario es de solo lectura: no puede crear, editar ni eliminar'));
  next();
};

// 3) El rol "estudiante" (cuentas creadas por los propios estudiantes) NO puede usar la gestión del
// lavadero: eso expondría correos, teléfonos y lavados de los demás. Solo usa /api/auth/mi-fidelidad.
exports.noEstudiantes = (req, res, next) => {
  if (req.usuario.rol === 'estudiante')
    return next(new HttpError(403, 'Tu cuenta de estudiante solo puede consultar tu propia fidelidad'));
  next();
};

// Tras cambiar la contraseña se cierran TODAS las demás sesiones de ese usuario (otros navegadores o
// dispositivos); la sesión actual se conserva. Así, si alguien más conocía la clave vieja, queda fuera.
exports.cerrarOtrasSesiones = (req) => {
  const actual = leerCookie(req);
  for (const [id, s] of sesiones) if (s.usuario.id === req.usuario.id && id !== actual) sesiones.delete(id);
};
