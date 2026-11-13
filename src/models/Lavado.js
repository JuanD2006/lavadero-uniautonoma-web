const { Schema, model } = require('mongoose');

const lavadoSchema = new Schema({
  estudiante: { type: Schema.Types.ObjectId, ref: 'Estudiante', required: true },
  vehiculo: { type: Schema.Types.ObjectId, ref: 'Vehiculo', required: true },
  tipoLavado: { type: String, required: true, enum: ['basico', 'completo'] },
  precio: { type: Number, required: true, min: 0 },
  esGratis: { type: Boolean, default: false },
  numeroLavadoEstudiante: { type: Number, required: true }
}, { timestamps: true });

module.exports = model('Lavado', lavadoSchema);
