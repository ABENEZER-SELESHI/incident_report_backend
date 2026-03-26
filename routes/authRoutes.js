// routes/authRoutes.js
const express = require("express");
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const authController = require("../controllers/authController");
const authenticate = require("../middleware/authMiddleware");

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

/** Strict limiter for OTP-sending endpoints (prevent SMS abuse) */
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: {
    success: false,
    message: "Too many OTP requests. Try again in 10 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** General auth limiter for login / password reset */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, message: "Too many requests. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------------------------------------------------------------------------
// Reusable validators
// ---------------------------------------------------------------------------
const phoneValidator = body("phone")
  .matches(/^\+251[0-9]{9}$/)
  .withMessage("Phone must be in +251XXXXXXXXX format");

const passwordValidator = (field) =>
  body(field)
    .isLength({ min: 8 })
    .withMessage(`${field} must be at least 8 characters`)
    .matches(/[A-Z]/)
    .withMessage(`${field} must contain an uppercase letter`)
    .matches(/[0-9]/)
    .withMessage(`${field} must contain a number`);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /auth/signup — register a new citizen account
router.post(
  "/signup",
  otpLimiter,
  [
    phoneValidator,
    body("full_name").notEmpty().withMessage("full_name is required"),
    passwordValidator("password"),
    body("email").optional().isEmail().withMessage("Invalid email address"),
  ],
  authController.signup,
);

// POST /auth/verify-signup — confirm OTP and activate account
router.post(
  "/verify-signup",
  otpLimiter,
  [
    phoneValidator,
    body("code")
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage("code must be 6 digits"),
  ],
  authController.verifySignup,
);

// POST /auth/login — password-based login
router.post(
  "/login",
  authLimiter,
  [
    phoneValidator,
    body("password").notEmpty().withMessage("password is required"),
  ],
  authController.login,
);

// POST /auth/refresh — rotate refresh token
router.post("/refresh", authLimiter, authController.refreshToken);

// POST /auth/logout — blacklist refresh token (authenticated)
router.post("/logout", authenticate, authController.logout);

// POST /auth/forgot-password — send password reset OTP
router.post(
  "/forgot-password",
  otpLimiter,
  [phoneValidator],
  authController.forgotPassword,
);

// POST /auth/reset-password — verify OTP and set new password
router.post(
  "/reset-password",
  authLimiter,
  [
    phoneValidator,
    body("code")
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage("code must be 6 digits"),
    passwordValidator("new_password"),
  ],
  authController.resetPassword,
);

// POST /auth/change-password — change password while logged in (authenticated)
router.post(
  "/change-password",
  authenticate,
  authLimiter,
  [
    body("current_password")
      .notEmpty()
      .withMessage("current_password is required"),
    passwordValidator("new_password"),
  ],
  authController.changePassword,
);

// Admin signup (protected or not depending on your system)
router.post(
  "/signup-admin",
  authLimiter,
  [
    phoneValidator,
    body("full_name").notEmpty(),
    passwordValidator("password"),
    body("admin_unit_id").notEmpty().withMessage("admin_unit_id is required"),
  ],
  authController.signupAdmin,
);

// Employee signup
router.post(
  "/signup-employee",
  authLimiter,
  [
    phoneValidator,
    body("full_name").notEmpty(),
    passwordValidator("password"),
    body("admin_unit_id").notEmpty().withMessage("admin_unit_id is required"),
  ],
  authController.signupEmployee,
);

module.exports = router;
