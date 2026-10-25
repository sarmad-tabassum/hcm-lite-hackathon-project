-- ============================================================
-- HCM Lite — PATCH (run ONCE in Supabase SQL Editor)
-- Your tables are already created. This only adds the 3 personal
-- info columns on employees (needed for HR-created records and
-- CSV import, because profiles can only exist after a real signup).
-- ============================================================

alter table public.employees add column if not exists full_name text;
alter table public.employees add column if not exists email text;
alter table public.employees add column if not exists phone text;

-- helpful uniqueness guards for app logic (safe on fresh data)
create unique index if not exists uniq_attendance_employee_date
  on public.attendance (employee_id, attendance_date);

create unique index if not exists uniq_payroll_company_month
  on public.payroll_runs (company_id, month, year);
