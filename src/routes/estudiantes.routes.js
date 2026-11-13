const router = require('express').Router();
const c = require('../controllers/estudiantes.controller');
const { asyncHandler: a } = require('../middlewares/errores');

router.post('/', a(c.crear));
router.get('/', a(c.listar));
router.get('/:id', a(c.obtener));
router.put('/:id', a(c.actualizar));
router.get('/:id/fidelidad', a(c.fidelidad));

module.exports = router;
