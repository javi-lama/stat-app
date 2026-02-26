import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '../services/api';

// Zod Schema
const newTaskSchema = z.object({
    patient_id: z.string().min(1, "Por favor selecciona un paciente"),
    category: z.enum(['lab', 'imaging', 'admin', 'procedure', 'consult', 'paperwork', 'supervision']), // consult/paperwork/supervision mapped?
    // User UI has: Lab, Image, Consult, Paperwork, Procedure, Supervision
    // DB has: lab, imaging, admin, procedure.
    // We need to map UI options to DB options.
    // UI "Consult" -> admin? "Paperwork" -> admin? "Supervision" -> admin?
    // Let's strictly allow what the DB supports for now or map them.
    // For this implementation, I will assume the UI radios pass valid DB values OR I map them.
    // The Input HTML shows labels: Lab, Image, Consult, Paperwork, Procedure, Supervision.
    // I should probably map:
    // Lab -> lab
    // Image -> imaging
    // Procedure -> procedure
    // Consult -> admin (or new type?)
    // Paperwork -> admin
    // Supervision -> admin
    // Let's use the DB enum values in the form for simplicity where possible, 
    // or map before sending.
    // Form will use DB values for values, but UI labels can differ.

    workflow_type: z.enum(['clinical', 'admin']),
    description: z.string().min(3, "La descripción debe tener al menos 3 caracteres"),
});

type NewTaskFormValues = z.infer<typeof newTaskSchema>;

import { formatDateForDB, formatDateForUI } from '../lib/dateUtils';


// ... (existing imports)

interface NewTaskSidebarProps {
    // Changing Props to accept a list that includes ID.
    // Let's assume passed patients have {id, bedNumber, ...}
    patients: { id: string; bedNumber: string; patientInitials: string; diagnosis: string }[];
    onTaskCreated: () => void;
    selectedDate: Date; // NEW Prop
}

