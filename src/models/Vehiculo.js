const { Schema, model } = require('mongoose');

const vehiculoSchema = new Schema({
  placa: { type: String, required: [true, 'La placa es obligatoria'], unique: true, uppercase: true, trim: true },
  tipo: { type: String, required: [true, 'El tipo es obligatorio'], enum: { values: ['carro', 'moto', 'camioneta'], message: 'Tipo debe ser carro, moto o camioneta' } },
  marca: { type: String, required: [true, 'La marca es obligatoria'], trim: true },
  color: { type: String, trim: true },
  estudiante: { type: Schema.Types.ObjectId, ref: 'Estudiante', required: [true, 'El estudiante es obligatorio'] }
}, { timestamps: true });

module.exports = model('Vehiculo', vehiculoSchema);
