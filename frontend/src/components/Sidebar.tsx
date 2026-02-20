'use client';

import { MessageSquare, LogOut, LayoutDashboard, Sun, Moon, BarChart3, Share2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        const saved = localStorage.getItem('theme');
        if (saved === 'light') {
            setIsDark(false);
            document.documentElement.classList.remove('dark');
        } else {
            setIsDark(true);
            document.documentElement.classList.add('dark');
        }
    }, []);

    const toggleTheme = () => {
        if (isDark) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            setIsDark(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            setIsDark(true);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push('/login');
    };

    const links = [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/chat', label: 'Chat', icon: MessageSquare },
        { href: '/knowledge-graph', label: 'Knowledge Graph', icon: Share2 },
        { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    ];

    return (
        <div className="flex h-screen w-64 flex-col border-r bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 fixed left-0 top-0 hidden md:flex shadow-xl z-40">
            <div className="p-6 border-b border-gray-100 dark:border-slate-800">
                <Link href="/">
                    <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent cursor-pointer">LinkPulse</h1>
                </Link>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium">AI Knowledge Platform</p>
            </div>
            <nav className="flex-1 space-y-1 p-4">
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${isActive
                                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                                : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            <Icon size={20} />
                            {link.label}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 space-y-2 border-t border-gray-200 dark:border-slate-800">
                <button
                    onClick={toggleTheme}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
                >
                    {isDark ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-500" />}
                    {isDark ? 'Light Mode' : 'Dark Mode'}
                </button>
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"
                >
                    <LogOut size={20} />
                    Logout
                </button>
            </div>
        </div>
    );
}
