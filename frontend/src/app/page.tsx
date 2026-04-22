'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Zap, Brain, Shield, Sparkles } from 'lucide-react';

export default function Home() {
    const router = useRouter();
    const [status, setStatus] = useState('Initializing Neural Engine');
    const [progress, setProgress] = useState(0);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        
        // Linear progression over 3 seconds
        const startTime = Date.now();
        const duration = 3000;
        
        const statuses = [
            { text: 'Initializing Neural Engine', threshold: 0 },
            { text: 'Syncing Knowledge Graph', threshold: 25 },
            { text: 'Calibrating Vector Space', threshold: 50 },
            { text: 'Optimizing Interface', threshold: 75 },
            { text: 'Neural Engine Ready', threshold: 100 }
        ];

        const timer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const newProgress = Math.min((elapsed / duration) * 100, 100);
            
            setProgress(newProgress);
            
            // Update status text based on progress
            const currentStatus = [...statuses].reverse().find(s => newProgress >= s.threshold);
            if (currentStatus) setStatus(currentStatus.text);

            if (newProgress >= 100) {
                clearInterval(timer);
                setTimeout(() => {
                    const token = localStorage.getItem('token');
                    router.replace(token ? '/dashboard' : '/login');
                }, 500);
            }
        }, 50);

        return () => clearInterval(timer);
    }, [router]);

    if (!mounted) return <div className="min-h-screen bg-[#020617]" />;

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#020617] selection:bg-indigo-500/30 overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div 
                    animate={{ scale: [1, 1.1, 1], opacity: [0.05, 0.1, 0.05] }}
                    transition={{ duration: 8, repeat: Infinity }}
                    className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[120px]" 
                />
                <motion.div 
                    animate={{ scale: [1.1, 1, 1.1], opacity: [0.05, 0.1, 0.05] }}
                    transition={{ duration: 10, repeat: Infinity }}
                    className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-600/20 rounded-full blur-[120px]" 
                />
            </div>

            <div className="flex flex-col items-center gap-12 relative z-10 w-full max-w-sm px-6">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative"
                >
                    <div className="h-24 w-24 rounded-[2rem] bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 shadow-2xl flex items-center justify-center p-0.5">
                        <div className="w-full h-full bg-[#020617] rounded-[1.8rem] flex items-center justify-center">
                            <motion.div 
                                animate={{ rotate: [0, 5, -5, 0] }}
                                transition={{ duration: 4, repeat: Infinity }}
                                className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center"
                            >
                                <span className="text-white font-black text-3xl tracking-tighter">L</span>
                            </motion.div>
                        </div>
                    </div>
                </motion.div>

                <div className="flex flex-col items-center w-full">
                    <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-r from-blue-400 via-white to-purple-400 bg-clip-text text-transparent mb-8">
                        LinkPulse
                    </h1>
                    
                    <div className="flex items-center gap-3 mb-4 h-6">
                        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 min-w-[200px] text-center">
                            {status}
                        </p>
                    </div>

                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden relative">
                        <motion.div 
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-purple-600"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <div className="flex gap-6 mt-4 opacity-20">
                    <Brain className="h-4 w-4" />
                    <Zap className="h-4 w-4" />
                    <Shield className="h-4 w-4" />
                    <Sparkles className="h-4 w-4" />
                </div>
            </div>
        </div>
    );
}
