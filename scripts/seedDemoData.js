// scripts/seedDemoData.js
// Run with: node scripts/seedDemoData.js
require("dotenv").config();
const pool = require("../db");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

// ---------------------------------------------------------------------------
// Hardcoded IDs so re-runs are idempotent
// ---------------------------------------------------------------------------
const IDS = {
  // Administrative units
  boleWoreda: "a1b2c3d4-0001-0001-0001-000000000001",

  // Users
  citizen:   "b0000000-0001-0001-0001-000000000001",
  admin:     "b0000000-0002-0002-0002-000000000002",
  tech:      "b0000000-0003-0003-0003-000000000003",
};

const ISSUES = [
  { title: "Large pothole on Bole Road near Atlas Hotel",        category: "road",             lat: 9.0105, lon: 38.7892, severity: "high",     priority: 8, status: "reported"    },
  { title: "Water pipe burst near Bole Medhanialem Church",      category: "water",            lat: 9.0050, lon: 38.7850, severity: "critical",  priority: 9, status: "verified"    },
  { title: "Street light out on Africa Avenue",                  category: "electricity",      lat: 9.0200, lon: 38.7950, severity: "medium",    priority: 5, status: "assigned"    },
  { title: "Overflowing waste bins near Edna Mall",              category: "waste",            lat: 9.0150, lon: 38.7920, severity: "medium",    priority: 4, status: "in_progress" },
  { title: "Blocked drainage causing flooding on CMC Road",      category: "drainage",         lat: 9.0300, lon: 38.8000, severity: "high",     priority: 7, status: "reported"    },
  { title: "Damaged public toilet at Bole Bus Terminal",         category: "public_facility",  lat: 9.0080, lon: 38.7870, severity: "medium",    priority: 5, status: "resolved"    },
  { title: "Road crack widening near Friendship Business Center",category: "road",             lat: 9.0120, lon: 38.7900, severity: "low",      priority: 3, status: "reported"    },
  { title: "No water supply in Bole Bulbula area for 3 days",    category: "water",            lat: 9.0060, lon: 38.7860, severity: "critical",  priority: 10,status: "verified"    },
  { title: "Fallen electricity pole on Cameroon Street",         category: "electricity",      lat: 9.0180, lon: 38.7940, severity: "critical",  priority: 9, status: "assigned"    },
  { title: "Illegal dumping site near Bole Airport Road",        category: "waste",            lat: 9.0250, lon: 38.7980, severity: "high",     priority: 6, status: "in_progress" },
  { title: "Broken sidewalk tiles on Bole Road",                 category: "road",             lat: 9.0090, lon: 38.7880, severity: "low",      priority: 2, status: "reported"    },
  { title: "Drainage overflow near Bole Arabsa",                 category: "drainage",         lat: 9.0350, lon: 38.8020, severity: "medium",    priority: 5, status: "reported"    },
];

const PLACEHOLDER_IMAGE = "https://placehold.co/800x600/png?text=CitiScope+Issue";

