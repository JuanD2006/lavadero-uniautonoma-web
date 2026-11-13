const Vehiculo = require('../models/Vehiculo');
const Estudiante = require('../models/Estudiante');
const Lavado = require('../models/Lavado');
const { HttpError } = require('../middlewares/errores');

// F5: registrar vehículo asociado a un estudiante (valida que el estudiante exista)
exports.crear = async (req, res) => {
  const { placa, tipo, marca, color, estudiante } = req.body;
  if (!estudiante) throw new HttpError(400, 'El campo estudiante (id) es obligatorio');
  const existe = await Estudiante.exists({ _id: estudiante });
  if (!existe) throw new HttpError(404, 'El estudiante indicado no existe');
  const vehiculo = await Vehiculo.create({ placa, tipo, marca, color, estudiante });
  res.status(201).json({ ok: true, data: vehiculo });
};

// F6: buscar vehículos (?placa=ABC123 búsqueda parcial, ?tipo=carro|moto)
exports.buscar = async (req, res) => {
  const filtro = {};
  if (req.query.placa) filtro.placa = new RegExp(req.query.placa.trim(), 'i');
  if (req.query.tipo) filtro.tipo = req.query.tipo;
  const vehiculos = await Vehiculo.find(filtro).populate('estudiante', 'nombre codigo programa');
  res.status(200).json({ ok: true, total: vehiculos.length, data: vehiculos });
};

// F10: eliminar vehículo (se conserva el historial de lavados)
exports.eliminar = async (req, res) => {
  const vehiculo = await Vehiculo.findByIdAndDelete(req.params.id);
  if (!vehiculo) throw new HttpError(404, 'Vehículo no encontrado');
  const lavados = await Lavado.countDocuments({ vehiculo: vehiculo._id });
  res.status(200).json({ ok: true, mensaje: 'Vehículo eliminado', lavadosConservadosEnHistorial: lavados });
};
