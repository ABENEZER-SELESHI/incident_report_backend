// middleware/authMiddleware.js
const tokenService = require("../services/tokenService");

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  try {
    req.user = tokenService.verifyAccessToken(token);
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Access token expired", code: "TOKEN_EXPIRED" });
    }
    res.status(401).json({ success: false, message: "Invalid token" });
  }
};

module.exports = authenticate;
