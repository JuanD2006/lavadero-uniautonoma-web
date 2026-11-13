const { Schema, model } = require('mongoose');

const estudianteSchema = new Schema({
  nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true },
  codigo: { type: String, required: [true, 'El código estudiantil es obligatorio'], unique: true, trim: true },
  correo: {
    type: String, required: [true, 'El correo es obligatorio'], unique: true, lowercase: true, trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Correo inválido']
  },
  programa: { type: String, required: [true, 'El programa es obligatorio'], trim: true },
  telefono: { type: String, trim: true },
  lavadosPagados: { type: Number, default: 0, min: 0 },   // contador del ciclo actual (0-10)
  lavadosTotales: { type: Number, default: 0, min: 0 },
  lavadosGratisUsados: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

module.exports = model('Estudiante', estudianteSchema);
