import React from 'react';
import PatientCard from './PatientCard';
import NewTaskSidebar from './NewTaskSidebar';
import { api } from '../services/api';
import { useRealtimeCensus } from '../hooks/useRealtimeCensus';

const DashboardPreview: React.FC = () => {
    // Usage of the new Custom Hook
    const { patients, rawPatients, loading, error, refresh } = useRealtimeCensus();

    const handleClearTasks = async () => {
        if (!confirm('Are you sure you want to DELETE ALL TASKS? This cannot be undone.')) return;
        try {
            await api.debug_deleteAllTasks();
            // Data will reload automatically via Realtime, but we can force it 
            // to ensure UI feels responsive immediately if Realtime has delay.
            refresh();
        } catch (err) {
            console.error(err);
        }
    };

    if (loading && patients.length === 0) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <p className="text-gray-500 animate-pulse">Loading Ward Census...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                    <p className="font-bold">Error</p>
                    <p>{error}</p>
                    <button onClick={refresh} className="text-sm underline mt-2">Retry</button>
                </div>
            </div>
        );
    }

    // Prepare data for sidebar
    const sidebarPatients = rawPatients.map(p => ({
        id: p.id,
        bedNumber: `Bed ${p.bed_number}`,
        patientInitials: 'PT',
        diagnosis: p.diagnosis
    }));

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
            {/* Main Content */}
            <div className="flex-1 p-8 lg:pr-96 transition-all">
                <div className="max-w-7xl mx-auto">
                    <header className="mb-8 flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                Ward Census
                            </h1>
                            <div className="flex items-center gap-3 mt-1">
                                <p className="text-gray-500 dark:text-gray-400">
                                    {patients.length} Active Patients
                                </p>
                                <span className="text-gray-300">|</span>
                                <button
                                    onClick={async () => {
                                        await api.supabase.auth.signOut();
                                        // Router ProtectedRoute will detect change and redirect to /login
                                    }}
                                    className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                                >
                                    Sign Out
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Dev Tool: Clear Data */}
                            <button
                                onClick={handleClearTasks}
                                className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                            >
                                ADMIN: CLEAR ALL
                            </button>

                            <button
                                onClick={refresh}
                                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                                title="Reload"
                            >
                                <span className="material-symbols-outlined text-gray-600 dark:text-gray-300">refresh</span>
                            </button>
                        </div>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {patients.map((patient) => (
                            <PatientCard
                                key={patient.patientId}
                                {...patient}
                                onRefresh={refresh}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar */}
            <NewTaskSidebar
                patients={sidebarPatients}
                onTaskCreated={refresh} // Pass the hook's refresh function
            />
        </div>
    );
};

export default DashboardPreview;
