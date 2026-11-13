const Lavado = require('../models/Lavado');
const Estudiante = require('../models/Estudiante');
const Vehiculo = require('../models/Vehiculo');
const { HttpError } = require('../middlewares/errores');

const PRECIOS = { basico: 15000, completo: 25000 };
const LAVADOS_PARA_GRATIS = 10;

// F7: registrar lavado aplicando la regla de negocio: tras 10 lavados pagados, el siguiente es gratis
exports.crear = async (req, res) => {
  const { estudiante: estudianteId, vehiculo: vehiculoId, tipoLavado } = req.body;
  if (!estudianteId || !vehiculoId || !tipoLavado)
    throw new HttpError(400, 'estudiante, vehiculo y tipoLavado son obligatorios');
  if (!PRECIOS[tipoLavado])
    throw new HttpError(400, `tipoLavado debe ser: ${Object.keys(PRECIOS).join(' o ')}`);

  const estudiante = await Estudiante.findById(estudianteId);
  if (!estudiante) throw new HttpError(404, 'Estudiante no encontrado');
  const vehiculo = await Vehiculo.findById(vehiculoId);
  if (!vehiculo) throw new HttpError(404, 'Vehículo no encontrado');
  if (String(vehiculo.estudiante) !== String(estudiante._id))
    throw new HttpError(400, 'El vehículo no pertenece a este estudiante');

  const esGratis = estudiante.lavadosPagados >= LAVADOS_PARA_GRATIS;
  if (esGratis) {
    estudiante.lavadosPagados = 0;          // se reinicia el ciclo
    estudiante.lavadosGratisUsados += 1;
  } else {
    estudiante.lavadosPagados += 1;
  }
  estudiante.lavadosTotales += 1;
  await estudiante.save();

  const lavado = await Lavado.create({
    estudiante: estudiante._id,
    vehiculo: vehiculo._id,
    tipoLavado,
    precio: esGratis ? 0 : PRECIOS[tipoLavado],
    esGratis,
    numeroLavadoEstudiante: estudiante.lavadosTotales
  });

  res.status(201).json({
    ok: true,
    mensaje: esGratis ? '¡Este lavado es GRATIS por fidelidad!' : 'Lavado registrado',
    data: lavado,
    lavadosRestantesParaGratis: Math.max(LAVADOS_PARA_GRATIS - estudiante.lavadosPagados, 0)
  });
};

// Escapa caracteres especiales para que el texto del buscador se use como texto literal (no como expresión regular)
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// F9: historial POR BUSCADOR. No devuelve el historial completo: hay que buscar por nombre, código o placa.
// (?q=texto  &estudiante=id  &gratis=true|false  &desde=YYYY-MM-DD  &hasta=YYYY-MM-DD  &limite=50)
exports.listar = async (req, res) => {
  const { q, estudiante, gratis, desde, hasta } = req.query;
  const texto = (q || '').trim();
  if (!estudiante && texto.length < 2)
    throw new HttpError(400, 'Use el buscador: escriba al menos 2 caracteres (nombre, código o placa)');
  const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 50, 1), 100);

  const filtro = {};
  if (estudiante) filtro.estudiante = estudiante;
  if (texto) {
    const rx = new RegExp(escapar(texto), 'i');
    const [ests, vehs] = await Promise.all([
      Estudiante.find({ $or: [{ nombre: rx }, { codigo: rx }] }).select('_id').limit(50).lean(),
      Vehiculo.find({ placa: rx }).select('_id').limit(50).lean()
    ]);
    filtro.$or = [
      { estudiante: { $in: ests.map(e => e._id) } },
      { vehiculo: { $in: vehs.map(v => v._id) } }
    ];
  }
  if (gratis !== undefined && gratis !== '') filtro.esGratis = gratis === 'true';
  if (desde || hasta) {
    filtro.createdAt = {};
    if (desde) filtro.createdAt.$gte = new Date(desde);
    if (hasta) filtro.createdAt.$lte = new Date(`${hasta}T23:59:59.999Z`);
    if (Object.values(filtro.createdAt).some(d => isNaN(d))) throw new HttpError(400, 'Fecha inválida (use YYYY-MM-DD)');
  }

  const lavados = await Lavado.find(filtro)
    .populate('estudiante', 'nombre codigo')
    .populate('vehiculo', 'placa tipo')
    .sort({ createdAt: -1 });
  const totalCobrado = lavados.reduce((s, l) => s + l.precio, 0);
  const totalGratis = lavados.filter(l => l.esGratis).length;
  res.status(200).json({
    ok: true,
    total: lavados.length,
    mostrando: Math.min(lavados.length, limite),
    totalCobrado,
    totalGratis,
    data: lavados.slice(0, limite)
  });
};
