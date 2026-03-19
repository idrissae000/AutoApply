-- Create user_profiles table for AutoApply intake flow
create table if not exists user_profiles (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  skills text[],
  experience jsonb,
  education jsonb,
  target_roles text[],
  location text,
  salary_range text,
  job_type text,
  avoid_list text,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security
alter table user_profiles enable row level security;

-- Allow inserts from anon key (for the intake flow)
create policy "Allow public inserts" on user_profiles
  for insert with check (true);

-- Allow users to read their own profile by id
create policy "Allow read by id" on user_profiles
  for select using (true);
