-- ============================================================
-- JISHLink Workforce & Manpower Management System
-- Supabase PostgreSQL Schema + RLS Policies
-- Run this in Supabase SQL Editor (Database > SQL Editor > New Query)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE CHECK (name IN ('admin', 'recruiter', 'employee')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  can_create BOOLEAN DEFAULT FALSE,
  can_read BOOLEAN DEFAULT TRUE,
  can_update BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS (mirrors Supabase Auth — admin/recruiter roles)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role_id UUID REFERENCES roles(id),
  mfa_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SHIFT MASTER
-- ============================================================
CREATE TABLE IF NOT EXISTS shift_master (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grace_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SITES
-- ============================================================
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geofence_radius_meters INTEGER NOT NULL DEFAULT 100,
  qr_token TEXT UNIQUE,
  qr_code_image_url TEXT,
  supervisor_name TEXT,
  assigned_recruiter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EMPLOYEES (Expanded with all required fields)
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL UNIQUE,
  email TEXT,
  address TEXT,
  
  -- Basic Details
  educational_qualification TEXT,
  blood_group TEXT,
  nominee_name TEXT,
  nominee_relationship TEXT,
  nominee_contact_number TEXT,
  
  -- Government IDs
  aadhaar TEXT,
  pan TEXT,
  voter_id TEXT,
  driving_license TEXT,
  passport_number TEXT,
  
  -- Employment Details
  date_of_joining DATE,
  date_of_leaving DATE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES shift_master(id) ON DELETE SET NULL,
  recruiter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  designation TEXT,
  department TEXT,
  employment_type TEXT DEFAULT 'permanent' CHECK (employment_type IN ('permanent', 'temporary', 'contract', 'daily_wage')),
  supervisor_name TEXT,
  
  -- Status with expanded options
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave', 'terminated', 'absconding')),
  
  -- Statutory & Compliance
  uan_number TEXT,
  pf_number TEXT,
  esi_number TEXT,
  
  -- Salary & Banking
  basic_salary DECIMAL(12,2),
  salary_type TEXT DEFAULT 'monthly' CHECK (salary_type IN ('fixed', 'per_day', 'per_hour')),
  bank_name TEXT,
  bank_account_number TEXT,
  ifsc_code TEXT,
  bank_branch TEXT,
  
  -- Document uploads (URLs to Supabase Storage)
  aadhaar_copy_url TEXT,
  pan_copy_url TEXT,
  bank_passbook_url TEXT,
  photo_url TEXT,
  
  password_hash TEXT,
  auth_phone_uid UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ATTENDANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  check_out_lat DOUBLE PRECISION,
  check_out_lng DOUBLE PRECISION,
  device_id TEXT,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'early_out')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (employee_id, date)
);

-- ============================================================
-- OTP LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS otp_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  otp_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'password_reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- QR CODES LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS qr_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  code_value TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- APP SETTINGS (for employee ID prefix/sequence)
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES
  ('employee_code_prefix', 'JL'),
  ('employee_code_sequence', '1000')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_site_id ON attendance(site_id);
CREATE INDEX IF NOT EXISTS idx_employees_employee_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_mobile ON employees(mobile);
CREATE INDEX IF NOT EXISTS idx_employees_site_id ON employees(site_id);
CREATE INDEX IF NOT EXISTS idx_employees_client_id ON employees(client_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_aadhaar ON employees(aadhaar);
CREATE INDEX IF NOT EXISTS idx_employees_pan ON employees(pan);
CREATE INDEX IF NOT EXISTS idx_employees_uan ON employees(uan_number);
CREATE INDEX IF NOT EXISTS idx_employees_pf ON employees(pf_number);
CREATE INDEX IF NOT EXISTS idx_otp_logs_employee_id ON otp_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_sites_qr_token ON sites(qr_token);

-- ============================================================
-- STORAGE BUCKETS (run separately or via Supabase dashboard)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('employee-photos', 'employee-photos', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('site-qr-codes', 'site-qr-codes', true) ON CONFLICT DO NOTHING;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role name
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get current user's assigned recruiter sites
CREATE OR REPLACE FUNCTION get_recruiter_site_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY_AGG(id) FROM sites WHERE assigned_recruiter_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ROLES: anyone authenticated can read
CREATE POLICY "roles_read" ON roles FOR SELECT USING (auth.role() = 'authenticated');

-- PERMISSIONS: authenticated users can read their own role's permissions
CREATE POLICY "permissions_read" ON permissions FOR SELECT USING (auth.role() = 'authenticated');

-- USERS: admins see all; recruiters see own record
CREATE POLICY "users_admin_all" ON users FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "users_self_read" ON users FOR SELECT USING (id = auth.uid());

-- CLIENTS: admins see all; recruiters see their assigned clients via sites
CREATE POLICY "clients_admin_all" ON clients FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "clients_recruiter_read" ON clients FOR SELECT USING (
  get_user_role() = 'recruiter' AND
  id IN (SELECT DISTINCT client_id FROM sites WHERE assigned_recruiter_id = auth.uid())
);

-- SITES: admins see all; recruiters see their assigned sites
CREATE POLICY "sites_admin_all" ON sites FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "sites_recruiter_read" ON sites FOR SELECT USING (
  get_user_role() = 'recruiter' AND assigned_recruiter_id = auth.uid()
);

-- EMPLOYEES: admins see all; recruiters see employees on their sites; employees see own record
CREATE POLICY "employees_admin_all" ON employees FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "employees_recruiter_read" ON employees FOR SELECT USING (
  get_user_role() = 'recruiter' AND
  site_id = ANY(get_recruiter_site_ids())
);
CREATE POLICY "employees_self_read" ON employees FOR SELECT USING (
  auth.uid() = auth_phone_uid
);

-- ATTENDANCE: admins see all; recruiters see their sites' attendance; employees see own
CREATE POLICY "attendance_admin_all" ON attendance FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "attendance_recruiter_read" ON attendance FOR SELECT USING (
  get_user_role() = 'recruiter' AND site_id = ANY(get_recruiter_site_ids())
);
CREATE POLICY "attendance_self_read" ON attendance FOR SELECT USING (
  employee_id IN (SELECT id FROM employees WHERE auth_phone_uid = auth.uid())
);

-- OTP LOGS: admins only (service role bypasses RLS)
CREATE POLICY "otp_logs_admin" ON otp_logs FOR ALL USING (get_user_role() = 'admin');

-- QR CODES: admins see all; recruiters see their sites
CREATE POLICY "qr_codes_admin_all" ON qr_codes FOR ALL USING (get_user_role() = 'admin');
CREATE POLICY "qr_codes_recruiter_read" ON qr_codes FOR SELECT USING (
  get_user_role() = 'recruiter' AND site_id = ANY(get_recruiter_site_ids())
);

-- SHIFT MASTER: all authenticated users can read
CREATE POLICY "shifts_read" ON shift_master FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "shifts_admin_write" ON shift_master FOR ALL USING (get_user_role() = 'admin');

-- APP SETTINGS: admins only
CREATE POLICY "settings_admin" ON app_settings FOR ALL USING (get_user_role() = 'admin');
