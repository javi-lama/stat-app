-- Migration: 04_add_daily_tracking.sql
-- Description: Creates daily_tracking table for EVOS & BH binary confirmation matrix
-- Phase 3.1: Evoluciones y Balances Hidricos Engine

-- 1. Create Table
create table public.daily_tracking (
    id uuid default uuid_generate_v4() primary key,
    patient_id uuid references public.patients(id) on delete cascade not null,
    tracking_date date not null,  -- DATE type (not TIMESTAMP) to avoid timezone bugs
    evos_done boolean default false not null,
    bh_done boolean default false not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

    -- CRITICAL: One record per patient per day (prevents duplicates, enables UPSERT)
    constraint daily_tracking_patient_date_unique unique (patient_id, tracking_date)
);

-- 2. Create Index for fast lookups by date (common query pattern)
create index idx_daily_tracking_date on public.daily_tracking(tracking_date);

-- 3. Create Index for patient lookups
create index idx_daily_tracking_patient on public.daily_tracking(patient_id);

-- 4. Auto-update trigger for updated_at
create or replace function public.update_daily_tracking_timestamp()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

create trigger update_daily_tracking_timestamp
    before update on public.daily_tracking
    for each row
    execute function public.update_daily_tracking_timestamp();

-- 5. Enable Row Level Security
alter table public.daily_tracking enable row level security;

-- 6. RLS Policies (following existing permissive pattern)
create policy "Enable read access for daily_tracking" on public.daily_tracking
    for select using (auth.role() = 'authenticated');

create policy "Enable insert for daily_tracking" on public.daily_tracking
    for insert with check (auth.role() = 'authenticated');

create policy "Enable update for daily_tracking" on public.daily_tracking
    for update using (auth.role() = 'authenticated');

create policy "Enable delete for daily_tracking" on public.daily_tracking
    for delete using (auth.role() = 'authenticated');

-- 7. Enable Realtime (safely wrapped to handle existing publication)
do $$
begin
    begin
        alter publication supabase_realtime add table public.daily_tracking;
    exception
        when duplicate_object then null;
        when others then null;
    end;
end $$;

-- 8. Add comments for documentation
comment on table public.daily_tracking is 'Binary confirmation matrix for daily patient tracking (Evos & BH)';
comment on column public.daily_tracking.tracking_date is 'DATE type (not TIMESTAMP) - stores YYYY-MM-DD without timezone to prevent timezone drift bugs';
comment on column public.daily_tracking.evos_done is 'True if Evolucion was completed for this patient on this date';
comment on column public.daily_tracking.bh_done is 'True if Balance Hidrico was completed for this patient on this date';
