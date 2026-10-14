-- Presence / AI-Based Elderly Monitoring System
-- Database schema based on the System Design Specification (SDS).

CREATE TABLE IF NOT EXISTS elderly_users (
  user_id BIGSERIAL PRIMARY KEY,
  amazon_user_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  preference_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES elderly_users(user_id) ON DELETE CASCADE UNIQUE,
  preferred_name VARCHAR(120),
  preferred_language VARCHAR(50) NOT NULL DEFAULT 'English',
  preferred_music VARCHAR(120),
  preferred_devotional VARCHAR(120),
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caregivers (
  caregiver_id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(30),
  cognito_sub VARCHAR(255) UNIQUE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caregiver_assignments (
  assignment_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES elderly_users(user_id) ON DELETE CASCADE,
  caregiver_id BIGINT NOT NULL REFERENCES caregivers(caregiver_id) ON DELETE CASCADE,
  relationship VARCHAR(80),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, caregiver_id)
);

CREATE TABLE IF NOT EXISTS consent_records (
  consent_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES elderly_users(user_id) ON DELETE CASCADE,
  caregiver_id BIGINT REFERENCES caregivers(caregiver_id) ON DELETE SET NULL,
  consented_by_type VARCHAR(40) NOT NULL DEFAULT 'caregiver',
  consent_type VARCHAR(60) NOT NULL DEFAULT 'voice_interaction_and_monitoring',
  consent_status VARCHAR(30) NOT NULL DEFAULT 'granted',
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS caregiver_devices (
  device_id BIGSERIAL PRIMARY KEY,
  caregiver_id BIGINT NOT NULL REFERENCES caregivers(caregiver_id) ON DELETE CASCADE,
  fcm_token VARCHAR(255) NOT NULL,
  platform VARCHAR(20) NOT NULL DEFAULT 'android',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_contacts (
  contact_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES elderly_users(user_id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  relationship VARCHAR(80),
  phone_number VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS family_voice_messages (
  message_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES elderly_users(user_id) ON DELETE CASCADE,
  sender_caregiver_id BIGINT REFERENCES caregivers(caregiver_id) ON DELETE SET NULL,
  storage_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  played_at TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS interactions (
  interaction_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES elderly_users(user_id) ON DELETE CASCADE,
  session_id VARCHAR(120),
  interaction_intent VARCHAR(100) NOT NULL DEFAULT 'general_check_in',
  transcript TEXT NOT NULL,
  response TEXT,
  summary TEXT,
  interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mood_analyses (
  mood_analysis_id BIGSERIAL PRIMARY KEY,
  interaction_id BIGINT NOT NULL REFERENCES interactions(interaction_id) ON DELETE CASCADE UNIQUE,
  mood_score NUMERIC(4, 3) CHECK (mood_score IS NULL OR (mood_score >= -1.000 AND mood_score <= 1.000)),
  confidence_score NUMERIC(4, 3) CHECK (confidence_score IS NULL OR (confidence_score >= 0.000 AND confidence_score <= 1.000)),
  sentiment_label VARCHAR(30) CHECK (sentiment_label IS NULL OR sentiment_label IN ('positive', 'neutral', 'negative', 'unknown')),
  distress_detected BOOLEAN NOT NULL DEFAULT FALSE,
  distress_phrase TEXT,
  model_version VARCHAR(80) NOT NULL DEFAULT 'manual-demo-v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS distress_keywords (
  keyword_id BIGSERIAL PRIMARY KEY,
  phrase VARCHAR(120) NOT NULL UNIQUE,
  category VARCHAR(60) NOT NULL DEFAULT 'general',
  severity VARCHAR(20) NOT NULL DEFAULT 'high',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memory_game_records (
  game_record_id BIGSERIAL PRIMARY KEY,
  interaction_id BIGINT REFERENCES interactions(interaction_id) ON DELETE SET NULL,
  user_id BIGINT NOT NULL REFERENCES elderly_users(user_id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medication_schedules (
  schedule_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES elderly_users(user_id) ON DELETE CASCADE,
  medication_name VARCHAR(120) NOT NULL,
  dosage VARCHAR(120),
  scheduled_time TIME NOT NULL,
  reminder_window INTEGER NOT NULL DEFAULT 20 CHECK (reminder_window > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  alexa_reminder_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medication_logs (
  log_id BIGSERIAL PRIMARY KEY,
  schedule_id BIGINT NOT NULL REFERENCES medication_schedules(schedule_id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES elderly_users(user_id) ON DELETE CASCADE,
  reminder_time TIMESTAMPTZ NOT NULL,
  confirmation_time TIMESTAMPTZ NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'late', 'missed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (schedule_id, reminder_time)
);

CREATE TABLE IF NOT EXISTS routine_schedules (
  routine_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES elderly_users(user_id) ON DELETE CASCADE,
  routine_type VARCHAR(60) NOT NULL,
  scheduled_time TIME,
  event_date DATE,
  frequency VARCHAR(40) NOT NULL DEFAULT 'daily',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routine_logs (
  routine_log_id BIGSERIAL PRIMARY KEY,
  routine_id BIGINT NOT NULL REFERENCES routine_schedules(routine_id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES elderly_users(user_id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_activity (
  activity_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES elderly_users(user_id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  interaction_count INTEGER NOT NULL DEFAULT 0,
  rolling_mean_30d NUMERIC(6, 2),
  rolling_stddev_30d NUMERIC(6, 2),
  first_interaction_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, activity_date)
);

CREATE TABLE IF NOT EXISTS anomaly_records (
  anomaly_id BIGSERIAL PRIMARY KEY,
  activity_id BIGINT NOT NULL REFERENCES daily_activity(activity_id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES elderly_users(user_id) ON DELETE CASCADE,
  sensitivity_k NUMERIC(4, 2) NOT NULL DEFAULT 1.50,
  threshold_value NUMERIC(6, 2),
  deviation_score NUMERIC(6, 2),
  is_anomalous BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escalation_policies (
  policy_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES elderly_users(user_id) ON DELETE CASCADE UNIQUE,
  primary_assignment_id BIGINT REFERENCES caregiver_assignments(assignment_id) ON DELETE SET NULL,
  backup_contact_id BIGINT REFERENCES family_contacts(contact_id) ON DELETE SET NULL,
  escalation_delay_min INTEGER NOT NULL DEFAULT 10,
  override_quiet_hours BOOLEAN NOT NULL DEFAULT FALSE,
  anomaly_sensitivity_k NUMERIC(4, 2) NOT NULL DEFAULT 1.50,
  mood_distress_threshold NUMERIC(4, 3) NOT NULL DEFAULT -0.600,
  distress_confidence_min NUMERIC(4, 3) NOT NULL DEFAULT 0.700,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  alert_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES elderly_users(user_id) ON DELETE CASCADE,
  source_interaction_id BIGINT REFERENCES interactions(interaction_id) ON DELETE SET NULL,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('distress', 'missed_medication', 'low_interaction')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  triggering_phrase TEXT,
  confidence_score NUMERIC(4, 3),
  status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  escalation_level INT NOT NULL DEFAULT 0,
  acknowledgement_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_by BIGINT REFERENCES caregivers(caregiver_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS alert_deliveries (
  delivery_id BIGSERIAL PRIMARY KEY,
  alert_id BIGINT NOT NULL REFERENCES alerts(alert_id) ON DELETE CASCADE,
  target_caregiver_id BIGINT REFERENCES caregivers(caregiver_id) ON DELETE SET NULL,
  target_contact_id BIGINT REFERENCES family_contacts(contact_id) ON DELETE SET NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms', 'push', 'email', 'voice')),
  delivery_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'sent', 'failed', 'delivered', 'simulated')),
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  actor_id BIGINT,
  actor_type VARCHAR(40) NOT NULL DEFAULT 'caregiver',
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(80) NOT NULL,
  target_id BIGINT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes on (user_id, time/status)
CREATE INDEX IF NOT EXISTS idx_interactions_user_time
  ON interactions (user_id, interaction_at DESC);

CREATE INDEX IF NOT EXISTS idx_medication_logs_user_time
  ON medication_logs (user_id, reminder_time DESC);

CREATE INDEX IF NOT EXISTS idx_daily_activity_user_date
  ON daily_activity (user_id, activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_user_status
  ON alerts (user_id, status);

CREATE INDEX IF NOT EXISTS idx_routine_logs_user_time
  ON routine_logs (user_id, created_at DESC);

-- Automatic updated_at trigger function and triggers
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_elderly_users_updated_at ON elderly_users;
CREATE TRIGGER trg_elderly_users_updated_at
BEFORE UPDATE ON elderly_users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
BEFORE UPDATE ON user_preferences
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_caregivers_updated_at ON caregivers;
CREATE TRIGGER trg_caregivers_updated_at
BEFORE UPDATE ON caregivers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_medication_schedules_updated_at ON medication_schedules;
CREATE TRIGGER trg_medication_schedules_updated_at
BEFORE UPDATE ON medication_schedules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_routine_schedules_updated_at ON routine_schedules;
CREATE TRIGGER trg_routine_schedules_updated_at
BEFORE UPDATE ON routine_schedules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_escalation_policies_updated_at ON escalation_policies;
CREATE TRIGGER trg_escalation_policies_updated_at
BEFORE UPDATE ON escalation_policies
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
