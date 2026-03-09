import React from 'react';
import { useOutletContext } from 'react-router-dom';
import PatientCard from './PatientCard';
import { api } from '../services/api';
import type { Patient, PatientTask } from '../types';
import { calculateTaskProgress } from '../lib/progressUtils';
import { generateHandoffText } from '../lib/handoffGenerator';
import { toast } from 'sonner';
import { useAppContext } from '../contexts/AppContext';

import { formatDateForUI, formatDateForDB } from '../lib/dateUtils';

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
    const { patients, loading, error, refresh, selectedDate } = useOutletContext<DashboardContextType>();

    // Multi-Tenant: Get active ward from AppContext
    const { activeWard } = useAppContext();

    // Date Navigation Handlers (MOVED TO MAINLAYOUT)
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
        if (!activeWard?.id) {
            toast.error('No hay servicio médico activo');
            return;
        }

        const dateStr = formatDateForUI(selectedDate);
        if (!confirm(`¿Seguro que deseas BORRAR TODAS LAS TAREAS para el ${dateStr}? Esto no se puede deshacer.`)) return;

        try {
            // Convert to DB format YYYY-MM-DD (timezone-safe)
            const dbDate = formatDateForDB(selectedDate);

            // Multi-Tenant: Pass wardId for ward-scoped deletion
            const deletedIds = await api.clearTasksForDate(dbDate, activeWard.id);
            refresh();

            toast.success(`Todas las tareas del ${dateStr} fueron borradas`, {
                action: {
                    label: 'DESHACER',
                    onClick: async () => {
                        const loadingToast = toast.loading("Restaurando tareas...");
                        try {
                            await api.restoreTasks(deletedIds);
                            refresh();
                            toast.dismiss(loadingToast);
                            toast.success("¡Tareas restauradas!");
                        } catch (err) {
                            console.error("Restore failed", err);
                            toast.dismiss(loadingToast);
                            toast.error("Error al restaurar las tareas");
                        }
                    }
                },
                duration: 5000,
            });
        } catch (err) {
            console.error(err);
            toast.error("Error al borrar las tareas");
        }
    };

    const handleAddBed = async () => {
        // Multi-Tenant: Require active ward
        if (!activeWard?.id) {
            toast.error('No hay servicio médico activo');
            return;
        }

        // 1. Limit Check
        // Count actual "cards" (patients).
        if (patients.length >= 30) {
            toast.error("Capacidad máxima alcanzada (30 camas). No se pueden añadir más.");
            return;
        }

        try {
            // 2. Calculate ID
            const occupiedNumbers = patients.map(p => {
                const anyP = p as any;
                const num = parseInt(p.bed_number) || parseInt(anyP.bedNumber) || 0;
                return num;
            });
            const maxBed = occupiedNumbers.length > 0 ? Math.max(...occupiedNumbers) : 86;
            const newBedNumber = (maxBed + 1).toString();

            // Multi-Tenant: Associate patient with ward
            await api.addPatient(newBedNumber, activeWard.id);
            toast.success(`Cama ${newBedNumber} añadida exitosamente`);
            refresh();
        } catch (err) {
            console.error('Add bed failed', err);
            toast.error('Error al añadir cama');
        }
    };

    const handleDeleteBed = async (patientId: string) => {
        // Confirmation is handled in PatientCard before calling this
        try {
            await api.deletePatient(patientId);
            toast.success("Cama borrada");
            refresh();
        } catch (err) {
            console.error('Delete bed failed', err);
            toast.error('Error al borrar la cama');
        }
    };

    if (loading && (!patients || patients.length === 0)) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-secondary animate-pulse">Cargando Censo...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="bg-red-50 text-red-600 p-4 rounded-lg border border-red-200">
                    <p className="font-bold">Error</p>
                    <p>{error}</p>
                    <button onClick={refresh} className="text-sm underline mt-2">Reintentar</button>
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
                <div className="bg-white p-4 rounded-xl border border-border-light border-l-4 border-l-primary shadow-sm flex items-center justify-between min-h-[100px]">
                    <div>
                        <p className="text-xs text-secondary font-semibold uppercase">Progreso Diario</p>
                        <div className="flex items-baseline gap-1 mt-1">
                            <p className={`text-2xl font-bold ${globalProgress.textClass}`}>{globalProgress.percentage}%</p>
                            <p className="text-[10px] text-secondary font-medium">{globalProgress.completedSteps}/{globalProgress.totalSteps}</p>
                        </div>
                    </div>
                    {/* Circular Progress SVG */}
                    <div className="relative size-10 flex items-center justify-center">
                        <svg className="size-10 transform -rotate-90">
                            <circle
                                className="text-gray-200"
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
                <div className="bg-white p-4 rounded-xl border border-border-light border-l-4 border-l-primary shadow-sm flex items-center justify-between min-h-[100px]">
                    <div>
                        <p className="text-xs text-secondary font-semibold uppercase">Labs Pendientes</p>
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
                <div className="bg-white p-4 rounded-xl border border-border-light border-l-4 border-l-success shadow-sm flex items-center justify-between min-h-[100px]">
                    <div>
                        <p className="text-xs text-secondary font-semibold uppercase">Consultas Pendientes</p>
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
                <div className="bg-white p-4 rounded-xl border border-border-light border-l-4 border-l-purple-500 shadow-sm flex items-center justify-between min-h-[100px]">
                    <div>
                        <p className="text-xs text-secondary font-semibold uppercase">Imágenes Pendientes</p>
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
            <div className="flex flex-wrap justify-between items-start mb-6 gap-2 sm:gap-4">

                {/* Left Side: Filters + Handoff + Date Nav */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">

                    {/* DATE NAVIGATION MOVED TO SECONDARY HEADER */}

                    {/* Import Pending Button + Divider (Only Today) */}
                    {isToday && (
                        <>
                            <button
                                onClick={async () => {
                                    // Multi-Tenant: Require active ward
                                    if (!activeWard?.id) {
                                        toast.error('No hay servicio médico activo');
                                        return;
                                    }

                                    const toastId = toast.loading('Importando tareas pendientes...');
                                    try {
                                        // Multi-Tenant: Pass wardId for ward-scoped import
                                        const result = await api.importPendingTasksFromYesterday(selectedDate, activeWard.id);
                                        if (result.skipped) {
                                            toast.error('¡Las tareas ya fueron importadas hoy!', { id: toastId });
                                        } else if (result.count === 0) {
                                            toast.info('No hay tareas pendientes de ayer.', { id: toastId });
                                        } else {
                                            toast.success(`Se importaron ${result.count} tareas de ayer.`, { id: toastId });
                                            refresh(); // Reload Dashboard
                                        }
                                    } catch (error) {
                                        console.error(error);
                                        toast.error('Error al importar tareas.', { id: toastId });
                                    }
                                }}
                                className="relative group border border-primary text-sm font-bold min-h-11 py-2 px-3 sm:px-4 rounded-lg shadow-sm flex items-center gap-2 transition-all active:scale-[0.98] bg-white text-primary hover:bg-primary hover:text-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                                title="Importar tareas pendientes de ayer"
                                aria-label="Importar tareas pendientes de ayer"
                            >
                                <span className="material-symbols-outlined text-[18px]">autorenew</span>
                                <span className="hidden sm:inline">Importar Pendientes</span>
                            </button>
                            {/* Divider - Conditional with Import Button */}
                            <div className="hidden sm:block w-px h-8 bg-border-light mx-1"></div>
                        </>
                    )}

                    {/* Smart Filters */}
                    <div className="relative">
                        <button
                            onClick={() => setShowFilterMenu(!showFilterMenu)}
                            className={`
                                relative group border text-sm font-bold min-h-11 py-2 px-3 sm:px-4 rounded-lg shadow-sm flex items-center gap-2 transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                                ${activeFilterCount > 0
                                    ? 'bg-primary/10 border-primary text-primary'
                                    : 'bg-white border-primary text-primary hover:bg-primary hover:text-white'
                                }
                            `}
                            aria-label="Filtrar tareas"
                        >
                            <span className="material-symbols-outlined text-[18px]">filter_list</span>
                            <span className="hidden sm:inline">Filtrar</span>
                            {activeFilterCount > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 size-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {/* Filter Menu Dropdown */}
                        {showFilterMenu && (
                            <>
                                {/* Backdrop to close */}
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowFilterMenu(false)}
                                ></div>

                                <div className="fixed bottom-0 inset-x-0 rounded-t-2xl max-h-[60vh] overflow-y-auto sm:absolute sm:bottom-auto sm:inset-auto sm:left-0 sm:mt-2 sm:w-56 sm:rounded-xl sm:max-h-none bg-white shadow-lg border border-border-light z-50 p-3 sm:p-2 flex flex-col gap-1" role="menu">
                                    <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Modo Enfoque
                                    </div>
                                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors" role="menuitem">
                                        <input
                                            type="checkbox"
                                            checked={filters.unfinished}
                                            onChange={() => toggleFilter('unfinished')}
                                            className="form-checkbox text-primary rounded border-secondary/50 focus:ring-primary h-4 w-4"
                                        />
                                        <span className="text-sm font-medium text-text-main">Tareas Incompletas</span>
                                    </label>

                                    <div className="h-px bg-border-light my-1 mx-2"></div>

                                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors" role="menuitem">
                                        <input
                                            type="checkbox"
                                            checked={filters.labs}
                                            onChange={() => toggleFilter('labs')}
                                            className="form-checkbox text-primary rounded border-secondary/50 focus:ring-primary h-4 w-4"
                                        />
                                        <span className="text-sm font-medium text-text-main">Labs</span>
                                    </label>
                                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors" role="menuitem">
                                        <input
                                            type="checkbox"
                                            checked={filters.imaging}
                                            onChange={() => toggleFilter('imaging')}
                                            className="form-checkbox text-primary rounded border-secondary/50 focus:ring-primary h-4 w-4"
                                        />
                                        <span className="text-sm font-medium text-text-main">Imágenes</span>
                                    </label>
                                    <label className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors" role="menuitem">
                                        <input
                                            type="checkbox"
                                            checked={filters.consults}
                                            onChange={() => toggleFilter('consults')}
                                            className="form-checkbox text-primary rounded border-secondary/50 focus:ring-primary h-4 w-4"
                                        />
                                        <span className="text-sm font-medium text-text-main">Consultas</span>
                                    </label>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Handoff Button & Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowHandoffMenu(!showHandoffMenu)}
                            className="relative group border border-primary text-primary hover:bg-primary hover:text-white text-sm font-bold min-h-11 py-2 px-3 sm:px-4 rounded-lg shadow-sm flex items-center gap-2 transition-all active:scale-[0.98] bg-white focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                            aria-label="Generar reporte de entrega"
                        >
                            <span className="material-symbols-outlined text-[18px]">assignment</span>
                            <span className="hidden sm:inline">Entregar Guardia</span>
                        </button>

                        {showHandoffMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowHandoffMenu(false)}
                                ></div>
                                <div className="fixed bottom-0 inset-x-0 rounded-t-2xl max-h-[60vh] overflow-y-auto sm:absolute sm:bottom-auto sm:inset-auto sm:left-0 sm:mt-2 sm:w-56 sm:rounded-xl sm:max-h-none bg-white shadow-lg border border-border-light z-50 p-3 sm:p-2 flex flex-col gap-1" role="menu">
                                    <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        Generar Reporte
                                    </div>
                                    <button
                                        onClick={() => handleHandoff('all')}
                                        className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors text-text-main"
                                        role="menuitem"
                                    >
                                        <span className="material-symbols-outlined text-lg">description</span>
                                        <span className="text-sm font-medium">Todas las Tareas</span>
                                    </button>
                                    <button
                                        onClick={() => handleHandoff('missing')}
                                        className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg transition-colors text-text-main"
                                        role="menuitem"
                                    >
                                        <span className="material-symbols-outlined text-lg text-orange-500">warning</span>
                                        <span className="text-sm font-medium">Solo Pendientes</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Config Mode Toggle (Bed Edit) */}
                    <button
                        onClick={() => setIsConfigMode(!isConfigMode)}
                        className={`
                            relative group border text-sm font-bold min-h-11 py-2 px-3 sm:px-4 rounded-lg shadow-sm flex items-center gap-2 transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
                            ${isConfigMode
                                ? 'bg-primary border-primary text-white hover:bg-primary/90'
                                : 'bg-white border-primary text-primary hover:bg-primary hover:text-white'
                            }
                        `}
                        aria-label="Editar configuración de cama"
                    >
                        <span className="material-symbols-outlined text-[18px]">
                            {isConfigMode ? 'check' : 'tune'}
                        </span>
                        <span className="hidden sm:inline">{isConfigMode ? 'Listo' : 'Editar Camas'}</span>
                    </button>
                </div>

                {/* Config Mode Toggle */}


                <button
                    onClick={handleClearTasks}
                    className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                >
                    BORRAR TAREAS
                </button>
            </div>

            {/* Patient Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6 pb-20 p-1">
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
                        className="bg-white/50 rounded-xl shadow-sm border-2 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 p-5 flex flex-col items-center justify-center min-h-[200px] cursor-pointer group transition-all"
                    >
                        <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-4xl text-primary">add</span>
                        </div>
                        <h3 className="text-lg font-bold text-primary">Añadir Cama</h3>
                        <p className="text-xs text-secondary mt-1">Capacidad: {patients.length}/30</p>
                    </div>
                )}

                {/* Empty Bed / Unoccupied Card (from HTML) - Example */}
                <div className="bg-surface-light rounded-xl shadow-sm border border-dashed border-border-light p-5 flex flex-col items-center justify-center min-h-[200px] opacity-60">
                    <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">bed</span>
                    <h3 className="text-lg font-bold text-gray-400">Bed 12</h3>
                    <p className="text-xs text-secondary">Desocupada</p>
                </div>
            </div>
        </div>
    );
};

export default WardDashboard;
