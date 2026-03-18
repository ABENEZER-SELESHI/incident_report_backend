// services/notificationService.js
// MVP VERSION — notifications are logged to console and persisted to DB.
// TODO: Replace console.log with FCM/Expo push, SMS, or email delivery.
const pool = require("../db");
const { v4: uuidv4 } = require("uuid");

/**
 * Persist a notification row and log it to console (MVP delivery).
 *
 * @param {string} userId
 * @param {string} title
 * @param {string} body
 * @param {{ type?: string, reference_type?: string, reference_id?: string, priority?: string }} [data={}]
 * @returns {Promise<object>} Created notification row
 */
const sendToUser = async (userId, title, body, data = {}) => {
  const {
    type           = "issue_update",
    reference_type = null,
    reference_id   = null,
    priority       = "medium",
  } = data;

  // MVP delivery — swap this block for real push/SMS in production
  console.log(`📱 [NOTIFICATION TO USER ${userId}]:`, title, "-", body, data);

  try {
    const result = await pool.query(
      `INSERT INTO notifications
         (id, user_id, type, title, body, reference_type, reference_id, priority, status, sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'sent',NOW())
       RETURNING *`,
      [uuidv4(), userId, type, title, body, reference_type, reference_id, priority]
    );
    return result.rows[0];
  } catch (err) {
    console.error("[notificationService.sendToUser]", err.message);
    throw err;
  }
};

/**
 * Notify all woreda_admin users belonging to a given admin unit.
 *
 * @param {string} woredaId
 * @param {string} title
 * @param {string} body
 * @param {object} [data={}]
 * @returns {Promise<void>}
 */
const sendToAdmins = async (woredaId, title, body, data = {}) => {
  try {
    const admins = await pool.query(
      `SELECT id FROM users
       WHERE role='woreda_admin' AND admin_unit_id=$1 AND is_active=TRUE`,
      [woredaId]
    );

    await Promise.all(admins.rows.map((a) => sendToUser(a.id, title, body, data)));
    console.log(`📢 [ADMIN BROADCAST] Notified ${admins.rows.length} admin(s) in woreda ${woredaId}`);
  } catch (err) {
    console.error("[notificationService.sendToAdmins]", err.message);
    throw err;
  }
};

/**
 * Send an assignment-type notification to a technician.
 *
 * @param {string} technicianId
 * @param {string} title
 * @param {string} body
 * @param {object} [data={}]
 * @returns {Promise<object>}
 */
const sendToTechnician = async (technicianId, title, body, data = {}) => {
  console.log(`🔧 [TECHNICIAN NOTIFICATION ${technicianId}]:`, title);
  return sendToUser(technicianId, title, body, { ...data, type: "assignment" });
};

/**
 * Notify the reporter and assigned technician when an issue status changes.
 *
 * @param {string} issueId
 * @param {string} newStatus
 * @param {string} updatedBy  - user id of the admin making the change
 * @returns {Promise<void>}
 */
const notifyStatusChange = async (issueId, newStatus, updatedBy) => {
  try {
    const result = await pool.query(
      `SELECT issue_number, title, reporter_id, assigned_to FROM issues WHERE id=$1`,
      [issueId]
    );

    if (result.rows.length === 0) return;

    const { issue_number, title, reporter_id, assigned_to } = result.rows[0];
    const refData = { reference_type: "issue", reference_id: issueId };

    const notifyReporter = sendToUser(
      reporter_id,
      `Issue ${issue_number} updated`,
      `Your issue "${title}" is now: ${newStatus}`,
      refData
    );

    const notifyTechnician = assigned_to
      ? sendToTechnician(
          assigned_to,
          `Issue ${issue_number} status changed`,
          `Issue "${title}" has been updated to: ${newStatus}`,
          refData
        )
      : Promise.resolve();

    await Promise.all([notifyReporter, notifyTechnician]);
    console.log(`🔔 [STATUS CHANGE] Issue ${issue_number} → ${newStatus} — notifications sent`);
  } catch (err) {
    console.error("[notificationService.notifyStatusChange]", err.message);
    throw err;
  }
};

/**
 * Low-level helper to insert a notification with full control over all fields.
 *
 * @param {string} userId
 * @param {string} type
 * @param {string} title
 * @param {string} body
 * @param {string|null} referenceType
 * @param {string|null} referenceId
 * @returns {Promise<object>}
 */
const createNotification = async (userId, type, title, body, referenceType, referenceId) => {
  try {
    const result = await pool.query(
      `INSERT INTO notifications
         (id, user_id, type, title, body, reference_type, reference_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [uuidv4(), userId, type, title, body, referenceType || null, referenceId || null]
    );
    return result.rows[0];
  } catch (err) {
    console.error("[notificationService.createNotification]", err.message);
    throw err;
  }
};

module.exports = {
  sendToUser,
  sendToAdmins,
  sendToTechnician,
  notifyStatusChange,
  createNotification,
};
