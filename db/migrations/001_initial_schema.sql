-- =============================================================================
-- CitiScope: National Civic Issue Reporting Platform (Ethiopia)
-- Migration: 001_initial_schema.sql
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =============================================================================
-- HELPER: updated_at trigger function (shared across all tables)
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TABLE: administrative_units
-- Hierarchical structure: federal > regional > zonal > woreda
-- Uses PostGIS MULTIPOLYGON for geographic boundaries
-- =============================================================================
CREATE TABLE administrative_units (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_code    VARCHAR(20)  NOT NULL UNIQUE,          -- e.g. WRD001, ZON005
  unit_name    VARCHAR(255) NOT NULL,                 -- e.g. "Bole Woreda"
  unit_type    VARCHAR(20)  NOT NULL,                 -- federal|regional|zonal|woreda
  parent_id    UUID REFERENCES administrative_units(id) ON DELETE SET NULL,
  boundary     GEOMETRY(MULTIPOLYGON, 4326),          -- WGS84 geographic boundary
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_unit_type CHECK (unit_type IN ('federal', 'regional', 'zonal', 'woreda'))
);

COMMENT ON TABLE administrative_units IS
  'Hierarchical administrative divisions: federal → regional → zonal → woreda. '
  'parent_id is NULL for the federal root. boundary stores the geographic polygon.';

CREATE INDEX idx_admin_units_parent     ON administrative_units(parent_id);
CREATE INDEX idx_admin_units_unit_type  ON administrative_units(unit_type);
CREATE INDEX idx_admin_units_boundary   ON administrative_units USING GIST(boundary);

CREATE TRIGGER trg_admin_units_updated_at
  BEFORE UPDATE ON administrative_units
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- TABLE: users
-- Citizens, admins (woreda/zonal/regional/federal), and technicians.
-- Phone is the primary identifier; +251 Ethiopian format enforced.
-- =============================================================================
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone             VARCHAR(20)  NOT NULL UNIQUE,
  email             VARCHAR(255) UNIQUE,
  password_hash     VARCHAR(255),                     -- nullable for OTP-only users
  full_name         VARCHAR(255),
  role              VARCHAR(20)  NOT NULL DEFAULT 'citizen',
  language          VARCHAR(5)   NOT NULL DEFAULT 'en',
  national_id_photo VARCHAR(500),                     -- URL to uploaded photo
  is_verified       BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login        TIMESTAMPTZ,
  admin_unit_id     UUID REFERENCES administrative_units(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_user_role     CHECK (role IN ('citizen', 'woreda_admin', 'zonal_admin', 'regional_admin', 'federal_admin', 'technician')),
  CONSTRAINT chk_user_language CHECK (language IN ('en', 'am', 'om')),
  -- Ethiopian phone: +251 followed by 9 digits
  CONSTRAINT chk_phone_format  CHECK (phone ~ '^\+251[0-9]{9}$')
);

COMMENT ON TABLE users IS
  'All platform users. Citizens self-register via OTP. Admins and technicians are '
  'provisioned by higher-level admins. admin_unit_id scopes admins/technicians to '
  'their administrative unit.';

