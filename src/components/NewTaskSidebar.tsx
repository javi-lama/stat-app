import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api } from '../services/api';

// Zod Schema
const newTaskSchema = z.object({
    patient_id: z.string().min(1, "Please select a patient"),
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
    description: z.string().min(3, "Description must be at least 3 characters"),
});

type NewTaskFormValues = z.infer<typeof newTaskSchema>;

interface NewTaskSidebarProps {
    // Changing Props to accept a list that includes ID.
    // Let's assume passed patients have {id, bedNumber, ...}
    patients: { id: string; bedNumber: string; patientInitials: string; diagnosis: string }[];
    onTaskCreated: () => void;
}

const NewTaskSidebar: React.FC<NewTaskSidebarProps> = ({ patients, onTaskCreated }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<NewTaskFormValues>({
        resolver: zodResolver(newTaskSchema),
        defaultValues: {
            category: 'lab',
            workflow_type: 'clinical'
        }
    });

    const onSubmit = async (data: NewTaskFormValues) => {
        setIsSubmitting(true);
        try {
            await api.createTask({
                patient_id: data.patient_id,
                description: data.description,
                category: data.category,
                type: data.workflow_type
            });
            toast.success('Task created successfully');
            reset({
                category: 'lab',
                workflow_type: 'clinical',
                description: '',
                patient_id: ''
            });
            onTaskCreated();
        } catch (error) {
            console.error(error);
            toast.error('Failed to create task');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-surface-light border-l border-border-light shadow-xl">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <h2 className="text-[#101719] dark:text-white text-xl font-bold leading-tight mb-1">Add New Task</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Quickly assign orders to beds.</p>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Patient Select */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Patient / Bed</label>
                        <div className="relative">
                            <select
                                {...register('patient_id')}
                                className="w-full bg-gray-50 dark:bg-[#252525] border-gray-200 dark:border-gray-700 rounded-lg py-2.5 px-3 text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none cursor-pointer text-gray-900 dark:text-white appearance-none"
                            >
                                <option value="">Select a bed...</option>
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
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Category</label>
                        <div className="flex flex-wrap gap-3">
                            {[
                                { label: 'Lab', value: 'lab' },
                                { label: 'Image', value: 'imaging' },
                                { label: 'Consult', value: 'consult' },
                                { label: 'Paperwork', value: 'paperwork' },
                                { label: 'Procedure', value: 'procedure' },
                                { label: 'Supervision', value: 'supervision' }
                            ].map((opt, idx) => (
                                <label key={`${opt.value}-${idx}`} className="cursor-pointer">
                                    <input
                                        type="radio"
                                        {...register('category')}
                                        value={opt.value}
                                        className="peer sr-only"
                                    />
                                    <span className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 peer-checked:bg-primary peer-checked:text-white peer-checked:border-primary transition-all">
                                        {opt.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                        {errors.category && <p className="text-red-500 text-xs">{errors.category.message}</p>}
                    </div>

                    {/* Workflow Type */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Workflow Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 dark:has-[:checked]:bg-primary/20 transition-all">
                                <input
                                    type="radio"
                                    {...register('workflow_type')}
                                    value="clinical"
                                    className="text-primary focus:ring-primary border-gray-300"
                                />
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">Clinical</span>
                                    <span className="text-[10px] text-gray-500">3-step verification</span>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5 dark:has-[:checked]:bg-primary/20 transition-all">
                                <input
                                    type="radio"
                                    {...register('workflow_type')}
                                    value="admin"
                                    className="text-primary focus:ring-primary border-gray-300"
                                />
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">Admin</span>
                                    <span className="text-[10px] text-gray-500">Single check</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">Description</label>
                        <textarea
                            {...register('description')}
                            className="w-full bg-gray-50 dark:bg-[#252525] border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none placeholder-gray-400 dark:placeholder-gray-600 dark:text-white transition-all"
                            placeholder="e.g. Consult Cardiology re: persistent arrhythmia..."
                            rows={4}
                        ></textarea>
                        {errors.description && <p className="text-red-500 text-xs">{errors.description.message}</p>}
                    </div>

                    {/* Actions */}
                    <div className="pt-4 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => reset()}
                            className="text-sm font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white px-4 py-2 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-bold px-6 py-2.5 rounded-lg shadow-sm shadow-primary/30 transition-all flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <span>Saving...</span>
                            ) : (
                                <>
                                    <span>Aceptar</span>
                                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewTaskSidebar;
