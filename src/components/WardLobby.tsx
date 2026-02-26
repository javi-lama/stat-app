import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAppContext } from '../contexts/AppContext';
import type { Ward } from '../types';

const WardLobby: React.FC = () => {
    const { user, recentWards, setWard } = useAppContext();
    const [wards, setWards] = useState<Ward[]>([]);
    const [isLoadingWards, setIsLoadingWards] = useState(true);
    const [selectedWardId, setSelectedWardId] = useState<string>('');

    // Dynamic Greeting Logic
    // In a real app we would use user_metadata.last_name, but for now we parse the email or use a generic term
    const getGreetingName = () => {
        if (!user?.email) return 'Doctor';
        const namePart = user.email.split('@')[0];
        // Capitalize first letter
        return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    };

    useEffect(() => {
        let mounted = true;
        const fetchWards = async () => {
            try {
                setIsLoadingWards(true);
                const { data, error } = await api.supabase.from('wards').select('*').order('name');
                if (error) throw error;
                if (mounted && data) {
                    setWards(data as Ward[]);
                }
            } catch (error) {
                console.error("Error fetching wards:", error);
            } finally {
                if (mounted) setIsLoadingWards(false);
            }
        };

        fetchWards();

        return () => { mounted = false; };
    }, []);

    const handleContinue = () => {
        if (!selectedWardId) return;
        const wardToSet = wards.find(w => w.id === selectedWardId) || recentWards.find(w => w.id === selectedWardId);
        if (wardToSet) {
            setWard(wardToSet);
        }
    };

    const handleSignOut = async () => {
        await api.supabase.auth.signOut();
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-display p-4 relative overflow-hidden">
            {/* Subtle background gradient / glow behind card if desired */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>

            {/* Top Logo Section - Synced with Login.tsx aesthetic */}
            <div className="flex flex-col items-center mb-10 z-10 text-center">
                <img src="/logo.svg" alt="STAT. Logo" className="w-24 h-24 mb-4 drop-shadow-lg" />
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 leading-tight">STAT.</h1>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">
                        Gestor de Flujo de Trabajo Hospitalario
                    </p>
                </div>
            </div>

            {/* Main Interactive Card - Synced with Login.tsx shadow */}
            <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 w-full max-w-md p-8 sm:p-10 z-10">
                <div className="text-center mb-8">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-2">
                        ¡Bienvenido, Dr. {getGreetingName()}!
                    </h2>
                    <p className="text-sm text-slate-500">
                        Selecciona tu lugar de trabajo para hoy para configurar tu entorno.
                    </p>
                </div>

                {/* Dropdown Section */}
                <div className="mb-6">
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                        Servicio
                    </label>
                    <div className="relative">
                        <select
                            value={selectedWardId}
                            onChange={(e) => setSelectedWardId(e.target.value)}
                            disabled={isLoadingWards}
                            className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-3 px-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors disabled:opacity-50"
                        >
                            <option value="" disabled>
                                {isLoadingWards ? 'Cargando servicios...' : 'Selecciona un servicio...'}
                            </option>
                            {wards.map(ward => (
                                <option key={ward.id} value={ward.id}>
                                    {ward.name}
                                </option>
                            ))}
                        </select>
                        {/* Custom Dropdown Icon & Hospital Icon Wrapper */}
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                            {isLoadingWards ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            ) : (
                                <span className="material-symbols-outlined text-xl">expand_more</span>
                            )}
                        </div>
                        {/* Left Hospital Icon (Optional matching design) */}
                        {!selectedWardId && !isLoadingWards && (
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                                <span className="material-symbols-outlined text-lg">local_hospital</span>
                            </div>
                        )}
                        {/* Adjust padding if left icon is used */}
                        <style>{`select { padding-left: ${!selectedWardId && !isLoadingWards ? '2.5rem' : '1rem'} !important; }`}</style>
                    </div>
                </div>

                {/* Recent Wards Pills */}
                {recentWards.length > 0 && (
                    <div className="mb-8">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-wider">
                            Servicios Recientes
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {recentWards.map(ward => (
                                <button
                                    key={`recent-${ward.id}`}
                                    onClick={() => setSelectedWardId(ward.id)}
                                    className={`text-xs px-4 py-2 rounded-full border transition-all ${selectedWardId === ward.id
                                        ? 'bg-primary/10 border-primary text-primary font-semibold'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }`}
                                >
                                    {ward.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Continue Action - Synced with Login.tsx primary color */}
                <button
                    onClick={handleContinue}
                    disabled={!selectedWardId || isLoadingWards}
                    className="w-full bg-[#30889E] hover:bg-[#287488] text-white font-semibold py-3.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                    Continuar
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
            </div>

            {/* Bottom Footer Section */}
            <div className="mt-8 flex flex-col items-center gap-4 z-10">
                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <button className="hover:text-slate-700 transition-colors">Seguridad</button>
                    <span className="text-slate-300">•</span>
                    <button className="hover:text-slate-700 transition-colors">Soporte IT</button>
                    <span className="text-slate-300">•</span>
                    <button onClick={handleSignOut} className="hover:text-slate-700 transition-colors">Cambiar Usuario</button>
                </div>

                <div className="bg-white border border-slate-200 px-4 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
                    <span className="material-symbols-outlined text-[14px] text-green-500">verified_user</span>
                    <span className="text-[9px] font-bold text-slate-500">CONEXIÓN SEGURA & ENCRIPTADA (HIPAA)</span>
                </div>
            </div>
        </div>
    );
};

export default WardLobby;
