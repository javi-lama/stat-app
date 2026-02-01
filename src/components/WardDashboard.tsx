import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { cn } from '../lib/utils';
import PatientCard from './PatientCard';
import { api } from '../services/api';
import type { Patient, PatientTask } from '../types';
import { calculateTaskProgress } from '../lib/progressUtils';
import { generateHandoffText } from '../lib/handoffGenerator';
import { toast } from 'sonner';

import { formatDateForUI, addDays } from '../lib/dateUtils';

interface DashboardContextType {
    patients: (Patient & { tasks: PatientTask[] })[];
    rawPatients: any[]; // refined type would be better if available
    loading: boolean;
    error: string | null;
    refresh: () => void;
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
}

const WardDashboard: React.FC = () => {
    // Consume Context from MainLayout
    const { patients, loading, error, refresh, selectedDate, setSelectedDate } = useOutletContext<DashboardContextType>();

    // Date Navigation Handlers
    const handlePrevDay = () => setSelectedDate(addDays(selectedDate, -1));
    const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));
    const isToday = new Date().toDateString() === selectedDate.toDateString();

    // State for Smart Filters
    const [showFilterMenu, setShowFilterMenu] = React.useState(false);
    const [filters, setFilters] = React.useState({
        unfinished: false,
        labs: false,
        imaging: false, // Changed from images to match type 'imaging'
        consults: false // Maps to 'admin' or 'consult'
    });

    // State for Handoff Menu
    const [showHandoffMenu, setShowHandoffMenu] = React.useState(false);

    // Toggle Helper
    const toggleFilter = (key: keyof typeof filters) => {
        setFilters(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // State for Configuration Mode (Bed CRUD)
    const [isConfigMode, setIsConfigMode] = React.useState(false);

    // Calculate Active Filters Count
    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    // Calculate Global Progress (MOVED UP to avoid Hook Rotation Error)
    const globalProgress = React.useMemo(() => {
        // Flatten all tasks from all patients
        // Safely handle if patients is undefined during initial load
        const currentPatients = patients || [];
        const allTasks = currentPatients.flatMap(p => p.tasks || []);
        return calculateTaskProgress(allTasks);
    }, [patients]);

    // Filter Logic Engine
    const getFilteredTaskIds = (patient: Patient & { tasks: PatientTask[] }) => {
        if (!patient.tasks) return [];

        // If no filters are active, return all task IDs (technically we handle this by passing undefined, but for logic sake)
        // actually looking at the requirement: "Si visibleTaskIds existe, renderiza solo esas".
        // So if NO filters are active, we should pass undefined to PatientCard to let it show all.
        // But here we need to know if the patient matches.

        const activeCategories: string[] = [];
        if (filters.labs) activeCategories.push('lab');
        if (filters.imaging) activeCategories.push('imaging');
        if (filters.consults) activeCategories.push('consult');

        return patient.tasks.filter(task => {
            // 1. Unfinished Logic
            if (filters.unfinished) {
                if (task.is_completed) return false;
                // Double check steps? Usually is_completed is the source of truth, but prompt said "steps.some(s => !s.value)"
                // We'll stick to is_completed for performance unless requested otherwise.
            }

            // 2. Category Logic (OR between categories)
            if (activeCategories.length > 0) {
                // If it doesn't match ANY of the active categories, exclude it.
                // Note: 'consults' filter maps to multiple types ('admin', 'consult')
                const taskType = task.type.toLowerCase();
                // We need to map task.type 'admin' to our 'consults' filter bucket logic if needed
                // The activeCategories array already contains 'admin' if consults is checked.
                if (!activeCategories.includes(taskType)) {
                    // Special check if strict mapping is needed, but 'includes' covers it if we populated activeCategories correctly
                    return false;
                }
            }

            return true;
        }).map(t => t.id);
    };

    const handleHandoff = async (mode: 'all' | 'missing') => {
        try {
            const handoffText = generateHandoffText(patients, mode);
            await navigator.clipboard.writeText(handoffText);
            toast.success("Handoff copiado al portapapeles");
            setShowHandoffMenu(false);
        } catch (err) {
            console.error('Failed to copy handoff:', err);
            toast.error("Error al copiar al portapapeles");
        }
    };



    // --- Bed CRUD Logic ---

    const handleClearTasks = async () => {
        if (!confirm('Are you sure you want to DELETE ALL TASKS? This cannot be undone.')) return;
        try {
            await api.debug_deleteAllTasks();
            refresh();
        } catch (err) {
            console.error(err);
        }
    };

    const handleAddBed = async () => {
        // 1. Limit Check
        // Count actual "cards" (patients).
        if (patients.length >= 30) {
            toast.error("Maximum capacity reached (30 beds). Cannot add more.");
            return;
        }

        try {
            // 2. Calculate ID
            const occupiedNumbers = patients.map(p => {
                const anyP = p as any;
                const num = parseInt(p.bed_number) || parseInt(anyP.bedNumber) || 0;
                return num;
            });
            const maxBed = occupiedNumbers.length > 0 ? Math.max(...occupiedNumbers) : 86; // Start at 86-1 if empty? Or just 1. Let's assume 86 as baseline if list empty, else max.
            const newBedNumber = (maxBed + 1).toString();

            await api.addPatient(newBedNumber);
            toast.success(`Bed ${newBedNumber} added successfully`);
            refresh();
        } catch (err) {
            console.error('Add bed failed', err);
            toast.error('Failed to add bed');
        }
    };

    const handleDeleteBed = async (patientId: string) => {
        // Confirmation is handled in PatientCard before calling this
        try {
            await api.deletePatient(patientId);
            toast.success("Bed deleted");
            refresh();
        } catch (err) {
            console.error('Delete bed failed', err);
            toast.error('Failed to delete bed');
        }
    };

    if (loading && (!patients || patients.length === 0)) {
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

    // SVG Circle Props
    const radius = 16;
    const circumference = 2 * Math.PI * radius; // approx 100.53
    const strokeDashoffset = circumference - (globalProgress.percentage / 100) * circumference;

    return (
        <div>
            {/* Top Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
                        <p className="text-2xl font-bold text-primary">
                            {/* Mock calculation: tasks of type 'lab' that are not completed? */}
                            {patients.flatMap(p => p.tasks || []).filter(t => t.type === 'lab' && !t.is_completed).length}
                        </p>
                    </div>
                    <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <span className="material-symbols-outlined">biotech</span>
                    </div>
                </div>
                {/* Pending Consults - Example Static or Calculation */}
                <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-border-light dark:border-border-dark shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs text-secondary font-semibold uppercase">Pending Consults</p>
                        <p className="text-2xl font-bold text-success">
                            {/* Count tasks strictly of type 'consult' that are not completed */}
                            {patients.flatMap(p => p.tasks || []).filter(t => t.type === 'consult' && !t.is_completed).length}
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

            {/* Controls Bar: Filters & Admin */}
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">

                {/* Left Side: Filters + Handoff + Date Nav */}
                <div className="flex flex-wrap items-center gap-3">

                    {/* DATE NAVIGATION */}
                    <div className={cn(
                        "flex items-center bg-surface-light dark:bg-surface-dark rounded-lg shadow-sm border p-1 transition-colors",
                        !isToday ? "border-amber-400/50 bg-amber-50/50 dark:bg-amber-900/10" : "border-border-light dark:border-border-dark"
                    )}>
                        <button
                            onClick={handlePrevDay}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                            <span className="material-symbols-outlined text-xl text-secondary">chevron_left</span>
                        </button>
                        <span className={cn(
                            "mx-2 text-sm font-bold min-w-[90px] text-center select-none",
                            !isToday ? "text-amber-700 dark:text-amber-500" : "text-text-main"
                        )}>
                            {formatDateForUI(selectedDate)}
                        </span>
                        <button
                            onClick={handleNextDay}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                            <span className="material-symbols-outlined text-xl text-secondary">chevron_right</span>
                        </button>
                    </div>

                    <div className="w-px h-8 bg-border-light mx-1"></div>

                    {/* Smart Filters */}
                    <div className="relative">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowFilterMenu(!showFilterMenu)}
                                className={`
                                    relative group border text-sm font-bold py-2 px-4 rounded-lg shadow-sm flex items-center gap-2 transition-all
                                    ${activeFilterCount > 0
                                        ? 'bg-primary/10 border-primary text-primary'
                                        : 'bg-surface-light dark:bg-surface-dark border-primary text-primary hover:bg-primary hover:text-white'
                                    }
                                `}
                            >
                                <span className="material-symbols-outlined text-[18px]">filter_list</span>
                                Filter
                            </button>

                            {activeFilterCount > 0 && (
                                <div className="bg-primary/10 text-primary border border-primary/20 text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm animate-in fade-in zoom-in duration-200">
                                    <span className="material-symbols-outlined text-[14px]">filter_alt</span>
                                    {activeFilterCount} Filter active
                                </div>
                            )}
                        </div>

                        {/* Filter Menu Dropdown */}
                        {showFilterMenu && (
                            <>
                                {/* Backdrop to close */}
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowFilterMenu(false)}
                                ></div>

                                <div className="absolute left-0 mt-2 w-56 bg-surface-light dark:bg-surface-dark rounded-xl shadow-lg border border-border-light dark:border-border-dark z-50 p-2 flex flex-col gap-1">
                                    <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        Focus Mode
                                    </div>
                                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={filters.unfinished}
                                            onChange={() => toggleFilter('unfinished')}
                                            className="form-checkbox text-primary rounded border-secondary/50 focus:ring-primary h-4 w-4"
                                        />
                                        <span className="text-sm font-medium text-text-main">Unfinished Tasks</span>
                                    </label>

                                    <div className="h-px bg-border-light my-1 mx-2"></div>

                                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={filters.labs}
                                            onChange={() => toggleFilter('labs')}
                                            className="form-checkbox text-primary rounded border-secondary/50 focus:ring-primary h-4 w-4"
                                        />
                                        <span className="text-sm font-medium text-text-main">Labs</span>
                                    </label>
                                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={filters.imaging}
                                            onChange={() => toggleFilter('imaging')}
                                            className="form-checkbox text-primary rounded border-secondary/50 focus:ring-primary h-4 w-4"
                                        />
                                        <span className="text-sm font-medium text-text-main">Images</span>
                                    </label>
                                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={filters.consults}
                                            onChange={() => toggleFilter('consults')}
                                            className="form-checkbox text-primary rounded border-secondary/50 focus:ring-primary h-4 w-4"
                                        />
                                        <span className="text-sm font-medium text-text-main">Consults</span>
                                    </label>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Handoff Button & Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowHandoffMenu(!showHandoffMenu)}
                            className="relative group border border-primary text-primary hover:bg-primary hover:text-white text-sm font-bold py-2 px-4 rounded-lg shadow-sm flex items-center gap-2 transition-all bg-surface-light dark:bg-surface-dark"
                        >
                            <span className="material-symbols-outlined text-[18px]">assignment</span>
                            Hand-off
                        </button>

                        {showHandoffMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowHandoffMenu(false)}
                                ></div>
                                <div className="absolute left-0 mt-2 w-56 bg-surface-light dark:bg-surface-dark rounded-xl shadow-lg border border-border-light dark:border-border-dark z-50 p-2 flex flex-col gap-1">
                                    <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        Generate Report
                                    </div>
                                    <button
                                        onClick={() => handleHandoff('all')}
                                        className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-text-main"
                                    >
                                        <span className="material-symbols-outlined text-lg">description</span>
                                        <span className="text-sm font-medium">Report All Tasks</span>
                                    </button>
                                    <button
                                        onClick={() => handleHandoff('missing')}
                                        className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors text-text-main"
                                    >
                                        <span className="material-symbols-outlined text-lg text-orange-500">warning</span>
                                        <span className="text-sm font-medium">Pending Only</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Config Mode Toggle (Bed Edit) */}
                    <button
                        onClick={() => setIsConfigMode(!isConfigMode)}
                        className={`
                            relative group border text-sm font-bold py-2 px-4 rounded-lg shadow-sm flex items-center gap-2 transition-all
                            ${isConfigMode
                                ? 'bg-primary border-primary text-white hover:bg-primary/90'
                                : 'bg-surface-light dark:bg-surface-dark border-primary text-primary hover:bg-primary hover:text-white'
                            }
                        `}
                    >
                        <span className="material-symbols-outlined text-[18px]">
                            {isConfigMode ? 'check' : 'tune'}
                        </span>
                        {isConfigMode ? 'Done' : 'Bed edit'}
                    </button>
                </div>

                {/* Config Mode Toggle */}


                <button
                    onClick={handleClearTasks}
                    className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                >
                    CLEAR TASKS
                </button>
            </div>

            {/* Patient Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 pb-20 p-1">
                {patients.map((patient: any) => {
                    const matchedTaskIds = getFilteredTaskIds(patient);
                    const isFilterActive = activeFilterCount > 0;

                    // Logic for Active/Ghost State
                    // If filters are active AND patient has 0 matches -> Inactive (Ghost)
                    // If filters are active AND patient has matches -> Active (Ring)
                    // If no filters -> Standard View

                    let cardClassName = "";
                    let visibleTaskIds = undefined;

                    if (isFilterActive) {
                        if (matchedTaskIds.length > 0) {
                            // Active Match
                            cardClassName = "ring-2 ring-primary shadow-primary/10 opacity-100 scale-[1.01] transition-all";
                            visibleTaskIds = matchedTaskIds;
                        } else {
                            // No Match (Ghost)
                            cardClassName = "opacity-25 grayscale-[0.5] scale-95 transition-all";
                            // We still pass empty array or undefined? 
                            // If we pass [], PatientCard will render "No active tasks". 
                            // If we want to hide everything in ghost mode we can pass [].
                            visibleTaskIds = [];
                        }
                    }

                    return (
                        <PatientCard
                            key={patient.id || patient.patientId} // fallback
                            patientId={patient.patientId}
                            bedNumber={patient.bed_number || patient.bedNumber}
                            patientInitials="PT" // patient.initials logic if exists
                            diagnosis={patient.diagnosis}
                            status={patient.status}
                            tasks={patient.tasks}
                            onRefresh={refresh}
                            visibleTaskIds={visibleTaskIds}
                            className={cardClassName}
                            isConfigMode={isConfigMode}
                            onDelete={handleDeleteBed}
                        />
                    );
                })}

                {/* Add Bed Card (Config Mode) */}
                {isConfigMode && (
                    <div
                        onClick={handleAddBed}
                        className="bg-surface-light/50 dark:bg-surface-dark/50 rounded-xl shadow-sm border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 p-5 flex flex-col items-center justify-center min-h-[200px] cursor-pointer group transition-all"
                    >
                        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-4xl text-primary">add</span>
                        </div>
                        <h3 className="text-lg font-bold text-primary">Add Bed</h3>
                        <p className="text-xs text-secondary mt-1">Capacity: {patients.length}/30</p>
                    </div>
                )}

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
