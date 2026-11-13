require('dotenv').config();
const app = require('./app');
const conectarDB = require('./config/db');
const crearUsuariosIniciales = require('./config/seed');
const { sincronizarCuentasEstudiantes } = require('./utils/cuentasEstudiantes');

const PORT = process.env.PORT || 3000;

conectarDB()
  .then(crearUsuariosIniciales)
  .then(sincronizarCuentasEstudiantes)
  .then(() => app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`)))
  .catch(err => { console.error('❌ Error conectando a MongoDB:', err.message); process.exit(1); });