async function seed() {
  const client = await pool.connect();
  try {
    console.log("🌱 Starting CitiScope demo seed...\n");

    await client.query("BEGIN");

    // ------------------------------------------------------------------
    // 1. Clear existing demo data
    // ------------------------------------------------------------------
    await client.query(`
      TRUNCATE notifications, technician_assignments, issue_media,
               issue_comments, issues, otp_codes RESTART IDENTITY CASCADE
    `);
    // Remove only demo users (keep any real data by targeting known IDs)
    await client.query(
      `DELETE FROM users WHERE id IN ($1,$2,$3)`,
      [IDS.citizen, IDS.admin, IDS.tech]
    );
    console.log("🗑️  Cleared existing demo records");

    // ------------------------------------------------------------------
    // 2. Ensure Bole Woreda admin unit exists
    // ------------------------------------------------------------------
    await client.query(`
      INSERT INTO administrative_units (id, unit_code, unit_name, unit_type)
      VALUES ($1,'WRD-BOLE','Bole Woreda','woreda')
      ON CONFLICT (id) DO NOTHING
    `, [IDS.boleWoreda]);

    // ------------------------------------------------------------------
    // 3. Create demo users
    // ------------------------------------------------------------------
    const hash = await bcrypt.hash("password123", 10);

    await client.query(
      `INSERT INTO users (id, phone, full_name, password_hash, role, is_verified, is_active)
       VALUES ($1,'+251911111111','Abebe Girma',$2,'citizen',TRUE,TRUE)`,
      [IDS.citizen, hash]
    );

    await client.query(
      `INSERT INTO users (id, phone, full_name, password_hash, role, is_verified, is_active, admin_unit_id)
       VALUES ($1,'+251922222222','Tigist Haile',$2,'woreda_admin',TRUE,TRUE,$3)`,
      [IDS.admin, hash, IDS.boleWoreda]
    );

    await client.query(
      `INSERT INTO users (id, phone, full_name, password_hash, role, is_verified, is_active, admin_unit_id)
       VALUES ($1,'+251933333333','Dawit Bekele',$2,'technician',TRUE,TRUE,$3)`,
      [IDS.tech, hash, IDS.boleWoreda]
    );

    console.log("👤 Created 3 demo users");

    // ------------------------------------------------------------------
    // 4. Create sample issues
    // ------------------------------------------------------------------
    const issueIds = [];

    for (const issue of ISSUES) {
      const id = uuidv4();
      issueIds.push({ id, status: issue.status });

      await client.query(
        `INSERT INTO issues
           (id, title, category, location, address, woreda_id,
            status, priority, severity, source, reporter_id)
         VALUES
           ($1,$2,$3,
            ST_SetSRID(ST_MakePoint($4,$5),4326),
            $6,$7,$8,$9,$10,'citizen',$11)`,
        [
          id, issue.title, issue.category,
          issue.lon, issue.lat,
          issue.title.substring(0, 80),   // use title snippet as address placeholder
          IDS.boleWoreda,
          issue.status, issue.priority, issue.severity,
          IDS.citizen,
        ]
      );

      // Attach a placeholder image to each issue
      await client.query(
        `INSERT INTO issue_media (id, issue_id, media_url, media_type, is_primary, uploaded_by)
         VALUES ($1,$2,$3,'image',TRUE,$4)`,
        [uuidv4(), id, PLACEHOLDER_IMAGE, IDS.citizen]
      );
    }

    console.log(`📋 Created ${ISSUES.length} sample issues with media`);

    // ------------------------------------------------------------------
    // 5. Create technician assignments for assigned/in_progress issues
    // ------------------------------------------------------------------
    const assignableStatuses = ["assigned", "in_progress"];
    const assignableIssues = issueIds.filter((i) => assignableStatuses.includes(i.status));
    let assignmentCount = 0;

    for (const issue of assignableIssues) {
      const assignStatus = issue.status === "in_progress" ? "in_progress" : "accepted";

      await client.query(
        `INSERT INTO technician_assignments
           (id, issue_id, technician_id, assigned_by, priority, status, accepted_at)
         VALUES ($1,$2,$3,$4,'high',$5, CASE WHEN $5 != 'pending' THEN NOW() ELSE NULL END)`,
        [uuidv4(), issue.id, IDS.tech, IDS.admin, assignStatus]
      );
      assignmentCount++;
    }

    console.log(`🔧 Created ${assignmentCount} technician assignments`);

    // ------------------------------------------------------------------
    // 6. Create sample notifications
    // ------------------------------------------------------------------
    const notifData = [
      { userId: IDS.citizen, type: "issue_update", title: "Issue Received",    body: "Your report has been received and is under review." },
      { userId: IDS.citizen, type: "issue_update", title: "Issue Verified",    body: "Your water pipe report has been verified by the woreda admin." },
      { userId: IDS.tech,    type: "assignment",   title: "New Assignment",    body: "You have been assigned to fix the street light on Africa Avenue." },
      { userId: IDS.admin,   type: "alert",        title: "Critical Issue",    body: "A critical water supply issue has been reported in Bole Bulbula." },
      { userId: IDS.tech,    type: "deadline",     title: "Deadline Reminder", body: "Your assignment deadline is approaching in 24 hours." },
    ];

    for (const n of notifData) {
      await client.query(
        `INSERT INTO notifications (id, user_id, type, title, body, status, sent_at)
         VALUES ($1,$2,$3,$4,$5,'sent',NOW())`,
        [uuidv4(), n.userId, n.type, n.title, n.body]
      );
    }

    console.log(`🔔 Created ${notifData.length} sample notifications`);

    await client.query("COMMIT");

    // ------------------------------------------------------------------
    // 7. Summary
    // ------------------------------------------------------------------
    console.log(`
✅ Demo seed complete!

Test credentials (all passwords: password123)
─────────────────────────────────────────────
  Citizen       +251911111111  role: citizen
  Woreda Admin  +251922222222  role: woreda_admin
  Technician    +251933333333  role: technician
`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
