-- Add steps column to tasks table for multi-step verification
alter table public.tasks 
add column steps jsonb; -- Stores array of objects e.g. [{label: 'Ordered', checked: true}, ...] or simple booleans
