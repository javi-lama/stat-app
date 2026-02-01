import React from 'react';
import { Outlet } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { useRealtimeCensus } from '../hooks/useRealtimeCensus';
import NewTaskSidebar from './NewTaskSidebar';
import { api } from '../services/api';

const MainLayout: React.FC = () => {
    // Lifted State: Date Navigation
    const [selectedDate, setSelectedDate] = React.useState(new Date());

    // Census Data depends on Date
    const { patients, rawPatients, loading, error, refresh } = useRealtimeCensus(selectedDate);

    // Prepare data for sidebar
    const sidebarPatients = rawPatients.map(p => ({
        id: p.id,
        bedNumber: `Bed ${p.bed_number}`,
        patientInitials: 'PT', // This could be dynamic if we had names
        diagnosis: p.diagnosis
    }));

    // Mobile Task Drawer State
    const [isMobileTaskOpen, setIsMobileTaskOpen] = React.useState(false);

    // User State
    const [user, setUser] = React.useState<User | null>(null);

    React.useEffect(() => {
        api.supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
        });
    }, []);

    return (
        <div className="flex flex-col h-screen bg-background-light text-text-main font-display overflow-hidden">
            {/* Header */}
            <header className="flex-none flex items-center justify-between border-b border-border-light bg-surface-light px-4 sm:px-8 py-4 z-30 shadow-sm relative">
                <div className="flex items-center gap-3">
                    <img src="/logo.svg" alt="Logo" className="w-11 h-11" />
                    <div className="flex flex-col justify-center">
                        <h2 className="text-xl font-bold leading-tight tracking-tight">STAT.</h2>
                        <p className="text-xs text-secondary font-medium uppercase tracking-wider">Medicina A2 • Internal Medicine</p>
                    </div>
                </div>

                {/* Right Side Header Content */}
                <div className="flex items-center gap-4">


                    {/* User Profile */}
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-text-main">{user?.email || 'Loading...'}</p>
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
                <main className="flex-1 overflow-y-auto bg-background-light p-4 lg:p-6">
                    {/* Pass context to Dashboard */}
                    <Outlet context={{ patients, rawPatients, loading, error, refresh, selectedDate, setSelectedDate }} />

                    {/* Premium Micro-Footer */}
                    <footer className="py-6 mt-8 text-center">
                        <p className="text-[10px] text-slate-300 dark:text-slate-600 font-light tracking-wider">
                            STAT. © 2026 | Engineered for High-Performance Medicine by Divini Technologies
                        </p>
                    </footer>
                </main>

                <aside className="w-80 2xl:w-96 z-20 hidden xl:flex flex-col border-l border-border-light bg-surface-light">
                    {/* Sidebar Component fills the aside (Desktop) */}
                    <NewTaskSidebar patients={sidebarPatients} onTaskCreated={refresh} selectedDate={selectedDate} />
                </aside>



                {/* Floating Action Button (FAB) - Mobile/Tablet/Laptop (< XL) */}
                <button
                    onClick={() => setIsMobileTaskOpen(true)}
                    className="xl:hidden fixed bottom-6 right-6 size-14 bg-primary text-white rounded-full shadow-lg shadow-primary/40 flex items-center justify-center hover:bg-primary-hover hover:scale-105 transition-all z-40"
                    aria-label="Add Task"
                >
                    <span className="material-symbols-outlined text-3xl">add</span>
                </button>

                {/* Mobile/Tablet Task Drawer Overlay */}
                {isMobileTaskOpen && (
                    <div className="fixed inset-0 z-50 flex justify-end xl:hidden">
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                            onClick={() => setIsMobileTaskOpen(false)}
                        ></div>

                        {/* Drawer Panel */}
                        <div className="relative w-full max-w-sm h-full bg-surface-light shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                            {/* Drawer Header with Close Button */}
                            <div className="p-4 border-b border-border-light flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                                <h3 className="font-bold text-lg">Add New Task</h3>
                                <button
                                    onClick={() => setIsMobileTaskOpen(false)}
                                    className="size-8 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-xl">close</span>
                                </button>
                            </div>

                            {/* Reuse Content */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="h-full">
                                    <NewTaskSidebar patients={sidebarPatients} onTaskCreated={() => {
                                        refresh();
                                        setIsMobileTaskOpen(false); // Close on success
                                    }} selectedDate={selectedDate} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};

export default MainLayout;
