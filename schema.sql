-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create Enums
create type patient_status as enum ('stable', 'critical', 'discharge_ready');
create type task_type as enum ('lab', 'imaging', 'admin', 'procedure');
create type user_role as enum ('resident', 'attending');

-- Create Profiles Table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  role user_role not null default 'resident',
  first_name text,
  last_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Patients Table
create table public.patients (
  id uuid default uuid_generate_v4() primary key,
  bed_number text not null unique,
  admission_date timestamp with time zone default timezone('utc'::text, now()) not null,
  diagnosis text,
  status patient_status default 'stable',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Tasks Table
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  patient_id uuid references public.patients(id) on delete cascade not null,
  description text not null,
  type task_type not null default 'admin',
  is_completed boolean default false,
  due_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.tasks enable row level security;

-- Create Policies

-- Profiles: Allow read access to authenticated users (team members need to see who's who)
create policy "Profiles are viewable by authenticated users." on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "Users can update own profile." on public.profiles
  for update using (auth.uid() = id);

-- Patients: Collaborative access for authenticated team members
create policy "Authenticated users can view patients." on public.patients
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert patients." on public.patients
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update patients." on public.patients
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete patients." on public.patients
  for delete using (auth.role() = 'authenticated');

-- Tasks: Collaborative access for authenticated team members
create policy "Authenticated users can view tasks." on public.tasks
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert tasks." on public.tasks
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update tasks." on public.tasks
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can delete tasks." on public.tasks
  for delete using (auth.role() = 'authenticated');

-- Trigger to handle new user signup automatically
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'resident');
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to allow idempotent script execution during dev
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
