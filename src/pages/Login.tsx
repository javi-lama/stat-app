import React, { useState } from 'react';
import { api } from '../services/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Fix: Redirection
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await api.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                toast.error(error.message);
            } else {
                toast.success('Welcome back!');
                // Fix: Immediate redirection
                navigate('/', { replace: true });
            }
        } catch (err) {
            console.error(err);
            toast.error('An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#F8FAFB] dark:bg-[#0F172A] min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-200 font-sans">
            <main className="w-full max-w-[440px] z-10 relative">
                <div className="flex flex-col items-center justify-center mb-10 text-center">
                    <img src="/logo.svg" alt="STAT. Logo" className="w-24 h-24 mb-4 drop-shadow-lg" />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">STAT.</h1>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">Hospital Workflow Manager</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 p-8 md:p-10">
                    <div className="mb-8">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Sign In</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Access your ward and patient tasks securely.</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="medical-id">Medical ID or Email</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#30889E] transition-colors">
                                    {/* Fix: Class name */}
                                    <span className="material-symbols-outlined text-[20px]">badge</span>
                                </div>
                                <input
                                    id="medical-id"
                                    type="text"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="e.g. DR123456 or name@hospital.org"
                                    className="block w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#30889E]/20 focus:border-[#30889E] transition-all text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="password">Password</label>
                                <a href="#" className="text-xs font-semibold text-[#30889E] hover:underline">Forgot password?</a>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#30889E] transition-colors">
                                    {/* Fix: Class name */}
                                    <span className="material-symbols-outlined text-[20px]">lock_open</span>
                                </div>
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="block w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#30889E]/20 focus:border-[#30889E] transition-all text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                                >
                                    {/* Fix: Class name */}
                                    <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                type="checkbox"
                                className="h-4 w-4 text-[#30889E] focus:ring-[#30889E] border-slate-300 dark:border-slate-700 rounded transition-colors bg-white dark:bg-slate-900 cursor-pointer"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                                Stay signed in for today's shift
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-[#30889E] hover:bg-[#287488] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#30889E] transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="animate-pulse">Signing in...</span>
                            ) : (
                                <>
                                    Secure Sign In
                                    {/* Fix: Class name */}
                                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <footer className="mt-10 text-center space-y-4">
                    <div className="flex items-center justify-center gap-4 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        <a href="#" className="hover:text-[#30889E] transition-colors">Security & Privacy</a>
                        <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full"></span>
                        <a href="#" className="hover:text-[#30889E] transition-colors">Support</a>
                        <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full"></span>
                        <a href="#" className="hover:text-[#30889E] transition-colors">Terms</a>
                    </div>
                    <div className="flex items-center justify-center gap-2 px-6 py-2 bg-slate-100/50 dark:bg-slate-800/50 rounded-full w-fit mx-auto">
                        {/* Fix: Class name */}
                        <span className="material-symbols-outlined text-emerald-500 text-sm">verified_user</span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">HIPAA Compliant & End-to-End Encrypted Session</p>
                    </div>
                </footer>
            </main>

            <div className="fixed top-0 left-0 w-full h-1 bg-[#30889E]"></div>
            <div className="fixed -bottom-24 -left-24 w-96 h-96 bg-[#30889E]/5 rounded-full blur-3xl pointer-events-none"></div>
            <div className="fixed -top-24 -right-24 w-96 h-96 bg-[#30889E]/5 rounded-full blur-3xl pointer-events-none"></div>
        </div>
    );
};

export default Login;
