// routes/issueRoutes.js
const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const issueController = require("../controllers/issueController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const upload = require("../middleware/uploadMiddleware");

router.post(
  "/",
  authenticate,
  upload.single("image"),
  issueController.createIssue,
);

router.get("/my-issues", authenticate, issueController.getUserIssues);

router.get("/search", authenticate, issueController.searchIssues);

router.get("/:id", authenticate, issueController.getIssue);

router.patch(
  "/:id/status",
  authenticate,
  authorize("woreda_admin", "zonal_admin", "regional_admin", "federal_admin"),
  issueController.updateIssueStatus,
);

/**
 * ✅ NEW: Vote route
 */
router.post("/:id/vote", authenticate, issueController.voteIssue);

module.exports = router;
