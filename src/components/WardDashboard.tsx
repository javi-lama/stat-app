import React from 'react';
import { useOutletContext } from 'react-router-dom';
import PatientCard from './PatientCard';
import { api } from '../services/api';
import type { Patient, PatientTask } from '../types';
import { calculateTaskProgress } from '../lib/progressUtils';

interface DashboardContextType {
    patients: (Patient & { tasks: PatientTask[] })[];
    rawPatients: any[]; // refined type would be better if available
    loading: boolean;
    error: string | null;
    refresh: () => void;
}

const WardDashboard: React.FC = () => {
    // Consume Context from MainLayout
    const { patients, loading, error, refresh } = useOutletContext<DashboardContextType>();

    const handleClearTasks = async () => {
        if (!confirm('Are you sure you want to DELETE ALL TASKS? This cannot be undone.')) return;
        try {
            await api.debug_deleteAllTasks();
            refresh();
        } catch (err) {
            console.error(err);
        }
    };

    if (loading && patients.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-secondary animate-pulse">Loading Ward Census...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                    <p className="font-bold">Error</p>
                    <p>{error}</p>
                    <button onClick={refresh} className="text-sm underline mt-2">Retry</button>
                </div>
            </div>
        );
    }

    // Calculate Global Progress
    const globalProgress = React.useMemo(() => {
        // Flatten all tasks from all patients
        const allTasks = patients.flatMap(p => p.tasks || []);
        return calculateTaskProgress(allTasks);
    }, [patients]);

    // SVG Circle Props
    const radius = 16;
    const circumference = 2 * Math.PI * radius; // approx 100.53
    const strokeDashoffset = circumference - (globalProgress.percentage / 100) * circumference;

    return (
        <div>
            {/* Top Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-border-light dark:border-border-dark shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-secondary font-semibold uppercase">Daily Progress</p>
                        <div className="flex items-baseline gap-1 mt-1">
                            <p className={`text-2xl font-bold ${globalProgress.textClass}`}>{globalProgress.percentage}%</p>
                            <p className="text-[10px] text-secondary font-medium">{globalProgress.completedSteps}/{globalProgress.totalSteps}</p>
                        </div>
                    </div>
                    {/* Circular Progress SVG */}
                    <div className="relative size-10 flex items-center justify-center">
                        <svg className="size-10 transform -rotate-90">
                            <circle
                                className="text-gray-200 dark:text-gray-700"
                                cx="20"
                                cy="20"
                                fill="transparent"
                                r={radius}
                                stroke="currentColor"
                                strokeWidth="4"
                            ></circle>
                            <circle
                                className={`${globalProgress.textClass} transition-all duration-1000 ease-out`}
                                cx="20"
                                cy="20"
                                fill="transparent"
                                r={radius}
                                stroke="currentColor"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                strokeWidth="4"
                            ></circle>
                        </svg>
                        <span className={`material-symbols-outlined absolute ${globalProgress.textClass} text-lg`}>data_usage</span>
                    </div>
                </div>
                {/* Pending Labs - Example Static or Calculation */}
                <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-border-light dark:border-border-dark shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-secondary font-semibold uppercase">Pending Labs</p>
                        <p className="text-2xl font-bold text-sky-500">
                            {/* Mock calculation: tasks of type 'lab' that are not completed? */}
                            {patients.flatMap(p => p.tasks || []).filter(t => t.type === 'lab' && !t.is_completed).length}
                        </p>
                    </div>
                    <div className="size-10 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center">
                        <span className="material-symbols-outlined">biotech</span>
                    </div>
                </div>
                {/* Pending Consults - Example Static or Calculation */}
                <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-border-light dark:border-border-dark shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-secondary font-semibold uppercase">Pending Consults</p>
                        <p className="text-2xl font-bold text-success">
                            {/* Use 'admin' as proxy for Consults for now to satisfy TS */}
                            {patients.flatMap(p => p.tasks || []).filter(t => t.type === 'admin' && !t.is_completed).length}
                        </p>
                    </div>
                    <div className="size-10 rounded-full bg-green-50 text-success flex items-center justify-center">
                        <span className="material-symbols-outlined">stethoscope</span>
                    </div>
                </div>
                {/* Pending Images - Example Static or Calculation */}
                <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-border-light dark:border-border-dark shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-secondary font-semibold uppercase">Pending Images</p>
                        <p className="text-2xl font-bold text-purple-600">
                            {/* Use 'imaging' based on types.ts */}
                            {patients.flatMap(p => p.tasks || []).filter(t => t.type === 'imaging' && !t.is_completed).length}
                        </p>
                    </div>
                    <div className="size-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                        <span className="material-symbols-outlined">radiology</span>
                    </div>
                </div>
            </div>

            {/* Admin Controls (Subtle) */}
            <div className="mb-4 flex justify-end">
                <button
                    onClick={handleClearTasks}
                    className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                >
                    DEBUG: CLEAR TASKS
                </button>
            </div>

            {/* Patient Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 pb-20">
                {patients.map((patient: any) => (
                    <PatientCard
                        key={patient.id || patient.patientId} // fallback
                        patientId={patient.patientId}
                        bedNumber={patient.bed_number || patient.bedNumber}
                        patientInitials="PT" // patient.initials logic if exists
                        diagnosis={patient.diagnosis}
                        status={patient.status}
                        tasks={patient.tasks}
                        onRefresh={refresh}
                    />
                ))}

                {/* Empty Bed / Unoccupied Card (from HTML) - Example */}
                <div className="bg-surface-light rounded-xl shadow-sm border border-dashed border-border-light p-5 flex flex-col items-center justify-center min-h-[200px] opacity-60">
                    <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">bed</span>
                    <h3 className="text-lg font-bold text-gray-400">Bed 12</h3>
                    <p className="text-xs text-secondary">Unoccupied</p>
                </div>
            </div>
        </div>
    );
};

export default WardDashboard;
