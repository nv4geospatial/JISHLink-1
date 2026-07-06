-- ============================================================
-- JISHLink Seed Data
-- Run AFTER schema.sql and AFTER creating admin/recruiter users
-- in Supabase Authentication (Auth > Users > Invite)
-- ============================================================
-- Replace the UUIDs below with actual user IDs from Supabase Auth

-- ============================================================
-- ROLES
-- ============================================================
INSERT INTO roles (id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin', 'Full system access'),
  ('00000000-0000-0000-0000-000000000002', 'recruiter', 'Site-scoped access'),
  ('00000000-0000-0000-0000-000000000003', 'employee', 'Own records only')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- PERMISSIONS (admin gets all; recruiter gets limited)
-- ============================================================
INSERT INTO permissions (role_id, module, can_create, can_read, can_update, can_delete) VALUES
  -- Admin: full access to all modules
  ('00000000-0000-0000-0000-000000000001', 'employees', true, true, true, true),
  ('00000000-0000-0000-0000-000000000001', 'clients', true, true, true, true),
  ('00000000-0000-0000-0000-000000000001', 'sites', true, true, true, true),
  ('00000000-0000-0000-0000-000000000001', 'attendance', true, true, true, true),
  ('00000000-0000-0000-0000-000000000001', 'reports', true, true, true, true),
  ('00000000-0000-0000-0000-000000000001', 'settings', true, true, true, true),
  -- Recruiter: read-only on most; no settings
  ('00000000-0000-0000-0000-000000000002', 'employees', false, true, false, false),
  ('00000000-0000-0000-0000-000000000002', 'clients', false, true, false, false),
  ('00000000-0000-0000-0000-000000000002', 'sites', false, true, false, false),
  ('00000000-0000-0000-0000-000000000002', 'attendance', false, true, false, false),
  ('00000000-0000-0000-0000-000000000002', 'reports', false, true, false, false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- CLIENTS
-- ============================================================
INSERT INTO clients (id, name, contact_person, phone, email, address, status) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Tata Projects Ltd', 'Ramesh Sharma', '+91-9876543210', 'ramesh@tataprojects.com', 'Andheri East, Mumbai, Maharashtra 400093', 'active'),
  ('10000000-0000-0000-0000-000000000002', 'L&T Construction', 'Priya Menon', '+91-9876543211', 'priya.menon@lntecc.com', 'Powai, Mumbai, Maharashtra 400076', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SHIFT MASTER
-- ============================================================
INSERT INTO shift_master (id, name, start_time, end_time, grace_minutes) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Day Shift', '08:00', '17:00', 15),
  ('20000000-0000-0000-0000-000000000002', 'Night Shift', '20:00', '05:00', 15)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SITES
-- ============================================================
INSERT INTO sites (id, name, client_id, address, latitude, longitude, geofence_radius_meters, qr_token, supervisor_name) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Mumbai Central Depot', '10000000-0000-0000-0000-000000000001', 'Senapati Bapat Marg, Mumbai, Maharashtra 400012', 18.9747, 72.8240, 100, 'qr_mum_central_001', 'Suresh Kumar'),
  ('30000000-0000-0000-0000-000000000002', 'Navi Mumbai Warehouse', '10000000-0000-0000-0000-000000000001', 'Turbhe MIDC, Navi Mumbai, Maharashtra 400705', 19.0727, 73.0163, 100, 'qr_navimum_wh_002', 'Anjali Desai'),
  ('30000000-0000-0000-0000-000000000003', 'Pune Industrial Park', '10000000-0000-0000-0000-000000000002', 'Chakan MIDC, Pune, Maharashtra 410501', 18.7616, 73.8636, 100, 'qr_pune_ind_003', 'Vijay Patil')
ON CONFLICT DO NOTHING;

-- ============================================================
-- EMPLOYEES (10 sample employees with realistic mobile numbers)
-- ============================================================
INSERT INTO employees (id, employee_code, name, mobile, email, address, date_of_joining, client_id, site_id, shift_id, status) VALUES
  ('40000000-0000-0000-0000-000000000001', 'JL1001', 'Arjun Mehta', '+91-9001001001', 'arjun.mehta@email.com', '12, Linking Road, Bandra, Mumbai', '2024-01-15', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'active'),
  ('40000000-0000-0000-0000-000000000002', 'JL1002', 'Pradeep Singh', '+91-9001001002', NULL, '45, Ghatkopar West, Mumbai', '2024-02-01', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'active'),
  ('40000000-0000-0000-0000-000000000003', 'JL1003', 'Sunita Rao', '+91-9001001003', 'sunita.rao@email.com', '7, Vashi Sector 5, Navi Mumbai', '2024-02-10', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'active'),
  ('40000000-0000-0000-0000-000000000004', 'JL1004', 'Mohammed Irfan', '+91-9001001004', NULL, '23, Turbhe, Navi Mumbai', '2024-03-01', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'active'),
  ('40000000-0000-0000-0000-000000000005', 'JL1005', 'Kavitha Nair', '+91-9001001005', 'kavitha.nair@email.com', '89, Chembur Colony, Mumbai', '2024-03-15', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'active'),
  ('40000000-0000-0000-0000-000000000006', 'JL1006', 'Rakesh Gupta', '+91-9001001006', NULL, '15, Chakan Village, Pune', '2024-04-01', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'active'),
  ('40000000-0000-0000-0000-000000000007', 'JL1007', 'Deepa Krishnamurthy', '+91-9001001007', 'deepa.k@email.com', '34, Pimpri, Pune', '2024-04-10', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'active'),
  ('40000000-0000-0000-0000-000000000008', 'JL1008', 'Santosh Yadav', '+91-9001001008', NULL, '56, Chinchwad, Pune', '2024-05-01', '10000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'active'),
  ('40000000-0000-0000-0000-000000000009', 'JL1009', 'Ananya Pillai', '+91-9001001009', 'ananya.p@email.com', '78, Turbhe MIDC, Navi Mumbai', '2024-05-15', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'active'),
  ('40000000-0000-0000-0000-000000000010', 'JL1010', 'Ravi Shankar Tiwari', '+91-9001001010', NULL, '90, Kurla West, Mumbai', '2024-06-01', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'inactive')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ATTENDANCE HISTORY (~30 days realistic data)
-- Note: Using generate_series for dates
-- ============================================================
DO $$
DECLARE
  emp_ids UUID[] := ARRAY[
    '40000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000004',
    '40000000-0000-0000-0000-000000000005',
    '40000000-0000-0000-0000-000000000006',
    '40000000-0000-0000-0000-000000000007',
    '40000000-0000-0000-0000-000000000008',
    '40000000-0000-0000-0000-000000000009'
  ];
  site_map UUID[] := ARRAY[
    '30000000-0000-0000-0000-000000000001', -- JL1001
    '30000000-0000-0000-0000-000000000001', -- JL1002
    '30000000-0000-0000-0000-000000000002', -- JL1003
    '30000000-0000-0000-0000-000000000002', -- JL1004
    '30000000-0000-0000-0000-000000000001', -- JL1005
    '30000000-0000-0000-0000-000000000003', -- JL1006
    '30000000-0000-0000-0000-000000000003', -- JL1007
    '30000000-0000-0000-0000-000000000003', -- JL1008
    '30000000-0000-0000-0000-000000000002'  -- JL1009
  ];
  d DATE;
  i INT;
  rand INT;
  att_status TEXT;
  check_in TIMESTAMPTZ;
  check_out TIMESTAMPTZ;
BEGIN
  FOR d IN SELECT generate_series(
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE - INTERVAL '1 day',
    INTERVAL '1 day'
  )::DATE LOOP
    -- Skip Sundays
    IF EXTRACT(DOW FROM d) = 0 THEN CONTINUE; END IF;

    FOR i IN 1..array_length(emp_ids, 1) LOOP
      rand := floor(random() * 100)::INT;

      IF rand < 75 THEN
        att_status := 'present';
        check_in := d + TIME '08:00:00' + (floor(random() * 10) || ' minutes')::INTERVAL;
        check_out := d + TIME '17:00:00' + (floor(random() * 30) || ' minutes')::INTERVAL;
      ELSIF rand < 88 THEN
        att_status := 'late';
        check_in := d + TIME '08:30:00' + (floor(random() * 60) || ' minutes')::INTERVAL;
        check_out := d + TIME '17:30:00' + (floor(random() * 30) || ' minutes')::INTERVAL;
      ELSIF rand < 95 THEN
        att_status := 'early_out';
        check_in := d + TIME '08:05:00';
        check_out := d + TIME '14:00:00' + (floor(random() * 60) || ' minutes')::INTERVAL;
      ELSE
        att_status := 'absent';
        check_in := NULL;
        check_out := NULL;
      END IF;

      INSERT INTO attendance (employee_id, site_id, date, check_in_time, check_out_time, status,
        check_in_lat, check_in_lng)
      VALUES (
        emp_ids[i],
        site_map[i],
        d,
        check_in,
        check_out,
        att_status,
        CASE WHEN check_in IS NOT NULL THEN 18.97 + (random() * 0.01 - 0.005) ELSE NULL END,
        CASE WHEN check_in IS NOT NULL THEN 72.82 + (random() * 0.01 - 0.005) ELSE NULL END
      )
      ON CONFLICT (employee_id, date) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;
