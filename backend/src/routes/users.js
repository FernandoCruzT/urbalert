const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middlewares/auth');
const {
  createAuthority,
  listAuthorities,
  getCitizen,
  suspendCitizen,
  listCitizens,
  listMunicipios,
  updateAuthority,
  deactivateAuthority,
  listSuperadmins,
  deactivateSuperadmin,
} = require('../controllers/users.controller');

const router = Router();

router.use(authMiddleware);
router.use(requireRole('superadmin'));

router.get('/municipios',                       listMunicipios);
router.get('/citizens',                         listCitizens);
router.get('/citizen/:usuarioId',               getCitizen);
router.patch('/citizen/:usuarioId/suspend',     suspendCitizen);
router.post('/authority',      createAuthority);
router.get('/authorities',     listAuthorities);
router.patch('/authority/:id', updateAuthority);
router.delete('/authority/:id', deactivateAuthority);
router.get('/superadmins',      listSuperadmins);
router.delete('/superadmin/:id', deactivateSuperadmin);

module.exports = router;
