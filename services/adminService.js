// services/adminService.js
const pool = require("../db");
const { v4: uuidv4 } = require("uuid");

/**
 * Aggregate dashboard statistics for a given woreda.
 *
 * @param {string} woredaId
 * @returns {Promise<{
 *   totals: object,
 *   by_category: object[],
 *   high_priority_count: number,
 *   avg_resolution_hours: number|null
 * }>}
 */
const getDashboardStats = async (woredaId) => {
  try {
    const [statusRes, categoryRes, priorityRes, resolutionRes] =
      await Promise.all([
        // Counts per status + total
        pool.query(
          `SELECT
           COUNT(*)                                          AS total,
           COUNT(*) FILTER (WHERE status='reported')        AS reported,
           COUNT(*) FILTER (WHERE status='verified')        AS verified,
           COUNT(*) FILTER (WHERE status='assigned')        AS assigned,
           COUNT(*) FILTER (WHERE status='in_progress')     AS in_progress,
           COUNT(*) FILTER (WHERE status='resolved')        AS resolved
         FROM issues WHERE woreda_id=$1`,
          [woredaId],
        ),
        // Counts per category
        pool.query(
          `SELECT category, COUNT(*)::int AS count
         FROM issues WHERE woreda_id=$1
         GROUP BY category ORDER BY count DESC`,
          [woredaId],
        ),
        // High/critical priority open issues
        pool.query(
          `SELECT COUNT(*)::int AS count
         FROM issues
         WHERE woreda_id=$1
           AND severity IN ('high','critical')
           AND status NOT IN ('resolved','closed')`,
          [woredaId],
        ),
        // Average resolution time (hours) over last 30 days
        pool.query(
          `SELECT ROUND(
           AVG(EXTRACT(EPOCH FROM (resolved_at - reported_at)) / 3600)::numeric, 2
         ) AS avg_hours
         FROM issues
         WHERE woreda_id=$1
           AND status IN ('resolved','closed')
           AND resolved_at >= NOW() - INTERVAL '30 days'`,
          [woredaId],
        ),
      ]);

    return {
      totals: statusRes.rows[0],
      by_category: categoryRes.rows,
      high_priority_count: priorityRes.rows[0].count,
      avg_resolution_hours: resolutionRes.rows[0].avg_hours,
    };
  } catch (err) {
    console.error("[adminService.getDashboardStats]", err.message);
    throw err;
  }
};

/**
 * Fetch unresolved issues awaiting action, ordered by urgency.
 *
 * @param {string} woredaId
 * @param {number} [limit=50]
 * @returns {Promise<object[]>}
 */
const getPendingIssues = async (woredaId, limit = 50) => {
  try {
    const result = await pool.query(
      `SELECT
         i.id, i.issue_number, i.title, i.category,
         i.status, i.severity, i.priority, i.address,
         i.reported_at,
         u.full_name AS reporter_name,
         u.phone     AS reporter_phone
       FROM issues i
       JOIN users u ON u.id = i.reporter_id
       WHERE i.woreda_id=$1
         AND i.status IN ('reported','verified')
       ORDER BY i.priority DESC, i.reported_at ASC
       LIMIT $2`,
      [woredaId, limit],
    );
    return result.rows;
  } catch (err) {
    console.error("[adminService.getPendingIssues]", err.message);
    throw err;
  }
};

/**
 * Paginated issue list for a woreda with optional filters.
 *
 * @param {string} woredaId
 * @param {{ status?: string, category?: string, from_date?: string, to_date?: string, page?: number, limit?: number }} filters
 * @returns {Promise<{ issues: object[], total: number, page: number, limit: number }>}
 */
const getIssuesByWoreda = async (woredaId, filters = {}) => {
  try {
    const {
      status,
      category,
      from_date,
      to_date,
      page = 1,
      limit = 20,
    } = filters;
    const params = [woredaId];
    const conditions = ["i.woreda_id = $1"];

    if (status) {
      params.push(status);
      conditions.push(`i.status = $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`i.category = $${params.length}`);
    }
    if (from_date) {
      params.push(from_date);
      conditions.push(`i.reported_at >= $${params.length}`);
    }
    if (to_date) {
      params.push(to_date);
      conditions.push(`i.reported_at <= $${params.length}`);
    }

    const where = conditions.join(" AND ");
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT
           i.id, i.issue_number, i.title, i.category,
           i.status, i.severity, i.priority, i.address, i.reported_at,
           u.full_name  AS reporter_name,
           t.full_name  AS technician_name,
           ta.status    AS assignment_status,
           ta.deadline  AS assignment_deadline
         FROM issues i
         JOIN users u ON u.id = i.reporter_id
         LEFT JOIN technician_assignments ta
           ON ta.issue_id = i.id AND ta.status NOT IN ('declined','completed')
         LEFT JOIN users t ON t.id = ta.technician_id
         WHERE ${where}
         ORDER BY i.reported_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, Number(limit), offset],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM issues i WHERE ${where}`,
        params,
      ),
    ]);

    return {
      issues: dataRes.rows,
      total: countRes.rows[0].total,
      page: Number(page),
      limit: Number(limit),
    };
  } catch (err) {
    console.error("[adminService.getIssuesByWoreda]", err.message);
    throw err;
  }
};

/**
 * Assign a technician to an issue within a transaction.
 * Updates the issue row and creates a technician_assignments record.
 *
 * @param {string} issueId
 * @param {string} technicianId
 * @param {string} adminId
 * @returns {Promise<object>} Updated issue row
 */
const assignTechnician = async (issueId, technicianId, adminId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const issueRes = await client.query(
      `UPDATE issues
       SET assigned_to=$1, assigned_by=$2, status='assigned', assigned_at=NOW()
       WHERE id=$3
       RETURNING *`,
      [technicianId, adminId, issueId],
    );

    if (issueRes.rows.length === 0) {
      throw Object.assign(new Error("Issue not found"), { statusCode: 404 });
    }

    await client.query(
      `INSERT INTO technician_assignments
         (id, issue_id, technician_id, assigned_by, status)
       VALUES ($1,$2,$3,$4,'pending')`,
      [uuidv4(), issueId, technicianId, adminId],
    );

    await client.query("COMMIT");
    return issueRes.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[adminService.assignTechnician]", err.message);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * List technicians belonging to a woreda with their current active workload.
 *
 * @param {string} woredaId
 * @returns {Promise<object[]>}
 */
const getAllTechnicians = async () => {
  try {
    const result = await pool.query(
      `SELECT
         u.id, u.full_name, u.phone, u.is_active,
         COUNT(ta.id) FILTER (
           WHERE ta.status IN ('pending','accepted','in_progress')
         )::int AS active_assignments
       FROM users u
       LEFT JOIN technician_assignments ta ON ta.technician_id = u.id
       WHERE u.role='technician'
         AND u.is_active=TRUE
       GROUP BY u.id
       ORDER BY active_assignments ASC, u.full_name ASC`,
    );

    return result.rows;
  } catch (err) {
    console.error("[adminService.getAllTechnicians]", err.message);
    throw err;
  }
};

module.exports = {
  getDashboardStats,
  getPendingIssues,
  getIssuesByWoreda,
  assignTechnician,
  getAllTechnicians,
};
