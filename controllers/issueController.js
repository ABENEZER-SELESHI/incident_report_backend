// controllers/issueController.js
const { validationResult } = require("express-validator");
const pool = require("../db");
const issueService = require("../services/issueService");
const { uploadToCloudinary } = require("../services/cloudinaryService");

const ADMIN_ROLES = [
  "woreda_admin",
  "zonal_admin",
  "regional_admin",
  "federal_admin",
];

const createIssue = async (req, res) => {
  console.log("BODY:", req.body);
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, error: errors.array() });
  }

  try {
    let image_url = null;

    if (req.file) {
      image_url = await uploadToCloudinary(req.file.buffer, "issues");
    }

    const issue = await issueService.createIssue({
      ...req.body,
      reporter_id: req.user.user_id,
      image_url,
    });

    res.status(201).json({
      success: true,
      message: "Issue reported successfully",
      data: issue,
    });
  } catch (err) {
    console.error("[issueController.createIssue]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getIssue = async (req, res) => {
  try {
    const issue = await issueService.getIssueById(req.params.id);

    if (!issue) {
      return res
        .status(404)
        .json({ success: false, message: "Issue not found" });
    }

    const { role, user_id } = req.user;
    if (role === "citizen" && issue.reporter_id !== user_id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    res.json({ success: true, data: issue });
  } catch (err) {
    console.error("[issueController.getIssue]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getUserIssues = async (req, res) => {
  try {
    const issues = await issueService.getUserIssues(
      req.user.user_id,
      req.query,
    );
    res.json({ success: true, data: issues });
  } catch (err) {
    console.error("[issueController.getUserIssues]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const updateIssueStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, error: errors.array() });
  }

  try {
    const { status, notes } = req.body;
    const issue = await issueService.updateIssueStatus(
      req.params.id,
      status,
      req.user.user_id,
      notes,
    );

    res.json({ success: true, message: "Status updated", data: issue });
  } catch (err) {
    console.error("[issueController.updateIssueStatus]", err.message);
    const code = err.statusCode || 500;
    res.status(code).json({ success: false, error: err.message });
  }
};

/**
 * ✅ NEW: Vote on an issue (toggle vote)
 */
const voteIssue = async (req, res) => {
  try {
    const result = await issueService.voteIssue(
      req.params.id,
      req.user.user_id,
    );

    res.json({
      success: true,
      message: result.message,
      votes: result.votes,
    });
  } catch (err) {
    console.error("[issueController.voteIssue]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const searchIssues = async (req, res) => {
  try {
    const { role, user_id, admin_unit_id } = req.user;
    const {
      woreda_id,
      status,
      category,
      priority,
      from_date,
      to_date,
      page = 1,
      limit = 20,
    } = req.query;

    const params = [];
    const conditions = [];

    if (role === "woreda_admin") {
      params.push(admin_unit_id);
      conditions.push(`i.woreda_id = $${params.length}`);
    } else if (woreda_id) {
      params.push(woreda_id);
      conditions.push(`i.woreda_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`i.status = $${params.length}`);
    }
    if (category) {
      params.push(category);
      conditions.push(`i.category = $${params.length}`);
    }
    if (priority) {
      params.push(Number(priority));
      conditions.push(`i.priority = $${params.length}`);
    }
    if (from_date) {
      params.push(from_date);
      conditions.push(`i.reported_at >= $${params.length}`);
    }
    if (to_date) {
      params.push(to_date);
      conditions.push(`i.reported_at <= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    params.push(Number(limit), offset);

    const result = await pool.query(
      `SELECT
         i.*,
         u.full_name AS reporter_name,
         COUNT(m.id)::int AS media_count
       FROM issues i
       JOIN users u ON u.id = i.reporter_id
       LEFT JOIN issue_media m ON m.issue_id = i.id
       ${where}
       GROUP BY i.id, u.full_name
       ORDER BY i.reported_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { page: Number(page), limit: Number(limit) },
    });
  } catch (err) {
    console.error("[issueController.searchIssues]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  createIssue,
  getIssue,
  getUserIssues,
  updateIssueStatus,
  searchIssues,
  voteIssue, // ✅ added
};
