-- ============================================================
-- Alumni Module — Supabase Table Definitions
-- Sprint 1-4 deliverable: Jertz / Alumni & Records domain
--
-- RULES:
-- 1. NO FOREIGN KEYS — no connecting lines in Schema Visualizer
-- 2. NO UNIQUE or NOT NULL constraints — API handles data integrity
-- 3. All tables start with the mandatory 5-column template:
--    log_id, created_at, actor_uuid, action_type, status_code
-- 4. actor_uuid is stored as plain text — no reference check
-- 5. These tables must function independently from enrollment DB
-- ============================================================

-- ============================================================
-- Table 1: alumni_reg_activity_logs
-- Tracks all alumni registration events (internal + legacy paths)
-- Also used to log graduation.verified.v1 events from Kafka
-- ============================================================
CREATE TABLE IF NOT EXISTS alumni_reg_activity_logs (
  -- Part A: Mandatory 5-column template (NO CONSTRAINTS)
  log_id          UUID,
  created_at      TIMESTAMP,
  actor_uuid      UUID,
  action_type     TEXT,
  status_code     INTEGER,

  -- Part B: Alumni-specific columns
  tenant_id             TEXT,
  full_name             TEXT,
  email                 TEXT,
  graduation_year       INTEGER,
  program               TEXT,
  academic_unit         TEXT,
  is_legacy_registration BOOLEAN,
  student_id            TEXT,
  proof_reference       TEXT,
  document_url          TEXT
  -- NO FOREIGN KEYS. NO UNIQUE. NO NOT NULL.
  -- The API enforces data presence via class-validator DTOs.
);

-- ============================================================
-- Table 2: alumni_record_requests
-- Tracks document requests (TOR, Diploma, Good Moral, Certificate)
-- Independent from alumni_reg_activity_logs — no FK between them
-- ============================================================
CREATE TABLE IF NOT EXISTS alumni_record_requests (
  -- Part A: Mandatory 5-column template (NO CONSTRAINTS)
  log_id          UUID,
  created_at      TIMESTAMP,
  actor_uuid      UUID,
  action_type     TEXT,
  status_code     INTEGER,

  -- Part B: Document-request-specific columns
  tenant_id       TEXT,
  document_type   TEXT,  -- 'TOR' | 'DIPLOMA' | 'GOOD_MORAL' | 'CERTIFICATE'
  fee_amount      NUMERIC,
  payment_status  TEXT,  -- 'PENDING' | 'PAID'
  notes           TEXT
  -- NO FOREIGN KEYS. NO UNIQUE. NO NOT NULL.
);

-- ============================================================
-- Notes for Supabase setup:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. No Schema Visualizer connections should appear after this
-- 3. Both tables are append-only event logs
-- 4. actor_uuid links to users via API only (no DB reference)
-- ============================================================
