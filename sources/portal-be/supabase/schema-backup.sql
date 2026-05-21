create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'applicant', 'admin')),
  email text unique,
  full_name text,
  campus text,
  created_at timestamptz default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete cascade,
  student_number text unique,
  first_name text,
  last_name text,
  middle_name text,
  campus text,
  college text,
  program text,
  year_level int,
  status text default 'active',
  created_at timestamptz default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  units int not null default 3,
  description text,
  created_at timestamptz default now()
);

create table if not exists public.subject_offerings (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  term text not null,
  school_year text not null,
  section text not null,
  schedule text,
  room text,
  instructor text,
  slots_total int default 40,
  slots_taken int default 0,
  campus text,
  is_open boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_year text not null,
  term text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'paid', 'cancelled')),
  total_units int default 0,
  created_at timestamptz default now()
);

create table if not exists public.enrollment_items (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete cascade,
  offering_id uuid not null references public.subject_offerings(id) on delete cascade,
  created_at timestamptz default now(),
  unique (enrollment_id, offering_id)
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  school_year text not null,
  term text not null,
  final_grade numeric(4,2),
  remarks text,
  created_at timestamptz default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  doc_type text not null,
  file_name text,
  file_url text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.subject_offerings enable row level security;
alter table public.enrollments enable row level security;
alter table public.enrollment_items enable row level security;
alter table public.grades enable row level security;
alter table public.documents enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

drop policy if exists students_select_own on public.students;
create policy students_select_own on public.students for select using (user_id = auth.uid());

drop policy if exists students_update_own on public.students;
create policy students_update_own on public.students for update using (user_id = auth.uid());

drop policy if exists documents_select_own on public.documents;
create policy documents_select_own on public.documents for select using (profile_id = auth.uid());

drop policy if exists documents_insert_own on public.documents;
create policy documents_insert_own on public.documents for insert with check (profile_id = auth.uid());

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select using (profile_id = auth.uid());

drop policy if exists enrollments_select_own on public.enrollments;
create policy enrollments_select_own on public.enrollments for select using (
  student_id in (select id from public.students where user_id = auth.uid())
);

drop policy if exists enrollments_insert_own on public.enrollments;
create policy enrollments_insert_own on public.enrollments for insert with check (
  student_id in (select id from public.students where user_id = auth.uid())
);

drop policy if exists enrollment_items_select_own on public.enrollment_items;
create policy enrollment_items_select_own on public.enrollment_items for select using (
  enrollment_id in (
    select e.id from public.enrollments e join public.students s on s.id = e.student_id where s.user_id = auth.uid()
  )
);

drop policy if exists enrollment_items_insert_own on public.enrollment_items;
create policy enrollment_items_insert_own on public.enrollment_items for insert with check (
  enrollment_id in (
    select e.id from public.enrollments e join public.students s on s.id = e.student_id where s.user_id = auth.uid()
  )
);

drop policy if exists grades_select_own on public.grades;
create policy grades_select_own on public.grades for select using (
  student_id in (select id from public.students where user_id = auth.uid())
);

drop policy if exists subjects_public_read on public.subjects;
create policy subjects_public_read on public.subjects for select using (true);

drop policy if exists subject_offerings_public_read on public.subject_offerings;
create policy subject_offerings_public_read on public.subject_offerings for select using (true);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
