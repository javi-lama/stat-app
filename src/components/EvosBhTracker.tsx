import React, { useMemo } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { useEvosBh } from '../hooks/useEvosBh';

interface EvosBhTrackerProps {
    patients: any[];
    selectedDate: Date;
}

const EvosBhTracker: React.FC<EvosBhTrackerProps> = ({ patients, selectedDate }) => {
    const { activeWard } = useAppContext();
    const patientIds = useMemo(() => patients.map(p => p.id || p.patientId), [patients]);

    const { toggleField, stats, getPatientTracking } = useEvosBh(
        selectedDate,
        activeWard?.id || null,
        patientIds
    );

    // SVG circle calculations for compact mobile cards
    const mobileRadius = 24;
    const mobileCircumference = 2 * Math.PI * mobileRadius;

    // SVG circle calculations for desktop cards
    const desktopRadius = 56;
    const desktopCircumference = 2 * Math.PI * desktopRadius;

    return (
        <div className="flex flex-col gap-4">

            {/* ============================================================ */}
            {/* MOBILE/TABLET: Compact Stats Cards (< xl) */}
            {/* ============================================================ */}
            <div className="grid grid-cols-2 gap-3 xl:hidden">
                {/* Compact BH Card */}
                <div className="bg-white rounded-xl shadow-sm border border-border-light p-3">
                    <div className="flex items-center gap-3">
                        <div className="relative size-14 flex items-center justify-center shrink-0">
                            <svg className="size-full transform -rotate-90">
                                <circle
                                    className="text-slate-100"
                                    cx="28" cy="28" r={mobileRadius}
                                    stroke="currentColor" strokeWidth="6" fill="transparent"
                                />
                                <circle
                                    className="text-[#2985a3] transition-all duration-700 ease-out"
                                    cx="28" cy="28" r={mobileRadius}
                                    stroke="currentColor" strokeWidth="6" fill="transparent"
                                    strokeDasharray={mobileCircumference}
                                    strokeDashoffset={mobileCircumference * (1 - stats.bhPercentage / 100)}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="absolute text-sm font-bold text-slate-800">{stats.bhPercentage}%</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700 uppercase truncate">Balances</p>
                            <p className="text-[10px] text-slate-400">{stats.bhComplete}/{stats.total} Listos</p>
                        </div>
                    </div>
                </div>

                {/* Compact EVOS Card */}
                <div className="bg-white rounded-xl shadow-sm border border-border-light p-3">
                    <div className="flex items-center gap-3">
                        <div className="relative size-14 flex items-center justify-center shrink-0">
                            <svg className="size-full transform -rotate-90">
                                <circle
                                    className="text-slate-100"
                                    cx="28" cy="28" r={mobileRadius}
                                    stroke="currentColor" strokeWidth="6" fill="transparent"
                                />
                                <circle
                                    className="text-[#2985a3] transition-all duration-700 ease-out"
                                    cx="28" cy="28" r={mobileRadius}
                                    stroke="currentColor" strokeWidth="6" fill="transparent"
                                    strokeDasharray={mobileCircumference}
                                    strokeDashoffset={mobileCircumference * (1 - stats.evosPercentage / 100)}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <span className="absolute text-sm font-bold text-slate-800">{stats.evosPercentage}%</span>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700 uppercase truncate">Evoluciones</p>
                            <p className="text-[10px] text-slate-400">{stats.evosComplete}/{stats.total} Listas</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ============================================================ */}
            {/* MAIN CONTENT: Table + Desktop Sidebar */}
            {/* ============================================================ */}
            <div className="flex flex-col xl:flex-row gap-6">

                {/* Table Area - grows organically (NO h-full, NO overflow-y-auto) */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-border-light">

                    {/* Table Header Row */}
                    <div className="grid grid-cols-[60px_80px_80px_1fr] md:grid-cols-[80px_1fr_100px_100px_160px] items-center px-4 py-3 bg-slate-50 border-b border-border-light text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <div className="text-center">Cama</div>
                        <div className="hidden md:block">Diagnóstico</div>
                        <div className="text-center">Balance en HC</div>
                        <div className="text-center">Evolución en HC</div>
                        <div className="text-center">Encargado</div>
                    </div>

                    {/* Patient Rows */}
                    <div>
                        {patients.map((patient) => {
                            const pid = patient.id || patient.patientId;
                            const tracking = getPatientTracking(pid);

                            return (
                                <div
                                    key={pid}
                                    className="grid grid-cols-[60px_80px_80px_1fr] md:grid-cols-[80px_1fr_100px_100px_160px] items-center px-4 py-3 md:py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors"
                                >
                                    {/* Cama */}
                                    <div className="text-center font-bold text-slate-800 text-sm">
                                        {patient.bed_number || patient.bedNumber}
                                    </div>

                                    {/* Diagnóstico - Hidden on mobile */}
                                    <div className="hidden md:block font-medium text-sm text-slate-700 pr-4 max-w-xs truncate">
                                        {patient.diagnosis || "Sin diagnóstico"}
                                    </div>

                                    {/* Balance en HC Checkbox */}
                                    <div className="flex justify-center">
                                        <button
                                            onClick={() => toggleField(pid, 'bh_done')}
                                            className={`size-10 md:size-11 rounded-lg border-2 flex items-center justify-center transition-all active:scale-95 ${
                                                tracking?.bhDone
                                                    ? 'bg-[#2985a3] border-[#2985a3] text-white shadow-md shadow-[#2985a3]/20'
                                                    : 'bg-white border-slate-200 text-transparent hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                            aria-label={tracking?.bhDone ? 'Balance completado' : 'Marcar balance como completado'}
                                        >
                                            <span className="material-symbols-outlined font-bold text-xl">check</span>
                                        </button>
                                    </div>

                                    {/* Evolución en HC Checkbox */}
                                    <div className="flex justify-center">
                                        <button
                                            onClick={() => toggleField(pid, 'evos_done')}
                                            className={`size-10 md:size-11 rounded-lg border-2 flex items-center justify-center transition-all active:scale-95 ${
                                                tracking?.evosDone
                                                    ? 'bg-[#2985a3] border-[#2985a3] text-white shadow-md shadow-[#2985a3]/20'
                                                    : 'bg-white border-slate-200 text-transparent hover:border-slate-300 hover:bg-slate-50'
                                            }`}
                                            aria-label={tracking?.evosDone ? 'Evolución completada' : 'Marcar evolución como completada'}
                                        >
                                            <span className="material-symbols-outlined font-bold text-xl">check</span>
                                        </button>
                                    </div>

                                    {/* Encargado - Editable Input */}
                                    <div className="flex justify-center">
                                        <input
                                            type="text"
                                            placeholder="Dr. / Dra."
                                            className="w-full min-w-[100px] md:min-w-[140px] border border-slate-200 bg-white rounded-md px-2 md:px-3 py-1.5 text-xs md:text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2985a3]/30 focus:border-[#2985a3] transition-colors"
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {/* Empty State */}
                        {patients.length === 0 && (
                            <div className="px-4 py-12 text-center">
                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">bed</span>
                                <p className="text-sm text-slate-400">No hay pacientes en este servicio</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ============================================================ */}
                {/* DESKTOP ONLY: Full-size Stats Cards Sidebar (≥ xl) */}
                {/* ============================================================ */}
                <div className="hidden xl:flex xl:flex-col xl:w-80 gap-6 shrink-0">

                    {/* BH Stats Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-border-light p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">% Balances Completos</h3>
                            <span className="material-symbols-outlined text-[#2985a3]">water_drop</span>
                        </div>

                        <div className="flex justify-center mb-6">
                            <div className="relative size-32 flex items-center justify-center">
                                <svg className="size-full transform -rotate-90">
                                    <circle
                                        className="text-slate-100"
                                        cx="64" cy="64" r={desktopRadius}
                                        stroke="currentColor" strokeWidth="12" fill="transparent"
                                    />
                                    <circle
                                        className="text-[#2985a3] transition-all duration-1000 ease-out"
                                        cx="64" cy="64" r={desktopRadius}
                                        stroke="currentColor" strokeWidth="12" fill="transparent"
                                        strokeDasharray={desktopCircumference}
                                        strokeDashoffset={desktopCircumference * (1 - stats.bhPercentage / 100)}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-bold text-slate-800">{stats.bhPercentage}%</span>
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Completos</span>
                                </div>
                            </div>
                        </div>

                        <div className="text-center text-xs font-medium text-slate-400">
                            {stats.bhComplete}/{stats.total} Balances Listos
                        </div>
                    </div>

                    {/* EVOS Stats Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-border-light p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">% Evoluciones Listas</h3>
                            <span className="material-symbols-outlined text-[#2985a3]">assignment</span>
                        </div>

                        <div className="flex justify-center mb-6">
                            <div className="relative size-32 flex items-center justify-center">
                                <svg className="size-full transform -rotate-90">
                                    <circle
                                        className="text-slate-100"
                                        cx="64" cy="64" r={desktopRadius}
                                        stroke="currentColor" strokeWidth="12" fill="transparent"
                                    />
                                    <circle
                                        className="text-[#2985a3] transition-all duration-1000 ease-out"
                                        cx="64" cy="64" r={desktopRadius}
                                        stroke="currentColor" strokeWidth="12" fill="transparent"
                                        strokeDasharray={desktopCircumference}
                                        strokeDashoffset={desktopCircumference * (1 - stats.evosPercentage / 100)}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-bold text-slate-800">{stats.evosPercentage}%</span>
                                    <span className="text-[10px] uppercase font-bold text-slate-400">Listas</span>
                                </div>
                            </div>
                        </div>

                        <div className="text-center text-xs font-medium text-slate-400">
                            {stats.evosComplete}/{stats.total} Evoluciones Listas
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default EvosBhTracker;
