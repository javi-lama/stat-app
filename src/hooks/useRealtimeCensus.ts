import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { PatientCardProps } from '../types';
import { formatDateForDB } from '../lib/dateUtils';

export const useRealtimeCensus = (selectedDate: Date) => {
    const [patients, setPatients] = useState<PatientCardProps[]>([]);
    const [rawPatients, setRawPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCensus = useCallback(async () => {
        try {
            console.log('[Census] Fetching latest data...');
            const dateStr = formatDateForDB(selectedDate);
            const raw = await api.getWardCensus(dateStr);
            setRawPatients(raw);
            const adapted = raw.map(api.adaptPatientToCard);
            setPatients(adapted);
            setError(null);
        } catch (err: any) {
            console.error('[Census] Error:', err);
            setError('Failed to load ward census.');
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        // 1. Initial Fetch
        fetchCensus();

        // 2. Realtime Subscription with State Reconciliation
        console.log('[Realtime] Initializing subscription with STATE RECONCILIATION...');

        const channel = api.supabase
            .channel(`realtime:census:${formatDateForDB(selectedDate)}`) // Unique channel per date
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'tasks'
                },
                (payload) => {
                    console.log('[Realtime] INSERT event:', payload);
                    const newTask = payload.new as any;

                    // STATE RECONCILIATION: Merge new task into state
                    setPatients(prevPatients => {
                        return prevPatients.map(patient => {
                            // Check if this task belongs to this patient
                            if (patient.patientId !== newTask.patient_id) {
                                return patient; // Not this patient, skip
                            }

                            // Check if task already exists (by ID) or is optimistic duplicate
                            const taskExists = patient.tasks.some(t => t.id === newTask.id);
                            if (taskExists) {
                                console.log('[Realtime] Task already exists, skipping duplicate:', newTask.id);
                                return patient;
                            }

                            // Check if this is replacing an optimistic task
                            const optimisticIndex = patient.tasks.findIndex(
                                t => t.isOptimistic &&
                                     t.description === newTask.description &&
                                     t.patient_id === newTask.patient_id
                            );

                            if (optimisticIndex !== -1) {
                                console.log('[Realtime] Replacing optimistic task:', patient.tasks[optimisticIndex].id, '→', newTask.id);
                                // Replace optimistic task with real task
                                const adaptedTask = api.adaptPatientToCard({ tasks: [newTask] }).tasks[0];
                                const newTasks = [...patient.tasks];
                                newTasks[optimisticIndex] = adaptedTask;
                                return { ...patient, tasks: newTasks };
                            }

                            // Add new task (not a replacement)
                            console.log('[Realtime] Adding new task:', newTask.id);
                            const adaptedTask = api.adaptPatientToCard({ tasks: [newTask] }).tasks[0];
                            return {
                                ...patient,
                                tasks: [...patient.tasks, adaptedTask]
                            };
                        });
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'tasks'
                },
                (payload) => {
                    console.log('[Realtime] UPDATE event:', payload);
                    const updatedTask = payload.new as any;

                    // 🔥 SOFT DELETE DETECTION: Check if deleted_at was set
                    if (updatedTask.deleted_at !== null && updatedTask.deleted_at !== undefined) {
                        console.log('[Realtime] Soft delete detected:', updatedTask.id);

                        // Remove task from state (soft delete = visual delete)
                        setPatients(prevPatients => {
                            return prevPatients.map(patient => {
                                const hasTask = patient.tasks.some(t => t.id === updatedTask.id);
                                if (!hasTask) {
                                    return patient; // Task not in this patient
                                }

                                console.log('[Realtime] Removing soft-deleted task:', updatedTask.id);
                                return {
                                    ...patient,
                                    tasks: patient.tasks.filter(t => t.id !== updatedTask.id)
                                };
                            });
                        });

                        return; // Exit early, don't process as normal update
                    }

                    // STATE RECONCILIATION: Update specific task (normal UPDATE)
                    setPatients(prevPatients => {
                        return prevPatients.map(patient => {
                            // Find the task to update
                            const taskIndex = patient.tasks.findIndex(t => t.id === updatedTask.id);
                            if (taskIndex === -1) {
                                return patient; // Task not found in this patient
                            }

                            console.log('[Realtime] Updating task:', updatedTask.id);
                            const adaptedTask = api.adaptPatientToCard({ tasks: [updatedTask] }).tasks[0];
                            const newTasks = [...patient.tasks];
                            newTasks[taskIndex] = adaptedTask;

                            return { ...patient, tasks: newTasks };
                        });
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'tasks'
                },
                (payload) => {
                    console.log('[Realtime] DELETE event:', payload);
                    const deletedTaskId = payload.old.id as string;

                    // STATE RECONCILIATION: Remove specific task
                    setPatients(prevPatients => {
                        return prevPatients.map(patient => {
                            const hasTask = patient.tasks.some(t => t.id === deletedTaskId);
                            if (!hasTask) {
                                return patient; // Task not in this patient
                            }

                            console.log('[Realtime] Removing task:', deletedTaskId);
                            return {
                                ...patient,
                                tasks: patient.tasks.filter(t => t.id !== deletedTaskId)
                            };
                        });
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'patients'
                },
                (payload) => {
                    console.log('[Realtime] Patient change detected:', payload);
                    // For patient changes (diagnosis, bed number, etc.), do full refetch
                    // This is safer as patient structure changes are less frequent
                    fetchCensus();
                }
            )
            .subscribe((status) => {
                console.log(`[Realtime] Subscription status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] ✅ Connected - Real-time updates active');
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('[Realtime] ❌ Channel Error - Check Supabase dashboard & RLS policies');
                }
                if (status === 'TIMED_OUT') {
                    console.error('[Realtime] ⏱️ Connection timed out - Retrying...');
                }
                if (status === 'CLOSED') {
                    console.warn('[Realtime] 🔌 Connection closed');
                }
            });

        // 3. Cleanup
        return () => {
            console.log('[Realtime] Disconnecting channel...');
            api.supabase.removeChannel(channel);
        };
    }, [selectedDate]); // Only depend on selectedDate, not fetchCensus

    return {
        patients,
        rawPatients,
        loading,
        error,
        refresh: fetchCensus
    };
};
