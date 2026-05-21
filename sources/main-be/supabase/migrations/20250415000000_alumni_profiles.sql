-- Create alumni_profiles table
create table if not exists public.alumni_profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  first_name text,
  last_name text,
  graduation_year int,
  department text,
  reference_number text unique,
  status text default 'Active' check (status in ('Active', 'Inactive', 'Pending')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create index on email for faster lookups
create index if not exists idx_alumni_profiles_email on public.alumni_profiles(email);

-- Create index on reference_number for tracking
create index if not exists idx_alumni_profiles_reference_number on public.alumni_profiles(reference_number);

-- Add alumni role to profiles table if not exists
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'applicant', 'admin', 'alumni'));
