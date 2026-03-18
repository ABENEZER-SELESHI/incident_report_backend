// services/issueService.js
const pool = require("../db");
const { v4: uuidv4 } = require("uuid");
const geospatialService = require("./geoSpatialService");

/**
 * Create a new issue report within a transaction.
 * Resolves the administrative unit (woreda/zone/region) from coordinates.
 *
 * @param {{
 *   title: string,
 *   description?: string,
 *   category: string,
 *   latitude: number,
 *   longitude: number,
 *   address?: string,
 *   reporter_id: string,
 *   source?: string,
 *   media?: Array<{ media_url: string, media_type: string, is_primary?: boolean }>
 * }} issueData
 * @returns {Promise<object>} Created issue row
 */
const createIssue = async (issueData) => {
  const {
    title,
    description = null,
    category,
    latitude,
    longitude,
    address = null,
    reporter_id,
    source = "citizen",
    media = [],
  } = issueData;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Resolve woreda/zone/region from coordinates
    const { woreda_id, zone_id, region_id } =
      await geospatialService.locateAdministrativeUnit(latitude, longitude);

    const issueId = uuidv4();

    // ST_SetSRID(ST_MakePoint(lon, lat), 4326) — note lon before lat for PostGIS
    const issueResult = await client.query(
      `INSERT INTO issues
         (id, title, description, category,
          location, address,
          woreda_id, zone_id, region_id,
          status, source, reporter_id)
       VALUES
         ($1, $2, $3, $4,
          ST_SetSRID(ST_MakePoint($5, $6), 4326), $7,
          $8, $9, $10,
          'reported', $11, $12)
       RETURNING *,
         ST_Y(location::geometry) AS latitude,
         ST_X(location::geometry) AS longitude`,
      [
        issueId, title, description, category,
        longitude, latitude, address,
        woreda_id || null, zone_id || null, region_id || null,
        source, reporter_id,
      ]
    );

    const issue = issueResult.rows[0];

    // Insert media attachments if provided
    if (media.length > 0) {
      const mediaValues = media.map((m) => [
        uuidv4(),
        issueId,
        m.media_url,
        m.media_type,
        m.is_primary ?? false,
        reporter_id,
      ]);

      for (const mv of mediaValues) {
        await client.query(
          `INSERT INTO issue_media (id, issue_id, media_url, media_type, is_primary, uploaded_by)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          mv
        );
      }

      issue.media = media;
    } else {
      issue.media = [];
    }

    await client.query("COMMIT");
    return issue;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[issueService.createIssue]", err.message);
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Fetch a single issue by ID, including media URLs, reporter info, and comments.
 *
 * @param {string} issueId
 * @returns {Promise<object|null>}
 */
const getIssueById = async (issueId) => {
  try {
    const issueResult = await pool.query(
      `SELECT
         i.*,
         ST_Y(i.location::geometry) AS latitude,
         ST_X(i.location::geometry) AS longitude,
         u.full_name  AS reporter_name,
         u.phone      AS reporter_phone
       FROM issues i
       JOIN users u ON u.id = i.reporter_id
       WHERE i.id = $1`,
      [issueId]
    );

    if (issueResult.rows.length === 0) return null;

    const issue = issueResult.rows[0];

    const [mediaResult, commentsResult] = await Promise.all([
      pool.query(
        `SELECT id, media_url, media_type, is_primary, uploaded_at
         FROM issue_media WHERE issue_id=$1 ORDER BY is_primary DESC, uploaded_at ASC`,
        [issueId]
      ),
      pool.query(
        `SELECT c.id, c.comment, c.is_public, c.created_at,
                u.full_name AS author_name, u.role AS author_role
         FROM issue_comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.issue_id=$1
         ORDER BY c.created_at ASC`,
        [issueId]
      ),
    ]);

    issue.media    = mediaResult.rows;
    issue.comments = commentsResult.rows;

    return issue;
  } catch (err) {
    console.error("[issueService.getIssueById]", err.message);
    throw err;
  }
};

/**
 * Get all issues reported by a user, with optional filters.
 *
 * @param {string} userId
 * @param {{ status?: string, category?: string, from_date?: string, to_date?: string }} filters
 * @returns {Promise<object[]>}
 */
const getUserIssues = async (userId, filters = {}) => {
  try {
    const params = [userId];
    const conditions = ["i.reporter_id = $1"];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`i.status = $${params.length}`);
    }
    if (filters.category) {
      params.push(filters.category);
      conditions.push(`i.category = $${params.length}`);
    }
    if (filters.from_date) {
      params.push(filters.from_date);
      conditions.push(`i.reported_at >= $${params.length}`);
    }
    if (filters.to_date) {
      params.push(filters.to_date);
      conditions.push(`i.reported_at <= $${params.length}`);
    }

    const where = conditions.join(" AND ");

    const result = await pool.query(
      `SELECT
         i.id, i.issue_number, i.title, i.category, i.status,
         i.severity, i.priority, i.address, i.reported_at,
         ST_Y(i.location::geometry) AS latitude,
         ST_X(i.location::geometry) AS longitude,
         COUNT(m.id)::int AS media_count
       FROM issues i
       LEFT JOIN issue_media m ON m.issue_id = i.id
       WHERE ${where}
       GROUP BY i.id
       ORDER BY i.reported_at DESC
       LIMIT 50`,
      params
    );

    return result.rows;
  } catch (err) {
    console.error("[issueService.getUserIssues]", err.message);
    throw err;
  }
};

// Maps status values to the timestamp column that should be set
const STATUS_TIMESTAMP_MAP = {
  verified:    "verified_at",
  assigned:    "assigned_at",
  in_progress: null,
  resolved:    "resolved_at",
  closed:      "closed_at",
};

/**
 * Update the status of an issue and optionally add an internal comment.
 *
 * @param {string} issueId
 * @param {string} status
 * @param {string} userId  - The admin performing the update
 * @param {string|null} notes
 * @returns {Promise<object>} Updated issue row
 */
const updateIssueStatus = async (issueId, status, userId, notes = null) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tsColumn = STATUS_TIMESTAMP_MAP[status];
    const tsClause = tsColumn ? `, ${tsColumn} = NOW()` : "";

    const result = await client.query(
      `UPDATE issues
       SET status=$1, updated_at=NOW() ${tsClause}
       WHERE id=$2
       RETURNING *,
         ST_Y(location::geometry) AS latitude,
         ST_X(location::geometry) AS longitude`,
      [status, issueId]
    );

    if (result.rows.length === 0) {
      throw Object.assign(new Error("Issue not found"), { statusCode: 404 });
    }

    // Add internal audit comment if notes provided
    if (notes) {
      await client.query(
        `INSERT INTO issue_comments (id, issue_id, user_id, comment, is_public)
         VALUES ($1,$2,$3,$4,FALSE)`,
        [uuidv4(), issueId, userId, `[Status → ${status}] ${notes}`]
      );
    }

    await client.query("COMMIT");
    return result.rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[issueService.updateIssueStatus]", err.message);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { createIssue, getIssueById, getUserIssues, updateIssueStatus };
