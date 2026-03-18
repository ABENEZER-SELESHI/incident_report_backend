// services/assignmentService.js
const pool = require("../db");
const { v4: uuidv4 } = require("uuid");

/**
 * Create a technician assignment and update the issue status in one transaction.
 *
 * @param {string} issueId
 * @param {string} technicianId
 * @param {string} assignedBy  - admin user id
 * @param {string} [priority='medium']
 * @returns {Promise<object>} Created assignment row
 */
const createAssignment = async (issueId, technicianId, assignedBy, priority = "medium") => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const assignmentRes = await client.query(
      `INSERT INTO technician_assignments
         (id, issue_id, technician_id, assigned_by, priority, status)
       VALUES ($1,$2,$3,$4,$5,'pending')
       RETURNING *`,
      [uuidv4(), issueId, technicianId, assignedBy, priority]
    );

    await client.query(
      `UPDATE issues
       SET assigned_to=$1, assigned_by=$2, status='assigned', assigned_at=NOW()
       WHERE id=$3`,
      [technicianId, assignedBy, issueId]
    );

    await client.query("COMMIT");
    return assignmentRes.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[assignmentService.createAssignment]", err.message);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Get all assignments for a technician, optionally filtered by status.
 *
 * @param {string} technicianId
 * @param {string|null} [status]
 * @returns {Promise<object[]>}
 */
const getMyAssignments = async (technicianId, status = null) => {
  try {
    const params = [technicianId];
    let statusClause = "";

    if (status) {
      params.push(status);
      statusClause = `AND ta.status = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT
         ta.id, ta.status, ta.priority, ta.deadline,
         ta.accepted_at, ta.completed_at, ta.notes, ta.created_at,
         i.id           AS issue_id,
         i.issue_number, i.title, i.category,
         i.address, i.priority AS issue_priority,
         i.severity, i.description,
         ST_Y(i.location::geometry) AS latitude,
         ST_X(i.location::geometry) AS longitude
       FROM technician_assignments ta
       JOIN issues i ON i.id = ta.issue_id
       WHERE ta.technician_id = $1 ${statusClause}
       ORDER BY
         CASE ta.priority
           WHEN 'urgent' THEN 1 WHEN 'high' THEN 2
           WHEN 'medium' THEN 3 ELSE 4
         END,
         ta.deadline ASC NULLS LAST`,
      params
    );

    return result.rows;
  } catch (err) {
    console.error("[assignmentService.getMyAssignments]", err.message);
    throw err;
  }
};

/**
 * Update assignment status. Sets completed_at when status='completed' and
 * resolves the parent issue when all active assignments are done.
 *
 * @param {string} assignmentId
 * @param {string} status
 * @param {string|null} [notes]
 * @returns {Promise<object>} Updated assignment row
 */
const updateAssignmentStatus = async (assignmentId, status, notes = null) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const completedClause = status === "completed" ? ", completed_at = NOW()" : "";
    const acceptedClause  = status === "accepted"  ? ", accepted_at  = NOW()" : "";

    const assignRes = await client.query(
      `UPDATE technician_assignments
       SET status=$1 ${completedClause} ${acceptedClause},
           notes = COALESCE($2, notes)
       WHERE id=$3
       RETURNING *`,
      [status, notes, assignmentId]
    );

    if (assignRes.rows.length === 0) {
      throw Object.assign(new Error("Assignment not found"), { statusCode: 404 });
    }

    const assignment = assignRes.rows[0];

    // If completed, check whether all assignments for this issue are done
    if (status === "completed") {
      const pendingRes = await client.query(
        `SELECT COUNT(*)::int AS pending
         FROM technician_assignments
         WHERE issue_id=$1 AND status NOT IN ('completed','declined')`,
        [assignment.issue_id]
      );

      if (pendingRes.rows[0].pending === 0) {
        await client.query(
          `UPDATE issues SET status='resolved', resolved_at=NOW() WHERE id=$1`,
          [assignment.issue_id]
        );
      } else {
        // At least one technician is working — mark in_progress
        await client.query(
          `UPDATE issues SET status='in_progress' WHERE id=$1 AND status='assigned'`,
          [assignment.issue_id]
        );
      }
    }

    await client.query("COMMIT");
    return assignment;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[assignmentService.updateAssignmentStatus]", err.message);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Fetch a single assignment with full issue details.
 * Note: work_logs table is not in the current schema; extend migration to add it.
 *
 * @param {string} assignmentId
 * @returns {Promise<object|null>}
 */
const getAssignmentById = async (assignmentId) => {
  try {
    const result = await pool.query(
      `SELECT
         ta.*,
         i.issue_number, i.title, i.description, i.category,
         i.status AS issue_status, i.severity, i.priority AS issue_priority,
         i.address, i.reported_at,
         ST_Y(i.location::geometry) AS latitude,
         ST_X(i.location::geometry) AS longitude,
         u.full_name AS technician_name,
         u.phone     AS technician_phone
       FROM technician_assignments ta
       JOIN issues i ON i.id = ta.issue_id
       JOIN users  u ON u.id = ta.technician_id
       WHERE ta.id = $1`,
      [assignmentId]
    );

    return result.rows[0] || null;
  } catch (err) {
    console.error("[assignmentService.getAssignmentById]", err.message);
    throw err;
  }
};

/**
 * Add a work log entry to an assignment.
 * TODO: Requires a `work_logs` table — add migration 002_work_logs.sql before using.
 *
 * @param {string} assignmentId
 * @param {string} technicianId
 * @param {{ log_type: string, description: string, hours_spent?: number, materials_used?: string, location?: string, photos?: string[] }} logData
 * @returns {Promise<object>} Created work log row
 */
const addWorkLog = async (assignmentId, technicianId, logData) => {
  try {
    const { log_type, description, hours_spent = null, materials_used = null, location = null, photos = [] } = logData;

    const result = await pool.query(
      `INSERT INTO work_logs
         (id, assignment_id, technician_id, log_type, description,
          hours_spent, materials_used, location, photos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        uuidv4(), assignmentId, technicianId,
        log_type, description, hours_spent,
        materials_used, location,
        JSON.stringify(photos),
      ]
    );

    return result.rows[0];
  } catch (err) {
    console.error("[assignmentService.addWorkLog]", err.message);
    throw err;
  }
};

module.exports = {
  createAssignment,
  getMyAssignments,
  updateAssignmentStatus,
  getAssignmentById,
  addWorkLog,
};