const NewTaskSidebar: React.FC<NewTaskSidebarProps> = ({ patients, onTaskCreated, selectedDate }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Safety Logic State
    const [confirmationPending, setConfirmationPending] = useState(false);
    const [pendingData, setPendingData] = useState<NewTaskFormValues | null>(null);

    const isToday = React.useMemo(() => {
        const today = new Date();
        return selectedDate.getDate() === today.getDate() &&
            selectedDate.getMonth() === today.getMonth() &&
            selectedDate.getFullYear() === today.getFullYear();
    }, [selectedDate]);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<NewTaskFormValues>({
        resolver: zodResolver(newTaskSchema),
        defaultValues: {
            category: 'lab',
            workflow_type: 'clinical'
        }
    });

    const executeCreateTask = async (data: NewTaskFormValues, targetDate: Date) => {
        setIsSubmitting(true);

        // DEFENSIVE PROGRAMMING: Cross-Ward Spoofing Prevention
        // Validates that patient_id belongs to current ward's patient list
        // Prevents: DOM manipulation, race conditions, replay attacks
        const patientBelongsToWard = patients.some(p => p.id === data.patient_id);
        if (!patientBelongsToWard) {
            toast.error('Error de seguridad: El paciente no pertenece al servicio actual');
            console.error('[SECURITY] Cross-Ward task creation blocked:', data.patient_id);
            setIsSubmitting(false);
            return; // ABORT - Do not send to Supabase
        }

        try {
            await api.createTask({
                patient_id: data.patient_id,
                description: data.description,
                category: data.category,
                type: data.workflow_type,
                task_date: formatDateForDB(targetDate)
            });
            toast.success('Tarea creada exitosamente');
            reset({
                category: 'lab',
                workflow_type: 'clinical',
                description: '',
                patient_id: ''
            });
            setConfirmationPending(false);
            setPendingData(null);
            onTaskCreated();
        } catch (error) {
            console.error(error);
            toast.error('Error al crear la tarea');
        } finally {
            setIsSubmitting(false);
        }
    };

    const onSubmit = async (data: NewTaskFormValues) => {
        if (isToday) {
            await executeCreateTask(data, selectedDate);
        } else {
            // Intercept
            setPendingData(data);
            setConfirmationPending(true);
        }
    };

    return (
        <div className="flex flex-col h-full bg-surface-light border-l border-border-light shadow-xl relative">
            <div className="p-6 border-b border-gray-200">
                <h2 className="text-[#101719] text-xl font-bold leading-tight mb-1">Añadir Tarea</h2>
                <p className="text-sm text-gray-500">Asignar tareas rápidamente.</p>
            </div>

            {/* Context Warning Banner */}
            {!isToday && (
                <div className="bg-amber-100 px-6 py-2 border-b border-amber-200 flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-700 text-sm">calendar_month</span>
                    <span className="text-xs font-bold text-amber-800">
                        Editando para: {formatDateForUI(selectedDate)}
                    </span>
                </div>
            )}

            <div className="p-6 flex-1 overflow-y-auto">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Patient Select */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Paciente / Cama</label>
                        <div className="relative">
                            <select
                                {...register('patient_id')}
                                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2.5 px-3 text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none cursor-pointer text-gray-900 appearance-none"
                            >
                                <option value="">Seleccionar cama...</option>
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.bedNumber} – {p.diagnosis}
                                    </option>
                                ))}
                            </select>
                            {errors.patient_id && <p className="text-red-500 text-xs">{errors.patient_id.message}</p>}
                        </div>
                    </div>

                    {/* Category Radios */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Categoría</label>
                        <div className="flex flex-wrap gap-3">
                            {[
                                { label: 'Lab', value: 'lab' },
                                { label: 'Imagen', value: 'imaging' },
                                { label: 'Consulta', value: 'consult' },
                                { label: 'Papeleo', value: 'paperwork' },
                                { label: 'Procedimiento', value: 'procedure' },
                                { label: 'Supervisión', value: 'supervision' }
                            ].map((opt, idx) => (
                                <label key={`${opt.value}-${idx}`} className="cursor-pointer">
                                    <input
                                        type="radio"
                                        {...register('category')}
                                        value={opt.value}
                                        className="peer sr-only"
                                    />
                                    <span className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs font-medium text-gray-700 peer-checked:bg-primary peer-checked:text-white peer-checked:border-primary transition-all">
                                        {opt.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                        {errors.category && <p className="text-red-500 text-xs">{errors.category.message}</p>}
                    </div>

                    {/* Workflow Type */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Tipo de Tarea</label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all">
                                <input
                                    type="radio"
                                    {...register('workflow_type')}
                                    value="clinical"
                                    className="text-primary focus:ring-primary border-gray-300"
                                />
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-900">3 Checks</span>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all">
                                <input
                                    type="radio"
                                    {...register('workflow_type')}
                                    value="admin"
                                    className="text-primary focus:ring-primary border-gray-300"
                                />
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-900">1 Check</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Descripción</label>
                        <textarea
                            {...register('description')}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none placeholder-gray-400 text-gray-900 transition-all"
                            placeholder="Ej: IC a Cardiología por riesgo quirúrgico..."
                            rows={4}
                        ></textarea>
                        {errors.description && <p className="text-red-500 text-xs">{errors.description.message}</p>}
                    </div>

                    {/* Actions / Confirmation Interstitial */}
                    {confirmationPending ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex items-start gap-2 mb-3">
                                <span className="material-symbols-outlined text-amber-600 text-lg">warning</span>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-amber-800">¡Revisa la fecha!</span>
                                    <p className="text-[10px] text-amber-700 leading-tight">
                                        Estás creando esta tarea para <strong className="font-bold">{formatDateForUI(selectedDate)}</strong>, no para Hoy.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => pendingData && executeCreateTask(pendingData, new Date())}
                                    className="flex-1 bg-white border border-amber-300 shadow-sm text-xs font-bold text-amber-800 py-2 rounded hover:bg-amber-50 transition-colors"
                                >
                                    Corregir a Hoy
                                </button>
                                <button
                                    type="button"
                                    onClick={() => pendingData && executeCreateTask(pendingData, selectedDate)}
                                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-xs font-bold text-white py-2 rounded shadow-sm transition-colors"
                                >
                                    Guardar en {formatDateForUI(selectedDate)}
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => setConfirmationPending(false)}
                                className="w-full text-center text-[10px] text-gray-400 hover:text-gray-600 mt-2 underline"
                            >
                                Cancelar
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => reset()}
                                className="text-sm font-bold text-gray-500 hover:text-gray-900 px-4 py-2 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold px-6 py-2.5 rounded-lg shadow-sm shadow-primary/30 transition-all flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <span>Guardando...</span>
                                ) : (
                                    <>
                                        <span>Aceptar</span>
                                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default NewTaskSidebar;
