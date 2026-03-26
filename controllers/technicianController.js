// controllers/technicianController.js
const technicianService = require("../services/technicianService");

/**
 * GET /api/technician/tasks
 */
const getAllTasks = async (req, res) => {
  try {
    const technicianId = req.user.user_id;

    const tasks = await technicianService.getAllAssignments(technicianId);
    res.json({ success: true, data: tasks });
  } catch (err) {
    console.error("[technicianController.getAllTasks]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/technician/tasks/unfinished
 */
const getUnfinishedTasks = async (req, res) => {
  try {
    const technicianId = req.user.user_id;

    const tasks =
      await technicianService.getUnfinishedAssignments(technicianId);
    res.json({ success: true, data: tasks });
  } catch (err) {
    console.error("[technicianController.getUnfinishedTasks]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/technician/tasks/finished
 */
const getFinishedTasks = async (req, res) => {
  try {
    const technicianId = req.user.user_id;

    const tasks = await technicianService.getFinishedAssignments(technicianId);
    res.json({ success: true, data: tasks });
  } catch (err) {
    console.error("[technicianController.getFinishedTasks]", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

const acceptTask = async (req, res) => {
  try {
    const technicianId = req.user.user_id;
    const { id } = req.params;

    const task = await technicianService.updateTaskStatus(
      id,
      technicianId,
      "accepted",
    );

    res.json({ success: true, data: task });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

const startTask = async (req, res) => {
  try {
    const technicianId = req.user.user_id;
    const { id } = req.params;

    const task = await technicianService.updateTaskStatus(
      id,
      technicianId,
      "in_progress",
    );

    res.json({ success: true, data: task });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

const completeTask = async (req, res) => {
  try {
    const technicianId = req.user.user_id;
    const { id } = req.params;

    const task = await technicianService.updateTaskStatus(
      id,
      technicianId,
      "completed",
    );

    res.json({ success: true, data: task });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

module.exports = {
  getAllTasks,
  getUnfinishedTasks,
  getFinishedTasks,
  acceptTask,
  startTask,
  completeTask,
};
