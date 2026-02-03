import React, { useState, useRef } from 'react';
import type { PatientTask } from '../types'; // PatientCardProps moved to this file
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { api } from '../services/api';
import { calculateTaskProgress } from '../lib/progressUtils';
import { useOptimisticMutations } from '../hooks/useOptimisticMutations';

// Update Props Interface
export interface PatientCardProps {
    patientId: string;
    bedNumber: string;
    patientInitials: string;
    diagnosis: string;
    status: 'stable' | 'critical' | 'ready';
    tasks: PatientTask[];
    onRefresh?: () => void;
    visibleTaskIds?: string[];
    className?: string;
    isConfigMode?: boolean; // NEW
    onDelete?: (id: string) => void; // NEW
}

// Fallback helper
const getTaskIcon = (type: string) => {
    // Normalize type just in case
    const normalized = type.toLowerCase();

    // Explicit mappings
    if (normalized === 'lab') return 'science';
    if (normalized === 'imaging') return 'image';

    // Let's map strict keys
    if (normalized === 'consult') return 'stethoscope';

    switch (normalized) {
        case 'lab': return 'science';
        case 'imaging': return 'radiology';
        case 'consult': return 'person_search';
        case 'paperwork': return 'description';
        case 'supervision': return 'visibility';
        case 'procedure': return 'healing';
        case 'admin': return 'description';
        default: return 'help_center';
    }
};

