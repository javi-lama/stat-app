export interface Patient {
    id: string;
    bed_number: string;
    diagnosis: string;
    status: 'stable' | 'critical' | 'discharge_ready';
    admission_date: string;
    created_at?: string;
}

export interface TaskStep {
    label: string;
    value: boolean;
}

export interface PatientTask {
    id: string;
    patient_id?: string; // Added for optimistic updates
    description: string;
    is_completed: boolean;
    steps?: TaskStep[]; // Updated to object array
    type: 'lab' | 'imaging' | 'admin' | 'procedure' | 'consult' | 'paperwork' | 'supervision';
    created_at: string;
    task_date?: string; // YYYY-MM-DD
    isOptimistic?: boolean; // Flag for temporary tasks
    tempId?: string; // Temporary ID for optimistic updates
}

export interface PatientCardProps {
    patientId: string;
    bedNumber: string;
    patientInitials: string;
    diagnosis: string;
    status: 'stable' | 'critical' | 'ready';
    tasks: PatientTask[];
    onRefresh?: () => void;
    // Bed Config Props
    isConfigMode?: boolean;
    onDelete?: (id: string) => void;
    // Smart Filter Props
    visibleTaskIds?: string[];
    className?: string; // For "Ghost" or "Active" styling from parent
}
