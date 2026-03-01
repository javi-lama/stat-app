import { supabase } from '../supabaseClient';
import { formatDateForDB } from '../lib/dateUtils';
import type { PatientCardProps, PatientTask } from '../types';

// DB Types (Raw from Supabase)
export interface SupabaseTask {
    id: string;
    patient_id: string;
    description: string;
    type: 'lab' | 'imaging' | 'admin' | 'procedure' | 'consult' | 'paperwork' | 'supervision';
    is_completed: boolean;
    due_date: string;
    steps?: { label: string; value: boolean }[] | any; // JSONB in DB
    created_at: string;
    deleted_at?: string | null; // Soft Delete Column
}

export interface SupabasePatient {
    id: string;
    bed_number: string;
    admission_date: string;
    diagnosis: string;
    status: 'stable' | 'critical' | 'discharge_ready';
    created_at: string;
    ward_id?: string; // Ward association
    tasks?: SupabaseTask[]; // Joined property
}

// DB Type for Daily Tracking (EVOS & BH)
export interface SupabaseDailyTracking {
    id: string;
    patient_id: string;
    tracking_date: string; // YYYY-MM-DD (DATE type returns as string)
    evos_done: boolean;
    bh_done: boolean;
    assigned_md: string | null; // Responsible physician for this date
    updated_at: string;
}

