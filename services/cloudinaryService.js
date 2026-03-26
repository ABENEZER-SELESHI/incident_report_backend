// services/cloudinaryService.js
const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary and return the secure URL
 * @param {Buffer} buffer - file buffer from multer
 * @param {string} folder - optional folder in Cloudinary
 * @returns {Promise<string>} secure URL
 */
const uploadToCloudinary = (buffer, folder = "issues") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
};

module.exports = { uploadToCloudinary };
