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
    description: string;
    is_completed: boolean;
    steps?: TaskStep[]; // Updated to object array
    type: 'lab' | 'imaging' | 'admin' | 'procedure';
    created_at: string;
}

export interface PatientCardProps {
    patientId: string;
    bedNumber: string;
    patientInitials: string;
    diagnosis: string;
    status: 'stable' | 'critical' | 'ready';
    tasks: PatientTask[];
    onRefresh?: () => void;
}
