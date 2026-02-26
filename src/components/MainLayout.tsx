import React from 'react';
import { Outlet } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { useRealtimeCensus } from '../hooks/useRealtimeCensus';
import NewTaskSidebar from './NewTaskSidebar';
import { api } from '../services/api';
import { useAppContext } from '../contexts/AppContext';
import WardLobby from './WardLobby';

const MainLayout: React.FC = () => {
    // Lifted State: Date Navigation
    const [selectedDate, setSelectedDate] = React.useState(new Date());

    // Tab State (React-controlled)
    const [activeTab, setActiveTab] = React.useState<'dashboard' | 'evos'>('dashboard');

    // Mobile Tab Dropdown State
    const [isTabDropdownOpen, setIsTabDropdownOpen] = React.useState(false);

    // Derived State: Is Today Check (for Amber Warning)
    const isToday = new Date().toDateString() === selectedDate.toDateString();

    // Context State
    const { activeWard, isAuthLoading } = useAppContext();

    // Census Data depends on Date AND Ward (Multi-Tenant Isolation)
    const { patients, rawPatients, loading, error, refresh } = useRealtimeCensus(
        selectedDate,
        activeWard?.id || null
    );

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

    // Gatekeeper Barrier
    if (isAuthLoading) {
        return (
            <div className="flex flex-col h-screen bg-background-light items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!activeWard) {
        return <WardLobby />;
    }

    return (
        <div className="flex flex-col h-screen bg-background-light text-text-main font-display overflow-hidden">
            {/* Header v2.0 */}
            <header className="flex-none flex items-center justify-between border-b border-border-light bg-white px-4 sm:px-8 py-3 z-30 shadow-sm relative sticky top-0">
                {/* Left Zone: Branding & Ward Context */}
                <div className="flex items-center gap-6 min-w-0">
                    {/* Brand */}
                    <div className="flex items-center gap-3 shrink-0">
                        <img src="/logo.svg" alt="STAT." className="w-10 h-10 drop-shadow-sm" />
                        <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-800 hidden sm:block">STAT.</h2>
                    </div>

                    {/* Divider */}
                    <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

                    {/* Ward Status Indicator */}
                    <div className="flex items-center gap-2 truncate">
                        <span className="text-sm text-slate-500 hidden md:inline-block">Trabajando en:</span>
                        <div className="bg-primary/10 border border-primary/20 px-3 py-1 rounded-md flex items-center gap-2 truncate">
                            <span className="text-sm font-bold text-primary truncate uppercase tracking-wider">{activeWard.name}</span>
                        </div>
                    </div>
                </div>

                {/* Center Zone: Temporal Navigation was removed here based on v2.0 design */}
                <div className="absolute left-1/2 -translate-x-1/2 hidden lg:flex items-center">
                    {/* Empty center for cleaner look in top bar */}
                </div>

                {/* Right Zone: User Settings & Session */}
                <div className="flex items-center gap-4 sm:gap-6 shrink-0">

                    {/* Settings Button */}
                    <button
                        onClick={() => { }}
                        className="text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center rounded-full hover:bg-slate-100 p-2"
                        title="Configuración"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>

                    {/* Divider */}
                    <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

                    {/* User Profile Info */}
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-100 border border-slate-200 rounded-md p-1.5 hidden sm:flex items-center justify-center text-slate-500">
                            <span className="material-symbols-outlined text-[18px]">person</span>
                        </div>
                        <p className="text-sm font-medium text-slate-700 hidden lg:block truncate max-w-[150px]">
                            {user?.email || 'Dr. Account'}
                        </p>
                    </div>

                    {/* Sign Out Action */}
                    <button
                        onClick={async () => await api.supabase.auth.signOut()}
                        className="text-sm font-medium text-rose-500 hover:text-rose-600 transition-colors ml-2"
                    >
                        Cerrar Sesión
                    </button>
                </div>
            </header>

            <div className="flex flex-col flex-1 overflow-hidden relative">

                {/* Secondary Header (Tabs & Date Navigation) v2.0 - Refactored */}
                <div className="flex-none w-full bg-white border-b border-border-light z-20 shadow-sm flex items-center px-4 sm:px-8 py-2 gap-4">

                    {/* Date Navigation - Amber Warning State when !isToday */}
                    <div className={`flex items-center rounded-full shadow-sm p-1 h-9 shrink-0 transition-colors ${
                        isToday
                            ? 'bg-white border border-slate-200'
                            : 'bg-amber-50 border-2 border-amber-400'
                    }`}>
                        <button
                            onClick={() => {
                                const newDate = new Date(selectedDate);
                                newDate.setDate(newDate.getDate() - 1);
                                setSelectedDate(newDate);
                            }}
                            className={`px-2 h-full rounded-l-full hover:bg-slate-100 transition-colors flex items-center ${
                                isToday ? 'text-primary' : 'text-amber-700'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                        </button>

                        <span className={`px-3 text-sm font-bold min-w-[100px] text-center uppercase tracking-wide whitespace-nowrap ${
                            isToday ? 'text-primary' : 'text-amber-700'
                        }`}>
                            {isToday ? 'Hoy' : selectedDate.toLocaleDateString('es-ES', { weekday: 'short' })}, {selectedDate.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }).replace('.', '')}
                        </span>

                        <button
                            onClick={() => {
                                const newDate = new Date(selectedDate);
                                newDate.setDate(newDate.getDate() + 1);
                                setSelectedDate(newDate);
                            }}
                            className={`px-2 h-full rounded-r-full hover:bg-slate-100 transition-colors flex items-center ${
                                isToday ? 'text-primary' : 'text-amber-700'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                        </button>
                    </div>

                    {/* Mobile: Dropdown Tab Selector (< sm) */}
                    <div className="relative sm:hidden">
                        <button
                            onClick={() => setIsTabDropdownOpen(!isTabDropdownOpen)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#30889E] text-white font-bold text-sm tracking-wider rounded-lg shadow-sm"
                        >
                            <span>{activeTab === 'dashboard' ? 'DASHBOARD' : 'EVOS & BH'}</span>
                            <span className={`material-symbols-outlined text-[16px] transition-transform ${isTabDropdownOpen ? 'rotate-180' : ''}`}>
                                expand_more
                            </span>
                        </button>

                        {/* Dropdown Menu */}
                        {isTabDropdownOpen && (
                            <>
                                {/* Backdrop to close */}
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsTabDropdownOpen(false)}
                                />
                                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 z-50 min-w-[160px] overflow-hidden">
                                    <button
                                        onClick={() => {
                                            setActiveTab('dashboard');
                                            setIsTabDropdownOpen(false);
                                        }}
                                        className={`w-full px-4 py-3 text-left text-sm font-bold tracking-wider flex items-center justify-between ${
                                            activeTab === 'dashboard'
                                                ? 'bg-[#30889E]/10 text-[#30889E]'
                                                : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        DASHBOARD
                                        {activeTab === 'dashboard' && (
                                            <span className="material-symbols-outlined text-[16px]">check</span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setActiveTab('evos');
                                            setIsTabDropdownOpen(false);
                                        }}
                                        className={`w-full px-4 py-3 text-left text-sm font-bold tracking-wider flex items-center justify-between ${
                                            activeTab === 'evos'
                                                ? 'bg-[#30889E]/10 text-[#30889E]'
                                                : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        EVOS & BH
                                        {activeTab === 'evos' && (
                                            <span className="material-symbols-outlined text-[16px]">check</span>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Desktop/Tablet: Horizontal Tabs (≥ sm) */}
                    <div className="hidden sm:flex items-center gap-2">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-6 py-2 font-bold text-sm tracking-wider rounded-lg whitespace-nowrap transition-colors ${
                                activeTab === 'dashboard'
                                    ? 'bg-[#30889E] text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                        >
                            DASHBOARD
                        </button>
                        <button
                            onClick={() => setActiveTab('evos')}
                            className={`px-6 py-2 font-bold text-sm tracking-wider rounded-lg whitespace-nowrap transition-colors ${
                                activeTab === 'evos'
                                    ? 'bg-[#30889E] text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                        >
                            EVOS & BH
                        </button>
                    </div>

                    {/* Spacer - Pushes nothing, allows natural flow */}
                    <div className="flex-1"></div>
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                    <main className="flex-1 overflow-y-auto bg-[#F8FAFC] p-4 lg:p-6">
                        {/* Pass context to Dashboard */}
                        <Outlet context={{ patients, rawPatients, loading, error, refresh, selectedDate, setSelectedDate }} />

                        {/* Premium Micro-Footer */}
                        <footer className="py-6 mt-8 text-center">
                            <p className="text-[10px] text-slate-400 font-light tracking-wider">
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
                        aria-label="Añadir Tarea"
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
                                <div className="p-4 border-b border-border-light flex justify-between items-center bg-gray-50">
                                    <h3 className="font-bold text-lg">Añadir Tarea</h3>
                                    <button
                                        onClick={() => setIsMobileTaskOpen(false)}
                                        className="size-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
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
        </div>
    );
};

export default MainLayout;
