// middleware/uploadMiddleware.js
const multer = require("multer");

// Store files in memory temporarily
const storage = multer.memoryStorage();
const upload = multer({ storage });

module.exports = upload;
