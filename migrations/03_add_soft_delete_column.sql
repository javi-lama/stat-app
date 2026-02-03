-- Migration: Add soft delete support to tasks table
-- Created: 2025-02-02
-- Purpose: Enable soft deletes for task deletion with undo capability
--
-- Context: The application uses soft deletes (UPDATE with deleted_at) instead of
-- hard deletes (DELETE FROM). This allows for:
-- - Undo functionality for accidentally deleted tasks
-- - Audit trail of task deletions
-- - Data recovery without backups

-- Add deleted_at column
ALTER TABLE public.tasks
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- Create partial index for performance
-- Only index rows where deleted_at IS NOT NULL (sparse index)
-- This improves performance for queries filtering by deleted_at
CREATE INDEX idx_tasks_deleted_at ON public.tasks(deleted_at)
WHERE deleted_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.tasks.deleted_at IS 'Timestamp when task was soft-deleted. NULL = active task.';

-- Verification queries:
-- 1. Verify column exists:
--    SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'deleted_at';
--
-- 2. Verify index exists:
--    SELECT indexname FROM pg_indexes WHERE tablename = 'tasks' AND indexname = 'idx_tasks_deleted_at';
--
-- 3. Test soft delete (replace <task_id> with real UUID):
--    UPDATE tasks SET deleted_at = NOW() WHERE id = '<task_id>';
--
-- 4. Verify active tasks (should exclude soft-deleted):
--    SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL;
