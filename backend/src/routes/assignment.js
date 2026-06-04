const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middlewares/auth');
const { assign, escalate, transfer, adminTransfer } = require('../controllers/assignment.controller');

const router = Router();

router.use(authMiddleware);

// Superadmin fuerza asignación de un reporte pendiente
router.post('/assign/:reportId',    requireRole('superadmin'),           assign);

// Autoridad dueña escala su reporte a revisión
router.post('/escalate/:reportId',  requireRole('autoridad'),            escalate);

// Autoridad dueña transfiere a otra categoría
router.post('/transfer/:reportId',  requireRole('autoridad'),            transfer);

// Superadmin reasigna reporte escalado a nueva categoría
router.post('/admin-transfer/:reportId', requireRole('superadmin'), adminTransfer);

module.exports = router;
