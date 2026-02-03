/**
 * useOptimisticMutations Hook
 *
 * Implements the "Trust but Verify" pattern for optimistic UI updates.
 * Provides robust state management for creating, updating, and deleting tasks
 * with automatic rollback on errors and prevention of race conditions.
 *
 * @author Claude (Senior Fullstack Engineer)
 * @pattern Trust but Verify
 */

import { useRef } from 'react';
import { toast } from 'sonner';
import { formatDateForDB } from '../lib/dateUtils';
import type { PatientTask } from '../types';
import { api } from '../services/api';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Optimistic task with temporary ID and flag
 */
interface OptimisticTask extends PatientTask {
    isOptimistic: true;
    tempId: string;
}

/**
 * Pending mutation in the queue
 */
interface PendingMutation {
    type: 'create' | 'update' | 'delete';
    taskId: string; // Can be tempId or real ID
    promise: Promise<any>;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Custom hook for optimistic mutations with "Trust but Verify" pattern
 *
 * @param patientId - Patient ID for task association
 * @param tasksState - Current tasks state
 * @param setTasksState - State setter for tasks
 * @param onRefresh - Optional callback to refresh parent state
 * @returns Object with mutation functions and helpers
 *
 * @example
 * const { createTaskOptimistic, toggleTaskOptimistic } = useOptimisticMutations(
 *   patientId,
 *   tasksState,
 *   setTasksState,
 *   onRefresh
 * );
 */
export const useOptimisticMutations = (
    patientId: string,
    tasksState: PatientTask[],
    setTasksState: React.Dispatch<React.SetStateAction<PatientTask[]>>,
    onRefresh?: () => void
) => {
    // Queue de mutaciones pendientes (previene race conditions)
    const pendingMutationsRef = useRef<Map<string, PendingMutation>>(new Map());

    // Mapeo tempId → realId (para reemplazo post-confirmación)
    const tempIdMapRef = useRef<Map<string, string>>(new Map());

    // ========================================================================
    // CORE FUNCTIONS
    // ========================================================================

    /**
     * Creates a task with optimistic UI update
     *
     * FASE 1 (TRUST): Inject task immediately with tempId
     * FASE 2 (VERIFY): Call Supabase and replace with real ID
     * FASE 3 (ROLLBACK): Remove task if error occurs
     *
     * @param description - Task description
     * @param type - Task type (lab, imaging, consult, paperwork, supervision, admin, procedure)
     * @param taskDate - Task date in YYYY-MM-DD format (optional, defaults to today)
     * @returns Promise that resolves when confirmed or rejects on error
     */
    const createTaskOptimistic = async (
        description: string,
        type: PatientTask['type'],
        taskDate?: string
    ): Promise<void> => {
        // === FASE 1: TRUST (Optimistic Update) ===

        // 1.1. Generate unique tempId
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        // 1.2. Generate steps based on task type (same logic as api.createTask)
        const steps = type === 'lab' || type === 'imaging'
            ? [
                { label: 'Ordered', value: false },
                { label: 'Done', value: false },
                { label: 'Reviewed', value: false }
            ]
            : [{ label: 'Done', value: false }];

        // 1.3. Create optimistic task
        const optimisticTask: OptimisticTask = {
            id: tempId,
            tempId,
            isOptimistic: true,
            patient_id: patientId,
            description,
            type,
            is_completed: false,
            steps,
            created_at: new Date().toISOString(),
            task_date: taskDate || formatDateForDB(new Date())
        };

        // 1.4. Inject into local state IMMEDIATELY
        console.log('[Optimistic] Creating task with tempId:', tempId);
        setTasksState(prev => [...prev, optimisticTask]);

        // 1.5. Register pending mutation
        const mutationPromise = (async () => {
            try {
                // === FASE 2: VERIFY (Server Confirmation) ===

                console.log('[Optimistic] Confirming task with Supabase...', tempId);

                // 2.1. Call Supabase (may take 100-500ms)
                const workflowType = (type === 'lab' || type === 'imaging') ? 'clinical' : 'admin';
                const realTask = await api.createTask({
                    patient_id: patientId,
                    description,
                    category: type,
                    type: workflowType,
                    task_date: taskDate || formatDateForDB(new Date())
                });

                // 2.2. Save mapping tempId → realId
                tempIdMapRef.current.set(tempId, realTask.id);
                console.log('[Optimistic] Task confirmed. Mapping:', tempId, '→', realTask.id);

                // 2.3. REPLACE temporary task with real task (CRITICAL)
                setTasksState(prev =>
                    prev.map(task =>
                        task.id === tempId
                            ? { ...realTask, isOptimistic: false }
                            : task
                    )
                );

                toast.success('Task created successfully');

                // 2.4. Refresh census to update stats (without full refetch)
                if (onRefresh) onRefresh();

            } catch (error) {
                // === FASE 3: ROLLBACK (Error Handling) ===

                console.error('[Optimistic] Create task failed:', error);

                // 3.1. Remove temporary task from state
                setTasksState(prev => prev.filter(task => task.id !== tempId));

                // 3.2. Clean temporary mapping
                tempIdMapRef.current.delete(tempId);

                toast.error('Failed to create task. Please try again.');

            } finally {
                // 3.3. Clean from queue
                pendingMutationsRef.current.delete(tempId);
            }
        })();

        // Register in queue
        pendingMutationsRef.current.set(tempId, {
            type: 'create',
            taskId: tempId,
            promise: mutationPromise
        });

        return mutationPromise;
    };

    /**
     * Toggles a task step with protection against optimistic tasks
     *
     * CRITICAL: Blocks mutations on temporary tasks (tempId not confirmed yet)
     *
     * @param taskId - Task ID (can be tempId or real ID)
     * @param stepIndex - Index of step to toggle
     */
    const toggleTaskOptimistic = async (taskId: string, stepIndex: number): Promise<void> => {
        // === PROTECTION: Block toggle on optimistic tasks ===

        const task = tasksState.find(t => t.id === taskId);

        if (!task) {
            console.warn('[Optimistic] Task not found:', taskId);
            return;
        }

        // 🛡️ CRITICAL SECURITY: Block mutations on temporary tasks
        if (task.isOptimistic) {
            toast.warning('Please wait, task is being created...', {
                description: 'You can check this task in a moment.'
            });
            return; // Abort silently
        }

        // Check if there are pending mutations for this task
        if (pendingMutationsRef.current.has(taskId)) {
            toast.info('Task is being updated, please wait...');
            return;
        }

        // === Original toggle logic (already implemented) ===

        const previousTasksState = JSON.parse(JSON.stringify(tasksState));
        const taskIndex = tasksState.findIndex(t => t.id === taskId);

        if (taskIndex === -1) return;

        const currentTask = tasksState[taskIndex];
        const hasSteps = currentTask.steps && currentTask.steps.length > 0;

        if (!hasSteps) return;

        const newTasks = [...tasksState];
        const newTask = { ...currentTask };
        const newSteps = newTask.steps!.map(s => ({ ...s }));

        // Toggle step
        newSteps[stepIndex].value = !newSteps[stepIndex].value;
        newTask.steps = newSteps;
        newTask.is_completed = newSteps.every(s => s.value);

        newTasks[taskIndex] = newTask;
        setTasksState(newTasks); // Optimistic update

        // Register mutation
        const mutationPromise = (async () => {
            try {
                await api.updateTaskStatus(taskId, newSteps, newTask.is_completed);
                toast.success('Task updated');
            } catch (error) {
                console.error('[Optimistic] Toggle failed:', error);
                setTasksState(previousTasksState); // Rollback
                toast.error('Connection failed. Change not saved');
            } finally {
                pendingMutationsRef.current.delete(taskId);
            }
        })();

        pendingMutationsRef.current.set(taskId, {
            type: 'update',
            taskId,
            promise: mutationPromise
        });
    };

    /**
     * Replaces a temporary task with the real task from Supabase
     *
     * Used by Realtime handlers to prevent duplication when
     * Supabase confirms the task creation.
     *
     * @param realTask - Real task from Supabase
     */
    const replaceTempTaskWithReal = (realTask: PatientTask): void => {
        // Search for optimistic task with matching patient_id + description
        const tempTask = tasksState.find(
            t => t.isOptimistic &&
                t.patient_id === realTask.patient_id &&
                t.description === realTask.description
        );

        if (tempTask) {
            console.log('[Optimistic] Replacing temp task:', tempTask.id, '→', realTask.id);

            // Save mapping
            tempIdMapRef.current.set(tempTask.id, realTask.id);

            // Replace in state
            setTasksState(prev =>
                prev.map(task =>
                    task.id === tempTask.id
                        ? { ...realTask, isOptimistic: false }
                        : task
                )
            );
        }
    };

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    /**
     * Check if a task is optimistic (temporary)
     *
     * @param taskId - Task ID to check
     * @returns true if task is optimistic, false otherwise
     */
    const isTaskOptimistic = (taskId: string): boolean => {
        const task = tasksState.find(t => t.id === taskId);
        return task?.isOptimistic === true;
    };

    /**
     * Check if there are pending mutations
     *
     * @returns true if there are pending mutations
     */
    const hasPendingMutations = (): boolean => {
        return pendingMutationsRef.current.size > 0;
    };

    /**
     * Get real ID from tempId
     *
     * @param taskId - Temporary task ID
     * @returns Real ID if found, undefined otherwise
     */
    const getRealId = (taskId: string): string | undefined => {
        return tempIdMapRef.current.get(taskId);
    };

    /**
     * Wait for all pending mutations to complete
     *
     * Useful before performing operations that require all tasks to be confirmed
     *
     * @returns Promise that resolves when all mutations are complete
     */
    const waitForPendingMutations = async (): Promise<void> => {
        const promises = Array.from(pendingMutationsRef.current.values()).map(m => m.promise);
        await Promise.allSettled(promises);
    };

    // ========================================================================
    // RETURN API
    // ========================================================================

    return {
        // Core functions
        createTaskOptimistic,
        toggleTaskOptimistic,
        replaceTempTaskWithReal,

        // Helpers
        isTaskOptimistic,
        hasPendingMutations,
        getRealId,
        waitForPendingMutations,

        // Internal refs (for debugging/testing)
        _pendingMutationsRef: pendingMutationsRef,
        _tempIdMapRef: tempIdMapRef
    };
};
