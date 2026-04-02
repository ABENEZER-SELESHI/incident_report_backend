// routes/adminRoutes.js
const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const adminController = require("../controllers/adminController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

// GET /api/admin/dashboard
/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get dashboard issue counts (scoped)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Issue counts
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 total: 120
 *                 pending: 35
 *                 in_progress: 20
 *                 completed: 65
 */
router.get(
  "/dashboard",
  authenticate,
  authorize(
    "woreda_admin",
    "city_admin",
    "zone_admin",
    "regional_admin",
    "federal_admin",
  ),
  adminController.getDashboardCounts,
);

// GET /api/admin/scoped-issues/pending
/**
 * @swagger
 * /api/admin/scoped-issues/pending:
 *   get:
 *     summary: Get pending issues scoped by admin level
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           description: Filter by issue category
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           description: Number of issues per page
 *     responses:
 *       200:
 *         description: List of pending issues scoped by admin clearance
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               issues:
 *                 - id: "c0ba5c65-5f6c-48a8-9ef0-a2741f907b5a"
 *                   title: "Broken street light"
 *                   category: "electricity"
 *                   status: "reported"
 *                   address: "Bole subcity, Addis Ababa"
 *                   reporter_name: "Abenezer Seleshi Abdisa"
 *               total: 1
 *               page: 1
 *               limit: 20
 */
router.get(
  "/scoped-issues/pending",
  authenticate,
  authorize(
    "woreda_admin",
    "city_admin",
    "zone_admin",
    "regional_admin",
    "federal_admin",
  ),
  adminController.getScopedPendingIssues,
);

// // GET /api/admin/issues
// router.get(
//   "/issues",
//   authenticate,
//   authorize("federal_admin"),
//   adminController.getIssues,
// );

//gET sCOPED Issues
/**
 * @swagger
 * /api/admin/scoped-issues:
 *   get:
 *     summary: Get issues scoped by admin level
 *     description: >
 *       Returns issues based on the admin's clearance level:
 *         - woreda_admin: issues in their woreda
 *         - city_admin: issues in their city
 *         - zone_admin: issues in their zone
 *         - regional_admin: issues in their region
 *         - federal_admin: all issues
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           description: Filter issues by status (e.g., reported, verified, assigned, in_progress, resolved)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           description: Filter issues by category (e.g., electricity, water)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           description: Number of issues per page
 *     responses:
 *       200:
 *         description: List of issues scoped by admin clearance
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               issues:
 *                 - id: "fd41f2e4-4707-435b-bf32-8345cad3c835"
 *                   issue_number: null
 *                   title: "Broken street light"
 *                   description: "Street light has been broken for a week days"
 *                   category: "electricity"
 *                   address: "Bole"
 *                   reporter_id: "cee5c2e5-130c-4e20-b22d-6a5fb8a240aa"
 *                   status: "resolved"
 *                   priority: null
 *                   source: "citizen"
 *                   reported_at: "2026-03-31T23:17:27.898Z"
 *                   updated_at: "2026-04-02T07:10:12.882Z"
 *                   assigned_to: "aeadf7a1-2beb-49b4-b740-d137db354cac"
 *                   image_url: "https://res.cloudinary.com/dxcfokog3/image/upload/v1774999047/issues/zfepltlv9kreu3oxyqxp.jpg"
 *                   severity: null
 *                   latitude: 9.03
 *                   longitude: 38.7578
 *                   votes: 1
 *                   assigned_by: "ed4a278a-4337-4846-a733-d3b9ea5fd366"
 *                   assigned_at: "2026-04-02T07:00:12.278Z"
 *                   woreda_id: null
 *                   zone_id: null
 *                   region_id: null
 *                   region_name: "Addis Abeba"
 *                   zone_name: "Addis Abeba"
 *                   woreda_name: "Arada"
 *                   reporter_name: "Abenezer Seleshi Abdisa"
 *               total: 4
 *               page: 1
 *               limit: 20
 *       400:
 *         description: Admin unit not assigned or invalid role
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "No admin unit assigned to this account"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: "Database error or unexpected exception"
 */
router.get(
  "/scoped-issues",
  authenticate,
  authorize(
    "woreda_admin",
    "city_admin",
    "zone_admin",
    "regional_admin",
    "federal_admin",
  ),
  adminController.getScopedIssues,
);

// POST /api/admin/issues/:id/assign
/**
 * @swagger
 * /api/admin/issues/{id}/assign:
 *   post:
 *     summary: Assign technician to issue
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "fd41f2e4-4707-435b-bf32-8345cad3c835"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - technicianId
 *             properties:
 *               technicianId:
 *                 type: string
 *                 example: "aeadf7a1-2beb-49b4-b740-d137db354cac"
 *     responses:
 *       200:
 *         description: Technician assigned successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Technician assigned"
 *               data:
 *                 id: "fd41f2e4-4707-435b-bf32-8345cad3c835"
 *                 title: "Broken street light"
 *                 description: "Street light has been broken for a week days"
 *                 category: "electricity"
 *                 address: "Bole"
 *                 status: "assigned"
 *                 assigned_to: "aeadf7a1-2beb-49b4-b740-d137db354cac"
 *                 assigned_by: "ed4a278a-4337-4846-a733-d3b9ea5fd366"
 *                 assigned_at: "2026-04-02T07:00:12.278Z"
 *                 image_url: "https://res.cloudinary.com/your-cloud/image/upload/sample.jpg"
 *                 latitude: 9.03
 *                 longitude: 38.7578
 *                 votes: 1
 */
router.post(
  "/issues/:id/assign",
  authenticate,
  authorize("federal_admin"),
  [body("technicianId").notEmpty().withMessage("technicianId is required")],
  adminController.assignTechnician,
);

// GET /api/admin/technicians
/**
 * @swagger
 * /api/admin/technicians:
 *   get:
 *     summary: Get all technicians with workload
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of technicians
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: "aeadf7a1-2beb-49b4-b740-d137db354cac"
 *                   full_name: "Field Officer"
 *                   phone: "+251922222224"
 *                   is_active: true
 *                   active_assignments: 0
 *                 - id: "c09ef32c-fe0c-476e-b788-a06e8f91d4c0"
 *                   full_name: "Field Officer"
 *                   phone: "+251922222222"
 *                   is_active: true
 *                   active_assignments: 0
 */
router.get(
  "/technicians",
  authenticate,
  authorize("federal_admin"),
  adminController.getTechnicians,
);

module.exports = router;
