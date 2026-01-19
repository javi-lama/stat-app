import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import type { PatientCardProps } from '../types';

export const useRealtimeCensus = () => {
    const [patients, setPatients] = useState<PatientCardProps[]>([]);
    const [rawPatients, setRawPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCensus = useCallback(async () => {
        try {
            console.log('[Census] Fetching latest data...');
            const raw = await api.getWardCensus();
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
    }, []);

    useEffect(() => {
        // 1. Initial Fetch
        fetchCensus();

        // 2. Realtime Subscription
        console.log('[Realtime] Initializing subscription...');

        const channel = api.supabase
            .channel('ward-updates-v3') // Bump version to start fresh
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public'
                },
                (payload) => {
                    console.log('[Realtime] Global Change:', payload);
                    fetchCensus();
                }
            )
            .subscribe((status) => {
                console.log(`[Realtime] Status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    // Confirmed connection
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('[Realtime] Channel Error - Check browser console/network tab');
                }
            });

        // 3. Cleanup
        return () => {
            console.log('[Realtime] Disconnecting...');
            api.supabase.removeChannel(channel);
        };
    }, [fetchCensus]);

    return {
        patients,
        rawPatients,
        loading,
        error,
        refresh: fetchCensus
    };
};
