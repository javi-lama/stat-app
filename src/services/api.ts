import { supabase } from '../supabaseClient';
import type { PatientCardProps, PatientTask } from '../types';

// DB Types (Raw from Supabase)
export interface SupabaseTask {
    id: string;
    patient_id: string;
    description: string;
    type: 'lab' | 'imaging' | 'admin' | 'procedure';
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
     * Fetches all patients and their active tasks.
     */
    async getWardCensus(): Promise<SupabasePatient[]> {
        const { data, error } = await supabase
            .from('patients')
            .select(`
                *,
                tasks (*)
            `)
        // .order('bed_number', { ascending: true }); // Removed to avoid string sort (100 < 87)


        if (error) {
            console.error('Error fetching ward census:', error);
            throw error;
        }

        // Numeric Sort for correct ordering (89 -> 100)
        if (data) {
            data.sort((a, b) => {
                const numA = parseInt(a.bed_number) || 0;
                const numB = parseInt(b.bed_number) || 0;
                return numA - numB;
            });
        }

        return data as SupabasePatient[];
    },

    /**
     * Adapts DB patient data to UI Card props.
     */
    adaptPatientToCard(patient: any): PatientCardProps {
        // Transform DB relation to UI format
        const tasks: PatientTask[] = (patient.tasks || []).map((t: any) => ({
            id: t.id,
            description: t.description,
            is_completed: t.is_completed,
            type: t.type || 'admin',
            steps: t.steps || [],
        }));

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
        category: 'lab' | 'imaging' | 'admin' | 'procedure';
        type: 'clinical' | 'admin'; // workflow_type
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

        const { error } = await supabase
            .from('tasks')
            .insert({
                patient_id: payload.patient_id,
                description: payload.description,
                type: payload.category,
                is_completed: false, // Initial state always false
                steps: steps
            });

        if (error) {
            console.error('Error creating task:', error);
            throw error;
        }
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

    async updateTaskDescription(taskId: string, newDescription: string): Promise<void> {
        const { error } = await supabase
            .from('tasks')
            .update({ description: newDescription })
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
    }
};
