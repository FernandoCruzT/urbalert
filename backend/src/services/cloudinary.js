const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Sube un Buffer a Cloudinary.
 * @param {Buffer} buffer
 * @param {string} publicId  — nombre de archivo sin extensión
 * @returns {Promise<import('cloudinary').UploadApiResponse>}
 */
function uploadBuffer(buffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:         'urbalert/reportes',
        public_id:      publicId,
        transformation: [
          { quality: 80, width: 1200, crop: 'limit' },
          { fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

module.exports = { cloudinary, uploadBuffer };
