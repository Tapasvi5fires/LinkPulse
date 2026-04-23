'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff, Mail, Lock, ArrowRight, Zap, Brain, Shield, Sparkles, Github, Globe } from 'lucide-react';

function LoginContent() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [mounted, setMounted] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        setMounted(true);
        
        // 1. Check if we just returned from Social Login (Google/GitHub)
        const token = searchParams.get('token');
        if (token) {
            localStorage.setItem('token', token);
            router.replace('/dashboard');
            return;
        }

        // 2. Regular check - if already logged in, skip the wait
        if (localStorage.getItem('token')) {
            router.replace('/dashboard');
        }
    }, [router, searchParams]);

    const handleSocialLogin = (provider: 'google' | 'github') => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';
        window.location.href = `${apiUrl}/api/v1/auth/${provider}/login`;
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';
            const res = await fetch(`${apiUrl}/api/v1/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ username: email, password: password }),
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('token', data.access_token);
                router.push('/dashboard');
            } else {
                const data = await res.json().catch(() => null);
                setError(data?.detail || 'Invalid email or password. Please try again.');
            }
        } catch (err) {
            console.error(err);
            setError('Connection failed. Please check your network.');
        } finally {
            setLoading(false);
        }
    };

    if (!mounted) return null;

    return (
        <div className="flex min-h-screen bg-[#020617] text-white overflow-hidden selection:bg-indigo-500/30">
            {/* Left Panel — Branding & Impact */}
            <div className="hidden lg:flex lg:w-[50%] relative flex-col justify-between p-16 overflow-hidden border-r border-white/5">
                {/* Dynamic Background */}
                <div className="absolute inset-0 bg-[#020617]" />
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]" style={{ animationDuration: '8s' }} />
                <div className="absolute top-[30%] left-[20%] w-[300px] h-[300px] bg-indigo-600/5 rounded-full blur-[80px]" />

                {/* Subtle Grid dots */}
                <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
                    backgroundSize: '30px 30px'
                }} />

                {/* Content */}
                <div className="relative z-10">
                    <div className="flex items-center gap-3.5 group cursor-default">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-2xl shadow-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                            <Zap size={24} className="text-white fill-white/10" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight bg-gradient-to-r from-blue-400 via-white to-purple-400 bg-clip-text text-transparent">
                                LinkPulse
                            </h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-0.5">Autonomous Knowledge Engine</p>
                        </div>
                    </div>
                </div>

                <div className="relative z-10">
                    <div className="space-y-6">
                        <h2 className="text-5xl font-black leading-[1.1] tracking-tight text-slate-100">
                            Centralize your <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">entire knowledge base.</span>
                        </h2>
                        <p className="text-lg text-slate-400 leading-relaxed max-w-md">
                            Connect your sources, visualize relationships, and interact with your data like never before.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-12 max-w-lg">
                        {[
                            { icon: Brain, label: 'Deep Context RAG', desc: 'Precise AI retrieval' },
                            { icon: Shield, label: 'Knowledge Mapping', desc: 'Visual source graph' },
                            { icon: Sparkles, label: 'Auto-Insights', desc: 'Summaries in seconds' },
                            { icon: Globe, label: 'Universal Ingest', desc: 'Web, PDF, Code, Video' },
                        ].map((item, i) => (
                            <div key={i} className="flex flex-col gap-2.5 p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors cursor-default">
                                <item.icon size={18} className="text-blue-400" />
                                <div>
                                    <p className="text-xs font-bold text-slate-200">{item.label}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative z-10 flex items-center justify-between">
                    <p className="text-[11px] text-slate-600 font-medium tracking-wide">© 2026 LINKPULSE. ALL RIGHTS RESERVED.</p>
                    <div className="flex gap-4 opacity-40 hover:opacity-100 transition-opacity">
                        <Github size={14} className="cursor-pointer" />
                        <Globe size={14} className="cursor-pointer" />
                    </div>
                </div>
            </div>

            {/* Right Panel — Auth Form */}
            <div className="flex-1 flex items-center justify-center p-8 lg:p-12 bg-[#020617]">
                <div className="w-full max-w-[400px] space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    {/* Header */}
                    <div className="text-center lg:text-left">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 mb-6 lg:hidden">
                            <Zap size={20} className="text-blue-500" />
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Welcome back</h2>
                        <p className="text-slate-400 text-sm">Please enter your details to sign in.</p>
                    </div>

                    {/* Social Login */}
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => handleSocialLogin('google')}
                            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-xs font-semibold text-slate-300"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                            Google
                        </button>
                        <button 
                            onClick={() => handleSocialLogin('github')}
                            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-xs font-semibold text-slate-300"
                        >
                            <Github size={16} />
                            GitHub
                        </button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/5"></span></div>
                        <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold"><span className="bg-[#020617] px-4 text-slate-600">Or continue with</span></div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        {error && (
                            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-in shake duration-300">
                                <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Email address</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={16} />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all placeholder:text-slate-700"
                                        placeholder="name@company.com"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Password</label>
                                    <Link href="#" className="text-[11px] text-blue-500 font-bold hover:text-blue-400 transition-colors">Forgot password?</Link>
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-blue-500 transition-colors" size={16} />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3 pl-12 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all placeholder:text-slate-700"
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
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full group relative flex h-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-sm font-bold text-white shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <div className="flex items-center gap-2">
                                    Sign In to LinkPulse
                                    <ArrowRight className="group-hover:translate-x-1 transition-transform" size={16} />
                                </div>
                            )}
                        </button>
                    </form>

                    <div className="text-center pt-4">
                        <p className="text-slate-500 text-sm">
                            New to the platform?{' '}
                            <Link href="/register" className="text-blue-500 font-bold hover:text-blue-400 transition-colors">
                                Create an account
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#020617] flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={40} />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