// Service Functions
export const api = {
    // Expose supabase client for Realtime subscriptions
    supabase,

    /**
     * Fetches patients (beds) and their active tasks for a SPECIFIC DATE and WARD.
     * Multi-Tenant Isolation: Only returns data for the specified ward.
     */
    async getWardCensus(dateStr: string, wardId: string | null): Promise<SupabasePatient[]> {
        // EARLY RETURN: No wardId = no data (security guard)
        if (!wardId) {
            console.warn('[API] getWardCensus called without wardId - returning empty');
            return [];
        }

        // 1. Fetch Patients for THIS WARD only
        const { data: patients, error: patientError } = await supabase
            .from('patients')
            .select('*')
            .eq('ward_id', wardId);

        if (patientError) {
            console.error('Error fetching patients:', patientError);
            throw patientError;
        }

        // 2. Fetch Tasks via INNER JOIN - only tasks for patients in this ward
        const { data: tasksRawWithPatient, error: taskError } = await supabase
            .from('tasks')
            .select('*, patients!inner(ward_id)')
            .eq('patients.ward_id', wardId)
            .is('deleted_at', null);

        if (taskError) {
            console.error('Error fetching tasks:', taskError);
            throw taskError;
        }

        // 3. SANITIZATION: Remove nested 'patients' property from task objects
        // Inner join mutates payload adding { patients: { ward_id } }
        const tasksRaw = (tasksRawWithPatient || []).map((task: any) => {
            const { patients: _removed, ...cleanTask } = task;
            return cleanTask as SupabaseTask;
        });

        // 4. Map Tasks to Patients (Client-Side Date Filtering)
        const patientsWithTasks = patients?.map(patient => {
            const patientTasks = tasksRaw.filter((t: SupabaseTask) => {
                const isActiveDate = (t.due_date ? String(t.due_date).substring(0, 10) : formatDateForDB(new Date(t.created_at))) === dateStr;
                return t.patient_id === patient.id && isActiveDate;
            }) || [];

            return {
                ...patient,
                tasks: patientTasks
            };
        });

        // 5. Numeric Sort for correct ordering (89 -> 100)
        if (patientsWithTasks) {
            patientsWithTasks.sort((a, b) => {
                return a.bed_number.localeCompare(b.bed_number, undefined, { numeric: true, sensitivity: 'base' });
            });
        }

        return patientsWithTasks as SupabasePatient[];
    },

    /**
     * Adapts DB patient data to UI Card props.
     */
    adaptPatientToCard(patient: any): PatientCardProps {
        // Transform DB relation to UI format
        const tasks: PatientTask[] = (patient.tasks || []).map((t: any) => {
            // Robust mapping of DB 'type' or 'category' to UI 'type'
            // Check for Polyfill Tags in description first
            const desc = t.description || '';
            let finalType: PatientTask['type'] = 'admin'; // Default fallback
            let cleanupDesc = desc;

            if (desc.startsWith('[Consult]')) {
                finalType = 'consult';
                cleanupDesc = desc.replace('[Consult] ', '').replace('[Consult]', '');
            } else if (desc.startsWith('[Paperwork]')) {
                finalType = 'paperwork';
                cleanupDesc = desc.replace('[Paperwork] ', '').replace('[Paperwork]', '');
            } else if (desc.startsWith('[Supervision]')) {
                finalType = 'supervision';
                cleanupDesc = desc.replace('[Supervision] ', '').replace('[Supervision]', '');
            } else {
                // Fallback to legacy string matching if no tag
                const rawType = (t.type || t.category || '').toLowerCase();
                if (rawType.includes('consult')) finalType = 'consult';
                else if (rawType.includes('paperwork')) finalType = 'paperwork';
                else if (rawType.includes('supervision')) finalType = 'supervision';
                else if (rawType.includes('lab')) finalType = 'lab';
                else if (rawType.includes('imag')) finalType = 'imaging'; // matches image, imaging
                else if (rawType.includes('proc')) finalType = 'procedure';
            }

            return {
                id: t.id,
                description: cleanupDesc.trim(), // Clean description for UI
                is_completed: t.is_completed,
                type: finalType,
                steps: t.steps || [],
                created_at: t.created_at,
                task_date: t.due_date || formatDateForDB(new Date(t.created_at))
            };
        });

        const isReady = tasks.length > 0 && tasks.every(t => t.is_completed);

        return {
            patientId: patient.id,
            bedNumber: patient.bed_number,
            patientInitials: "EQ", // Placeholder
            diagnosis: patient.diagnosis,
            status: isReady ? 'ready' : 'stable',
            tasks: tasks
        };
    },

    /**
     * Updates the status of a task and its steps.
     * Persists both the 'is_completed' flag AND the detailed 'steps' JSONB array.
     */
    async updateTaskStatus(taskId: string, steps: { label: string; value: boolean }[], isCompleted: boolean): Promise<void> {
        const { error } = await supabase
            .from('tasks')
            .update({
                is_completed: isCompleted,
                steps: steps
            })
            .eq('id', taskId);

        if (error) {
            console.error('Error updating task:', error);
            throw error;
        }
    },

    /**
     * Creates a new task with generated steps based on workflow type.
     */
    async createTask(payload: {
        patient_id: string;
        description: string;
        category: 'lab' | 'imaging' | 'admin' | 'procedure' | 'consult' | 'paperwork' | 'supervision';
        type: 'clinical' | 'admin'; // workflow_type
        task_date: string; // YYYY-MM-DD
    }): Promise<PatientTask> {
        let steps: { label: string; value: boolean }[] = [];

        // 2.2. Logic to generate steps (Strict Rule)
        if (payload.type === 'clinical') {
            // 3 steps: Ordered, Done, Reviewed
            steps = [
                { label: 'Ordered', value: false },
                { label: 'Done', value: false },
                { label: 'Reviewed', value: false }
            ];
        } else {
            // Admin: 1 step
            steps = [
                { label: 'Done', value: false }
            ];
        }

        // POLYFILL: Map extended types to 'admin' + Tag
        let dbType = payload.category;
        let dbDescription = payload.description;

        if (payload.category === 'consult') {
            dbType = 'admin'; // Satisfy DB Enum
            dbDescription = `[Consult] ${payload.description}`;
        } else if (payload.category === 'paperwork') {
            dbType = 'admin';
            dbDescription = `[Paperwork] ${payload.description}`;
        } else if (payload.category === 'supervision') {
            dbType = 'admin';
            dbDescription = `[Supervision] ${payload.description}`;
        }

        const { data, error } = await supabase
            .from('tasks')
            .insert({
                patient_id: payload.patient_id,
                description: dbDescription,
                type: dbType,
                is_completed: false, // Initial state always false
                steps: steps,
                due_date: payload.task_date
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating task:', error);
            throw error;
        }

        // Return PatientTask (clean description)
        return {
            id: data.id,
            description: payload.description, // Return original, not tag-prefixed
            is_completed: data.is_completed,
            type: payload.category as PatientTask['type'], // Use original category
            steps: data.steps,
            created_at: data.created_at,
            task_date: data.due_date || formatDateForDB(new Date(data.created_at))
        };
    },

    /**
     * Smart Carry-Over: Imports pending tasks from Yesterday to Today.
     * Multi-Tenant: Only imports tasks for patients in the specified ward.
     */
    async importPendingTasksFromYesterday(targetDate: Date, wardId: string | null): Promise<{ count: number; skipped: boolean }> {
        // EARLY RETURN: No wardId = no import
        if (!wardId) {
            console.warn('[API] importPendingTasksFromYesterday called without wardId - skipping');
            return { count: 0, skipped: false };
        }

        // 1. Calculate Dates
        const yesterday = new Date(targetDate);
        yesterday.setDate(yesterday.getDate() - 1);

        const targetDateStr = formatDateForDB(targetDate);
        const yesterdayStr = formatDateForDB(yesterday);

        // 2. Fetch Raw Tasks with Ward Filter via INNER JOIN
        const { data: allTasksRawWithPatient, error } = await supabase
            .from('tasks')
            .select('*, patients!inner(ward_id)')
            .eq('patients.ward_id', wardId)
            .is('deleted_at', null);

        if (error) throw error;

        // SANITIZATION: Remove nested patients property
        const allTasksRaw = (allTasksRawWithPatient || []).map((task: any) => {
            const { patients: _removed, ...cleanTask } = task;
            return cleanTask as SupabaseTask;
        });

        // Filter for Yesterday (Pending)
        const pendingRawYesterday = allTasksRaw.filter((t: SupabaseTask) => {
            const tDate = t.due_date ? String(t.due_date).substring(0, 10) : formatDateForDB(new Date(t.created_at));
            return tDate === yesterdayStr && !t.is_completed;
        });

        // Filter for Today (All)
        const allRawToday = allTasksRaw.filter((t: SupabaseTask) => {
            const tDate = t.due_date ? String(t.due_date).substring(0, 10) : formatDateForDB(new Date(t.created_at));
            return tDate === targetDateStr;
        });

        if (pendingRawYesterday.length === 0) {
            return { count: 0, skipped: false };
        }

        // Duplicate Check
        const hasDuplicates = pendingRawYesterday.some(yTask => {
            return allRawToday.some(tTask =>
                tTask.patient_id === yTask.patient_id &&
                tTask.description === yTask.description &&
                tTask.type === yTask.type // strict check
            );
        });

        if (hasDuplicates) {
            return { count: 0, skipped: true };
        }

        // Bulk Insert
        if (pendingRawYesterday.length > 0) {
            const newTasks = pendingRawYesterday.map(t => ({
                patient_id: t.patient_id,
                description: t.description,
                type: t.type,
                is_completed: false,
                steps: t.steps,
                due_date: targetDateStr
            }));

            const { error: insertError } = await supabase.from('tasks').insert(newTasks);
            if (insertError) throw insertError;
        }

        return { count: pendingRawYesterday.length, skipped: false };
    },

    async updatePatientDiagnosis(patientId: string, newDiagnosis: string): Promise<void> {
        const { error } = await supabase
            .from('patients')
            .update({ diagnosis: newDiagnosis })
            .eq('id', patientId);

        if (error) {
            console.error('Error updating diagnosis:', error);
            throw error;
        }
    },

    async updateBedNumber(patientId: string, newBedNumber: string): Promise<void> {
        const { error } = await supabase
            .from('patients')
            .update({ bed_number: newBedNumber })
            .eq('id', patientId);

        if (error) {
            console.error('Error updating bed number:', error);
            throw error;
        }
    },

    async updateTaskDescription(taskId: string, newDescription: string, taskType: PatientTask['type']): Promise<void> {
        let finalDescription = newDescription;

        // State Preservation: Re-apply tags for Polyfill Types
        // This ensures filter/icon logic survives the edit
        if (taskType === 'consult' && !newDescription.startsWith('[Consult]')) {
            finalDescription = `[Consult] ${newDescription}`;
        } else if (taskType === 'paperwork' && !newDescription.startsWith('[Paperwork]')) {
            finalDescription = `[Paperwork] ${newDescription}`;
        } else if (taskType === 'supervision' && !newDescription.startsWith('[Supervision]')) {
            finalDescription = `[Supervision] ${newDescription}`;
        }

        const { error } = await supabase
            .from('tasks')
            .update({
                description: finalDescription,
            })
            .eq('id', taskId);

        if (error) {
            console.error('Error updating task description:', error);
            throw error;
        }
    },

    async deleteTask(taskId: string, dateStr?: string): Promise<void> {
        // Soft Delete: Update deleted_at instead of DELETE
        let query = supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('id', taskId);

        // Strict safety check requested by user
        if (dateStr) {
            query = query.eq('due_date', dateStr);
        }

        const { error } = await query;

        if (error) {
            console.error('Error deleting task:', error);
            throw error;
        }
    },

    /**
     * SAFE Bulk Delete: Soft Deletes tasks for a specific date and ward.
     * Multi-Tenant: Only deletes tasks for patients in the specified ward.
     */
    async clearTasksForDate(dateStr: string, wardId: string | null): Promise<string[]> {
        // EARLY RETURN: No wardId = no deletion
        if (!wardId) {
            console.warn('[API] clearTasksForDate called without wardId - skipping');
            return [];
        }

        // 1. Fetch IDs with ward filter via INNER JOIN
        const { data: tasksToDelete, error: fetchError } = await supabase
            .from('tasks')
            .select('id, patients!inner(ward_id)')
            .eq('patients.ward_id', wardId)
            .eq('due_date', dateStr)
            .is('deleted_at', null);

        if (fetchError) {
            console.error('Error fetching tasks for deletion:', fetchError);
            throw fetchError;
        }

        if (!tasksToDelete || tasksToDelete.length === 0) return [];

        const ids = tasksToDelete.map((t: any) => t.id);

        // 2. Perform Soft Delete
        const { error } = await supabase
            .from('tasks')
            .update({ deleted_at: new Date().toISOString() })
            .in('id', ids);

        if (error) {
            console.error('Error clearing tasks for date:', error);
            throw error;
        }

        return ids;
    },

    /**
     * Restore Tasks: Undoes soft delete for given IDs.
     */
    async restoreTasks(ids: string[]): Promise<void> {
        if (!ids || ids.length === 0) return;

        const { error } = await supabase
            .from('tasks')
            .update({ deleted_at: null })
            .in('id', ids);

        if (error) {
            console.error('Error restoring tasks:', error);
            throw error;
        }
    },

    /**
     * Adds a new patient (bed) to the specified ward.
     * Multi-Tenant: Associates patient with wardId.
     */
    async addPatient(bedNumber: string, wardId: string): Promise<void> {
        // Security: wardId is required (strict validation for empty strings)
        if (!wardId || wardId.trim() === '') {
            throw new Error('[SECURITY] wardId is required to add a patient - received empty or null value');
        }

        const { error } = await supabase
            .from('patients')
            .insert([{
                bed_number: bedNumber,
                ward_id: wardId, // MULTI-TENANT: Associate with ward
                status: 'stable',
                diagnosis: '',
                admission_date: new Date().toISOString()
            }]);

        if (error) {
            console.error('Error adding patient:', error);
            throw error;
        }
    },

    /**
     * Deletes a patient (bed) and implicitly their tasks (via Cascade or separate cleanup if needed).
     */
    async deletePatient(patientId: string): Promise<void> {
        // optimistically assume cascade delete works for tasks linked to patient_id
        // If not, we'd need to delete tasks first.
        const { error } = await supabase
            .from('patients')
            .delete()
            .eq('id', patientId);

        if (error) {
            console.error('Error deleting patient:', error);
            throw error;
        }
    },

    // ============================================================
    // EVOS & BH (Daily Tracking) API Functions
    // ============================================================

    /**
     * Fetches all daily tracking records for a ward on a specific date.
     * Multi-Tenant: Uses INNER JOIN to filter by ward_id through patients table.
     *
     * @param wardId - Active ward ID (null returns empty array)
     * @param dateStr - Date in YYYY-MM-DD format (from formatDateForDB)
     * @returns Array of tracking records for patients in the ward
     */
    async fetchDailyTracking(wardId: string | null, dateStr: string): Promise<SupabaseDailyTracking[]> {
        // EARLY RETURN: No wardId = no data (security guard)
        if (!wardId) {
            console.warn('[API] fetchDailyTracking called without wardId - returning empty');
            return [];
        }

        // INNER JOIN pattern: Filter by ward through patients table
        const { data, error } = await supabase
            .from('daily_tracking')
            .select('*, patients!inner(ward_id)')
            .eq('patients.ward_id', wardId)
            .eq('tracking_date', dateStr);

        if (error) {
            console.error('Error fetching daily tracking:', error);
            throw error;
        }

        // SANITIZATION: Remove nested 'patients' property from response
        const sanitized = (data || []).map((record: any) => {
            const { patients: _removed, ...cleanRecord } = record;
            return cleanRecord as SupabaseDailyTracking;
        });

        return sanitized;
    },

    /**
     * Toggles a tracking field (evos_done or bh_done) for a patient on a specific date.
     * Uses UPSERT with conflict resolution on (patient_id, tracking_date).
     * If record doesn't exist, creates it; if exists, updates it.
     *
     * @param patientId - Patient UUID
     * @param dateStr - Date in YYYY-MM-DD format
     * @param field - Field to toggle ('evos_done' | 'bh_done')
     * @param value - New boolean value
     * @returns The upserted tracking record
     */
    async toggleTracking(
        patientId: string,
        dateStr: string,
        field: 'evos_done' | 'bh_done',
        value: boolean
    ): Promise<SupabaseDailyTracking> {
        // Build upsert payload dynamically based on field
        const upsertPayload: Record<string, any> = {
            patient_id: patientId,
            tracking_date: dateStr,
            [field]: value
        };

        // UPSERT: Insert if not exists, update if exists
        // onConflict targets the UNIQUE constraint columns
        const { data, error } = await supabase
            .from('daily_tracking')
            .upsert(upsertPayload, {
                onConflict: 'patient_id,tracking_date',
                ignoreDuplicates: false // We want to update on conflict
            })
            .select()
            .single();

        if (error) {
            console.error('Error toggling tracking:', error);
            throw error;
        }

        return data as SupabaseDailyTracking;
    },

    /**
     * Update assigned_md for a patient on a specific date.
     * Uses UPSERT to handle both new and existing records.
     */
    async updateAssignedMd(
        patientId: string,
        dateStr: string,
        assignedMd: string | null
    ): Promise<SupabaseDailyTracking> {
        const { data, error } = await supabase
            .from('daily_tracking')
            .upsert({
                patient_id: patientId,
                tracking_date: dateStr,
                assigned_md: assignedMd
            }, {
                onConflict: 'patient_id,tracking_date',
                ignoreDuplicates: false
            })
            .select()
            .single();

        if (error) {
            console.error('[API] updateAssignedMd error:', error);
            throw error;
        }

        return data as SupabaseDailyTracking;
    }
};
