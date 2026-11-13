const path = require('path');
const express = require('express');
const { noEncontrada, manejadorErrores } = require('./middlewares/errores');
const { verificarSesion, soloLecturaParaLector, noEstudiantes } = require('./middlewares/auth');

const app = express();
app.use(express.json());

// Interfaz web (carpeta /public): http://localhost:3000
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api', (req, res) => res.json({ ok: true, mensaje: 'API Lavadero Uniautónoma funcionando' }));

// Pública: registro y login (la ruta /mi-fidelidad y /me exigen sesión dentro del propio router)
app.use('/api/auth', require('./routes/auth.routes'));

// Protegidas: requieren sesión iniciada; el rol "lector" solo puede hacer GET
const protegido = [verificarSesion, noEstudiantes, soloLecturaParaLector];
app.use('/api/estudiantes', protegido, require('./routes/estudiantes.routes'));
app.use('/api/vehiculos', protegido, require('./routes/vehiculos.routes'));
app.use('/api/lavados', protegido, require('./routes/lavados.routes'));

app.use(noEncontrada);
app.use(manejadorErrores);

module.exports = app;
