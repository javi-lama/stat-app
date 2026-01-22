import React from 'react';
import { Outlet } from 'react-router-dom';
import { useRealtimeCensus } from '../hooks/useRealtimeCensus';
import NewTaskSidebar from './NewTaskSidebar';
import { api } from '../services/api';

const MainLayout: React.FC = () => {
    // Lifted State
    const { patients, rawPatients, loading, error, refresh } = useRealtimeCensus();

    // Prepare data for sidebar
    const sidebarPatients = rawPatients.map(p => ({
        id: p.id,
        bedNumber: `Bed ${p.bed_number}`,
        patientInitials: 'PT', // This could be dynamic if we had names
        diagnosis: p.diagnosis
    }));

    return (
        <div className="flex flex-col h-screen bg-background-light text-text-main font-display overflow-hidden">
            {/* Header */}
            <header className="flex-none flex items-center justify-between border-b border-border-light bg-surface-light px-8 py-4 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="size-8 text-primary flex items-center justify-center bg-primary/10 rounded-lg">
                        <span className="material-symbols-outlined text-2xl">local_hospital</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold leading-tight tracking-tight">Hospitalist Dashboard</h2>
                        <p className="text-xs text-secondary font-medium uppercase tracking-wider">Ward 4B • Internal Medicine</p>
                    </div>
                </div>

                {/* Right Side Header Content */}
                <div className="flex items-center gap-4">
                    {/* Placeholder for Doctor Name */}
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-text-main">Dr. Sarah Chen</p>
                        <p className="text-xs text-secondary">Attending Physician</p>
                    </div>
                    <button
                        onClick={async () => await api.supabase.auth.signOut()}
                        className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden relative">
                <main className="flex-1 overflow-y-auto bg-background-light p-6 lg:p-8">
                    {/* Pass context to Dashboard */}
                    <Outlet context={{ patients, rawPatients, loading, error, refresh }} />
                </main>

                <aside className="w-80 2xl:w-96 z-20 hidden lg:flex flex-col">
                    {/* Sidebar Component fills the aside */}
                    <NewTaskSidebar patients={sidebarPatients} onTaskCreated={refresh} />
                </aside>
            </div>
        </div>
    );
};

export default MainLayout;
