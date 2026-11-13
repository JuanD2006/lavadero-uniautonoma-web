const { Schema, model } = require('mongoose');

// Usuarios del sistema (quienes inician sesión).
// - admin y lector se crean al arrancar (config/seed.js).
// - estudiante se crea solo desde POST /api/auth/registro (el rol lo fija el servidor, nunca el cliente).
const usuarioSchema = new Schema({
  usuario: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false }, // nunca se devuelve en consultas
  nombre: { type: String, trim: true },
  rol: { type: String, enum: ['admin', 'lector', 'estudiante'], default: 'lector' },
  // Solo para rol estudiante: ficha del lavadero asociada (si el administrador ya lo registró con ese nombre)
  estudiante: { type: Schema.Types.ObjectId, ref: 'Estudiante', default: null }
}, { timestamps: true });

module.exports = model('Usuario', usuarioSchema);
