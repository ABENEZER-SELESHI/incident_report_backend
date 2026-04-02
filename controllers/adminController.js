// controllers/adminController.js
const { validationResult } = require("express-validator");
const adminService = require("../services/adminService");

/**
 * GET /api/admin/issues/pending
 * Returns reported/verified issues ordered by urgency.
 */
const getPendingIssues = async (req, res) => {
  try {
    const woreda_id = req.user.admin_unit_id;
    if (!woreda_id) {
      return res.status(400).json({
        success: false,
        message: "No admin unit assigned to this account",
      });
    }

    const issues = await adminService.getPendingIssues(woreda_id);
    res.json({ success: true, data: issues });
  } catch (err) {
    console.error("[adminController.getPendingIssues]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/admin/issues
 * Paginated issue list with optional filters.
 */
const getIssues = async (req, res) => {
  try {
    const woreda_id = req.user.admin_unit_id;
    if (!woreda_id) {
      return res.status(400).json({
        success: false,
        message: "No admin unit assigned to this account",
      });
    }

    const result = await adminService.getIssuesByWoreda(woreda_id, req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[adminController.getIssues]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/admin/issues/:id/assign
 * Assign a technician to an issue.
 */
const assignTechnician = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, error: errors.array() });
  }

  try {
    const { technicianId } = req.body;
    const issue = await adminService.assignTechnician(
      req.params.id,
      technicianId,
      req.user.user_id,
    );

    res.json({ success: true, message: "Technician assigned", data: issue });
  } catch (err) {
    console.error("[adminController.assignTechnician]", err.message);
    const code = err.statusCode || 500;
    res.status(code).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/admin/technicians
 * List technicians in the admin's woreda with workload counts.
 */
const getTechnicians = async (req, res) => {
  try {
    const technicians = await adminService.getAllTechnicians();
    res.json({ success: true, data: technicians });
  } catch (err) {
    console.error("[adminController.getTechnicians]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getScopedIssues = async (req, res) => {
  try {
    const { role, admin_unit_id } = req.user;

    const result = await adminService.getScopedIssues(
      role,
      admin_unit_id,
      req.query,
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("[adminController.getScopedIssues]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getScopedPendingIssues = async (req, res) => {
  try {
    const { role, admin_unit_id } = req.user;

    if (!admin_unit_id && role !== "federal_admin") {
      return res.status(400).json({
        success: false,
        message: "No admin unit assigned to this account",
      });
    }

    const filters = { status: ["reported", "verified"] };

    const result = await adminService.getScopedIssues(
      role,
      admin_unit_id,
      filters,
    );

    res.json({
      success: true,
      issues: result.issues,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (err) {
    console.error("[adminController.getScopedPendingIssues]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

//get scoped issue counts for dashboard
const getTotalIssuesCount = async (req, res) => {
  try {
    const { role, admin_unit_id } = req.user;

    const counts = await adminService.getScopedIssueCounts(role, admin_unit_id);

    res.json({ success: true, total: counts.total });
  } catch (err) {
    console.error("[getTotalIssuesCount]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getPendingIssuesCount = async (req, res) => {
  try {
    const { role, admin_unit_id } = req.user;

    const counts = await adminService.getScopedIssueCounts(role, admin_unit_id);

    res.json({ success: true, pending: counts.pending });
  } catch (err) {
    console.error("[getPendingIssuesCount]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getInProgressIssuesCount = async (req, res) => {
  try {
    const { role, admin_unit_id } = req.user;

    const counts = await adminService.getScopedIssueCounts(role, admin_unit_id);

    res.json({ success: true, in_progress: counts.in_progress });
  } catch (err) {
    console.error("[getInProgressIssuesCount]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const getResolvedIssuesCount = async (req, res) => {
  try {
    const { role, admin_unit_id } = req.user;

    const counts = await adminService.getScopedIssueCounts(role, admin_unit_id);

    res.json({ success: true, resolved: counts.resolved });
  } catch (err) {
    console.error("[getResolvedIssuesCount]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// scoped dashboard stats controller
const getDashboardCounts = async (req, res) => {
  try {
    const { role, admin_unit_id } = req.user;

    if (!admin_unit_id && role !== "federal_admin") {
      return res.status(400).json({
        success: false,
        message: "No admin unit assigned",
      });
    }

    const counts = await adminService.getScopedDashboardCounts(
      role,
      admin_unit_id,
    );

    res.json({
      success: true,
      data: counts,
    });
  } catch (err) {
    console.error("[adminController.getDashboardCounts]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getDashboardCounts,
  getPendingIssues,
  getIssues,
  assignTechnician,
  getTechnicians,
  getScopedIssues,
  getScopedPendingIssues,
  getTotalIssuesCount,
  getPendingIssuesCount,
  getInProgressIssuesCount,
  getResolvedIssuesCount,
};
