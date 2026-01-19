import React, { useState, useRef } from 'react';
import type { PatientCardProps, PatientTask } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { api } from '../services/api';

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
    // We need patient ID for diagnosis update, but props currently only map UI fields.
    // DashboardPreview maps `id` to `key` but not a prop. 
    // We need to update `PatientCardProps` to include `patientId`?
    // Wait, the prompt implies using `api.updatePatientDiagnosis(patientId, ...)`
    // I need `patientId` passed as prop. 
    // I will assume `patientId` is available or I should add it.
    // DashboardPreview uses: `key={patient.id} bedNumber={patient.bed_number} ...`
    // It does NOT pass `id` or `patientId`. 
    // I will add `patientId` to props in this file and assume caller will be updated or I update it blindly?
    // "Actua como un Senior CS...". Identifying missing props is key.
    // I will add `patientId` to Props and update DashboardPreview in next step if needed or assume it's there.
    // Actually, I can't restart `DashboardPreview` task here easily without context switch.
    // But I must. For now I'll add the prop.
    // Wait, I will use `bedNumber` or similar as key? No, `patientId` is needed for DB.
    // I'll add `patientId` to the interface and Component.
    // NOTE: This will break TS build until parent is updated. I will do that in next step.
    patientId,
    bedNumber,
    patientInitials,
    diagnosis,
    tasks: initialTasks,
    onRefresh,
}) => {
    // 1. Local State for Optimistic UI
    const [tasksState, setTasksState] = useState<PatientTask[]>(initialTasks);

    // Dynamic Styling: Calculate "Ready" state from LOCAL state for immediate feedback
    const isAllCompleted = tasksState.length > 0 && tasksState.every(t => t.is_completed);

    // Diagnosis Editing State
    const [isEditingDiagnosis, setIsEditingDiagnosis] = useState(false);
    const [diagnosisText, setDiagnosisText] = useState(diagnosis);
    const diagnosisInputRef = useRef<HTMLInputElement>(null);

    // Sync state with props (Fix for Realtime/Refetch updates)
    React.useEffect(() => {
        setTasksState(initialTasks);
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

    return (
        <div
            className={cn(
                'rounded-xl shadow-sm border p-5 group transition-colors duration-200',
                'bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-700 hover:border-blue-500/50',
                isAllCompleted && 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
            )}
        >
            <div className="flex justify-between items-start mb-3">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                    {bedNumber}
                </h3>
                {isAllCompleted && (
                    <div className="px-2 py-1 rounded bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-bold flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        READY
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-sm">
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
                            className="w-full text-sm font-bold text-gray-900 dark:text-white bg-transparent border-b border-blue-500 focus:outline-none"
                        />
                    ) : (
                        <div
                            className="group/diagnosis flex items-center gap-2 cursor-pointer"
                            onClick={() => setIsEditingDiagnosis(true)}
                        >
                            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight truncate">
                                {diagnosisText}
                            </p>
                            <span className="material-symbols-outlined text-[14px] text-gray-400 opacity-0 group-hover/diagnosis:opacity-100 transition-opacity">
                                edit
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="h-px bg-gray-200 dark:bg-gray-700 w-full mb-4"></div>

            <div className="space-y-3">
                {tasksState.map((task) => {
                    const icon = getTaskIcon(task.type);
                    const isTaskCompleted = task.is_completed;
                    const steps = task.steps || [];

                    return (
                        <div key={task.id} className="flex justify-between items-start group/task pt-1">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                                <span
                                    className={cn(
                                        'material-symbols-outlined text-lg shrink-0 mt-0.5',
                                        task.type === 'lab' && 'text-purple-500',
                                        task.type === 'imaging' && 'text-blue-500',
                                        task.type === 'admin' && 'text-gray-500',
                                        task.type === 'procedure' && 'text-teal-500'
                                    )}
                                >
                                    {icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <span
                                        className={cn(
                                            'text-sm font-medium transition-colors block break-words',
                                            isTaskCompleted
                                                ? 'text-gray-400 line-through'
                                                : 'text-gray-700 dark:text-gray-200'
                                        )}
                                    >
                                        {task.description}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-1 ml-2 shrink-0">
                                {/* Steps Checkboxes */}
                                <div className="flex gap-1 mr-2">
                                    {steps.map((step, index) => (
                                        <div
                                            key={index}
                                            onClick={() => toggleTaskStep(task.id, index)}
                                            title={step.label}
                                            className={cn(
                                                'w-4 h-4 rounded border-2 cursor-pointer flex items-center justify-center transition-colors',
                                                step.value
                                                    ? 'border-blue-600 bg-blue-600'
                                                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-500'
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

                                {/* Action Buttons (Edit/Delete) */}
                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/task:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleEditTask(task.id, task.description)}
                                        className="text-gray-400 hover:text-blue-500 p-0.5 rounded transition-colors"
                                        title="Edit Task"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">edit</span>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteTask(task.id)}
                                        className="text-gray-400 hover:text-red-500 p-0.5 rounded transition-colors"
                                        title="Delete Task"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {tasksState.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-4 text-gray-400">
                        <span className="material-symbols-outlined text-3xl mb-1 opacity-50">task</span>
                        <span className="text-xs">No active tasks</span>
                        <button className="text-xs text-blue-500 font-bold mt-2 hover:underline">Add Task +</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PatientCard;
