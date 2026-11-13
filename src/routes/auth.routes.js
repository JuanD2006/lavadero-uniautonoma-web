const router = require('express').Router();
const c = require('../controllers/auth.controller');
const { verificarSesion } = require('../middlewares/auth');
const { asyncHandler: a } = require('../middlewares/errores');

router.post('/registro', a(c.registro));   // pública: el estudiante crea su cuenta
router.post('/login', a(c.login));         // pública
router.post('/logout', a(c.logout));       // pública (si no hay sesión, no hace nada)
router.get('/me', verificarSesion, a(c.me));
router.post('/cambiar-password', verificarSesion, a(c.cambiarPassword)); // cambia la clave del usuario con sesión
router.get('/mi-fidelidad', verificarSesion, a(c.miFidelidad)); // el estudiante ve solo lo suyo

module.exports = router;