const PatientCard: React.FC<PatientCardProps> = ({
    patientId,
    bedNumber,
    patientInitials,
    diagnosis,
    tasks: initialTasks,
    visibleTaskIds,
    className,
    onRefresh,
    isConfigMode,
    onDelete,
    ...props // Capture rest including status
}) => {
    // 1. Local State for Optimistic UI
    const [tasksState, setTasksState] = useState<PatientTask[]>(initialTasks || []);

    // Calculate Progress dynamically from local state using ALL TASKS (User requirement: ignore filter for progress)
    const progressStats = calculateTaskProgress(tasksState);

    // Dynamic Styling: Calculate "Ready" state from LOCAL state for immediate feedback
    const isAllCompleted = tasksState.length > 0 && tasksState.every(t => t.is_completed);

    // Filter Logic for RENDERING ONLY
    const tasksToRender = visibleTaskIds
        ? tasksState.filter(t => visibleTaskIds.includes(t.id) || t.isOptimistic)
        : tasksState;

    // Diagnosis Editing State
    const [isEditingDiagnosis, setIsEditingDiagnosis] = useState(false);
    const [diagnosisText, setDiagnosisText] = useState(diagnosis);
    const diagnosisInputRef = useRef<HTMLInputElement>(null);

    // Bed Editing State
    const [isEditingBed, setIsEditingBed] = useState(false);
    const [bedNumberText, setBedNumberText] = useState(bedNumber);
    const bedInputRef = useRef<HTMLInputElement>(null);

    // Sync state with props (Fix for Realtime/Refetch updates)
    React.useEffect(() => {
        setTasksState(initialTasks || []);
    }, [initialTasks]);

    React.useEffect(() => {
        setDiagnosisText(diagnosis);
    }, [diagnosis]);

    React.useEffect(() => {
        if (isEditingDiagnosis && diagnosisInputRef.current) {
            diagnosisInputRef.current.focus();
        }
    }, [isEditingDiagnosis]);

    React.useEffect(() => {
        setBedNumberText(bedNumber);
    }, [bedNumber]);

    React.useEffect(() => {
        if (isEditingBed && bedInputRef.current) {
            bedInputRef.current.focus();
        }
    }, [isEditingBed]);

    // Optimistic Mutations Hook
    const { toggleTaskOptimistic } = useOptimisticMutations(
        patientId,
        tasksState,
        setTasksState,
        onRefresh
    );

    // Diagnosis Save Handler
    const handleSaveDiagnosis = async () => {
        if (diagnosisText.trim() === diagnosis) {
            setIsEditingDiagnosis(false);
            return;
        }

        try {
            // Optimistic update (local state already updated via input onChange)
            setIsEditingDiagnosis(false);
            await api.updatePatientDiagnosis(patientId, diagnosisText);
            toast.success('Diagnosis updated');
            // Immediate Parent Refresh to update Dropdowns
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Diagnosis update failed:', error);
            setDiagnosisText(diagnosis); // Rollback
            toast.error('Failed to update diagnosis');
        }
    };

    // Bed Save Handler
    const handleSaveBedNumber = async () => {
        if (bedNumberText.trim() === bedNumber) {
            setIsEditingBed(false);
            return;
        }

        try {
            setIsEditingBed(false);
            await api.updateBedNumber(patientId, bedNumberText);
            toast.success('Bed number updated');
            if (onRefresh) onRefresh(); // Trigger re-sort
        } catch (error) {
            console.error('Bed update failed:', error);
            setBedNumberText(bedNumber); // Rollback
            toast.error('Failed to update bed number');
        }
    };

    // Task Description Edit Handler
    const handleEditTask = async (taskId: string, currentDescription: string, taskType: PatientTask['type']) => {
        const newDescription = window.prompt("Edit task description:", currentDescription);
        if (newDescription === null || newDescription === currentDescription) return;
        if (newDescription.trim() === "") return;

        // Optimistic Update
        const previousTasks = [...tasksState];
        const updatedTasks = tasksState.map(t =>
            t.id === taskId ? { ...t, description: newDescription } : t
        );
        setTasksState(updatedTasks);

        try {
            // Fix: Pass taskType so API knows to re-apply Polyfill Tags (e.g. [Consult])
            await api.updateTaskDescription(taskId, newDescription, taskType);
            toast.success('Task description updated');
        } catch (error) {
            console.error('Task update failed:', error);
            setTasksState(previousTasks); // Rollback
            toast.error('Failed to update task');
        }
    };


    // Task Delete Handler
    const handleDeleteTask = async (taskId: string, taskDate: string) => {
        if (!window.confirm("Are you sure you want to delete this task?")) return;

        // Optimistic Update
        const previousTasks = [...tasksState];
        const updatedTasks = tasksState.filter(t => t.id !== taskId);
        setTasksState(updatedTasks);

        try {
            await api.deleteTask(taskId, taskDate);

            toast.success('Task deleted', {
                action: {
                    label: 'UNDO',
                    onClick: async () => {
                        // Optimistic Restore
                        setTasksState(previousTasks);
                        const loadingToast = toast.loading("Restoring task...");
                        try {
                            await api.restoreTasks([taskId]);
                            // If parent refresh is available, trigger it to be safe, 
                            // though local state restore handles the UI immediately.
                            if (onRefresh) onRefresh();
                            toast.dismiss(loadingToast);
                            toast.success("Task restored");
                        } catch (err) {
                            console.error("Restore failed", err);
                            // Rollback (item is technically gone from DB if restore fails, so remove it again)
                            setTasksState(updatedTasks);
                            toast.dismiss(loadingToast);
                            toast.error("Failed to restore task");
                        }
                    }
                },
                duration: 5000,
            });

            // Allow parent to refresh to ensure counts are accurate if needed
            // But we don't want to cause a flicker if not necessary.
            // Actually, we SHOULD refresh parent to update top stats (Progress Bar).
            if (onRefresh) onRefresh();

        } catch (error) {
            console.error('Task deletion failed:', error);
            setTasksState(previousTasks); // Rollback
            toast.error('Failed to delete task');
        }
    };



    // Bed Delete Handler (Config Mode)
    const handleDeleteBed = () => {
        if (!onDelete) return;
        const confirm = window.confirm(
            `⚠️ DANGER ZONE: This will permanently delete Bed ${bedNumber} and ALL its history/tasks.\n\nAre you sure?`
        );
        if (confirm) {
            onDelete(patientId);
        }
    };

    // 2. Toggle Function (Using Optimistic Mutations Hook)
    // Replaced with toggleTaskOptimistic from useOptimisticMutations hook
    const toggleTaskStep = toggleTaskOptimistic;

    // Determine Status: Prop OR Logic
    const isReady = (props.status as string) === 'discharge_ready' || isAllCompleted;

    return (
        <div
            className={cn(
                'rounded-xl shadow-sm border p-5 group transition-all duration-200 relative', // Added relative here explicitly
                isReady
                    ? 'bg-success-bg border-success/30'
                    : 'bg-surface-light border-border-light hover:border-primary/50',
                isConfigMode && "animate-shake ring-2 ring-primary/20", // Config Mode: Shake & Highlight
                className
            )}
        >
            {/* Delete Badge (Config Mode) - Top RIGHT */}
            {isConfigMode && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBed();
                    }}
                    className="absolute -top-3 -right-3 size-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform z-20 cursor-pointer"
                    title="Delete Bed"
                >
                    <span className="material-symbols-outlined text-lg">close</span>
                </button>
            )}

            <div className="flex justify-between items-center mb-3">
                {isEditingBed || isConfigMode ? (
                    <input
                        ref={bedInputRef}
                        type="text"
                        value={bedNumberText}
                        onChange={(e) => setBedNumberText(e.target.value)}
                        onBlur={handleSaveBedNumber}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveBedNumber()}
                        className={cn(
                            "text-xl font-bold text-text-main bg-transparent focus:outline-none transition-all w-16",
                            isConfigMode
                                ? "bg-white border rounded px-1 border-primary/50 shadow-sm"
                                : "border-b border-primary"
                        )}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <div
                        className="flex items-center gap-2 cursor-pointer group/bed"
                        onClick={() => setIsEditingBed(true)}
                    >
                        <h3
                            className={cn(
                                "text-xl font-bold text-text-main transition-colors",
                                isReady ? "text-success" : "group-hover:text-primary"
                            )}
                        >
                            {bedNumberText}
                        </h3>
                        <span className="material-symbols-outlined text-[14px] text-secondary opacity-0 group-hover/bed:opacity-100 transition-opacity">
                            edit
                        </span>
                    </div>
                )}

                <div className="flex items-center gap-3">
                    {/* Progress Bar */}
                    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${progressStats.bgClass} transition-all duration-500`}
                            style={{ width: `${progressStats.percentage}%` }}
                        ></div>
                    </div>
                    <span className={`text-xs font-bold ${progressStats.textClass}`}>{progressStats.percentage}%</span>
                </div>
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm">
                    {patientInitials}
                </div>
                <div className="flex-1 min-w-0">
                    {/* Diagnosis Inline Edit - Show Input if Editing OR Config Mode */}
                    {isEditingDiagnosis || isConfigMode ? (
                        <input
                            ref={diagnosisInputRef}
                            type="text"
                            value={diagnosisText}
                            onChange={(e) => setDiagnosisText(e.target.value)}
                            onBlur={handleSaveDiagnosis}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveDiagnosis()}
                            className={cn(
                                "w-full text-sm font-bold text-text-main bg-transparent focus:outline-none transition-all",
                                isConfigMode
                                    ? "bg-white border rounded px-2 py-1 border-primary/50 shadow-sm" // Config Mode: Visual Input Box
                                    : "border-b border-primary" // Normal Edit: Underline
                            )}
                            placeholder={isConfigMode ? "Edit Diagnosis..." : ""}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <div
                            className={cn(
                                "group/diagnosis flex items-center gap-2 cursor-pointer"
                            )}
                            onClick={() => setIsEditingDiagnosis(true)}
                        >
                            <p className="text-sm font-bold text-text-main leading-tight truncate">
                                {diagnosisText}
                            </p>
                            <span className="material-symbols-outlined text-[14px] text-secondary opacity-0 group-hover/diagnosis:opacity-100 transition-opacity">
                                edit
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="h-px bg-border-light w-full mb-4"></div>

            <div className="space-y-3">
                {[...tasksToRender]
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map((task) => {
                        const icon = getTaskIcon(task.type);
                        const isTaskCompleted = task.is_completed;
                        const steps = task.steps || [];
                        const isOptimistic = task.isOptimistic;

                        return (
                            <div
                                key={task.id}
                                className={cn(
                                    "flex items-center group/task py-2 gap-3 transition-all duration-300",
                                    isOptimistic && "opacity-70 grayscale-[0.3] border-l-2 border-dashed border-gray-300 pl-2 -ml-2.5 bg-gray-50/50"
                                )}
                            >
                                {/* Column 1: Text Content */}
                                <div className="flex items-center gap-2 flex-1 min-w-0 pr-4">
                                    <span
                                        className={cn(
                                            'material-symbols-outlined text-lg shrink-0 mt-0.5',
                                            // Unified Theme Colors
                                            task.type === 'lab' && 'text-primary',
                                            task.type === 'imaging' && 'text-primary',
                                            // Fallback for others to use Secondary or Primary
                                            !['lab', 'imaging'].includes(task.type) && 'text-primary'
                                        )}
                                    >
                                        {icon}
                                    </span>
                                    <span
                                        className={cn(
                                            "text-sm font-medium text-text-main break-words leading-tight",
                                            isTaskCompleted && "text-gray-400 line-through"
                                        )}
                                    >
                                        {task.description}
                                    </span>
                                </div>

                                {/* Column 2: Checkboxes */}
                                <div className={cn("flex items-center gap-2 shrink-0", isConfigMode && "opacity-50 pointer-events-none grayscale")}>
                                    {steps.map((step, index) => (
                                        <div
                                            key={index}
                                            onClick={() => !isConfigMode && toggleTaskStep(task.id, index)}
                                            title={step.label}
                                            className={cn(
                                                'w-4 h-4 rounded border-2 cursor-pointer flex items-center justify-center transition-colors',
                                                step.value
                                                    ? 'border-primary bg-primary' // Checked: Blue Border + Blue BG
                                                    : 'border-gray-300 hover:border-primary bg-white' // Unchecked: Gray Border + White BG
                                            )}
                                        >
                                            {step.value && (
                                                <span className="material-symbols-outlined text-white text-[10px] font-bold">
                                                    check
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Column 3: Actions (Static reservation, no overlap) */}
                                <div className="flex items-center gap-1 shrink-0 opacity-100 lg:opacity-0 lg:group-hover/task:opacity-100 transition-opacity duration-200 pl-3 bg-surface-light">
                                    <button
                                        onClick={() => handleEditTask(task.id, task.description, task.type)}
                                        className="text-[10px] text-secondary hover:text-primary font-bold uppercase tracking-wide"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTask(task.id, task.task_date || '')}
                                        className="text-[10px] text-red-400 hover:text-red-500 font-bold uppercase tracking-wide"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                {tasksState.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-4 text-gray-300">
                        <span className="material-symbols-outlined text-3xl mb-1 opacity-50">task</span>
                        <span className="text-xs">No active tasks</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PatientCard;
