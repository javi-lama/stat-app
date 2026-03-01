import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '../services/api';
import type { SupabaseDailyTracking } from '../services/api';
import { formatDateForDB } from '../lib/dateUtils';

/**
 * UI-friendly tracking state per patient
 */
export interface PatientTracking {
    patientId: string;
    evosDone: boolean;
    bhDone: boolean;
    assignedMd: string | null; // Responsible physician for this date
    recordId: string | null; // null if no record exists yet (will be created on first toggle)
}

/**
 * Tracking matrix: Map of patientId -> tracking state
 * Using Map for O(1) lookups by patientId
 */
export type TrackingMatrix = Map<string, PatientTracking>;

/**
 * Statistics for progress indicators
 */
export interface TrackingStats {
    evosComplete: number;
    bhComplete: number;
    total: number;
    evosPercentage: number;
    bhPercentage: number;
}

/**
 * Multi-Tenant Realtime EVOS & BH Hook
 *
 * Fetches and subscribes to daily_tracking data for a specific ward and date.
 * Implements Client-Side Gatekeeper pattern for realtime event validation.
 *
 * @param selectedDate - Currently selected date
 * @param wardId - Active ward ID (null = no data)
 * @param patientIds - Array of patient IDs in current ward (for gatekeeper validation)
 */
