const { Router } = require('express');
const { authMiddleware } = require('../middlewares/auth');
const { heatmap } = require('../controllers/heatmap.controller');

const router = Router();

// Accesible para cualquier usuario autenticado
router.get('/', authMiddleware, heatmap);

module.exports = router;
