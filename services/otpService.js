// services/otpService.js
const pool = require("../db");
const { v4: uuidv4 } = require("uuid");
const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Send a 6-digit OTP to the given phone number for a specific purpose.
 * @param {string} phone   - E.164 format, e.g. +251912345678
 * @param {string} purpose - 'signup' | 'login' | 'password_reset'
 */
const sendOTP = async (phone, purpose = "login") => {
  const code = generateOTP();
  const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await pool.query(
    `INSERT INTO otp_codes (id, phone, code, purpose, expires_at)
     VALUES ($1,$2,$3,$4,$5)`,
    [uuidv4(), phone, code, purpose, expires]
  );

  await client.messages.create({
    body: `Your CitiScope verification code is: ${code}. Valid for 5 minutes.`,
    from: process.env.TWILIO_PHONE,
    to: phone,
  });

  console.log(`[OTP] Sent ${purpose} code to ${phone}`);
};

/**
 * Verify an OTP code. Marks it as used on success.
 * @param {string} phone
 * @param {string} code
 * @param {string} purpose
 * @returns {boolean}
 */
const verifyOTP = async (phone, code, purpose = "login") => {
  const result = await pool.query(
    `SELECT id, expires_at, is_used FROM otp_codes
     WHERE phone=$1 AND code=$2 AND purpose=$3
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone, code, purpose]
  );

  if (result.rows.length === 0) return false;

  const otp = result.rows[0];

  if (otp.is_used || new Date() > otp.expires_at) return false;

  // Mark as used to prevent replay attacks
  await pool.query("UPDATE otp_codes SET is_used=TRUE WHERE id=$1", [otp.id]);

  return true;
};

module.exports = { sendOTP, verifyOTP };
