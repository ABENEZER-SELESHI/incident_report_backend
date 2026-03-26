// routes/technicianRoutes.js
const express = require("express");
const router = express.Router();

const technicianController = require("../controllers/technicianController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

// All tasks
router.get(
  "/tasks",
  authenticate,
  authorize("technician"),
  technicianController.getAllTasks,
);

// Unfinished tasks
router.get(
  "/tasks/unfinished",
  authenticate,
  authorize("technician"),
  technicianController.getUnfinishedTasks,
);

// Finished tasks
router.get(
  "/tasks/finished",
  authenticate,
  authorize("technician"),
  technicianController.getFinishedTasks,
);

// workflow routes
router.post(
  "/tasks/:id/accept",
  authenticate,
  authorize("technician"),
  technicianController.acceptTask,
);
router.post(
  "/tasks/:id/start",
  authenticate,
  authorize("technician"),
  technicianController.startTask,
);
router.post(
  "/tasks/:id/complete",
  authenticate,
  authorize("technician"),
  technicianController.completeTask,
);

module.exports = router;