CREATE INDEX idx_users_phone         ON users(phone);
CREATE INDEX idx_users_role          ON users(role);
CREATE INDEX idx_users_admin_unit_id ON users(admin_unit_id);
CREATE INDEX idx_users_is_active     ON users(is_active);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- SEQUENCE + FUNCTION: auto-generate issue_number like "CIT-2025-0001"
-- =============================================================================
CREATE SEQUENCE issue_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_issue_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.issue_number := 'CIT-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                      LPAD(NEXTVAL('issue_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TABLE: issues
-- Core entity. Location stored as PostGIS POINT (WGS84).
-- Linked to woreda/zone/region admin units for routing.
-- =============================================================================
CREATE TABLE issues (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_number     VARCHAR(20)  NOT NULL UNIQUE,       -- CIT-YYYY-NNNN, auto-generated
  title            VARCHAR(500) NOT NULL,
  description      TEXT,
  category         VARCHAR(20)  NOT NULL,
  location         GEOMETRY(POINT, 4326),              -- GPS coordinates (lon, lat)
  address          TEXT,
  woreda_id        UUID REFERENCES administrative_units(id) ON DELETE SET NULL,
  zone_id          UUID REFERENCES administrative_units(id) ON DELETE SET NULL,
  region_id        UUID REFERENCES administrative_units(id) ON DELETE SET NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'reported',
  priority         SMALLINT     NOT NULL DEFAULT 5,    -- 1 (lowest) to 10 (highest)
  severity         VARCHAR(10)  NOT NULL DEFAULT 'medium',
  source           VARCHAR(20)  NOT NULL DEFAULT 'citizen',
  reporter_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  ai_category      VARCHAR(50),                        -- ML-predicted category
  ai_confidence    NUMERIC(5,4),                       -- 0.0000 – 1.0000
  reported_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  verified_at      TIMESTAMPTZ,
  assigned_at      TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  closed_at        TIMESTAMPTZ,
  assigned_to      UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_issue_category CHECK (category IN ('road', 'water', 'electricity', 'waste', 'drainage', 'public_facility', 'other')),
  CONSTRAINT chk_issue_status   CHECK (status   IN ('reported', 'verified', 'assigned', 'in_progress', 'resolved', 'closed')),
  CONSTRAINT chk_issue_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT chk_issue_source   CHECK (source   IN ('citizen', 'iot_sensor', 'admin')),
  CONSTRAINT chk_issue_priority CHECK (priority BETWEEN 1 AND 10),
  CONSTRAINT chk_ai_confidence  CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1))
);

COMMENT ON TABLE issues IS
  'Civic issues reported by citizens or ingested from IoT sensors/admins. '
  'location is a PostGIS POINT used for spatial queries and woreda routing. '
  'issue_number is auto-generated by trigger on INSERT.';

-- Auto-generate issue_number before insert
CREATE TRIGGER trg_issues_issue_number
  BEFORE INSERT ON issues
  FOR EACH ROW EXECUTE FUNCTION generate_issue_number();

CREATE TRIGGER trg_issues_updated_at
  BEFORE UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_issues_status      ON issues(status);
CREATE INDEX idx_issues_category    ON issues(category);
CREATE INDEX idx_issues_reporter_id ON issues(reporter_id);
CREATE INDEX idx_issues_woreda_id   ON issues(woreda_id);
CREATE INDEX idx_issues_zone_id     ON issues(zone_id);
CREATE INDEX idx_issues_region_id   ON issues(region_id);
CREATE INDEX idx_issues_assigned_to ON issues(assigned_to);
CREATE INDEX idx_issues_reported_at ON issues(reported_at DESC);
CREATE INDEX idx_issues_severity    ON issues(severity);
CREATE INDEX idx_issues_location    ON issues USING GIST(location);  -- spatial index

-- =============================================================================
-- TABLE: issue_media
-- Photos, videos, or documents attached to an issue.
-- =============================================================================
CREATE TABLE issue_media (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id    UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  media_url   VARCHAR(500) NOT NULL,
  media_type  VARCHAR(10)  NOT NULL,
  is_primary  BOOLEAN      NOT NULL DEFAULT FALSE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  uploaded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_media_type CHECK (media_type IN ('image', 'video', 'document'))
);

COMMENT ON TABLE issue_media IS
  'Media attachments for issues. is_primary flags the main display image. '
  'Deleted automatically when the parent issue is deleted (CASCADE).';

CREATE INDEX idx_issue_media_issue_id ON issue_media(issue_id);
CREATE INDEX idx_issue_media_type     ON issue_media(media_type);

-- =============================================================================
-- TABLE: issue_comments
-- Public or internal comments on an issue thread.
-- =============================================================================
CREATE TABLE issue_comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id   UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  comment    TEXT NOT NULL,
  is_public  BOOLEAN     NOT NULL DEFAULT TRUE,  -- FALSE = internal admin note
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE issue_comments IS
  'Comments on issues. is_public=TRUE is visible to the reporter; '
  'is_public=FALSE is an internal admin/technician note.';

