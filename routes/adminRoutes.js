// routes/adminRoutes.js
const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const adminController = require("../controllers/adminController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

// GET /api/admin/dashboard — aggregate stats (woreda/zonal/regional admins)
router.get(
  "/dashboard",
  authenticate,
  authorize("woreda_admin", "zonal_admin", "regional_admin"),
  adminController.getDashboard,
);

// GET /api/admin/issues/pending — unactioned issues, ordered by urgency (woreda_admin only)
// Must be defined before /:id-style routes to avoid shadowing
router.get(
  "/issues/pending",
  authenticate,
  authorize("woreda_admin"),
  adminController.getPendingIssues,
);

// GET /api/admin/issues — paginated issue list with filters (woreda_admin only)
router.get(
  "/issues",
  authenticate,
  authorize("woreda_admin"),
  adminController.getIssues,
);

// POST /api/admin/issues/:id/assign — assign a technician to an issue (woreda_admin only)
router.post(
  "/issues/:id/assign",
  authenticate,
  authorize("federal_admin"),
  [body("technicianId").notEmpty().withMessage("technicianId is required")],
  adminController.assignTechnician,
);

// GET /api/admin/technicians — list technicians with workload (woreda_admin only)
router.get(
  "/technicians",
  authenticate,
  authorize("federal_admin"),
  adminController.getTechnicians,
);

module.exports = router;
