import React, { useState, useRef } from 'react';
import type { PatientCardProps, PatientTask } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { api } from '../services/api';
import { calculateTaskProgress } from '../lib/progressUtils';

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
        ? tasksState.filter(t => visibleTaskIds.includes(t.id))
        : tasksState;

    // Diagnosis Editing State
    const [isEditingDiagnosis, setIsEditingDiagnosis] = useState(false);
    const [diagnosisText, setDiagnosisText] = useState(diagnosis);
    const diagnosisInputRef = useRef<HTMLInputElement>(null);

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

    // Task Description Edit Handler
    const handleEditTask = async (taskId: string, currentDescription: string) => {
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
            await api.updateTaskDescription(taskId, newDescription);
            toast.success('Task description updated');
        } catch (error) {
            console.error('Task update failed:', error);
            setTasksState(previousTasks); // Rollback
            toast.error('Failed to update task');
        }
    };

    // Task Delete Handler
    const handleDeleteTask = async (taskId: string) => {
        if (!window.confirm("Are you sure you want to delete this task?")) return;

        // Optimistic Update
        const previousTasks = [...tasksState];
        const updatedTasks = tasksState.filter(t => t.id !== taskId);
        setTasksState(updatedTasks);

        try {
            await api.deleteTask(taskId);
            toast.success('Task deleted');
        } catch (error) {
            console.error('Task deletion failed:', error);
            setTasksState(previousTasks); // Rollback
            toast.error('Failed to delete task');
        }
    };

    // 2. Toggle Function (Existing)
    const toggleTaskStep = async (taskId: string, stepIndex: number) => {
        const taskIndex = tasksState.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;

        const currentTask = tasksState[taskIndex];
        const hasSteps = currentTask.steps && currentTask.steps.length > 0;

        if (!hasSteps) return;

        const previousTasksState = JSON.parse(JSON.stringify(tasksState));
        const newTasks = [...tasksState];
        const newTask = { ...currentTask };
        const newSteps = newTask.steps!.map(s => ({ ...s }));

        newSteps[stepIndex].value = !newSteps[stepIndex].value;
        newTask.steps = newSteps;
        newTask.is_completed = newSteps.every(s => s.value);

        newTasks[taskIndex] = newTask;
        setTasksState(newTasks);

        try {
            await api.updateTaskStatus(taskId, newSteps, newTask.is_completed);
            toast.success('Task updated');
        } catch (error) {
            console.error('Sync error:', error);
            setTasksState(previousTasksState);
            toast.error('Connection failed. Change not saved');
        }
    };

    // Determine Status: Prop OR Logic
    const isReady = (props.status as string) === 'discharge_ready' || isAllCompleted;

    return (
        <div
            className={cn(
                'rounded-xl shadow-sm border p-5 group transition-all duration-200',
                isReady
                    ? 'bg-success-bg border-success/30'
                    : 'bg-surface-light border-border-light hover:border-primary/50',
                className // Allow parent to override/append classes (Ghost effect)
            )}
        >
            <div className="flex justify-between items-center mb-3">
                <h3
                    className={cn(
                        "text-xl font-bold text-text-main transition-colors",
                        isReady ? "text-success" : "group-hover:text-primary"
                    )}
                >
                    {bedNumber}
                </h3>

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
                    {/* Diagnosis Inline Edit */}
                    {isEditingDiagnosis ? (
                        <input
                            ref={diagnosisInputRef}
                            type="text"
                            value={diagnosisText}
                            onChange={(e) => setDiagnosisText(e.target.value)}
                            onBlur={handleSaveDiagnosis}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveDiagnosis()}
                            className="w-full text-sm font-bold text-text-main bg-transparent border-b border-primary focus:outline-none"
                        />
                    ) : (
                        <div
                            className="group/diagnosis flex items-center gap-2 cursor-pointer"
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

                        return (
                            <div key={task.id} className="flex items-center justify-between group/task py-2 gap-3">
                                {/* Column 1: Text Content */}
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span
                                        className={cn(
                                            'material-symbols-outlined text-lg shrink-0 mt-0.5',
                                            // Unified Theme Colors
                                            task.type === 'lab' && 'text-primary',
                                            task.type === 'imaging' && 'text-secondary',
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
                                <div className="flex items-center gap-3">
                                    {steps.map((step, index) => (
                                        <div
                                            key={index}
                                            onClick={() => toggleTaskStep(task.id, index)}
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
                                <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity duration-200 pl-2 bg-surface-light">
                                    <button
                                        onClick={() => handleEditTask(task.id, task.description)}
                                        className="text-[10px] text-secondary hover:text-primary font-bold uppercase tracking-wide"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTask(task.id)}
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
