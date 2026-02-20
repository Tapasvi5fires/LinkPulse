'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff, Mail, Lock, User, ArrowRight, Zap, CheckCircle2, Github, Globe, ShieldCheck, BookOpen, Fingerprint } from 'lucide-react';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [mounted, setMounted] = useState(false);
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
    }, []);

    // Password strength logic
    const getPasswordStrength = (pwd: string) => {
        let score = 0;
        if (!pwd) return 0;
        if (pwd.length >= 6) score++;
        if (pwd.length >= 10) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[^A-Za-z0-9]/.test(pwd)) score++;
        return score;
    };

    const passwordStrength = getPasswordStrength(password);
    const strengthLabels = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Secure'];
    const strengthColors = ['', 'bg-rose-500', 'bg-orange-500', 'bg-amber-500', 'bg-indigo-500', 'bg-emerald-500'];

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';
            const res = await fetch(`${apiUrl}/api/v1/users/open`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, full_name: fullName }),
            });

            if (res.ok) {
                setSuccess(true);
                setTimeout(() => router.push('/login'), 2500);
            } else {
                const data = await res.json().catch(() => null);
                setError(data?.detail || 'Registration failed. Please try again.');
            }
        } catch (err) {
            console.error(err);
            setError('Connection failed. Please check your network.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#020617] p-6 selection:bg-emerald-500/30">
                <div className="w-full max-w-[440px] text-center space-y-8 animate-in zoom-in-95 duration-700">
                    <div className="relative mx-auto w-24 h-24">
                        <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse" />
                        <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-500/10 border border-emerald-500/30 shadow-2xl shadow-emerald-500/20">
                            <CheckCircle2 size={40} className="text-emerald-400" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-3xl font-black text-white tracking-tight">Account Created!</h2>
                        <p className="text-slate-400 leading-relaxed">
                            Welcome to the future of knowledge management. <br />
                            Redirecting you to the login portal...
                        </p>
                    </div>
                    <div className="flex justify-center">
                        <Loader2 className="animate-spin text-emerald-500/40" size={24} />
                    </div>
                </div>
            </div>
        );
    }

    if (!mounted) return null;

    return (
        <div className="flex min-h-screen bg-[#020617] text-white overflow-hidden selection:bg-indigo-500/30">
            {/* Left Panel — Branding & Steps */}
            <div className="hidden lg:flex lg:w-[50%] relative flex-col justify-between p-16 overflow-hidden border-r border-white/5">
                {/* Dynamic Background */}
                <div className="absolute inset-0 bg-[#020617]" />
                <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-15%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]" style={{ animationDuration: '6s' }} />

                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-10" style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }} />

                {/* Content */}
                <div className="relative z-10">
                    <div className="flex items-center gap-3.5 group cursor-default">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-2xl shadow-blue-500/20 group-hover:rotate-6 transition-transform">
                            <Zap size={24} className="text-white fill-white/10" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-white to-purple-400 bg-clip-text text-transparent">
                                LinkPulse
                            </h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-0.5">Scale Your Intelligence</p>
                        </div>
                    </div>
                </div>

                <div className="relative z-10">
                    <div className="mb-12">
                        <h2 className="text-5xl font-black leading-[1.1] tracking-tight text-slate-100 mb-6">
                            Master your <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 font-black">Digital Universe.</span>
                        </h2>
                        <p className="text-lg text-slate-400 leading-relaxed max-w-sm">
                            Join LinkPulse to transform scattered data into a unified, actionable knowledge network.
                        </p>
                    </div>

                    <div className="space-y-5 max-w-sm">
                        {[
                            { step: '01', icon: Fingerprint, title: 'Identity Setup', desc: 'Secure encryption for your private workspace' },
                            { step: '02', icon: BookOpen, title: 'Knowledge Ingest', desc: 'Plug in any data source instantly' },
                            { step: '03', icon: ShieldCheck, title: 'AI Synthesis', desc: 'Chat and explore connections' },
                        ].map((s, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all group">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors shrink-0">
                                    <s.icon size={18} className="text-indigo-400" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] font-bold text-slate-200 uppercase tracking-widest">{s.title}</p>
                                        <span className="text-[10px] font-black text-slate-600">{s.step}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">{s.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative z-10 flex items-center justify-between">
                    <p className="text-[11px] text-slate-600 font-medium tracking-wide">EST. 2026 • LINKPULSE CORE</p>
                </div>
            </div>

            {/* Right Panel — Reg Form */}
            <div className="flex-1 flex items-center justify-center p-8 lg:p-12 bg-[#020617]">
                <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    {/* Header */}
                    <div className="text-center lg:text-left">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 mb-6 lg:hidden">
                            <Zap size={20} className="text-indigo-500" />
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Create Account</h2>
                        <p className="text-slate-400 text-sm">Join the next generation of AI knowledge platforms.</p>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-5">
                        {error && (
                            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-in shake duration-300">
                                <div className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Full Name</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={16} />
                                    <input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder:text-slate-700"
                                        placeholder="Enter your name"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Email address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={16} />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder:text-slate-700"
                                        placeholder="name@company.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Create Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={16} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        minLength={6}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-12 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all placeholder:text-slate-700"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>

                                {/* Password Strength Meter */}
                                {password && (
                                    <div className="px-1.5 pt-2 space-y-1.5 animate-in fade-in duration-300">
                                        <div className="flex gap-1.5">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${i <= passwordStrength ? strengthColors[passwordStrength] : 'bg-white/5'}`} />
                                            ))}
                                        </div>
                                        <p className={`text-[10px] font-bold uppercase tracking-wider ${passwordStrength <= 2 ? 'text-rose-400' : passwordStrength <= 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                            Security: {strengthLabels[passwordStrength]}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || passwordStrength < 2}
                            className="w-full group relative flex h-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-sm font-bold text-white shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <div className="flex items-center gap-2">
                                    Initialize Account
                                    <ArrowRight className="group-hover:translate-x-1 transition-transform" size={16} />
                                </div>
                            )}
                        </button>
                    </form>

                    <div className="text-center pt-2">
                        <p className="text-slate-500 text-sm font-medium">
                            Already part of LinkPulse?{' '}
                            <Link href="/login" className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors">
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
