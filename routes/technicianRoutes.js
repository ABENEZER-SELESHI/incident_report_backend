// routes/technicianRoutes.js
const express = require("express");
const router = express.Router();

const technicianController = require("../controllers/technicianController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

// All tasks
// GET /api/technician/tasks
/**
 * @swagger
 * /api/technician/tasks:
 *   get:
 *     summary: Get all assigned tasks
 *     tags: [Technician]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of assigned tasks
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: "6db2936e-4208-4d87-9d55-a6045aa8b815"
 *                   status: "completed"
 *                   deadline: null
 *                   created_at: "2026-03-21T23:26:57.624Z"
 *                   issue_id: "20b13192-cb15-4da8-9337-a076b079ef81"
 *                   issue_number: null
 *                   title: "Broken street light"
 *                   category: "electricity"
 *                   description: "Street light has been out for 2 days"
 *                   address: "Bole subcity, Addis Ababa"
 *                   severity: null
 *                   issue_priority: null
 */
router.get(
  "/tasks",
  authenticate,
  authorize("technician"),
  technicianController.getAllTasks,
);

// Unfinished tasks
/**
 * @swagger
 * /api/technician/tasks/unfinished:
 *   get:
 *     summary: Get unfinished tasks
 *     tags: [Technician]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of unfinished tasks
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: "62b47aae-6fa0-4d8a-a8d4-da496dcc28ab"
 *                   status: "pending"
 *                   deadline: null
 *                   created_at: "2026-04-02T07:00:12.278Z"
 *                   issue_number: null
 *                   title: "Broken street light"
 *                   category: "electricity"
 *                   address: "Bole"
 *                   issue_priority: null
 */
router.get(
  "/tasks/unfinished",
  authenticate,
  authorize("technician"),
  technicianController.getUnfinishedTasks,
);

// Finished tasks
/**
 * @swagger
 * /api/technician/tasks/finished:
 *   get:
 *     summary: Get completed tasks
 *     tags: [Technician]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of completed tasks
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - id: "6db2936e-4208-4d87-9d55-a6045aa8b815"
 *                   status: "completed"
 *                   completed_at: "2026-03-26T00:12:24.799Z"
 *                   issue_number: null
 *                   title: "Broken street light"
 *                   category: "electricity"
 *                   address: "Bole subcity, Addis Ababa"
 *                   issue_priority: null
 */
router.get(
  "/tasks/finished",
  authenticate,
  authorize("technician"),
  technicianController.getFinishedTasks,
);

// workflow routes
/**
 * @swagger
 * /api/technician/tasks/{id}/accept:
 *   post:
 *     summary: Accept a task
 *     tags: [Technician]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "62b47aae-6fa0-4d8a-a8d4-da496dcc28ab"
 *     responses:
 *       200:
 *         description: Task accepted successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: "62b47aae-6fa0-4d8a-a8d4-da496dcc28ab"
 *                 issue_id: "fd41f2e4-4707-435b-bf32-8345cad3c835"
 *                 technician_id: "aeadf7a1-2beb-49b4-b740-d137db354cac"
 *                 assigned_by: "ed4a278a-4337-4846-a733-d3b9ea5fd366"
 *                 status: "accepted"
 *                 deadline: null
 *                 created_at: "2026-04-02T07:00:12.278Z"
 *                 updated_at: "2026-04-02T07:00:12.278Z"
 *                 accepted_at: "2026-04-02T07:07:19.356Z"
 *                 started_at: null
 *                 completed_at: null
 */
router.post(
  "/tasks/:id/accept",
  authenticate,
  authorize("technician"),
  technicianController.acceptTask,
);

// POST /api/technician/tasks/:id/start
/**
 * @swagger
 * /api/technician/tasks/{id}/start:
 *   post:
 *     summary: Start a task
 *     tags: [Technician]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "62b47aae-6fa0-4d8a-a8d4-da496dcc28ab"
 *     responses:
 *       200:
 *         description: Task started successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: "62b47aae-6fa0-4d8a-a8d4-da496dcc28ab"
 *                 issue_id: "fd41f2e4-4707-435b-bf32-8345cad3c835"
 *                 technician_id: "aeadf7a1-2beb-49b4-b740-d137db354cac"
 *                 assigned_by: "ed4a278a-4337-4846-a733-d3b9ea5fd366"
 *                 status: "in_progress"
 *                 deadline: null
 *                 created_at: "2026-04-02T07:00:12.278Z"
 *                 updated_at: "2026-04-02T07:00:12.278Z"
 *                 accepted_at: "2026-04-02T07:07:19.356Z"
 *                 started_at: "2026-04-02T07:09:34.572Z"
 *                 completed_at: null
 */
router.post(
  "/tasks/:id/start",
  authenticate,
  authorize("technician"),
  technicianController.startTask,
);

// POST /api/technician/tasks/:id/complete
/**
 * @swagger
 * /api/technician/tasks/{id}/complete:
 *   post:
 *     summary: Complete a task
 *     tags: [Technician]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: "62b47aae-6fa0-4d8a-a8d4-da496dcc28ab"
 *     responses:
 *       200:
 *         description: Task completed successfully
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 id: "62b47aae-6fa0-4d8a-a8d4-da496dcc28ab"
 *                 issue_id: "fd41f2e4-4707-435b-bf32-8345cad3c835"
 *                 technician_id: "aeadf7a1-2beb-49b4-b740-d137db354cac"
 *                 assigned_by: "ed4a278a-4337-4846-a733-d3b9ea5fd366"
 *                 status: "completed"
 *                 deadline: null
 *                 created_at: "2026-04-02T07:00:12.278Z"
 *                 updated_at: "2026-04-02T07:00:12.278Z"
 *                 accepted_at: "2026-04-02T07:07:19.356Z"
 *                 started_at: "2026-04-02T07:09:34.572Z"
 *                 completed_at: "2026-04-02T07:10:12.879Z"
 */
router.post(
  "/tasks/:id/complete",
  authenticate,
  authorize("technician"),
  technicianController.completeTask,
);

module.exports = router;
