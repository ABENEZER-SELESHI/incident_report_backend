// config/swagger.js
const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Incident Reporting API",
      version: "1.0.0",
      description: "API documentation for Incident Reporting System",
    },
    servers: [
      {
        url: "http://localhost:3000",
        url: "https://incident-report-backend-cyep.onrender.com/",
      },
    ],
  },
  apis: ["./routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
