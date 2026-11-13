const Estudiante = require('../models/Estudiante');
const Vehiculo = require('../models/Vehiculo');
const { HttpError } = require('../middlewares/errores');
const { crearCuentaEstudiante } = require('../utils/cuentasEstudiantes');

const LAVADOS_PARA_GRATIS = 10;
const CAMPOS_EDITABLES = ['nombre', 'correo', 'programa', 'telefono'];

// F1: registrar estudiante
exports.crear = async (req, res) => {
  const { nombre, codigo, correo, programa, telefono } = req.body;
  const estudiante = await Estudiante.create({ nombre, codigo, correo, programa, telefono });
  // Cuenta de acceso automática (usuario = primer nombre, contraseña = nombre123). Si falla, el estudiante igual queda registrado.
  let usuario = null;
  try { usuario = await crearCuentaEstudiante(estudiante); } catch (e) { console.error('No se pudo crear la cuenta:', e.message); }
  res.status(201).json({ ok: true, data: estudiante, cuenta: usuario ? { usuario } : null });
};

// F2: listar estudiantes (filtro opcional ?programa=)
exports.listar = async (req, res) => {
  const filtro = {};
  if (req.query.programa) filtro.programa = new RegExp(req.query.programa, 'i');
  const estudiantes = await Estudiante.find(filtro).sort({ nombre: 1 });
  res.status(200).json({ ok: true, total: estudiantes.length, data: estudiantes });
};

// F3: consultar estudiante por id (incluye sus vehículos)
exports.obtener = async (req, res) => {
  const estudiante = await Estudiante.findById(req.params.id);
  if (!estudiante) throw new HttpError(404, 'Estudiante no encontrado');
  const vehiculos = await Vehiculo.find({ estudiante: estudiante._id });
  res.status(200).json({ ok: true, data: { ...estudiante.toObject(), vehiculos } });
};

// F4: actualizar datos del estudiante
exports.actualizar = async (req, res) => {
  const cambios = {};
  CAMPOS_EDITABLES.forEach(c => { if (req.body[c] !== undefined) cambios[c] = req.body[c]; });
  const estudiante = await Estudiante.findByIdAndUpdate(req.params.id, cambios, { new: true, runValidators: true });
  if (!estudiante) throw new HttpError(404, 'Estudiante no encontrado');
  res.status(200).json({ ok: true, data: estudiante });
};

// F8: consultar estado de fidelidad (cuántos lavados faltan para el gratis)
exports.fidelidad = async (req, res) => {
  const e = await Estudiante.findById(req.params.id);
  if (!e) throw new HttpError(404, 'Estudiante no encontrado');
  res.status(200).json({
    ok: true,
    data: {
      estudiante: e.nombre,
      lavadosPagadosEnCiclo: e.lavadosPagados,
      lavadosRestantesParaGratis: Math.max(LAVADOS_PARA_GRATIS - e.lavadosPagados, 0),
      proximoLavadoGratis: e.lavadosPagados >= LAVADOS_PARA_GRATIS,
      lavadosTotales: e.lavadosTotales,
      lavadosGratisUsados: e.lavadosGratisUsados
    }
  });
};
