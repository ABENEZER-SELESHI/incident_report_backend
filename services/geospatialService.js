// services/geospatialService.js
const pool = require("../db");

const locateAdministrativeUnit = async (latitude, longitude) => {
  const result = await pool.query(
    `
    SELECT region_name, zone_name, woreda_name
    FROM administrative_boundaries
    WHERE ST_Intersects(
      geom,
      ST_SetSRID(ST_MakePoint($1, $2), 4326)
    )
    LIMIT 1;
    `,
    [longitude, latitude], // ✅ correct order
  );

  if (result.rows.length === 0) {
    return {
      region: null,
      zone: null,
      woreda: null,
    };
  }

  const row = result.rows[0];

  return {
    region: row.region_name,
    zone: row.zone_name,
    woreda: row.woreda_name,
  };
};

module.exports = { locateAdministrativeUnit };
