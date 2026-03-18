// services/tokenService.js
const jwt    = require("jsonwebtoken");
const crypto = require("crypto");
const pool   = require("../db");
const { v4: uuidv4 } = require("uuid");

const ACCESS_TTL  = "15m";
const REFRESH_TTL = "7d";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** SHA-256 hex of a raw token string — used as the DB lookup key */
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

/**
 * Generate a short-lived access token and a long-lived refresh token.
 * The refresh token is persisted to the DB for blacklist support.
 *
 * @param {{ id: string, role: string, admin_unit_id?: string, refresh_token_version?: number }} user
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
const generateTokens = async (user) => {
  const payload = {
    user_id:       user.id,
    role:          user.role,
    admin_unit_id: user.admin_unit_id || null,
    version:       user.refresh_token_version || 0,
  };

  const accessToken  = jwt.sign(payload, process.env.JWT_SECRET,         { expiresIn: ACCESS_TTL });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });

  // Persist hashed refresh token
  await pool.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
     VALUES ($1,$2,$3,$4)`,
    [uuidv4(), user.id, hashToken(refreshToken), new Date(Date.now() + REFRESH_TTL_MS)]
  );

  return { accessToken, refreshToken };
};

/**
 * Verify an access token. Throws on invalid/expired.
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyAccessToken = (token) =>
  jwt.verify(token, process.env.JWT_SECRET);

/**
 * Verify a refresh token and confirm it is not blacklisted.
 * @param {string} token
 * @returns {Promise<object>} decoded payload
 */
const verifyRefreshToken = async (token) => {
  // Will throw if expired or tampered
  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

  const result = await pool.query(
    `SELECT revoked FROM refresh_tokens WHERE token_hash=$1`,
    [hashToken(token)]
  );

  if (result.rows.length === 0 || result.rows[0].revoked) {
    throw Object.assign(new Error("Refresh token revoked or not found"), { code: "TOKEN_REVOKED" });
  }

  return decoded;
};

/**
 * Blacklist a single refresh token.
 * @param {string} token
 */
const blacklistRefreshToken = async (token) => {
  await pool.query(
    `UPDATE refresh_tokens SET revoked=TRUE WHERE token_hash=$1`,
    [hashToken(token)]
  );
};

/**
 * Revoke all refresh tokens for a user (force logout everywhere).
 * Also increments refresh_token_version so any cached tokens fail version checks.
 * @param {string} userId
 */
const revokeAllUserTokens = async (userId) => {
  await Promise.all([
    pool.query(`UPDATE refresh_tokens SET revoked=TRUE WHERE user_id=$1`, [userId]),
    pool.query(`UPDATE users SET refresh_token_version = refresh_token_version + 1 WHERE id=$1`, [userId]),
  ]);
};

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  blacklistRefreshToken,
  revokeAllUserTokens,
};
