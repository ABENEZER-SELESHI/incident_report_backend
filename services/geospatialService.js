// services/geospatialService.js
const pool = require("../db");

/**
 * Resolve the woreda, zone, and region that contain the given coordinates
 * by doing a PostGIS ST_Contains query against administrative_units boundaries.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<{ woreda_id: string|null, zone_id: string|null, region_id: string|null }>}
 */
const locateAdministrativeUnit = async (latitude, longitude) => {
  const result = await pool.query(
    `SELECT id, unit_type
     FROM administrative_units
     WHERE ST_Contains(
       boundary,
       ST_SetSRID(ST_MakePoint($1, $2), 4326)
     )
     AND unit_type IN ('woreda', 'zonal', 'regional')`,
    [longitude, latitude]
  );

  const units = { woreda_id: null, zone_id: null, region_id: null };

  for (const row of result.rows) {
    if (row.unit_type === "woreda")   units.woreda_id = row.id;
    if (row.unit_type === "zonal")    units.zone_id   = row.id;
    if (row.unit_type === "regional") units.region_id = row.id;
  }

  return units;
};

module.exports = { locateAdministrativeUnit };
