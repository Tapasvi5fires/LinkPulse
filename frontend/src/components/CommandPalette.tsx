'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Search,
    MessageSquare,
    LayoutDashboard,
    Share2,
    BarChart3,
    Plus,
    Moon,
    Sun,
    LogOut,
    ArrowRight,
    Command as CommandIcon,
    FileText,
    Github,
    Globe,
    Youtube
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface CommandItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    category: 'Navigation' | 'Actions' | 'Recently Ingested';
    action: () => void;
    shortcut?: string;
}

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [recentSources, setRecentSources] = useState<any[]>([]);
    const router = useRouter();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';

    const fetchRecentSources = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const response = await fetch(`${apiUrl}/api/v1/ingestion/sources`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                // Get last 5 sources
                setRecentSources(data.slice(-5).reverse());
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    useEffect(() => {
        if (open) {
            fetchRecentSources();
            setSearch('');
            setSelectedIndex(0);
        }
    }, [open]);

    const toggleTheme = () => {
        const isDark = document.documentElement.classList.contains('dark');
        if (isDark) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        }
        setOpen(false);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push('/login');
        setOpen(false);
    };

    const commands: CommandItem[] = [
        // Navigation
        { id: 'nav-dashboard', label: 'Go to Dashboard', icon: <LayoutDashboard size={18} />, category: 'Navigation', action: () => router.push('/dashboard'), shortcut: 'G D' },
        { id: 'nav-chat', label: 'Go to Chat', icon: <MessageSquare size={18} />, category: 'Navigation', action: () => router.push('/chat'), shortcut: 'G C' },
        { id: 'nav-graph', label: 'Go to Knowledge Graph', icon: <Share2 size={18} />, category: 'Navigation', action: () => router.push('/knowledge-graph'), shortcut: 'G G' },
        { id: 'nav-analytics', label: 'Go to Analytics', icon: <BarChart3 size={18} />, category: 'Navigation', action: () => router.push('/analytics'), shortcut: 'G A' },

        // Actions
        { id: 'act-ingest', label: 'Start New Ingestion', icon: <Plus size={18} />, category: 'Actions', action: () => { router.push('/dashboard'); /* Trigger ingest dialog would be better but requires context */ } },
        { id: 'act-theme', label: 'Toggle Theme', icon: <Sun size={18} />, category: 'Actions', action: toggleTheme },
        { id: 'act-logout', label: 'Logout', icon: <LogOut size={18} />, category: 'Actions', action: handleLogout },
    ];

    // Add recent sources to commands
    recentSources.forEach(source => {
        const sourceIcon = source.source_type === 'github' ? <Github size={18} /> :
            source.source_type === 'website' ? <Globe size={18} /> :
                source.source_type === 'youtube' ? <Youtube size={18} /> :
                    <FileText size={18} />;

        commands.push({
            id: `source-${source.id}`,
            label: `View: ${source.title || source.source_url}`,
            icon: sourceIcon,
            category: 'Recently Ingested',
            action: () => {
                // Future: open specific source content view
                router.push('/dashboard');
                setOpen(false);
            }
        });
    });

    const filteredCommands = commands.filter(cmd =>
        cmd.label.toLowerCase().includes(search.toLowerCase()) ||
        cmd.category.toLowerCase().includes(search.toLowerCase())
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredCommands[selectedIndex]) {
                filteredCommands[selectedIndex].action();
            }
        }
    };

    const categories = Array.from(new Set(filteredCommands.map(c => c.category)));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden border-none bg-slate-900/95 backdrop-blur-xl shadow-2xl ring-1 ring-white/10">
                <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
                    <Search className="text-slate-400" size={20} />
                    <Input
                        placeholder="Type a command or search..."
                        className="flex-1 border-none bg-transparent text-lg focus-visible:ring-0 text-white placeholder:text-slate-500"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
                        onKeyDown={handleKeyDown}
                        autoFocus
                    />
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] text-slate-400 font-mono">
                        <span className="text-[12px]">ESC</span>
                    </div>
                </div>

                <ScrollArea className="max-h-[450px]">
                    <div className="p-2 space-y-4">
                        {categories.map(category => (
                            <div key={category} className="space-y-1">
                                <h3 className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    {category}
                                </h3>
                                <div className="space-y-0.5">
                                    {filteredCommands
                                        .filter(c => c.category === category)
                                        .map((cmd, idx) => {
                                            const globalIdx = filteredCommands.indexOf(cmd);
                                            const isSelected = globalIdx === selectedIndex;
                                            return (
                                                <div
                                                    key={cmd.id}
                                                    className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-150 group ${isSelected
                                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                                        }`}
                                                    onClick={() => cmd.action()}
                                                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                                                >
                                                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-white/5 group-hover:bg-white/10'}`}>
                                                        {cmd.icon}
                                                    </div>
                                                    <span className="flex-1 text-sm font-medium">{cmd.label}</span>
                                                    {cmd.shortcut && (
                                                        <div className={`flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${isSelected ? 'bg-white/20 border-white/20 text-white' : 'bg-white/5 border-white/5 text-slate-500'
                                                            }`}>
                                                            {cmd.shortcut}
                                                        </div>
                                                    )}
                                                    {isSelected && <ArrowRight size={14} className="animate-in slide-in-from-left-2" />}
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        ))}
                    </div>
                    {filteredCommands.length === 0 && (
                        <div className="p-12 text-center">
                            <CommandIcon size={48} className="mx-auto text-slate-700 mb-4 opacity-20" />
                            <p className="text-slate-400 text-sm">No results found for "{search}"</p>
                        </div>
                    )}
                </ScrollArea>

                <div className="px-4 py-3 bg-white/5 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-white/10 border border-white/10">↑↓</kbd> Navigate</span>
                        <span className="flex items-center gap-1"><kbd className="px-1 rounded bg-white/10 border border-white/10">↵</kbd> Select</span>
                    </div>
                    <span>LinkPulse Palette v1.0</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
