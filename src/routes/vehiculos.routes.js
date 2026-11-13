const router = require('express').Router();
const c = require('../controllers/vehiculos.controller');
const { asyncHandler: a } = require('../middlewares/errores');

router.post('/', a(c.crear));
router.get('/', a(c.buscar));
router.delete('/:id', a(c.eliminar));

module.exports = router;
