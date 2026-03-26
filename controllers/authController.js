// controllers/authController.js
const { validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db");
const { sendOTP, verifyOTP } = require("../services/otpService");
const tokenService = require("../services/tokenService");

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/** Pull express-validator errors and return 422 if any */
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, error: errors.array() });
    return false;
  }
  return true;
};

/* ------------------------------------------------------------------ */
/* POST /auth/signup                                                    */
/* ------------------------------------------------------------------ */
const signup = async (req, res) => {
  console.log("HEADERS:", req.headers);
  console.log("BODY:", req.body);

  if (!validate(req, res)) return;
  try {
    const {
      phone,
      email = null,
      password,
      full_name,
      national_id_photo = null,
    } = req.body;

    const existing = await pool.query(
      `SELECT id FROM users WHERE phone=$1 OR (email IS NOT NULL AND email=$2)`,
      [phone, email],
    );
    if (existing.rows.length > 0) {
      return res
        .status(409)
        .json({ success: false, message: "Phone or email already registered" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (id, phone, email, password_hash, full_name, national_id_photo, role, is_verified)
       VALUES ($1,$2,$3,$4,$5,$6,'citizen',FALSE)`,
      [uuidv4(), phone, email, password_hash, full_name, national_id_photo],
    );

    await sendOTP(phone, "signup");

    res
      .status(201)
      .json({ success: true, message: "OTP sent to your phone", phone });
  } catch (err) {
    console.error("[authController.signup]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ------------------------------------------------------------------ */
/* POST /auth/verify-signup                                             */
/* ------------------------------------------------------------------ */
const verifySignup = async (req, res) => {
  console.log("HEADERS:", req.headers);
  console.log("BODY:", req.body);
  if (!validate(req, res)) return;
  try {
    const { phone, code } = req.body;

    const valid = await verifyOTP(phone, code, "signup");
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    const result = await pool.query(
      `UPDATE users SET is_verified=TRUE, is_active = TRUE
       WHERE phone=$1
       RETURNING id, phone, email, full_name, role, language, admin_unit_id, refresh_token_version`,
      [phone],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const user = result.rows[0];
    const tokens = await tokenService.generateTokens(user);

    res.json({ success: true, ...tokens, user });
  } catch (err) {
    console.error("[authController.verifySignup]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ------------------------------------------------------------------ */
/* POST /auth/login                                                     */
/* ------------------------------------------------------------------ */
const login = async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { phone, password } = req.body;

    const result = await pool.query(
      `SELECT id, phone, email, full_name, role, language, admin_unit_id,
              password_hash, is_active, is_verified,
              failed_login_attempts, locked_until, refresh_token_version
       FROM users WHERE phone=$1`,
      [phone],
    );

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res
        .status(403)
        .json({ success: false, message: "Account is deactivated" });
    }

    // Check account lock
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      const remaining = Math.ceil(
        (new Date(user.locked_until) - Date.now()) / 60000,
      );
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${remaining} minute(s)`,
      });
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      const attempts = user.failed_login_attempts + 1;
      const lockUntil =
        attempts >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCK_DURATION_MS)
          : null;

      await pool.query(
        `UPDATE users SET failed_login_attempts=$1, locked_until=$2 WHERE id=$3`,
        [attempts, lockUntil, user.id],
      );

      const attemptsLeft = MAX_FAILED_ATTEMPTS - attempts;
      return res.status(401).json({
        success: false,
        message:
          attemptsLeft > 0
            ? `Invalid credentials. ${attemptsLeft} attempt(s) remaining`
            : "Account locked for 15 minutes due to too many failed attempts",
      });
    }

    // Reset failed attempts and update last_login
    await pool.query(
      `UPDATE users SET failed_login_attempts=0, locked_until=NULL, last_login=NOW() WHERE id=$1`,
      [user.id],
    );

    const tokens = await tokenService.generateTokens(user);

    res.json({
      success: true,
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        language: user.language,
        admin_unit_id: user.admin_unit_id,
        is_verified: user.is_verified,
      },
    });
  } catch (err) {
    console.error("[authController.login]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ------------------------------------------------------------------ */
/* POST /auth/refresh                                                   */
/* ------------------------------------------------------------------ */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "refreshToken is required" });
    }

    const decoded = await tokenService.verifyRefreshToken(token);

    // Confirm version still matches (covers revokeAllUserTokens)
    const userRes = await pool.query(
      `SELECT id, role, admin_unit_id, refresh_token_version FROM users WHERE id=$1`,
      [decoded.user_id],
    );
    if (userRes.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }

    const user = userRes.rows[0];
    if (decoded.version !== user.refresh_token_version) {
      return res
        .status(401)
        .json({ success: false, message: "Token has been revoked" });
    }

    // Rotate: blacklist old, issue new
    await tokenService.blacklistRefreshToken(token);
    const tokens = await tokenService.generateTokens(user);

    res.json({ success: true, ...tokens });
  } catch (err) {
    const isJwtError = ["JsonWebTokenError", "TokenExpiredError"].includes(
      err.name,
    );
    const code = isJwtError || err.code === "TOKEN_REVOKED" ? 401 : 500;
    res.status(code).json({ success: false, message: err.message });
  }
};

