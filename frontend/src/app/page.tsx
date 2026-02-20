'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            // Give it a tiny bit of time for a smooth transition feel
            await new Promise(r => setTimeout(r, 800));
            if (token) {
                router.replace('/dashboard');
            } else {
                router.replace('/login');
            }
        };
        checkAuth();
    }, [router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#020617] selection:bg-indigo-500/30">
            {/* Ambient Background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px]" style={{ animationDuration: '8s' }} />
            </div>

            <div className="flex flex-col items-center gap-6 relative z-10 animate-in fade-in zoom-in duration-1000">
                <div className="h-20 w-20 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 shadow-2xl shadow-blue-500/20 flex items-center justify-center p-0.5">
                    <div className="w-full h-full bg-[#020617] rounded-[22px] flex items-center justify-center">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
                            <span className="text-white font-black text-2xl tracking-tighter">L</span>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center">
                    <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-blue-400 via-white to-purple-400 bg-clip-text text-transparent mb-2">
                        LinkPulse
                    </h1>
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Initializing Neural Engine</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