CREATE INDEX idx_issue_comments_issue_id  ON issue_comments(issue_id);
CREATE INDEX idx_issue_comments_user_id   ON issue_comments(user_id);
CREATE INDEX idx_issue_comments_is_public ON issue_comments(is_public);

-- =============================================================================
-- TABLE: technician_assignments
-- Tracks assignment of a technician to an issue, including lifecycle status.
-- =============================================================================
CREATE TABLE technician_assignments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id      UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_by   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  priority      VARCHAR(10)  NOT NULL DEFAULT 'medium',
  deadline      TIMESTAMPTZ,
  status        VARCHAR(15)  NOT NULL DEFAULT 'pending',
  accepted_at   TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_assignment_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT chk_assignment_status   CHECK (status   IN ('pending', 'accepted', 'declined', 'in_progress', 'completed'))
);

COMMENT ON TABLE technician_assignments IS
  'Woreda admins assign technicians to issues. A single issue may have multiple '
  'assignment records (e.g. reassignment after decline). Status tracks the '
  'technician lifecycle from pending acceptance through completion.';

CREATE INDEX idx_tech_assign_issue_id      ON technician_assignments(issue_id);
CREATE INDEX idx_tech_assign_technician_id ON technician_assignments(technician_id);
CREATE INDEX idx_tech_assign_status        ON technician_assignments(status);
CREATE INDEX idx_tech_assign_deadline      ON technician_assignments(deadline);

-- =============================================================================
-- TABLE: notifications
-- In-app / push notifications for users.
-- =============================================================================
CREATE TABLE notifications (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           VARCHAR(20)  NOT NULL,
  title          VARCHAR(255) NOT NULL,
  body           TEXT         NOT NULL,
  reference_type VARCHAR(50),   -- e.g. 'issue', 'assignment'
  reference_id   UUID,          -- FK-like pointer (polymorphic, no hard FK)
  priority       VARCHAR(10)  NOT NULL DEFAULT 'medium',
  status         VARCHAR(15)  NOT NULL DEFAULT 'pending',
  sent_at        TIMESTAMPTZ,
  delivered_at   TIMESTAMPTZ,
  read_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_notif_type     CHECK (type     IN ('issue_update', 'assignment', 'deadline', 'alert')),
  CONSTRAINT chk_notif_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT chk_notif_status   CHECK (status   IN ('pending', 'sent', 'delivered', 'read'))
);

COMMENT ON TABLE notifications IS
  'Notifications dispatched to users for issue updates, assignments, deadlines, '
  'and system alerts. reference_type/reference_id provide a polymorphic link to '
  'the source entity without a hard foreign key constraint.';

CREATE INDEX idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX idx_notifications_status     ON notifications(status);
CREATE INDEX idx_notifications_type       ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- =============================================================================
-- TABLE: otp_codes
-- Short-lived OTP codes for signup, login, and password reset.
-- =============================================================================
CREATE TABLE otp_codes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone      VARCHAR(20)  NOT NULL,
  code       CHAR(6)      NOT NULL,
  purpose    VARCHAR(20)  NOT NULL DEFAULT 'login',
  expires_at TIMESTAMPTZ  NOT NULL,
  is_used    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_otp_purpose CHECK (purpose IN ('signup', 'login', 'password_reset')),
  CONSTRAINT chk_otp_code    CHECK (code ~ '^[0-9]{6}$')
);

COMMENT ON TABLE otp_codes IS
  'One-time passwords sent via SMS. Expire after 5 minutes. is_used prevents '
  'replay attacks. Old/expired rows should be purged periodically.';

CREATE INDEX idx_otp_phone_purpose ON otp_codes(phone, purpose);
CREATE INDEX idx_otp_expires_at    ON otp_codes(expires_at);  -- for cleanup jobs
