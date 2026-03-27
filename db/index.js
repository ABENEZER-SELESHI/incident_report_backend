// db/index.js
// db/index.js
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // ✅ use Render DB
  ssl: {
    rejectUnauthorized: false, // ✅ required for Render
  },
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error("Error connecting to PostgreSQL:", err.stack);
  }
  console.log("Connected to PostgreSQL database");
  release();
});

module.exports = pool;

// const { Pool } = require("pg");
// require("dotenv").config();

// const pool = new Pool({
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
// });

// pool.connect((err, client, release) => {
//   if (err) {
//     return console.error("Error connecting to PostgreSQL:", err.stack);
//   }
//   console.log("Connected to PostgreSQL database");
//   release();
// });

// module.exports = pool;
