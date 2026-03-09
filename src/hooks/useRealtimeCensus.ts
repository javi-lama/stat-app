import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import type { PatientCardProps } from '../types';
import { formatDateForDB } from '../lib/dateUtils';

/**
 * Multi-Tenant Realtime Census Hook
 * Fetches and subscribes to patient/task data for a specific ward and date.
 * Implements ward isolation via native filters and client-side gatekeeper.
 */
export const useRealtimeCensus = (selectedDate: Date, wardId: string | null) => {
    const [patients, setPatients] = useState<PatientCardProps[]>([]);
    const [rawPatients, setRawPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ANTI-STALE CLOSURE: Track current patients for task gatekeeper
    // Realtime callbacks capture state at subscription time (closure)
    // useRef maintains a mutable reference that always points to current value
    const patientsRef = useRef<PatientCardProps[]>([]);

    // ANTI-STALE CLOSURE: Track current date for task date filtering
    const selectedDateRef = useRef<Date>(selectedDate);

    // Keep refs in sync with state
    useEffect(() => {
        patientsRef.current = patients;
    }, [patients]);

    useEffect(() => {
        selectedDateRef.current = selectedDate;
    }, [selectedDate]);

    const fetchCensus = useCallback(async () => {
        // EARLY RETURN: No wardId means no data to fetch
        if (!wardId) {
            console.log('[Census] No wardId - clearing data');
            setPatients([]);
            setRawPatients([]);
            setLoading(false);
            return;
        }

        try {
            console.log('[Census] Fetching data for ward:', wardId);
            const dateStr = formatDateForDB(selectedDate);
            const raw = await api.getWardCensus(dateStr, wardId);
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
    }, [selectedDate, wardId]);

    useEffect(() => {
        // EARLY RETURN: No subscription without wardId
        if (!wardId) {
            console.log('[Realtime] No wardId - skipping subscription');
            setLoading(false);
            return;
        }

        // STRICTMODE GUARD: Track if effect is still active
        // Prevents race conditions during double-mount in development
        let isActive = true;

        // 1. Initial Fetch
        fetchCensus();

        // 2. Realtime Subscription with Ward Scoping
        console.log('[Realtime] Initializing ward-scoped subscription:', wardId);

        // UNIQUE CHANNEL ID: Previene colisiones en StrictMode double-mount
        // Cada ejecución del effect obtiene su propio canal con ID único
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        const channelName = `realtime:census:${wardId}:${formatDateForDB(selectedDate)}:${uniqueId}`;

        const channel = api.supabase
            .channel(channelName)
            // PATIENTS: Native Supabase filter (ward_id = wardId)
            // This filter is applied server-side by Supabase
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'patients',
                    filter: `ward_id=eq.${wardId}` // NATIVE FILTER
                },
                (payload) => {
                    if (!isActive) return; // STRICTMODE GUARD
                    console.log('[Realtime] Patient change (ward-filtered):', payload);
                    // For patient changes (diagnosis, bed number, etc.), do full refetch
                    fetchCensus();
                }
            )
            // TASKS INSERT: Client-side Gatekeeper (Supabase doesn't support joins in Realtime filters)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'tasks'
                },
                (payload) => {
                    if (!isActive) return; // STRICTMODE GUARD
                    const newTask = payload.new as any;
                    console.log('[Realtime] INSERT event (tasks):', newTask.id);

                    // GATEKEEPER: Check if task's patient belongs to current ward
                    // Uses ref (always current) instead of state (potentially stale)
                    const currentPatients = patientsRef.current;
                    const belongsToWard = currentPatients.some(
                        p => p.patientId === newTask.patient_id
                    );

                    if (!belongsToWard) {
                        console.log('[Realtime] Task rejected - patient not in ward:', newTask.patient_id);
                        return; // Silently ignore tasks for other wards
                    }

                    // DATE FILTER: Only process tasks for the currently viewed date
                    const taskDateStr = newTask.due_date
                        ? String(newTask.due_date).substring(0, 10)
                        : String(newTask.created_at).substring(0, 10);
                    const currentDateStr = formatDateForDB(selectedDateRef.current);

                    if (taskDateStr !== currentDateStr) {
                        console.log('[Realtime] Task ignored - date mismatch:', taskDateStr, 'vs', currentDateStr);
                        return;
                    }

                    // STATE RECONCILIATION: Merge new task into state
                    setPatients(prevPatients => {
                        return prevPatients.map(patient => {
                            if (patient.patientId !== newTask.patient_id) {
                                return patient;
                            }

                            const taskExists = patient.tasks.some(t => t.id === newTask.id);
                            if (taskExists) {
                                console.log('[Realtime] Task already exists, skipping:', newTask.id);
                                return patient;
                            }

                            // Check for optimistic replacement
                            const optimisticIndex = patient.tasks.findIndex(
                                t => t.isOptimistic &&
                                     t.description === newTask.description &&
                                     t.patient_id === newTask.patient_id
                            );

                            if (optimisticIndex !== -1) {
                                console.log('[Realtime] Replacing optimistic task:', patient.tasks[optimisticIndex].id);
                                const adaptedTask = api.adaptPatientToCard({ tasks: [newTask] }).tasks[0];
                                const newTasks = [...patient.tasks];
                                newTasks[optimisticIndex] = adaptedTask;
                                return { ...patient, tasks: newTasks };
                            }

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
            // TASKS UPDATE: Client-side Gatekeeper
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'tasks'
                },
                (payload) => {
                    if (!isActive) return; // STRICTMODE GUARD
                    const updatedTask = payload.new as any;
                    console.log('[Realtime] UPDATE event (tasks):', updatedTask.id);

                    // GATEKEEPER
                    const currentPatients = patientsRef.current;
                    const belongsToWard = currentPatients.some(
                        p => p.patientId === updatedTask.patient_id
                    );

                    if (!belongsToWard) {
                        return; // Ignore updates for other wards
                    }

                    // DATE FILTER: Only process updates for currently viewed date
                    const taskDateStr = updatedTask.due_date
                        ? String(updatedTask.due_date).substring(0, 10)
                        : String(updatedTask.created_at).substring(0, 10);
                    const currentDateStr = formatDateForDB(selectedDateRef.current);

                    if (taskDateStr !== currentDateStr) {
                        console.log('[Realtime] Update ignored - date mismatch');
                        return;
                    }

                    // Soft Delete Detection
                    if (updatedTask.deleted_at !== null && updatedTask.deleted_at !== undefined) {
                        console.log('[Realtime] Soft delete detected:', updatedTask.id);
                        setPatients(prevPatients => {
                            return prevPatients.map(patient => {
                                const hasTask = patient.tasks.some(t => t.id === updatedTask.id);
                                if (!hasTask) return patient;
                                return {
                                    ...patient,
                                    tasks: patient.tasks.filter(t => t.id !== updatedTask.id)
                                };
                            });
                        });
                        return;
                    }

                    // Normal Update
                    setPatients(prevPatients => {
                        return prevPatients.map(patient => {
                            const taskIndex = patient.tasks.findIndex(t => t.id === updatedTask.id);
                            if (taskIndex === -1) return patient;

                            console.log('[Realtime] Updating task:', updatedTask.id);
                            const adaptedTask = api.adaptPatientToCard({ tasks: [updatedTask] }).tasks[0];
                            const newTasks = [...patient.tasks];
                            newTasks[taskIndex] = adaptedTask;
                            return { ...patient, tasks: newTasks };
                        });
                    });
                }
            )
            // TASKS DELETE: No gatekeeper needed (just check if task exists in state)
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'tasks'
                },
                (payload) => {
                    if (!isActive) return; // STRICTMODE GUARD
                    const deletedTaskId = payload.old.id as string;
                    console.log('[Realtime] DELETE event (tasks):', deletedTaskId);

                    setPatients(prevPatients => {
                        return prevPatients.map(patient => {
                            const hasTask = patient.tasks.some(t => t.id === deletedTaskId);
                            if (!hasTask) return patient;
                            return {
                                ...patient,
                                tasks: patient.tasks.filter(t => t.id !== deletedTaskId)
                            };
                        });
                    });
                }
            )
            .subscribe((status) => {
                if (!isActive) return; // STRICTMODE GUARD
                console.log(`[Realtime] Subscription status (${channelName}):`, status);
                if (status === 'SUBSCRIBED') {
                    console.log('[Realtime] Connected - Ward-scoped updates active');
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('[Realtime] Channel Error - Check RLS policies');
                }
                if (status === 'TIMED_OUT') {
                    console.error('[Realtime] Connection timed out');
                }
                if (status === 'CLOSED') {
                    console.warn('[Realtime] Connection closed');
                }
            });

        // 3. STRICTMODE-SAFE CLEANUP
        // Async cleanup - seguro porque channelName es único per effect
        return () => {
            console.log('[Realtime] Cleaning up channel:', channelName);
            isActive = false; // Mark as inactive FIRST

            // Async cleanup con catch - no hay race condition porque cada canal es único
            channel.unsubscribe()
                .then(() => {
                    api.supabase.removeChannel(channel);
                })
                .catch((err) => {
                    console.warn('[Realtime] Cleanup warning:', err);
                    api.supabase.removeChannel(channel);
                });
        };
    }, [selectedDate, wardId]); // Dependencies: date AND ward

    return {
        patients,
        rawPatients,
        loading,
        error,
        refresh: fetchCensus
    };
};
