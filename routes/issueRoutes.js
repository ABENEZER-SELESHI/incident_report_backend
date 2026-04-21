// routes/issueRoutes.js
const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const issueController = require("../controllers/issueController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const upload = require("../middleware/uploadMiddleware");

/**
 * @swagger
 * /api/issues:
 *   post:
 *     summary: Create a new issue (with optional image upload)
 *     tags: [Issues]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - category
 *               - latitude
 *               - longitude
 *               - address
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Broken street light"
 *               description:
 *                 type: string
 *                 example: "Street light not working for 3 days"
 *               category:
 *                 type: string
 *                 example: "electricity"
 *               latitude:
 *                 type: number
 *                 example: 9.03
 *               longitude:
 *                 type: number
 *                 example: 38.7578
 *               address:
 *                 type: string
 *                 example: "Bole"
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file (jpg, png, etc.)
 *     responses:
 *       201:
 *         description: Issue created successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Issue reported successfully"
 *               data:
 *                 id: "fd41f2e4-4707-435b-bf32-8345cad3c835"
 *                 title: "Broken street light"
 *                 description: "Street light has been broken for a week days"
 *                 category: "electricity"
 *                 address: "Bole"
 *                 status: "reported"
 *                 image_url: "https://res.cloudinary.com/your-cloud/image/upload/sample.jpg"
 *                 latitude: 9.03
 *                 longitude: 38.7578
 *                 votes: 0
 *                 assigned_by: null
 *                 assigned_at: null
 *                 woreda_id: null
 *                 zone_id: null
 *                 region_id: null
 *                 region_name: "Addis Abeba"
 *                 zone_name: "Addis Abeba"
 *                 woreda_name: "Arada"
 *                 media: []
 */
router.post(
  "/",
  authenticate,
  upload.single("image"),
  issueController.createIssue,
);

// GET /api/issues/my-issues
/**
 * @swagger
 * /api/issues/my-issues:
 *   get:
 *     summary: Get issues reported by current user
 *     tags: [Issues]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user issues
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: "fd41f2e4-4707-435b-bf32-8345cad3c835"
 *                   issue_number: null
 *                   title: "Broken street light"
 *                   description: "Street light has been broken for a week days"
 *                   category: "electricity"
 *                   address: "Bole"
 *                   reporter_id: "cee5c2e5-130c-4e20-b22d-6a5fb8a240aa"
 *                   status: "reported"
 *                   priority: null
 *                   source: "citizen"
 *                   reported_at: "2026-03-31T23:17:27.898Z"
 *                   updated_at: "2026-03-31T23:17:27.898Z"
 *                   assigned_to: null
 *                   image_url: "https://res.cloudinary.com/example.jpg"
 *                   severity: null
 *                   latitude: 9.03
 *                   longitude: 38.7578
 *                   votes: 0
 *                   assigned_by: null
 *                   assigned_at: null
 *                   woreda_id: null
 *                   zone_id: null
 *                   region_id: null
 *                   region_name: "Addis Abeba"
 *                   zone_name: "Addis Abeba"
 *                   woreda_name: "Arada"
 */
router.get("/my-issues", authenticate, issueController.getUserIssues);

// GET /api/issues/search
/**
 * @swagger
 * /api/issues/search:
 *   get:
 *     summary: Search and filter issues
 *     tags: [Issues]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           example: pending
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           example: infrastructure
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Filtered issues
 *         content:
 *           application/json:
 *             example:
 *               page: 1
 *               totalPages: 3
 *               data:
 *                 - id: "650abc12345"
 *                   title: "Broken road"
 */
router.get("/search", authenticate, issueController.searchIssues);

// GET /api/issues/:id
/**
 * @swagger
 * /api/issues/{id}:
 *   get:
 *     summary: Get issue by ID
 *     tags: [Issues]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "fd41f2e4-4707-435b-bf32-8345cad3c835"
 *     responses:
 *       200:
 *         description: Issue details
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: "fd41f2e4-4707-435b-bf32-8345cad3c835"
 *                 issue_number: null
 *                 title: "Broken street light"
 *                 description: "Street light has been broken for a week days"
 *                 category: "electricity"
 *                 address: "Bole"
 *                 reporter_id: "cee5c2e5-130c-4e20-b22d-6a5fb8a240aa"
 *                 status: "reported"
 *                 priority: null
 *                 source: "citizen"
 *                 reported_at: "2026-03-31T23:17:27.898Z"
 *                 updated_at: "2026-03-31T23:17:27.898Z"
 *                 assigned_to: null
 *                 image_url: "https://res.cloudinary.com/example.jpg"
 *                 severity: null
 *                 latitude: 9.03
 *                 longitude: 38.7578
 *                 votes: 0
 *                 assigned_by: null
 *                 assigned_at: null
 *                 woreda_id: null
 *                 zone_id: null
 *                 region_id: null
 *                 region_name: "Addis Abeba"
 *                 zone_name: "Addis Abeba"
 *                 woreda_name: "Arada"
 */
router.get("/:id", authenticate, issueController.getIssue);

// // PATCH /api/issues/:id/status
// /**
//  * @swagger
//  * /api/issues/{id}/status:
//  *   patch:
//  *     summary: Update issue status
//  *     tags: [Issues]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: path
//  *         name: id
//  *         required: true
//  *         schema:
//  *           type: string
//  *           example: "650abc12345"
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           example:
//  *             status: "resolved"
//  *     responses:
//  *       200:
//  *         description: Status updated
//  *         content:
//  *           application/json:
//  *             example:
//  *               message: "Status updated successfully"
//  */
router.patch(
  "/:id/status",
  authenticate,
  authorize("woreda_admin", "zonal_admin", "regional_admin", "federal_admin"),
  issueController.updateIssueStatus,
);

// POST /api/issues/:id/vote
/**
 * @swagger
 * /api/issues/{id}/vote:
 *   post:
 *     summary: Vote or unvote an issue
 *     tags: [Issues]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           example: "650abc12345"
 *     responses:
 *       200:
 *         description: Vote updated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Voted successfully"
 *               votes: 12
 */
router.post("/:id/vote", authenticate, issueController.voteIssue);

module.exports = router;
