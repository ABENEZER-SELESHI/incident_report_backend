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

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many OTP requests. Try again in 10 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many requests. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------------------------------------------------------------------------
// Validators
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

// POST /api/auth/signup
/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new citizen
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             phone: "+251912345678"
 *             email: "user@example.com"
 *             password: "StrongPass123"
 *             full_name: "Abel Tesfaye"
 *     responses:
 *       201:
 *         description: OTP sent
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "OTP sent to phone"
 */
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

// POST /api/auth/verify-signup
/**
 * @swagger
 * /api/auth/verify-signup:
 *   post:
 *     summary: Verify OTP and activate account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             phone: "+251912345678"
 *             code: "123456"
 *     responses:
 *       200:
 *         description: Account verified
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Account verified successfully"
 */
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

// POST /api/auth/login
// POST /api/auth/login
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+251912345678"
 *               password:
 *                 type: string
 *                 example: "StrongPass123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 accessToken:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 refreshToken:
 *                   type: string
 *                   example: "dGhpcy1pcy1hLXJlZnJlc2gtdG9rZW4="
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "cee5c2e5-130c-4e20-b22d-6a5fb8a240aa"
 *                     phone:
 *                       type: string
 *                       example: "+251991343124"
 *                     email:
 *                       type: string
 *                       example: "abenezer@test.com"
 *                     full_name:
 *                       type: string
 *                       example: "Abenezer Seleshi Abdisa"
 *                     role:
 *                       type: string
 *                       example: "citizen"
 *                     language:
 *                       type: string
 *                       example: "en"
 *                     admin_unit_id:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     is_verified:
 *                       type: boolean
 *                       example: true
 */
router.post(
  "/login",
  authLimiter,
  [
    phoneValidator,
    body("password").notEmpty().withMessage("password is required"),
  ],
  authController.login,
);

// POST /api/auth/refresh
/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             refreshToken: "your-refresh-token"
 *     responses:
 *       200:
 *         description: New Access Token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 accessToken:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 refreshToken:
 *                   type: string
 *                   example: "dGhpcy1pcy1hLXJlZnJlc2gtdG9rZW4="
 */
router.post("/refresh", authLimiter, authController.refreshToken);

// POST /api/auth/logout
/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Logged out successfully"
 */
router.post("/logout", authenticate, authController.logout);

// POST /api/auth/forgot-password
/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Send password reset OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             phone: "+251912345678"
 *     responses:
 *       200:
 *         description: OTP sent
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Password reset OTP sent"
 */
router.post(
  "/forgot-password",
  otpLimiter,
  [phoneValidator],
  authController.forgotPassword,
);

// POST /api/auth/reset-password
/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             phone: "+251912345678"
 *             code: "123456"
 *             new_password: "NewStrongPass123"
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Password reset successful"
 */
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

// POST /api/auth/change-password
/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change password
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             current_password: "OldPass123"
 *             new_password: "NewStrongPass123"
 *     responses:
 *       200:
 *         description: Password changed
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Password changed successfully"
 */
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

// POST /api/auth/signup-admin
/**
 * @swagger
 * /api/auth/signup-admin:
 *   post:
 *     summary: Create admin account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             phone: "+251911111111"
 *             full_name: "Admin User"
 *             password: "AdminPass123"
 *             admin_unit_id: "unit123"
 *     responses:
 *       201:
 *         description: Admin created
 */
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

// POST /api/auth/signup-employee
/**
 * @swagger
 * /api/auth/signup-employee:
 *   post:
 *     summary: Create employee account
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           example:
 *             phone: "+251922222222"
 *             full_name: "Employee User"
 *             password: "EmployeePass123"
 *             admin_unit_id: "unit123"
 *     responses:
 *       201:
 *         description: Employee created
 */
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