export const useEvosBh = (
    selectedDate: Date,
    wardId: string | null,
    patientIds: string[]
) => {
    // State: Tracking data as Map for O(1) lookups
    const [trackingMatrix, setTrackingMatrix] = useState<TrackingMatrix>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ANTI-STALE CLOSURE: Track current patientIds for gatekeeper
    // Realtime callbacks capture state at subscription time (closure)
    // useRef maintains a mutable reference that always points to current value
    const patientIdsRef = useRef<string[]>([]);
    const selectedDateRef = useRef<string>(formatDateForDB(selectedDate));

    // Keep refs in sync with props
    useEffect(() => {
        patientIdsRef.current = patientIds;
    }, [patientIds]);

    useEffect(() => {
        selectedDateRef.current = formatDateForDB(selectedDate);
    }, [selectedDate]);

    // Memoized date string to prevent unnecessary re-renders
    const dateStr = useMemo(() => formatDateForDB(selectedDate), [selectedDate]);

    /**
     * Fetches tracking data from Supabase
     */
    const fetchTracking = useCallback(async () => {
        // EARLY RETURN: No wardId = no data
        if (!wardId) {
            console.log('[EvosBh] No wardId - clearing data');
            setTrackingMatrix(new Map());
            setLoading(false);
            return;
        }

        try {
            console.log('[EvosBh] Fetching tracking for ward:', wardId, 'date:', dateStr);
            const records = await api.fetchDailyTracking(wardId, dateStr);

            // Convert array to Map for efficient lookups
            const matrix = new Map<string, PatientTracking>();
            records.forEach(record => {
                matrix.set(record.patient_id, {
                    patientId: record.patient_id,
                    evosDone: record.evos_done,
                    bhDone: record.bh_done,
                    assignedMd: record.assigned_md,
                    recordId: record.id
                });
            });

            // Fill in patients with no records (default to false/false/null)
            patientIds.forEach(pid => {
                if (!matrix.has(pid)) {
                    matrix.set(pid, {
                        patientId: pid,
                        evosDone: false,
                        bhDone: false,
                        assignedMd: null,
                        recordId: null
                    });
                }
            });

            setTrackingMatrix(matrix);
            setError(null);
        } catch (err: any) {
            console.error('[EvosBh] Error:', err);
            setError('Error al cargar datos de tracking');
        } finally {
            setLoading(false);
        }
    }, [wardId, dateStr, patientIds]);

    /**
     * Toggle handler with optimistic update
     */
    const toggleField = useCallback(async (
        patientId: string,
        field: 'evos_done' | 'bh_done'
    ) => {
        // Get current state
        const current = trackingMatrix.get(patientId);
        if (!current) {
            console.warn('[EvosBh] Patient not found in matrix:', patientId);
            return;
        }

        const fieldKey = field === 'evos_done' ? 'evosDone' : 'bhDone';
        const currentValue = current[fieldKey];
        const newValue = !currentValue;

        // OPTIMISTIC UPDATE: Update UI immediately
        setTrackingMatrix(prev => {
            const updated = new Map(prev);
            updated.set(patientId, {
                ...current,
                [fieldKey]: newValue
            });
            return updated;
        });

        try {
            // VERIFY: Send to Supabase
            const result = await api.toggleTracking(patientId, dateStr, field, newValue);

            // Update recordId if this was a new record (UPSERT created it)
            if (!current.recordId) {
                setTrackingMatrix(prev => {
                    const updated = new Map(prev);
                    const existing = updated.get(patientId);
                    if (existing) {
                        updated.set(patientId, {
                            ...existing,
                            recordId: result.id
                        });
                    }
                    return updated;
                });
            }
        } catch (err) {
            console.error('[EvosBh] Toggle failed:', err);

            // ROLLBACK: Revert optimistic update
            setTrackingMatrix(prev => {
                const updated = new Map(prev);
                updated.set(patientId, current); // Restore original state
                return updated;
            });
        }
    }, [trackingMatrix, dateStr]);

    /**
     * Update assigned_md for a patient with optimistic update.
     * Called on input blur to prevent network spam.
     */
    const updateAssignedMd = useCallback(async (
        patientId: string,
        value: string | null
    ) => {
        const current = trackingMatrix.get(patientId);
        if (!current) return;

        // Normalize empty string to null
        const normalizedValue = value?.trim() || null;

        // Skip if no change
        if (current.assignedMd === normalizedValue) return;

        // 1. OPTIMISTIC UPDATE
        setTrackingMatrix(prev => {
            const updated = new Map(prev);
            updated.set(patientId, {
                ...current,
                assignedMd: normalizedValue
            });
            return updated;
        });

        try {
            // 2. PERSIST TO DATABASE
            const result = await api.updateAssignedMd(patientId, dateStr, normalizedValue);

            // 3. Update recordId if new record was created
            if (!current.recordId) {
                setTrackingMatrix(prev => {
                    const updated = new Map(prev);
                    const existing = updated.get(patientId);
                    if (existing) {
                        updated.set(patientId, {
                            ...existing,
                            recordId: result.id
                        });
                    }
                    return updated;
                });
            }
        } catch (err) {
            console.error('[useEvosBh] updateAssignedMd error:', err);
            // 4. ROLLBACK ON ERROR
            setTrackingMatrix(prev => {
                const updated = new Map(prev);
                updated.set(patientId, current);
                return updated;
            });
        }
    }, [trackingMatrix, dateStr]);

    /**
     * Main effect: Fetch data and subscribe to Realtime
     */
    useEffect(() => {
        // EARLY RETURN: No subscription without wardId
        if (!wardId) {
            console.log('[EvosBh Realtime] No wardId - skipping subscription');
            setLoading(false);
            return;
        }

        // 1. Initial Fetch
        fetchTracking();

        // 2. Realtime Subscription with Ward+Date Scoping
        // Channel naming: Unique per ward + date (prevents cross-ward/date leakage)
        const channelName = `realtime:evos-bh:${wardId}:${dateStr}`;
        console.log('[EvosBh Realtime] Initializing subscription:', channelName);

        const channel = api.supabase
            .channel(channelName)
            // Listen for INSERT events (new tracking record created)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'daily_tracking',
                    filter: `tracking_date=eq.${dateStr}`
                },
                (payload) => {
                    const newRecord = payload.new as SupabaseDailyTracking;
                    console.log('[EvosBh Realtime] INSERT event:', newRecord.id);

                    // GATEKEEPER 1: Check if patient belongs to current ward
                    const currentPatientIds = patientIdsRef.current;
                    if (!currentPatientIds.includes(newRecord.patient_id)) {
                        console.log('[EvosBh Realtime] Rejected - patient not in ward:', newRecord.patient_id);
                        return;
                    }

                    // GATEKEEPER 2: Check if date matches selected date
                    const currentDateStr = selectedDateRef.current;
                    if (newRecord.tracking_date !== currentDateStr) {
                        console.log('[EvosBh Realtime] Rejected - date mismatch:', newRecord.tracking_date, '!=', currentDateStr);
                        return;
                    }

                    // STATE UPDATE: Add/update record in matrix
                    setTrackingMatrix(prev => {
                        const updated = new Map(prev);
                        updated.set(newRecord.patient_id, {
                            patientId: newRecord.patient_id,
                            evosDone: newRecord.evos_done,
                            bhDone: newRecord.bh_done,
                            assignedMd: newRecord.assigned_md,
                            recordId: newRecord.id
                        });
                        return updated;
                    });
                }
            )
            // Listen for UPDATE events (tracking field toggled)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'daily_tracking',
                    filter: `tracking_date=eq.${dateStr}`
                },
                (payload) => {
                    const updatedRecord = payload.new as SupabaseDailyTracking;
                    console.log('[EvosBh Realtime] UPDATE event:', updatedRecord.id);

                    // GATEKEEPER 1: Patient in ward
                    const currentPatientIds = patientIdsRef.current;
                    if (!currentPatientIds.includes(updatedRecord.patient_id)) {
                        console.log('[EvosBh Realtime] Rejected - patient not in ward:', updatedRecord.patient_id);
                        return;
                    }

                    // GATEKEEPER 2: Date matches
                    const currentDateStr = selectedDateRef.current;
                    if (updatedRecord.tracking_date !== currentDateStr) {
                        console.log('[EvosBh Realtime] Rejected - date mismatch:', updatedRecord.tracking_date);
                        return;
                    }

                    // STATE UPDATE: Update record in matrix
                    setTrackingMatrix(prev => {
                        const updated = new Map(prev);
                        const existing = updated.get(updatedRecord.patient_id);

                        // Prevent unnecessary updates (from own optimistic update echo)
                        if (existing &&
                            existing.evosDone === updatedRecord.evos_done &&
                            existing.bhDone === updatedRecord.bh_done &&
                            existing.assignedMd === updatedRecord.assigned_md) {
                            console.log('[EvosBh Realtime] Skipping - no change detected');
                            return prev;
                        }

                        updated.set(updatedRecord.patient_id, {
                            patientId: updatedRecord.patient_id,
                            evosDone: updatedRecord.evos_done,
                            bhDone: updatedRecord.bh_done,
                            assignedMd: updatedRecord.assigned_md,
                            recordId: updatedRecord.id
                        });
                        return updated;
                    });
                }
            )
            // Listen for DELETE events (cleanup when patient deleted - CASCADE)
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'daily_tracking',
                    filter: `tracking_date=eq.${dateStr}`
                },
                (payload) => {
                    const deletedPatientId = payload.old?.patient_id as string;
                    console.log('[EvosBh Realtime] DELETE event for patient:', deletedPatientId);

                    // Remove from matrix by resetting to default state
                    if (deletedPatientId) {
                        setTrackingMatrix(prev => {
                            const updated = new Map(prev);
                            if (updated.has(deletedPatientId)) {
                                // Reset to default state (don't remove entirely - patient may still exist)
                                updated.set(deletedPatientId, {
                                    patientId: deletedPatientId,
                                    evosDone: false,
                                    bhDone: false,
                                    assignedMd: null,
                                    recordId: null
                                });
                            }
                            return updated;
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[EvosBh Realtime] Subscription status (${channelName}):`, status);
                if (status === 'SUBSCRIBED') {
                    console.log('[EvosBh Realtime] Connected - Ward+Date scoped updates active');
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('[EvosBh Realtime] Channel Error - Check RLS policies');
                    setError('Error de conexion Realtime');
                }
                if (status === 'TIMED_OUT') {
                    console.error('[EvosBh Realtime] Connection timed out');
                }
                if (status === 'CLOSED') {
                    console.warn('[EvosBh Realtime] Connection closed');
                }
            });

        // 3. ROBUST CLEANUP: unsubscribe() then removeChannel()
        // Prevents memory leaks from ghost channels
        return () => {
            console.log('[EvosBh Realtime] Cleaning up channel:', channelName);
            channel.unsubscribe().then(() => {
                api.supabase.removeChannel(channel);
            });
        };
    }, [wardId, dateStr]); // Dependencies: ward AND date

    // Re-fill matrix when patientIds change (new patient added)
    useEffect(() => {
        if (wardId && patientIds.length > 0) {
            // Fill in any new patients not in matrix
            setTrackingMatrix(prev => {
                const updated = new Map(prev);
                let changed = false;

                patientIds.forEach(pid => {
                    if (!updated.has(pid)) {
                        updated.set(pid, {
                            patientId: pid,
                            evosDone: false,
                            bhDone: false,
                            assignedMd: null,
                            recordId: null
                        });
                        changed = true;
                    }
                });

                // Remove patients no longer in ward
                updated.forEach((_, pid) => {
                    if (!patientIds.includes(pid)) {
                        updated.delete(pid);
                        changed = true;
                    }
                });

                return changed ? updated : prev;
            });
        }
    }, [patientIds, wardId]);

    // Computed statistics for UI progress indicators
    const stats = useMemo((): TrackingStats => {
        let evosComplete = 0;
        let bhComplete = 0;
        let total = trackingMatrix.size;

        trackingMatrix.forEach(tracking => {
            if (tracking.evosDone) evosComplete++;
            if (tracking.bhDone) bhComplete++;
        });

        return {
            evosComplete,
            bhComplete,
            total,
            evosPercentage: total > 0 ? Math.round((evosComplete / total) * 100) : 0,
            bhPercentage: total > 0 ? Math.round((bhComplete / total) * 100) : 0
        };
    }, [trackingMatrix]);

    /**
     * Helper to get tracking for a specific patient
     */
    const getPatientTracking = useCallback((patientId: string): PatientTracking | undefined => {
        return trackingMatrix.get(patientId);
    }, [trackingMatrix]);

    return {
        trackingMatrix,
        loading,
        error,
        toggleField,
        updateAssignedMd,
        refresh: fetchTracking,
        stats,
        getPatientTracking
    };
};
