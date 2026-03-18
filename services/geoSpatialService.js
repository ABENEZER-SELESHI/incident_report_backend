// services/geoSpatialService.js
//
// MVP VERSION — uses hardcoded bounding boxes and sample data.
// TODO: Replace bounding box logic with PostGIS ST_Contains queries
//       against the administrative_units table (see services/geospatialService.js
//       for the production implementation skeleton).

// ---------------------------------------------------------------------------
// Hardcoded woreda registry
// In production: query administrative_units WHERE unit_type='woreda'
// ---------------------------------------------------------------------------
const WOREDAS = {
  bole: {
    woreda_id:   "a1b2c3d4-0001-0001-0001-000000000001",
    woreda_name: "Bole Woreda",
    zone_id:     null, // TODO: populate from administrative_units hierarchy
    region_id:   null,
  },
  yeka: {
    woreda_id:   "a1b2c3d4-0002-0002-0002-000000000002",
    woreda_name: "Yeka Woreda",
    zone_id:     null,
    region_id:   null,
  },
  kirkos: {
    woreda_id:   "a1b2c3d4-0003-0003-0003-000000000003",
    woreda_name: "Kirkos Woreda",
    zone_id:     null,
    region_id:   null,
  },
};

// ---------------------------------------------------------------------------
// Bounding box definitions  [minLon, maxLon, minLat, maxLat]
// TODO: Replace with ST_Contains(boundary, ST_SetSRID(ST_MakePoint(lon,lat),4326))
// ---------------------------------------------------------------------------
const BOUNDING_BOXES = [
  { key: "bole",   minLon: 38.75, maxLon: 38.80, minLat: 8.98, maxLat: 9.02 },
  { key: "yeka",   minLon: 38.80, maxLon: 38.85, minLat: 9.02, maxLat: 9.06 },
  { key: "kirkos", minLon: 38.70, maxLon: 38.75, minLat: 9.00, maxLat: 9.04 },
];

/**
 * Resolve the administrative unit for a given coordinate pair.
 * MVP: simple bounding-box lookup against hardcoded woreda polygons.
 * Production: replace body with a PostGIS ST_Contains query.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<{ woreda_id: string, woreda_name: string, zone_id: null, region_id: null }>}
 */
const locateAdministrativeUnit = async (latitude, longitude) => {
  try {
    const match = BOUNDING_BOXES.find(
      (b) =>
        longitude >= b.minLon && longitude <= b.maxLon &&
        latitude  >= b.minLat && latitude  <= b.maxLat
    );

    // Default to Bole when coordinates fall outside all known boxes
    return WOREDAS[match ? match.key : "bole"];
  } catch (err) {
    console.error("[geoSpatialService.locateAdministrativeUnit]", err.message);
    throw err;
  }
};

/**
 * Return sample issues near the given coordinates.
 * MVP: returns hardcoded mock data regardless of actual radius.
 * Production: replace with ST_DWithin(location, ST_MakePoint(lon,lat)::geography, radiusMeters)
 *
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} [radiusMeters=1000]
 * @returns {Promise<object[]>}
 */
const getNearbyIssues = async (latitude, longitude, radiusMeters = 1000) => {
  try {
    // TODO: query issues WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($lon,$lat),4326)::geography, $radius)
    return [
      {
        id: "mock-issue-0001",
        issue_number: "CIT-2025-0001",
        title: "Pothole on Bole Road",
        category: "road",
        status: "reported",
        latitude: latitude + 0.001,
        longitude: longitude + 0.001,
        distance_meters: 120,
      },
      {
        id: "mock-issue-0002",
        issue_number: "CIT-2025-0002",
        title: "Broken street light near Edna Mall",
        category: "electricity",
        status: "in_progress",
        latitude: latitude - 0.002,
        longitude: longitude + 0.002,
        distance_meters: 310,
      },
      {
        id: "mock-issue-0003",
        issue_number: "CIT-2025-0003",
        title: "Blocked drainage on CMC Road",
        category: "drainage",
        status: "verified",
        latitude: latitude + 0.003,
        longitude: longitude - 0.001,
        distance_meters: 540,
      },
      {
        id: "mock-issue-0004",
        issue_number: "CIT-2025-0004",
        title: "Overflowing waste bin near Bole Medhanialem",
        category: "waste",
        status: "reported",
        latitude: latitude - 0.001,
        longitude: longitude - 0.003,
        distance_meters: 780,
      },
    ];
  } catch (err) {
    console.error("[geoSpatialService.getNearbyIssues]", err.message);
    throw err;
  }
};

/**
 * Look up a woreda by name (case-insensitive).
 * MVP: searches the hardcoded registry.
 * Production: query administrative_units WHERE LOWER(unit_name)=LOWER($1) AND unit_type='woreda'
 *
 * @param {string} woredaName
 * @returns {Promise<object|null>}
 */
const getWoredaFromName = async (woredaName) => {
  try {
    const key = Object.keys(WOREDAS).find((k) =>
      WOREDAS[k].woreda_name.toLowerCase() === woredaName.toLowerCase()
    );
    return key ? WOREDAS[key] : null;
  } catch (err) {
    console.error("[geoSpatialService.getWoredaFromName]", err.message);
    throw err;
  }
};

module.exports = { locateAdministrativeUnit, getNearbyIssues, getWoredaFromName };
