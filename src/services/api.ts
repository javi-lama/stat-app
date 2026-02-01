import { supabase } from '../supabaseClient';
import { formatDateForDB } from '../lib/dateUtils';
import type { PatientCardProps, PatientTask } from '../types';

// DB Types (Raw from Supabase)
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
}

export interface SupabasePatient {
    id: string;
    bed_number: string;
    admission_date: string;
    diagnosis: string;
    status: 'stable' | 'critical' | 'discharge_ready';
    created_at: string;
    tasks?: SupabaseTask[]; // Joined property
}

// Service Functions
export const api = {
    // Expose supabase client for Realtime subscriptions
    supabase,

    /**
     * Fetches all patients (beds) and their active tasks for a SPECIFIC DATE.
     * Strategy: Split Query.
     * 1. Get ALL Beds (Patients).
     * 2. Get Tasks for the selected DATE.
     * 3. Map Tasks to Beds.
     */
    async getWardCensus(dateStr: string): Promise<SupabasePatient[]> {
        // 1. Fetch All Patients (Beds) - Persistent
        const { data: patients, error: patientError } = await supabase
            .from('patients')
            .select('*');

        if (patientError) {
            console.error('Error fetching patients:', patientError);
            throw patientError;
        }

        // 2. Fetch Tasks (All or Filtered by Due Date if possible, but Client Side is safer for fallback)
        const { data: tasksRaw, error: taskError } = await supabase
            .from('tasks')
            .select('*');

        if (taskError) {
            console.error('Error fetching tasks:', taskError);
            throw taskError;
        }

        // 3. Map Tasks to Patients (Client-Side Filtering)
        const patientsWithTasks = patients?.map(patient => {
            const patientTasks = tasksRaw?.filter((t: SupabaseTask) => {
                const isActiveDate = (t.due_date ? String(t.due_date).substring(0, 10) : formatDateForDB(new Date(t.created_at))) === dateStr;
                return t.patient_id === patient.id && isActiveDate;
            }) || [];

            return {
                ...patient,
                tasks: patientTasks
            };
        });

        // Numeric Sort for correct ordering (89 -> 100)
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
    }): Promise<void> {
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

        const { error } = await supabase
            .from('tasks')
            .insert({
                patient_id: payload.patient_id,
                description: dbDescription,
                type: dbType,
                is_completed: false, // Initial state always false
                steps: steps,
                due_date: payload.task_date
            });

        if (error) {
            console.error('Error creating task:', error);
            throw error;
        }
    },

    /**
     * Smart Carry-Over: Imports pending tasks from Yesterday to Today.
     * Checks for duplicates to prevent double-importing.
     */
    async importPendingTasksFromYesterday(targetDate: Date): Promise<{ count: number; skipped: boolean }> {
        // 1. Calculate Dates
        const yesterday = new Date(targetDate);
        yesterday.setDate(yesterday.getDate() - 1);

        const targetDateStr = formatDateForDB(targetDate);
        const yesterdayStr = formatDateForDB(yesterday);

        // 2. Fetch Data (Reuse Census Logic for consistency)
        // We need raw tasks really, but getWardCensus gives us patient-grouped tasks.
        // It's cleaner to reuse the *logic* of getWardCensus but we are inside api,
        // so we can call getWardCensus directly if we want, OR just fetch tasks.
        // Let's call getWardCensus to rely on the "Active Date" filtering logic we just mocked/fixed.
        const yesterdayCensus = await this.getWardCensus(yesterdayStr);

        // 3. Extract Tasks
        // Flatten tasks from all patients
        const yesterdayTasks: PatientTask[] = yesterdayCensus.flatMap(p => p.tasks || []);


        // 4. Filter Pending from Yesterday
        const pendingToImport = yesterdayTasks.filter(t => !t.is_completed);

        if (pendingToImport.length === 0) {
            return { count: 0, skipped: false };
        }

        // 5. Check Duplicates (Safety Guard)
        // If ANY pending task from yesterday matches a task in today (by description + patient), abort.
        // We need patient_id. PatientTask has 'id', but not 'patientId' explicitly in interface usually?
        // Wait, PatientTask interface in 'types.ts' might not have patientId?
        // Let's check getWardCensus adapter.
        // adaptPatientToCard maps tasks. The task object has 'id'.
        // It does NOT have patient_id in PatientTask interface (UI).
        // The SupabaseTask HAS patient_id.
        // So relying on getWardCensus (UI Objects) loses patient_id context unless we map it.
        // Strategy Change: Fetch RAW tasks using the same filter logic, or map patient_id.

        // Simpler Strategy: Fetch Raw Tasks inside this function using the same robust filter.
        const { data: allTasksRaw, error } = await supabase.from('tasks').select('*');
        if (error) throw error;

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

        // 6. Bulk Insert
        if (pendingRawYesterday.length > 0) {
            const newTasks = pendingRawYesterday.map(t => ({
                patient_id: t.patient_id,
                description: t.description,
                type: t.type,
                is_completed: false,
                steps: t.steps, // Preserve progress checkboxes? No, request says "Mantener IGUAL".
                // "checklist_status: Mantener IGUAL al original"
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

        // For Native Types (Lab, Imaging, etc), we just send the description.
        // We do NOT update the 'type' column explicitly unless we want to enforce consistency,
        // but the bug report focuses on description edit clearing the category.
        // Sending { description: ... } is sufficient for native types.

        const { error } = await supabase
            .from('tasks')
            .update({
                description: finalDescription,
                // Optional: We could enforce type preservation here if we wanted:
                // type: (taskType === 'consult' || taskType === 'paperwork' || taskType === 'supervision') ? 'admin' : taskType 
            })
            .eq('id', taskId);

        if (error) {
            console.error('Error updating task description:', error);
            throw error;
        }
    },

    async deleteTask(taskId: string): Promise<void> {
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', taskId);

        if (error) {
            console.error('Error deleting task:', error);
            throw error;
        }
    },

    /**
     * DEBUG ONLY: Deletes all tasks from the database.
     */
    async debug_deleteAllTasks(): Promise<void> {
        const { error } = await supabase
            .from('tasks')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all where ID is not nil (effectively all)

        if (error) {
            console.error('Error clearing tasks:', error);
            throw error;
        }
    },

    /**
     * Adds a new patient (bed) to the ward.
     */
    async addPatient(bedNumber: string): Promise<void> {
        const { error } = await supabase
            .from('patients')
            .insert([{
                bed_number: bedNumber,
                status: 'stable', // Default status
                diagnosis: '', // Empty diagnosis
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
    }
};
