const multer = require('multer');

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png'];
const MAX_SIZE_BYTES   = 5 * 1024 * 1024; // 5 MB

const _multer = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_SIZE_BYTES },
  fileFilter(_req, file, cb) {
    if (TIPOS_PERMITIDOS.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Solo se permiten archivos JPG y PNG'), { status: 400 }));
    }
  },
});

/**
 * Wrapper que convierte los errores de multer en respuestas JSON.
 * Uso en rutas: upload.array('fotos', 2)
 */
const upload = {
  array(field, maxCount) {
    const middleware = _multer.array(field, maxCount);
    return (req, res, next) => {
      middleware(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'Cada foto debe pesar menos de 5 MB' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ message: `Máximo ${maxCount} foto(s) por petición` });
        }
        return res.status(400).json({ message: err.message || 'Error al procesar las fotos' });
      });
    };
  },
};

module.exports = upload;
