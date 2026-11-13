const router = require('express').Router();
const c = require('../controllers/lavados.controller');
const { asyncHandler: a } = require('../middlewares/errores');

router.post('/', a(c.crear));
router.get('/', a(c.listar));

module.exports = router;
