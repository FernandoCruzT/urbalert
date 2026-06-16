const { Router } = require('express');
const { authMiddleware } = require('../middlewares/auth');
const { heatmap, sectores, municipios } = require('../controllers/heatmap.controller');

const router = Router();

router.get('/municipios', authMiddleware, municipios);
router.get('/sectores',   authMiddleware, sectores);
router.get('/',           authMiddleware, heatmap);

module.exports = router;
