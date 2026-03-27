// services/issueService.js
const pool = require("../db");
const { v4: uuidv4 } = require("uuid");
const { locateAdministrativeUnit } = require("./geospatialService");

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
    image_url = null,
  } = issueData;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const issueId = uuidv4();

    // ✅ NEW: get admin location
    const locationData = await locateAdministrativeUnit(latitude, longitude);

    if (!locationData.woreda) {
      throw new Error(
        "Your location is outside of Ethiopia or not mapped in our system. Please provide a more specific location or contact support.",
      );
    }

    const issueResult = await client.query(
      `INSERT INTO issues
       (id, title, description, category,
        latitude, longitude, address,
        status, source, reporter_id, image_url, votes,
        region_name, zone_name, woreda_name)
       VALUES
       ($1, $2, $3, $4,
        $5, $6, $7,
        'reported', $8, $9, $10, 0,
        $11, $12, $13)
       RETURNING *`,
      [
        issueId,
        title,
        description,
        category,
        latitude,
        longitude,
        address,
        source,
        reporter_id,
        image_url,
        locationData.region,
        locationData.zone,
        locationData.woreda,
      ],
    );

    const issue = issueResult.rows[0];

    if (media.length > 0) {
      for (const m of media) {
        await client.query(
          `INSERT INTO issue_media 
           (id, issue_id, media_url, media_type, is_primary, uploaded_by)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            uuidv4(),
            issueId,
            m.media_url,
            m.media_type,
            m.is_primary ?? false,
            reporter_id,
          ],
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
Toggle vote
 */
const voteIssue = async (issueId, userId) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT * FROM issue_votes WHERE issue_id=$1 AND user_id=$2`,
      [issueId, userId],
    );

    let message;

    if (existing.rows.length > 0) {
      // remove vote
      await client.query(
        `DELETE FROM issue_votes WHERE issue_id=$1 AND user_id=$2`,
        [issueId, userId],
      );

      await client.query(
        `UPDATE issues SET votes = votes - 1 WHERE id=$1 AND votes > 0`,
        [issueId],
      );

      message = "Vote removed";
    } else {
      // add vote
      await client.query(
        `INSERT INTO issue_votes (id, issue_id, user_id)
         VALUES ($1,$2,$3)`,
        [uuidv4(), issueId, userId],
      );

      await client.query(`UPDATE issues SET votes = votes + 1 WHERE id=$1`, [
        issueId,
      ]);

      message = "Voted successfully";
    }

    const updated = await client.query(`SELECT votes FROM issues WHERE id=$1`, [
      issueId,
    ]);

    await client.query("COMMIT");

    return {
      message,
      votes: updated.rows[0].votes,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[issueService.voteIssue]", err.message);
    throw err;
  } finally {
    client.release();
  }
};

const getIssueById = async (issueId) => {
  const result = await pool.query(`SELECT * FROM issues WHERE id=$1`, [
    issueId,
  ]);
  return result.rows[0] || null;
};

const getUserIssues = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM issues WHERE reporter_id=$1 ORDER BY reported_at DESC`,
    [userId],
  );
  return result.rows;
};

const updateIssueStatus = async (issueId, status) => {
  const result = await pool.query(
    `UPDATE issues SET status=$1 WHERE id=$2 RETURNING *`,
    [status, issueId],
  );
  return result.rows[0];
};

module.exports = {
  createIssue,
  voteIssue,
  getIssueById,
  getUserIssues,
  updateIssueStatus,
};
