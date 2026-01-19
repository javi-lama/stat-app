-- 1. Enable Realtime (Safely wrapped in DO block)
do $$
begin
  begin
    -- Try to add the table. If it's already there or publication prevents it, catch the error.
    alter publication supabase_realtime add table public.tasks;
  exception 
    when duplicate_object then null; -- Already exists
    when others then null; -- Ignore other errors safely
  end;
end $$;

-- 2. Fix Permissions (RLS)
-- Enable RLS
alter table public.tasks enable row level security;

-- Drop ALL existing policies to ensure clean slate (avoiding conflicts)
drop policy if exists "Authenticated users can view tasks." on public.tasks;
drop policy if exists "Authenticated users can insert tasks." on public.tasks;
drop policy if exists "Authenticated users can update tasks." on public.tasks;
drop policy if exists "Authenticated users can delete tasks." on public.tasks;
drop policy if exists "Enable read access for all users" on public.tasks;
drop policy if exists "Enable insert for all users" on public.tasks;
drop policy if exists "Enable update for all users" on public.tasks;
drop policy if exists "Enable delete for all users" on public.tasks;

-- Create Permissive Policies for Development (CRUD for everyone invluding 'anon')
create policy "Enable read access for all users" on public.tasks
    for select using (true);

create policy "Enable insert for all users" on public.tasks
    for insert with check (true);

create policy "Enable update for all users" on public.tasks
    for update using (true);

create policy "Enable delete for all users" on public.tasks
    for delete using (true);

-- Ensure Patients table is readable too
drop policy if exists "Enable read access for patients" on public.patients;
create policy "Enable read access for patients" on public.patients
    for select using (true);
