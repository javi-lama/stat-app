import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../services/api';
import type { Ward, Profile } from '../types';
import type { User, Session } from '@supabase/supabase-js';

export interface AppContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    activeWard: Ward | null;
    recentWards: Ward[];
    isAuthLoading: boolean;
    setWard: (ward: Ward) => void;
    clearActiveWard: () => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);

    const [activeWard, setActiveWard] = useState<Ward | null>(null);
    const [recentWards, setRecentWards] = useState<Ward[]>([]);
    const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

    const setWard = (ward: Ward) => {
        setActiveWard(ward);
        localStorage.setItem('stat_active_ward_id', ward.id);

        // Update recent wards
        setRecentWards(prev => {
            const filtered = prev.filter(w => w.id !== ward.id);
            const updated = [ward, ...filtered].slice(0, 3); // Keep only up to 3 recent wards
            localStorage.setItem('stat_recent_wards', JSON.stringify(updated));
            return updated;
        });
    };

    const clearActiveWard = () => {
        setActiveWard(null);
        localStorage.removeItem('stat_active_ward_id');
        // Mantener stat_recent_wards para quick-access en lobby
    };

    useEffect(() => {
        let mounted = true;

        const initializeAuthAndState = async (currentSession: Session | null) => {
            if (!currentSession) {
                if (mounted) {
                    setSession(null);
                    setUser(null);
                    setProfile(null);
                    setActiveWard(null);
                    setIsAuthLoading(false);
                }
                return;
            }

            if (mounted) {
                setIsAuthLoading(true);
                setSession(currentSession);
                setUser(currentSession.user);
            }

            try {
                // Read local storage first for fast-track
                const savedWardId = localStorage.getItem('stat_active_ward_id');
                const savedRecentWards = localStorage.getItem('stat_recent_wards');

                let targetWard: Ward | null = null;
                let parsedRecentWards: Ward[] = [];

                if (savedRecentWards) {
                    try {
                        parsedRecentWards = JSON.parse(savedRecentWards);
                        if (mounted) setRecentWards(parsedRecentWards);
                    } catch (e) {
                        console.error('Error parsing recent wards', e);
                    }
                }

                // If we have a saved ward, we can try to find it in recent first to avoid fetching if possible,
                // but we might need its name. If it's in recent, we have the full object.
                if (savedWardId) {
                    const foundInRecent = parsedRecentWards.find(w => w.id === savedWardId);
                    if (foundInRecent) {
                        targetWard = foundInRecent;
                    }
                }

                // We don't strictly need to block on fetching all wards if we have the targetWard from local storage
                // If we don't have it, we'll just leave activeWard null and the lobby will force them to pick one.

                if (mounted) setActiveWard(targetWard);

                // Fetch profile to have it available just in case, non-blocking for basic rendering
                api.supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', currentSession.user.id)
                    .single()
                    .then(({ data: profileData, error: profileError }) => {
                        if (!profileError && mounted) {
                            setProfile((profileData as Profile) || null);
                        }
                    });

            } catch (error) {
                console.error('Error during context initialization:', error);
            } finally {
                if (mounted) {
                    setIsAuthLoading(false);
                }
            }
        };

        // 1. Get initial session
        api.supabase.auth.getSession().then(({ data: { session } }) => {
            initializeAuthAndState(session);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = api.supabase.auth.onAuthStateChange((_event, session) => {
            initializeAuthAndState(session);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // Daily Maintenance: Archive old tasks + health check (runs once per day)
    useEffect(() => {
        if (session && activeWard) {
            api.runMaintenanceIfNeeded();
        }
    }, [session, activeWard]);

    return (
        <AppContext.Provider value={{
            session,
            user,
            profile,
            activeWard,
            recentWards,
            isAuthLoading,
            setWard,
            clearActiveWard
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
