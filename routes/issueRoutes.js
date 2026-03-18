// routes/issueRoutes.js
const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const issueController = require("../controllers/issueController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const VALID_CATEGORIES = ["road", "water", "electricity", "waste", "drainage", "public_facility", "other"];
const VALID_STATUSES   = ["reported", "verified", "assigned", "in_progress", "resolved", "closed"];

// POST / — Report a new civic issue (any authenticated user)
router.post(
  "/",
  authenticate,
  [
    body("title")
      .notEmpty().withMessage("Title is required")
      .isLength({ max: 200 }).withMessage("Title must be 200 characters or fewer"),
    body("category")
      .isIn(VALID_CATEGORIES).withMessage(`Category must be one of: ${VALID_CATEGORIES.join(", ")}`),
    body("latitude")
      .isFloat({ min: -90, max: 90 }).withMessage("Latitude must be between -90 and 90"),
    body("longitude")
      .isFloat({ min: -180, max: 180 }).withMessage("Longitude must be between -180 and 180"),
  ],
  issueController.createIssue
);

// GET /my-issues — Get the current user's own reported issues
// Must be defined before /:id to avoid route shadowing
router.get("/my-issues", authenticate, issueController.getUserIssues);

// GET /search — Search/filter issues (woreda_admin auto-scoped to their unit)
router.get("/search", authenticate, issueController.searchIssues);

// GET /:id — Get a single issue (citizens can only view their own)
router.get("/:id", authenticate, issueController.getIssue);

// PATCH /:id/status — Update issue status (admin roles only)
router.patch(
  "/:id/status",
  authenticate,
  authorize("woreda_admin", "zonal_admin", "regional_admin", "federal_admin"),
  [
    body("status")
      .isIn(VALID_STATUSES).withMessage(`Status must be one of: ${VALID_STATUSES.join(", ")}`),
  ],
  issueController.updateIssueStatus
);

module.exports = router;
