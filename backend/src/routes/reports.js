const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middlewares/auth');
const { create, mine, getById, confirmDuplicate, authorityReports, getChildReports, byColonia } = require('../controllers/reports.controller');
const { uploadPhotos, getPhotos } = require('../controllers/photos.controller');
const { updateStatus } = require('../controllers/status.controller');
const upload = require('../middlewares/upload');

const router = Router();

// Todos los endpoints requieren autenticación
router.use(authMiddleware);

// Solo ciudadanos pueden crear reportes
router.post('/', requireRole('ciudadano'), create);

// Lista de reportes propios (ciudadano)
router.get('/mine', requireRole('ciudadano'), mine);

// Lista de reportes de la autoridad autenticada
router.get('/authority-reports', requireRole('autoridad'), authorityReports);

// Reportes por colonia (para drawer del mapa coroplético) — debe ir antes de /:id
router.get('/by-colonia', byColonia);

// Fotos — deben ir antes de /:id para no ser absorbidas por ese parámetro
router.post('/:id/photos', requireRole('ciudadano'), upload.array('fotos', 2), uploadPhotos);
router.get('/:id/photos', getPhotos);

// Confirmar duplicado (ciudadano sobre su propio reporte)
router.patch('/:id/confirm-duplicate', requireRole('ciudadano'), confirmDuplicate);

// Reportes hijo que confirmaron el mismo incidente
router.get('/:id/children', getChildReports);

// Actualizar estado (autoridad dueña del reporte)
router.patch('/:id/status', requireRole('autoridad'), updateStatus);

// Detalle de un reporte — acceso controlado dentro del controller
router.get('/:id', getById);

module.exports = router;