/* ------------------------------------------------------------------ */
/* POST /auth/logout  (authenticated)                                  */
/* ------------------------------------------------------------------ */
const logout = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (token) await tokenService.blacklistRefreshToken(token);
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("[authController.logout]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ------------------------------------------------------------------ */
/* POST /auth/forgot-password                                           */
/* ------------------------------------------------------------------ */
const forgotPassword = async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { phone } = req.body;

    const result = await pool.query(
      `SELECT id FROM users WHERE phone=$1 AND is_active=TRUE`,
      [phone],
    );
    // Always return 200 to avoid user enumeration
    if (result.rows.length > 0) {
      await sendOTP(phone, "password_reset");
    }

    res.json({
      success: true,
      message: "If that number is registered, an OTP has been sent",
    });
  } catch (err) {
    console.error("[authController.forgotPassword]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ------------------------------------------------------------------ */
/* POST /auth/reset-password                                            */
/* ------------------------------------------------------------------ */
const resetPassword = async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { phone, code, new_password } = req.body;

    const valid = await verifyOTP(phone, code, "password_reset");
    if (!valid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    const password_hash = await bcrypt.hash(new_password, 10);

    await pool.query(
      `UPDATE users
       SET password_hash=$1,
           refresh_token_version = refresh_token_version + 1,
           failed_login_attempts=0, locked_until=NULL
       WHERE phone=$2`,
      [password_hash, phone],
    );

    res.json({
      success: true,
      message: "Password reset successfully. Please log in again.",
    });
  } catch (err) {
    console.error("[authController.resetPassword]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ------------------------------------------------------------------ */
/* POST /auth/change-password  (authenticated)                         */
/* ------------------------------------------------------------------ */
const changePassword = async (req, res) => {
  if (!validate(req, res)) return;
  try {
    const { current_password, new_password } = req.body;

    const result = await pool.query(
      `SELECT id, password_hash FROM users WHERE id=$1`,
      [req.user.user_id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect" });
    }

    const password_hash = await bcrypt.hash(new_password, 10);

    await pool.query(
      `UPDATE users
       SET password_hash=$1, refresh_token_version = refresh_token_version + 1
       WHERE id=$2`,
      [password_hash, req.user.user_id],
    );

    res.json({
      success: true,
      message: "Password changed. Please log in again.",
    });
  } catch (err) {
    console.error("[authController.changePassword]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ------------------------------------------------------------------ */
/* POST /auth/signup-admin                                             */
/* ------------------------------------------------------------------ */
const signupAdmin = async (req, res) => {
  if (!validate(req, res)) return;

  try {
    const {
      phone,
      email = null,
      password,
      full_name,
      admin_unit_id, // REQUIRED for admin
    } = req.body;

    const existing = await pool.query(
      `SELECT id FROM users WHERE phone=$1 OR (email IS NOT NULL AND email=$2)`,
      [phone, email],
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Phone or email already registered",
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users 
       (id, phone, email, password_hash, full_name, role, admin_unit_id, is_verified, is_active)
       VALUES ($1,$2,$3,$4,$5,'woreda_admin',$6,TRUE,TRUE)`,
      [uuidv4(), phone, email, password_hash, full_name, admin_unit_id],
    );

    res.status(201).json({
      success: true,
      message: "Admin account created successfully",
    });
  } catch (err) {
    console.error("[authController.signupAdmin]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/* ------------------------------------------------------------------ */
/* POST /auth/signup-employee                                          */
/* ------------------------------------------------------------------ */
const signupEmployee = async (req, res) => {
  if (!validate(req, res)) return;

  try {
    const {
      phone,
      email = null,
      password,
      full_name,
      admin_unit_id, // employee belongs to a unit
    } = req.body;

    const existing = await pool.query(
      `SELECT id FROM users WHERE phone=$1 OR (email IS NOT NULL AND email=$2)`,
      [phone, email],
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Phone or email already registered",
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users 
       (id, phone, email, password_hash, full_name, role, admin_unit_id, is_verified, is_active)
       VALUES ($1,$2,$3,$4,$5,'employee',$6,TRUE,TRUE)`,
      [uuidv4(), phone, email, password_hash, full_name, admin_unit_id],
    );

    res.status(201).json({
      success: true,
      message: "Employee account created successfully",
    });
  } catch (err) {
    console.error("[authController.signupEmployee]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  signup,
  signupAdmin,
  signupEmployee,
  verifySignup,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
};
