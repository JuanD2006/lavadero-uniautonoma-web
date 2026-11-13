// Envuelve controladores async para que cualquier error llegue al manejador global
exports.asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Error con código HTTP controlado
exports.HttpError = class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
};

exports.noEncontrada = (req, res) =>
  res.status(404).json({ ok: false, mensaje: `Ruta ${req.method} ${req.originalUrl} no encontrada` });

exports.manejadorErrores = (err, req, res, next) => {
  if (err.status) return res.status(err.status).json({ ok: false, mensaje: err.message });
  if (err.name === 'ValidationError')
    return res.status(400).json({ ok: false, mensaje: 'Datos inválidos', errores: Object.values(err.errors).map(e => e.message) });
  if (err.name === 'CastError')
    return res.status(400).json({ ok: false, mensaje: `Valor inválido para el campo ${err.path}` });
  if (err.code === 11000)
    return res.status(400).json({ ok: false, mensaje: `Ya existe un registro con ese ${Object.keys(err.keyValue)[0]}` });
  if (err.type === 'entity.parse.failed')
    return res.status(400).json({ ok: false, mensaje: 'JSON mal formado' });
  console.error(err);
  res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
};
