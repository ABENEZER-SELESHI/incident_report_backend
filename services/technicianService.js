// services/technicianService.js
const pool = require("../db");

/**
 * Get all assignments for a technician
 */
const getAllAssignments = async (technicianId) => {
  try {
    const result = await pool.query(
      `SELECT
         ta.id, ta.status, ta.deadline, ta.created_at,
         i.id AS issue_id,
         i.issue_number, i.title, i.category,
         i.description, i.address, i.severity,
         i.priority AS issue_priority
       FROM technician_assignments ta
       JOIN issues i ON i.id = ta.issue_id
       WHERE ta.technician_id = $1
       ORDER BY ta.created_at DESC`,
      [technicianId],
    );

    return result.rows;
  } catch (err) {
    console.error("[technicianService.getAllAssignments]", err.message);
    throw err;
  }
};

/**
 * Get unfinished assignments
 */
const getUnfinishedAssignments = async (technicianId) => {
  try {
    const result = await pool.query(
      `SELECT
         ta.id, ta.status, ta.deadline, ta.created_at,
         i.issue_number, i.title, i.category, i.address,
         i.priority AS issue_priority
       FROM technician_assignments ta
       JOIN issues i ON i.id = ta.issue_id
       WHERE ta.technician_id = $1
         AND ta.status IN ('pending','accepted','in_progress')
       ORDER BY
         i.priority DESC NULLS LAST,
         ta.deadline ASC NULLS LAST`,
      [technicianId],
    );

    return result.rows;
  } catch (err) {
    console.error("[technicianService.getUnfinishedAssignments]", err.message);
    throw err;
  }
};

/**
 * Get finished assignments
 */
const getFinishedAssignments = async (technicianId) => {
  try {
    const result = await pool.query(
      `SELECT
         ta.id, ta.status, ta.completed_at,
         i.issue_number, i.title, i.category, i.address,
         i.priority AS issue_priority
       FROM technician_assignments ta
       JOIN issues i ON i.id = ta.issue_id
       WHERE ta.technician_id = $1
         AND ta.status = 'completed'
       ORDER BY ta.completed_at DESC`,
      [technicianId],
    );

    return result.rows;
  } catch (err) {
    console.error("[technicianService.getFinishedAssignments]", err.message);
    throw err;
  }
};

const updateTaskStatus = async (assignmentId, technicianId, newStatus) => {
  try {
    // ensure the task belongs to the technician
    const check = await pool.query(
      `SELECT * FROM technician_assignments
       WHERE id = $1 AND technician_id = $2`,
      [assignmentId, technicianId],
    );

    if (check.rows.length === 0) {
      throw new Error("Task not found or unauthorized");
    }

    let query = "";
    let values = [];

    if (newStatus === "accepted") {
      query = `
        UPDATE technician_assignments
        SET status = 'accepted', accepted_at = NOW()
        WHERE id = $1
        RETURNING *`;
      values = [assignmentId];
    }

    if (newStatus === "in_progress") {
      query = `
        UPDATE technician_assignments
        SET status = 'in_progress', started_at = NOW()
        WHERE id = $1
        RETURNING *`;
      values = [assignmentId];
    }

    if (newStatus === "completed") {
      query = `
        UPDATE technician_assignments
        SET status = 'completed', completed_at = NOW()
        WHERE id = $1
        RETURNING *`;
      values = [assignmentId];
    }

    const result = await pool.query(query, values);

    // 🔥 also update issue when completed
    if (newStatus === "completed") {
      await pool.query(
        `UPDATE issues
         SET status = 'resolved', updated_at = NOW()
         WHERE id = $1`,
        [check.rows[0].issue_id],
      );
    }

    return result.rows[0];
  } catch (err) {
    console.error("[technicianService.updateTaskStatus]", err.message);
    throw err;
  }
};

module.exports = {
  getAllAssignments,
  getUnfinishedAssignments,
  getFinishedAssignments,
  updateTaskStatus,
};
