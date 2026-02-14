-- Run this in Supabase: SQL Editor → New query → paste → Run
-- Creates the orders table so all branches save to the same database

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number integer,
  branch text not null,
  branch_name text not null,
  customer_name text not null,
  customer_phone text not null,
  order_details text not null,
  total_amount numeric not null default 0,
  advance numeric not null default 0,
  notes text default '',
  status text not null default 'pending' check (status in ('pending', 'returned')),
  returned_at timestamptz,
  paid_full_on_return boolean not null default false,
  created_at timestamptz not null default now()
);

-- Allow anyone with your anon key to insert and read (for your app only)
alter table public.orders enable row level security;

drop policy if exists "Allow anon insert" on public.orders;
create policy "Allow anon insert" on public.orders
  for insert to anon with check (true);

drop policy if exists "Allow anon select" on public.orders;
create policy "Allow anon select" on public.orders
  for select to anon using (true);

drop policy if exists "Allow anon update orders" on public.orders;
create policy "Allow anon update orders" on public.orders
  for update to anon using (true);

-- Employees table (admin: add/edit/delete)
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text default '',
  email text default '',
  branch text not null,
  pin text not null default '00000000',
  role text not null default 'staff' check (role in ('staff', 'admin')),
  annual_leave_allowance numeric not null default 14,
  join_date date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.employees enable row level security;

alter table public.employees add column if not exists join_date date;
alter table public.employees add column if not exists end_date date;
alter table public.employees add column if not exists is_active boolean not null default true;

-- Leave records (per employee)
create table if not exists public.leave_records (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  days numeric not null,
  leave_type text not null default 'annual' check (leave_type in ('annual', 'sick', 'other')),
  notes text default '',
  created_at timestamptz not null default now()
);

alter table public.leave_records enable row level security;
drop policy if exists "Allow anon select leave" on public.leave_records;
create policy "Allow anon select leave" on public.leave_records for select to anon using (true);
drop policy if exists "Allow anon insert leave" on public.leave_records;
create policy "Allow anon insert leave" on public.leave_records for insert to anon with check (true);
drop policy if exists "Allow anon update leave" on public.leave_records;
create policy "Allow anon update leave" on public.leave_records for update to anon using (true);
drop policy if exists "Allow anon delete leave" on public.leave_records;
create policy "Allow anon delete leave" on public.leave_records for delete to anon using (true);

drop policy if exists "Allow anon select employees" on public.employees;
create policy "Allow anon select employees" on public.employees for select to anon using (true);
drop policy if exists "Allow anon insert employees" on public.employees;
create policy "Allow anon insert employees" on public.employees for insert to anon with check (true);
drop policy if exists "Allow anon update employees" on public.employees;
create policy "Allow anon update employees" on public.employees for update to anon using (true);
drop policy if exists "Allow anon delete employees" on public.employees;
create policy "Allow anon delete employees" on public.employees for delete to anon using (true);

alter table public.employees add column if not exists annual_leave_allowance numeric not null default 14;
-- join_date, end_date, is_active added above

alter table public.orders add column if not exists advance numeric not null default 0;
alter table public.orders add column if not exists status text not null default 'pending';
alter table public.orders add column if not exists returned_at timestamptz;
alter table public.orders add column if not exists paid_full_on_return boolean not null default false;
alter table public.orders add column if not exists order_number integer;
