-- ============================================================
-- Migration 05: Sistema Preventivo de Higiene de Datos
-- Author: STAT CTO
-- Date: 2026-03-09
-- Purpose: Automatic archiving, date validation, and monitoring
-- ============================================================

-- ============================================================
-- PART 1: TASKS ARCHIVE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tasks_archive (
    id UUID PRIMARY KEY,
    patient_id UUID NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    due_date TIMESTAMPTZ,
    steps JSONB,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    archive_reason TEXT NOT NULL  -- 'completed_aged', 'deleted_aged', 'manual'
);

-- Indexes for historical queries
CREATE INDEX IF NOT EXISTS idx_tasks_archive_patient ON tasks_archive(patient_id);
CREATE INDEX IF NOT EXISTS idx_tasks_archive_date ON tasks_archive(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_archive_archived_at ON tasks_archive(archived_at);

-- ============================================================
-- PART 2: ARCHIVE FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION archive_old_tasks()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Move completed tasks > 30 days OR soft-deleted tasks > 7 days
    WITH moved AS (
        DELETE FROM tasks
        WHERE (
            (is_completed = true AND due_date < NOW() - INTERVAL '30 days')
            OR
            (deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '7 days')
        )
        RETURNING *
    )
    INSERT INTO tasks_archive (
        id, patient_id, description, type, is_completed,
        due_date, steps, deleted_at, created_at, archive_reason
    )
    SELECT
        id, patient_id, description, type::TEXT, is_completed,
        due_date, steps, deleted_at, created_at,
        CASE
            WHEN deleted_at IS NOT NULL THEN 'deleted_aged'
            ELSE 'completed_aged'
        END
    FROM moved;

    GET DIAGNOSTICS archived_count = ROW_COUNT;

    RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 3: DATE VALIDATION TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION validate_task_date()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate that due_date is not more than 1 year in the past
    IF NEW.due_date IS NOT NULL AND NEW.due_date < NOW() - INTERVAL '1 year' THEN
        RAISE EXCEPTION 'due_date cannot be more than 1 year in the past: %', NEW.due_date;
    END IF;

    -- Validate that due_date is not more than 1 year in the future
    IF NEW.due_date IS NOT NULL AND NEW.due_date > NOW() + INTERVAL '1 year' THEN
        RAISE EXCEPTION 'due_date cannot be more than 1 year in the future: %', NEW.due_date;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS trg_validate_task_date ON tasks;

-- Create trigger
CREATE TRIGGER trg_validate_task_date
    BEFORE INSERT OR UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION validate_task_date();

-- ============================================================
-- PART 4: MONITORING SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL,      -- 'task_count_high', 'archive_failed', etc.
    severity TEXT NOT NULL,        -- 'warning', 'critical'
    message TEXT NOT NULL,
    metadata JSONB,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for unacknowledged alerts
CREATE INDEX IF NOT EXISTS idx_system_alerts_unack ON system_alerts(created_at)
    WHERE acknowledged_at IS NULL;

-- Health check function
CREATE OR REPLACE FUNCTION check_task_health()
RETURNS VOID AS $$
DECLARE
    active_count INTEGER;
    threshold INTEGER := 5000;
BEGIN
    SELECT COUNT(*) INTO active_count
    FROM tasks
    WHERE deleted_at IS NULL;

    IF active_count > threshold THEN
        -- Only insert if no recent alert (prevent spam)
        IF NOT EXISTS (
            SELECT 1 FROM system_alerts
            WHERE alert_type = 'task_count_high'
            AND created_at > NOW() - INTERVAL '24 hours'
            AND acknowledged_at IS NULL
        ) THEN
            INSERT INTO system_alerts (alert_type, severity, message, metadata)
            VALUES (
                'task_count_high',
                CASE WHEN active_count > threshold * 2 THEN 'critical' ELSE 'warning' END,
                format('Task count (%s) exceeds threshold (%s)', active_count, threshold),
                jsonb_build_object('count', active_count, 'threshold', threshold)
            );
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 5: HEALTH DASHBOARD VIEW
-- ============================================================

CREATE OR REPLACE VIEW v_system_health AS
SELECT
    (SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL) as active_tasks,
    (SELECT COUNT(*) FROM tasks_archive) as archived_tasks,
    (SELECT COUNT(*) FROM system_alerts WHERE acknowledged_at IS NULL) as pending_alerts,
    (SELECT MAX(archived_at) FROM tasks_archive) as last_archive_run;

-- ============================================================
-- GRANT PERMISSIONS (for RPC calls from client)
-- ============================================================

GRANT EXECUTE ON FUNCTION archive_old_tasks() TO authenticated;
GRANT EXECUTE ON FUNCTION check_task_health() TO authenticated;
GRANT SELECT ON v_system_health TO authenticated;

-- ============================================================
-- VERIFICATION QUERIES (run manually after migration)
-- ============================================================

-- Test 1: Check function exists
-- SELECT archive_old_tasks();

-- Test 2: Check trigger (should fail with old date)
-- INSERT INTO tasks (patient_id, description, type, due_date)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'test', 'admin', '2020-01-01');

-- Test 3: Check monitoring
-- SELECT check_task_health();
-- SELECT * FROM system_alerts;

-- Test 4: Check health view
-- SELECT * FROM v_system_health;
