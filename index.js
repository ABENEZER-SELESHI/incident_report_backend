// index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Allow all origins (quick fix)
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

const app = express();

// Swagger setup
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const authRoutes = require("./routes/authRoutes");
const issueRoutes = require("./routes/issueRoutes");
const adminRoutes = require("./routes/adminRoutes");
const technicianRoutes = require("./routes/technicianRoutes");

app.use("/auth", authRoutes);
app.use("/issues", issueRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/technician", technicianRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check route
app.get("/", (req, res) => {
  res.send("Incident Reporting API is running 🚀");
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
