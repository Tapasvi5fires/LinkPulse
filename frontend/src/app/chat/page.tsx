'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Loader2, Sparkles, Filter, X, Check, Calculator, MessageSquare, ArrowRight, Zap, Lightbulb, ChevronDown, ChevronRight, Github, FileText, Globe, Youtube, Instagram, FolderOpen, Search, Minus, Hash, RefreshCw } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

// Source group for chat filter
interface FilterGroup {
    key: string;
    type: 'github' | 'folder' | 'website' | 'single';
    label: string;
    sourceType: string;
    sources: any[];
}

export default function ChatPage() {
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [persona, setPersona] = useState("professional");
    const [webSearch, setWebSearch] = useState(false);

    const [sources, setSources] = useState<any[]>([]);
    const [selectedSources, setSelectedSources] = useState<string[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [filterSearch, setFilterSearch] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const filterRef = useRef<HTMLDivElement>(null);

    // Helper to get token
    const getToken = () => {
        return localStorage.getItem('token');
    }

    useEffect(() => {
        const fetchSources = async () => {
            try {
                const token = getToken();
                const headers: HeadersInit = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';
                const res = await fetch(`${apiUrl}/api/v1/ingestion/sources`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    setSources(data);
                }
            } catch (error) {
                console.error("Failed to fetch sources", error);
            }
        };
        fetchSources();

        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- Grouping & Selection Helpers ---

    const groupSourcesForFilter = useCallback((): FilterGroup[] => {
        const groups: FilterGroup[] = [];
        const repoMap = new Map<string, any[]>();
        const folderMap = new Map<string, any[]>();
        const websiteMap = new Map<string, any[]>();
        const singles: any[] = [];

        sources.forEach(s => {
            if (s.repo) {
                const existing = repoMap.get(s.repo) || [];
                existing.push(s);
                repoMap.set(s.repo, existing);
            } else if (s.folder_name) {
                const existing = folderMap.get(s.folder_name) || [];
                existing.push(s);
                folderMap.set(s.folder_name, existing);
            } else if (s.source_type === 'website') {
                try {
                    const domain = new URL(s.source_url).hostname.replace('www.', '');
                    const existing = websiteMap.get(domain) || [];
                    existing.push(s);
                    websiteMap.set(domain, existing);
                } catch {
                    singles.push(s);
                }
            } else {
                singles.push(s);
            }
        });

        repoMap.forEach((srcs, repo) => {
            groups.push({
                key: `repo:${repo}`,
                type: 'github',
                label: repo.split('/').pop() || repo,
                sourceType: 'github',
                sources: srcs,
            });
        });

        folderMap.forEach((srcs, folder) => {
            groups.push({
                key: `folder:${folder}`,
                type: 'folder',
                label: folder,
                sourceType: srcs[0]?.source_type || 'file',
                sources: srcs,
            });
        });

        websiteMap.forEach((srcs, domain) => {
            groups.push({
                key: `website:${domain}`,
                type: 'website',
                label: domain,
                sourceType: 'website',
                sources: srcs,
            });
        });

        singles.forEach(s => {
            groups.push({
                key: `single:${s.source_url}`,
                type: 'single',
                label: s.title || s.source_url,
                sourceType: s.source_type,
                sources: [s],
            });
        });

        return groups;
    }, [sources]);

    const getGroupSelectionState = (group: FilterGroup): 'none' | 'partial' | 'all' => {
        const selected = group.sources.filter(s => selectedSources.includes(s.source_url)).length;
        if (selected === 0) return 'none';
        if (selected === group.sources.length) return 'all';
        return 'partial';
    };

    const toggleFilterGroup = (group: FilterGroup) => {
        const state = getGroupSelectionState(group);
        if (state === 'all') {
            // Deselect all in group
            setSelectedSources(prev => prev.filter(url => !group.sources.some(s => s.source_url === url)));
        } else {
            // Select all in group
            const groupUrls = group.sources.map(s => s.source_url);
            setSelectedSources(prev => {
                const combined = [...prev];
                groupUrls.forEach(url => { if (!combined.includes(url)) combined.push(url); });
                return combined;
            });
        }
    };

    const toggleSource = (sourceUrl: string) => {
        if (selectedSources.includes(sourceUrl)) {
            setSelectedSources(selectedSources.filter(s => s !== sourceUrl));
        } else {
            setSelectedSources([...selectedSources, sourceUrl]);
        }
    };

    const toggleGroupExpand = (key: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const selectAll = () => setSelectedSources(sources.map(s => s.source_url));
    const clearFilters = () => { setSelectedSources([]); };

    const removeChip = (url: string) => setSelectedSources(prev => prev.filter(u => u !== url));

    const getDisplayName = (source: any) => {
        if (source.title) return source.title;
        if (source.path) return source.path.split('/').pop() || source.path;
        try {
            const u = new URL(source.source_url);
            return u.hostname + u.pathname;
        } catch {
            const parts = source.source_url.split(/[/\\]/);
            let fname = parts[parts.length - 1];
            if (fname.length > 37 && fname[36] === '_') fname = fname.substring(37);
            return fname;
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'github': return <Github size={14} />;
            case 'pdf': return <FileText size={14} className="text-red-500" />;
            case 'website': return <Globe size={14} className="text-blue-500" />;
            case 'youtube': return <Youtube size={14} className="text-orange-500" />;
            case 'instagram': return <Instagram size={14} className="text-pink-500" />;
            default: return <FileText size={14} className="text-slate-400" />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'github': return { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700' };
            case 'pdf': return { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' };
            case 'website': return { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' };
            case 'youtube': return { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800' };
            case 'instagram': return { bg: 'bg-pink-50 dark:bg-pink-950/30', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800' };
            default: return { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700' };
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        // Add a placeholder assistant message that we'll update
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        try {
            const token = getToken();
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';
            const response = await fetch(`${apiUrl}/api/v1/chat/stream`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    query: userMessage,
                    persona: persona,
                    source_filter: selectedSources.length > 0 ? selectedSources : null,
                    web_search: webSearch
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to fetch');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = '';
            let currentSources: any[] = [];

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('metadata:')) {
                            try {
                                const meta = JSON.parse(line.substring(9));
                                currentSources = meta.sources || [];
                            } catch (e) {
                                console.error("Error parsing metadata", e);
                            }
                        } else if (line.startsWith('data:')) {
                            const token = line.substring(5);
                            assistantMessage += token;

                            // Update the last message in the list
                            setMessages(prev => {
                                const newMessages = [...prev];
                                newMessages[newMessages.length - 1] = {
                                    role: 'assistant',
                                    content: assistantMessage
                                };
                                return newMessages;
                            });
                        } else if (line.startsWith('error:')) {
                            const error = line.substring(6);
                            assistantMessage = `Error: ${error}`;
                            setMessages(prev => {
                                const newMessages = [...prev];
                                newMessages[newMessages.length - 1] = {
                                    role: 'assistant',
                                    content: assistantMessage
                                };
                                return newMessages;
                            });
                        }
                    }
                }
            }

            // Post-processing: Add sources after stream ends
            if (currentSources.length > 0) {
                const sourceUrls = currentSources.map((s: any) => {
                    if (!s) return null;
                    const meta = s.metadata || s;
                    return {
                        url: meta.source_url || meta.url || meta.title || null,
                        is_web: meta.is_web || false,
                        title: meta.title || null
                    };
                }).filter((obj: any) => obj.url != null && obj.url !== 'undefined');

                const uniqueSources = Array.from(new Set(sourceUrls.map((s: any) => s.url)))
                    .map(url => sourceUrls.find((s: any) => s.url === url))
                    .slice(0, 5);

                if (uniqueSources.length > 0) {
                    let sourcesList = "\n\n**Sources synthesized:**\n";
                    uniqueSources.forEach((src: any) => {
                        let displayUrl = src.url;
                        const icon = src.is_web ? '🌐' : '📄';

                        if (!src.is_web && (src.url.includes('data/storage') || src.url.includes('data\\storage'))) {
                            const parts = src.url.split(/[/\\]/);
                            let filename = parts[parts.length - 1];
                            if (filename.length > 37 && filename[36] === '_') filename = filename.substring(37);
                            displayUrl = filename;
                        } else if (src.is_web && src.title) {
                            displayUrl = `${src.title}`;
                        }

                        sourcesList += `- ${icon} ${displayUrl}\n`;
                    });

                    assistantMessage += sourcesList;
                    setMessages(prev => {
                        const newMessages = [...prev];
                        newMessages[newMessages.length - 1] = {
                            role: 'assistant',
                            content: assistantMessage
                        };
                        return newMessages;
                    });
                }
            }

        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}. (Did you login?)`
                };
                return newMessages;
            });
        } finally {
            setIsLoading(false);
        }
    };

    // --- Derived ---
    const filterGroups = groupSourcesForFilter();
    const filteredGroups = filterSearch.trim()
        ? filterGroups.filter(g =>
            g.label.toLowerCase().includes(filterSearch.toLowerCase()) ||
            g.sources.some(s => getDisplayName(s).toLowerCase().includes(filterSearch.toLowerCase()))
        )
        : filterGroups;

    // Organize groups by type for section rendering
    const typeOrder = ['github', 'folder', 'pdf', 'website', 'youtube', 'instagram', 'file'];
    const groupsByType = new Map<string, FilterGroup[]>();
    filteredGroups.forEach(g => {
        const key = g.type === 'single' ? g.sourceType : g.type;
        const existing = groupsByType.get(key) || [];
        existing.push(g);
        groupsByType.set(key, existing);
    });

    const typeSectionMeta: Record<string, { label: string; icon: any; color: string; gradient: string; accent: string; selectedBg: string; checkColor: string; ringColor: string; hoverBg: string }> = {
        'github': { label: 'GitHub Repos', icon: Github, color: 'text-slate-700 dark:text-slate-300', gradient: 'from-slate-100/80 via-slate-50/40 to-transparent dark:from-slate-800/60 dark:via-slate-800/20', accent: 'border-l-slate-600 dark:border-l-slate-400', selectedBg: 'bg-slate-100/80 dark:bg-slate-800/50', checkColor: 'bg-slate-600 border-slate-600', ringColor: 'ring-slate-300/60 dark:ring-slate-600/60', hoverBg: 'hover:bg-slate-100/60 dark:hover:bg-slate-800/30' },
        'folder': { label: 'Folders', icon: FolderOpen, color: 'text-amber-600 dark:text-amber-400', gradient: 'from-amber-100/80 via-amber-50/40 to-transparent dark:from-amber-900/40 dark:via-amber-900/10', accent: 'border-l-amber-500 dark:border-l-amber-400', selectedBg: 'bg-amber-100/70 dark:bg-amber-900/30', checkColor: 'bg-amber-500 border-amber-500', ringColor: 'ring-amber-300/60 dark:ring-amber-700/60', hoverBg: 'hover:bg-amber-50/60 dark:hover:bg-amber-900/20' },
        'pdf': { label: 'PDFs', icon: FileText, color: 'text-red-600 dark:text-red-400', gradient: 'from-red-100/80 via-red-50/40 to-transparent dark:from-red-900/40 dark:via-red-900/10', accent: 'border-l-red-500 dark:border-l-red-400', selectedBg: 'bg-red-100/70 dark:bg-red-900/30', checkColor: 'bg-red-500 border-red-500', ringColor: 'ring-red-300/60 dark:ring-red-700/60', hoverBg: 'hover:bg-red-50/60 dark:hover:bg-red-900/20' },
        'website': { label: 'Web Pages', icon: Globe, color: 'text-blue-600 dark:text-blue-400', gradient: 'from-blue-100/80 via-blue-50/40 to-transparent dark:from-blue-900/40 dark:via-blue-900/10', accent: 'border-l-blue-500 dark:border-l-blue-400', selectedBg: 'bg-blue-100/70 dark:bg-blue-900/30', checkColor: 'bg-blue-500 border-blue-500', ringColor: 'ring-blue-300/60 dark:ring-blue-700/60', hoverBg: 'hover:bg-blue-50/60 dark:hover:bg-blue-900/20' },
        'youtube': { label: 'YouTube', icon: Youtube, color: 'text-red-500 dark:text-orange-400', gradient: 'from-red-100/80 via-orange-50/40 to-transparent dark:from-red-900/40 dark:via-orange-900/10', accent: 'border-l-red-500 dark:border-l-orange-400', selectedBg: 'bg-red-100/70 dark:bg-red-900/30', checkColor: 'bg-red-500 border-red-500', ringColor: 'ring-red-300/60 dark:ring-red-700/60', hoverBg: 'hover:bg-red-50/60 dark:hover:bg-orange-900/20' },
        'instagram': { label: 'Social Media', icon: Instagram, color: 'text-pink-600 dark:text-pink-400', gradient: 'from-pink-100/80 via-fuchsia-50/40 to-transparent dark:from-pink-900/40 dark:via-fuchsia-900/10', accent: 'border-l-pink-500 dark:border-l-pink-400', selectedBg: 'bg-pink-100/70 dark:bg-pink-900/30', checkColor: 'bg-pink-500 border-pink-500', ringColor: 'ring-pink-300/60 dark:ring-pink-700/60', hoverBg: 'hover:bg-pink-50/60 dark:hover:bg-pink-900/20' },
        'file': { label: 'Other Files', icon: FileText, color: 'text-violet-600 dark:text-violet-400', gradient: 'from-violet-100/60 via-violet-50/30 to-transparent dark:from-violet-900/30 dark:via-violet-900/10', accent: 'border-l-violet-500 dark:border-l-violet-400', selectedBg: 'bg-violet-100/60 dark:bg-violet-900/20', checkColor: 'bg-violet-500 border-violet-500', ringColor: 'ring-violet-300/60 dark:ring-violet-700/60', hoverBg: 'hover:bg-violet-50/60 dark:hover:bg-violet-900/20' },
    };

    // Selection progress
    const selectionPct = sources.length > 0 ? Math.round((selectedSources.length / sources.length) * 100) : 0;

    // Get selected chip display info
    const selectedChips = selectedSources.slice(0, 5).map(url => {
        const src = sources.find(s => s.source_url === url);
        return { url, label: src ? getDisplayName(src) : url.split('/').pop() || url, type: src?.source_type || 'file' };
    });

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col md:ml-64 bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-violet-900 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-900 relative z-10 transition-colors duration-500">
                {/* Header */}
                <header className="flex h-16 items-center justify-between px-6 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-slate-800/50 shadow-sm z-20">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20">
                            <Bot size={20} />
                        </div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent hidden md:block">LinkPulse Chat</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Resource Filter Button */}
                        <div className="relative" ref={filterRef}>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`flex items-center gap-2 h-9 px-4 shadow-lg transition-all duration-300 ${selectedSources.length > 0
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent ring-2 ring-indigo-400/50 shadow-indigo-500/20'
                                    : 'bg-white text-slate-700 hover:bg-slate-50 border-0 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700'
                                    }`}
                            >
                                <Filter size={14} className={selectedSources.length > 0 ? "text-white" : "text-indigo-600 dark:text-indigo-400"} />
                                <span className="text-xs font-bold">
                                    {selectedSources.length > 0 ? `${selectedSources.length} Source${selectedSources.length > 1 ? 's' : ''}` : 'Filter Sources'}
                                </span>
                                {selectedSources.length > 0 && (
                                    <span className="ml-0.5 bg-white/20 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{selectedSources.length}</span>
                                )}
                            </Button>

                            {/* === FILTER PANEL === */}
                            {isFilterOpen && (
                                <div className="absolute right-0 top-12 w-[440px] bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl shadow-2xl shadow-black/30 z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200 overflow-hidden backdrop-blur-2xl" style={{ maxHeight: 'calc(100vh - 100px)' }}>

                                    {/* ─── Panel Header ─── */}
                                    <div className="px-5 pt-4 pb-3 bg-gradient-to-br from-indigo-50 via-purple-50/80 to-pink-50/60 dark:from-indigo-950/60 dark:via-purple-950/40 dark:to-pink-950/20 border-b border-indigo-100/80 dark:border-indigo-800/40">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="p-2.5 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl shadow-lg shadow-indigo-500/30">
                                                        <Filter size={15} className="text-white" />
                                                    </div>
                                                    {selectedSources.length > 0 && (
                                                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full flex items-center justify-center shadow-sm">
                                                            <span className="text-[8px] font-black text-white">{selectedSources.length > 9 ? '9+' : selectedSources.length}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-extrabold bg-gradient-to-r from-indigo-700 via-purple-600 to-pink-600 dark:from-indigo-300 dark:via-purple-300 dark:to-pink-300 bg-clip-text text-transparent">Knowledge Sources</h3>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{sources.length} sources available • Click to filter</p>
                                                </div>
                                            </div>
                                            <button onClick={() => setIsFilterOpen(false)} className="p-1.5 hover:bg-white/70 dark:hover:bg-slate-700/60 rounded-lg transition-all duration-200 hover:scale-110 active:scale-90 hover:rotate-90">
                                                <X size={16} className="text-slate-400 hover:text-red-400 transition-colors" />
                                            </button>
                                        </div>

                                        {/* Search */}
                                        <div className="relative group">
                                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400 transition-colors group-focus-within:text-purple-500" />
                                            <input
                                                type="text"
                                                value={filterSearch}
                                                onChange={(e) => setFilterSearch(e.target.value)}
                                                placeholder="Type to search sources..."
                                                className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-indigo-200/70 dark:border-indigo-800/50 bg-white/90 dark:bg-slate-800/90 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-400/50 focus:border-purple-300 dark:focus:ring-purple-500/30 transition-all duration-200 shadow-sm hover:shadow-md"
                                            />
                                            {filterSearch && (
                                                <button onClick={() => setFilterSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-red-100/60 dark:hover:bg-red-900/30 rounded-full transition-all hover:scale-110">
                                                    <X size={11} className="text-slate-400 hover:text-red-500 transition-colors" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Quick actions + animated progress */}
                                        <div className="flex items-center gap-1.5 mt-3">
                                            <button onClick={selectAll}
                                                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/40 px-2.5 py-1.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1">
                                                <Check size={10} /> All
                                            </button>
                                            {selectedSources.length > 0 && (
                                                <button onClick={clearFilters}
                                                    className="text-[10px] font-bold text-red-500 hover:bg-red-50/80 dark:hover:bg-red-900/20 px-2.5 py-1.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1">
                                                    <X size={10} /> Clear
                                                </button>
                                            )}
                                            <div className="ml-auto flex items-center gap-2">
                                                {/* Circular progress ring */}
                                                {sources.length > 0 && (
                                                    <div className="relative w-8 h-8 flex items-center justify-center">
                                                        <svg className="w-8 h-8 -rotate-90" viewBox="0 0 36 36">
                                                            <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200 dark:text-slate-700" />
                                                            <circle cx="18" cy="18" r="14" fill="none" strokeWidth="3" strokeLinecap="round" className="text-purple-500 dark:text-purple-400" style={{ strokeDasharray: `${87.96}`, strokeDashoffset: `${87.96 - (87.96 * selectionPct) / 100}`, transition: 'stroke-dashoffset 0.6s ease-out' }} />
                                                        </svg>
                                                        <span className="absolute text-[7px] font-black text-purple-600 dark:text-purple-400">{selectionPct}%</span>
                                                    </div>
                                                )}
                                                <Badge variant="secondary" className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all duration-300 ${selectedSources.length > 0 ? 'bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 border-indigo-200/80 dark:from-indigo-900/50 dark:to-purple-900/50 dark:text-indigo-300 dark:border-indigo-700/60 shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                                                    {selectedSources.length > 0 ? `${selectedSources.length} selected` : 'None'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ─── Panel Body — OUTER SCROLLER (vertical + horizontal) ─── */}
                                    <ScrollArea className="max-h-[420px]" type="always" bothAxes>
                                        <div className="p-2.5 space-y-2.5 min-w-[380px]">
                                            {sources.length === 0 ? (
                                                <div className="p-10 text-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-gradient-to-b from-slate-50 via-white to-slate-50/50 dark:from-slate-800/50 dark:via-slate-900/50 dark:to-slate-800/30">
                                                    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center shadow-inner">
                                                        <FileText size={22} className="text-slate-300 dark:text-slate-600" />
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-500">No sources ingested yet</p>
                                                    <p className="text-[10px] text-slate-400 mt-1">Head to the Dashboard to add your first document</p>
                                                </div>
                                            ) : (
                                                typeOrder.filter(t => groupsByType.has(t)).map(typeKey => {
                                                    const groups = groupsByType.get(typeKey)!;
                                                    const meta = typeSectionMeta[typeKey] || typeSectionMeta['file'];
                                                    const SectionIcon = meta.icon;
                                                    const sectionTotal = groups.reduce((n, g) => n + g.sources.length, 0);
                                                    const sectionSelected = groups.reduce((n, g) => n + g.sources.filter(s => selectedSources.includes(s.source_url)).length, 0);
                                                    const allSectionUrls = groups.flatMap(g => g.sources.map(s => s.source_url));
                                                    const isSectionAllSelected = allSectionUrls.every(u => selectedSources.includes(u));

                                                    return (
                                                        <div key={typeKey} className={`rounded-xl border overflow-hidden bg-gradient-to-br ${meta.gradient} transition-all duration-300 hover:shadow-md ${sectionSelected > 0 ? `border-l-[3px] ${meta.accent} border-r border-t border-b border-slate-200/50 dark:border-slate-700/40` : 'border-slate-200/70 dark:border-slate-700/50'}`}>
                                                            {/* Section Header — clickable to toggle all */}
                                                            <div
                                                                className={`flex items-center gap-2.5 px-3 py-3 cursor-pointer transition-all duration-200 hover:brightness-95 dark:hover:brightness-110`}
                                                                onClick={() => {
                                                                    if (isSectionAllSelected) {
                                                                        setSelectedSources(prev => prev.filter(u => !allSectionUrls.includes(u)));
                                                                    } else {
                                                                        setSelectedSources(prev => Array.from(new Set([...prev, ...allSectionUrls])));
                                                                    }
                                                                }}
                                                            >
                                                                {/* Section checkbox */}
                                                                <div className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${isSectionAllSelected
                                                                    ? `${meta.checkColor} shadow-sm`
                                                                    : sectionSelected > 0
                                                                        ? 'bg-amber-500 border-amber-500'
                                                                        : 'border-slate-300 dark:border-slate-600'
                                                                    }`}>
                                                                    {isSectionAllSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                                                                    {!isSectionAllSelected && sectionSelected > 0 && <Minus size={10} className="text-white" strokeWidth={3} />}
                                                                </div>

                                                                <div className={`p-1.5 rounded-lg ${meta.selectedBg} ring-1 ${meta.ringColor} shadow-sm`}>
                                                                    <SectionIcon size={14} className={meta.color} />
                                                                </div>
                                                                <span className={`text-[11px] font-extrabold tracking-wide ${meta.color}`}>{meta.label}</span>
                                                                <div className="ml-auto flex items-center gap-1.5">
                                                                    {sectionSelected > 0 && (
                                                                        <span className={`text-[9px] font-bold ${meta.color} ${meta.selectedBg} px-2 py-0.5 rounded-full ring-1 ${meta.ringColor} shadow-sm`}>
                                                                            ✓ {sectionSelected}/{sectionTotal}
                                                                        </span>
                                                                    )}
                                                                    {sectionSelected === 0 && (
                                                                        <Badge variant="secondary" className={`text-[9px] h-[18px] px-2 font-bold rounded-full ${meta.selectedBg} ${meta.color} ring-1 ${meta.ringColor}`}>
                                                                            {sectionTotal}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Groups/Items — INNER SCROLLER per section (vertical + horizontal) */}
                                                            <ScrollArea
                                                                className="max-h-[220px] pr-1"
                                                                type="always"
                                                                bothAxes
                                                            >
                                                                <div className="px-1.5 pb-2.5 space-y-0.5 min-w-[340px]">
                                                                    {groups.map(group => {
                                                                        const isMulti = group.sources.length > 1 || group.type === 'website';
                                                                        const selState = getGroupSelectionState(group);
                                                                        const isExpanded = expandedGroups.has(group.key);

                                                                        return (
                                                                            <div key={group.key} className="rounded-lg overflow-hidden">
                                                                                {/* Group/Item Row */}
                                                                                <div
                                                                                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 group/row ${selState !== 'none'
                                                                                        ? `${meta.selectedBg} ring-1 ${meta.ringColor} shadow-sm`
                                                                                        : `${meta.hoverBg}`
                                                                                        }`}
                                                                                    onClick={() => toggleFilterGroup(group)}
                                                                                >
                                                                                    {/* Animated Checkbox — type-colored */}
                                                                                    <div className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-200 group-hover/row:scale-110 ${selState === 'all'
                                                                                        ? `${meta.checkColor} shadow-sm`
                                                                                        : selState === 'partial'
                                                                                            ? 'bg-amber-500 border-amber-500 shadow-sm'
                                                                                            : 'border-slate-300 dark:border-slate-600 group-hover/row:border-indigo-400'
                                                                                        }`}>
                                                                                        {selState === 'all' && <Check size={10} className="text-white" strokeWidth={3} />}
                                                                                        {selState === 'partial' && <Minus size={10} className="text-white" strokeWidth={3} />}
                                                                                    </div>

                                                                                    {/* Icon */}
                                                                                    <div className={`p-1.5 rounded-lg ${meta.selectedBg} transition-transform duration-150 group-hover/row:scale-110`}>
                                                                                        {isMulti && group.type === 'github' ? <Github size={13} className="text-slate-600 dark:text-slate-300" /> :
                                                                                            isMulti && group.type === 'folder' ? <FolderOpen size={13} className="text-amber-500" /> :
                                                                                                isMulti && group.type === 'website' ? <Globe size={13} className="text-blue-500" /> :
                                                                                                    getTypeIcon(group.sourceType)}
                                                                                    </div>

                                                                                    {/* Label */}
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <p className={`text-[12px] font-semibold truncate transition-colors ${selState !== 'none' ? meta.color : 'text-slate-700 dark:text-slate-200'}`} title={group.label}>
                                                                                            {isMulti ? group.label : getDisplayName(group.sources[0])}
                                                                                        </p>
                                                                                        {isMulti && (
                                                                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                                                                                {group.sources.length} {group.type === 'website' ? 'pages' : 'files'}
                                                                                                {selState === 'partial' && <span className={`${meta.color} font-semibold`}> • {group.sources.filter(s => selectedSources.includes(s.source_url)).length} selected</span>}
                                                                                            </p>
                                                                                        )}
                                                                                    </div>

                                                                                    {/* Expand button */}
                                                                                    {isMulti && (
                                                                                        <button
                                                                                            onClick={(e) => { e.stopPropagation(); toggleGroupExpand(group.key); }}
                                                                                            className={`p-1.5 rounded-lg transition-all duration-200 hover:scale-110 active:scale-95 shrink-0 ${meta.hoverBg}`}
                                                                                            title={isExpanded ? 'Collapse' : 'Expand to select individual items'}
                                                                                        >
                                                                                            <ChevronDown size={14} className={`${meta.color} transition-transform duration-300 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                                                                        </button>
                                                                                    )}
                                                                                </div>

                                                                                {/* Expanded file list — INNER SCROLLER for items */}
                                                                                {isMulti && isExpanded && (
                                                                                    <div className={`mx-2 mb-1.5 rounded-lg border overflow-hidden ${meta.selectedBg} border-slate-200/40 dark:border-slate-700/40 shadow-inner`}>
                                                                                        <div
                                                                                            className="overflow-y-auto overflow-x-auto overscroll-contain pr-1 custom-inner-scrollbar"
                                                                                            style={{ maxHeight: '180px' }}
                                                                                        >
                                                                                            <div className="divide-y divide-slate-200/40 dark:divide-slate-700/30 min-w-[300px]">
                                                                                                {group.sources.map(source => {
                                                                                                    const isSelected = selectedSources.includes(source.source_url);
                                                                                                    const itemIcon = source.source_type === 'github' ? <Github size={11} className="text-slate-500 shrink-0" /> :
                                                                                                        source.source_type === 'website' ? <Globe size={11} className="text-blue-500 shrink-0" /> :
                                                                                                            source.source_type === 'youtube' ? <Youtube size={11} className="text-red-500 shrink-0" /> :
                                                                                                                source.source_type === 'pdf' ? <FileText size={11} className="text-red-500 shrink-0" /> :
                                                                                                                    <FileText size={11} className="text-violet-400 shrink-0" />;
                                                                                                    const itemName = source.source_type === 'website'
                                                                                                        ? (source.title || (() => { try { return new URL(source.source_url).pathname.split('/').filter(Boolean).join(' / ') || 'Home'; } catch { return source.source_url; } })())
                                                                                                        : getDisplayName(source);
                                                                                                    return (
                                                                                                        <div
                                                                                                            key={source.source_url}
                                                                                                            onClick={() => toggleSource(source.source_url)}
                                                                                                            className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-all duration-150 text-[11px] group/item ${isSelected
                                                                                                                ? `${meta.selectedBg} ${meta.color} font-medium shadow-sm`
                                                                                                                : `${meta.hoverBg} text-slate-600 dark:text-slate-400`
                                                                                                                }`}
                                                                                                            title={source.source_url}
                                                                                                        >
                                                                                                            <div className={`w-4 h-4 rounded-[4px] border-[1.5px] flex items-center justify-center shrink-0 transition-all duration-200 group-hover/item:scale-110 ${isSelected
                                                                                                                ? `${meta.checkColor} shadow-sm`
                                                                                                                : 'border-slate-300 dark:border-slate-600 group-hover/item:border-indigo-400'
                                                                                                                }`}>
                                                                                                                {isSelected && <Check size={9} className="text-white" strokeWidth={3} />}
                                                                                                            </div>
                                                                                                            {itemIcon}
                                                                                                            <span className="truncate font-medium">{itemName}</span>
                                                                                                            {isSelected && <div className={`ml-auto w-1.5 h-1.5 rounded-full ${meta.checkColor} animate-pulse`} />}
                                                                                                        </div>
                                                                                                    );
                                                                                                })}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </ScrollArea>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </ScrollArea>

                                    {/* ─── Panel Footer ─── */}
                                    {selectedSources.length > 0 ? (
                                        <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-pink-950/20 border-t border-indigo-100/80 dark:border-indigo-800/40">
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-1.5 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/60 dark:to-purple-900/60 rounded-lg shadow-sm">
                                                    <Sparkles size={13} className="text-indigo-600 dark:text-indigo-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-bold bg-gradient-to-r from-indigo-700 to-purple-600 dark:from-indigo-300 dark:to-purple-300 bg-clip-text text-transparent">
                                                        {selectedSources.length} source{selectedSources.length > 1 ? 's' : ''} active
                                                    </p>
                                                    <p className="text-[9px] text-indigo-500/70 dark:text-indigo-400/50">
                                                        AI answers grounded to selected sources
                                                    </p>
                                                </div>
                                                <button onClick={clearFilters} className="text-[10px] font-bold text-red-500 hover:bg-red-100/80 dark:hover:bg-red-900/30 px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-1">
                                                    <RefreshCw size={10} /> Reset
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50/80 to-slate-100/60 dark:from-slate-800/40 dark:to-slate-800/20 border-t border-slate-200/50 dark:border-slate-700/30">
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center font-medium italic">
                                                ✨ No filter active — chat uses all sources
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Web Search Toggle */}
                        <div
                            onClick={() => setWebSearch(!webSearch)}
                            className={`flex items-center gap-2 p-1 pl-2 pr-3 rounded-lg cursor-pointer transition-all duration-300 shadow-lg ring-1 ${webSearch
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white ring-blue-400 shadow-blue-500/20'
                                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 ring-slate-200 dark:ring-slate-700'
                                }`}
                        >
                            <Globe size={14} className={webSearch ? "text-white animate-pulse" : "text-slate-400"} />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Web Search</span>
                            <div className={`w-6 h-3.5 rounded-full relative transition-colors duration-300 ${webSearch ? 'bg-blue-400' : 'bg-slate-200 dark:bg-slate-700'}`}>
                                <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all duration-300 ${webSearch ? 'left-3' : 'left-0.5'}`}></div>
                            </div>
                        </div>

                        {/* Persona */}
                        <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 p-1 pl-2 rounded-lg shadow-lg shadow-orange-500/20 ring-1 ring-orange-400">
                            <Sparkles className="h-3.5 w-3.5 text-white hidden sm:block" />
                            <Select value={persona} onValueChange={setPersona}>
                                <SelectTrigger className="w-[130px] h-7 text-xs font-bold border-0 bg-transparent focus:ring-0 text-white placeholder:text-orange-100">
                                    <SelectValue placeholder="Persona" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-slate-900 border-orange-200 dark:border-orange-900/50 font-medium shadow-xl">
                                    <SelectItem value="professional" className="focus:bg-orange-50 dark:focus:bg-orange-900/20 focus:text-orange-700 dark:focus:text-orange-300">Professional</SelectItem>
                                    <SelectItem value="eli5" className="focus:bg-orange-50 dark:focus:bg-orange-900/20 focus:text-orange-700 dark:focus:text-orange-300">ELI5 (Simple)</SelectItem>
                                    <SelectItem value="developer" className="focus:bg-orange-50 dark:focus:bg-orange-900/20 focus:text-orange-700 dark:focus:text-orange-300">Developer</SelectItem>
                                    <SelectItem value="academic" className="focus:bg-orange-50 dark:focus:bg-orange-900/20 focus:text-orange-700 dark:focus:text-orange-300">Academic</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </header>

                {/* Active filter chips bar */}
                {
                    selectedSources.length > 0 && (
                        <div className="flex items-center gap-2 px-6 py-2 bg-indigo-600/10 dark:bg-indigo-500/5 backdrop-blur-sm border-b border-indigo-200/30 dark:border-indigo-800/30 animate-in fade-in slide-in-from-top-2 duration-200">
                            <Filter size={12} className="text-indigo-500 shrink-0" />
                            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">Chatting with:</span>
                            <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
                                {selectedChips.map(chip => (
                                    <span key={chip.url} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold whitespace-nowrap border border-indigo-200 dark:border-indigo-800">
                                        {getTypeIcon(chip.type)}
                                        <span className="max-w-[100px] truncate">{chip.label}</span>
                                        <button onClick={() => removeChip(chip.url)} className="hover:bg-indigo-200 dark:hover:bg-indigo-800 p-0.5 rounded transition-colors">
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                                {selectedSources.length > 5 && (
                                    <span className="text-[10px] text-indigo-500 font-bold whitespace-nowrap">+{selectedSources.length - 5} more</span>
                                )}
                            </div>
                            <button onClick={clearFilters} className="text-[10px] font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded-md transition-colors shrink-0">
                                Clear
                            </button>
                        </div>
                    )
                }

                {/* Chat Area */}
                <ScrollArea className="flex-1">
                    <div className="p-4 md:p-6">
                        <div className="mx-auto max-w-4xl space-y-6">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
                                    <div className="relative">
                                        <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-xl opacity-20 animate-pulse"></div>
                                        <div className="relative h-24 w-24 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 ring-1 ring-white/20">
                                            <Bot size={48} className="text-white" />
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 bg-green-500 h-6 w-6 rounded-full border-4 border-slate-900"></div>
                                    </div>

                                    <div className="space-y-2 max-w-md">
                                        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-blue-100 to-indigo-200">
                                            Hello, Explorer
                                        </h2>
                                        <p className="text-slate-400 text-sm">
                                            {selectedSources.length > 0
                                                ? `Chatting with ${selectedSources.length} selected source${selectedSources.length > 1 ? 's' : ''}. Ask me anything about them.`
                                                : 'I\'m ready to analyze your documents. Use the Filter button to select specific sources, or ask a question to search all.'}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                                        {[
                                            { icon: Sparkles, text: "Summarize the latest document", color: "from-pink-500 to-rose-500" },
                                            { icon: Zap, text: "Extract key insights", color: "from-amber-400 to-orange-500" },
                                            { icon: Lightbulb, text: "Explain complex concepts", color: "from-cyan-400 to-blue-500" },
                                            { icon: Calculator, text: "Analyze data points", color: "from-emerald-400 to-green-500" }
                                        ].map((item, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setInput(item.text)}
                                                className="group relative p-4 rounded-xl bg-white/5 dark:bg-white/5 border border-white/10 hover:border-white/20 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-500/10 text-left"
                                            >
                                                <div className={`absolute inset-0 bg-gradient-to-r ${item.color} opacity-0 group-hover:opacity-5 rounded-xl transition-opacity`} />
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg bg-gradient-to-br ${item.color} bg-opacity-10 text-white shadow-sm`}>
                                                        <item.icon size={16} />
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">{item.text}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {messages.map((message, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-start gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                                        >
                                            <div
                                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg ring-1 ring-white/10 ${message.role === 'user'
                                                    ? 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-indigo-500/20'
                                                    : 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-emerald-500/20'
                                                    }`}
                                            >
                                                {message.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                                            </div>
                                            <div
                                                className={`max-w-[85%] rounded-2xl px-6 py-4 shadow-xl backdrop-blur-md ${message.role === 'user'
                                                    ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-tr-none border border-white/10'
                                                    : 'bg-white/90 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-tl-none border border-white/20 dark:border-white/5 shadow-2xl ring-1 ring-black/5'
                                                    }`}
                                            >
                                                <div className="prose dark:prose-invert max-w-none prose-sm prose-p:text-inherit prose-pre:bg-black/20 prose-pre:text-white prose-code:bg-black/20 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-a:text-blue-400 prose-a:underline hover:prose-a:text-blue-300 transition-colors">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />
                                                        }}
                                                    >
                                                        {message.content}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 ring-1 ring-white/10">
                                                <Bot size={20} />
                                            </div>
                                            <div className="flex flex-col gap-2 rounded-2xl bg-white/10 backdrop-blur-md px-6 py-4 border border-white/10 shadow-xl">
                                                <div className="flex items-center gap-1">
                                                    <div className="h-2 w-2 animate-bounce rounded-full bg-blue-400 [animation-delay:-0.3s]"></div>
                                                    <div className="h-2 w-2 animate-bounce rounded-full bg-purple-400 [animation-delay:-0.15s]"></div>
                                                    <div className="h-2 w-2 animate-bounce rounded-full bg-pink-400"></div>
                                                </div>
                                                {webSearch && (
                                                    <p className="text-[10px] font-bold text-blue-300 animate-pulse tracking-wide uppercase italic">
                                                        Researching live web...
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="p-6 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent backdrop-blur-none">
                    <div className="mx-auto max-w-3xl">
                        <form onSubmit={handleSubmit} className="relative flex items-center group">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={selectedSources.length > 0 ? `Ask about ${selectedSources.length} selected source${selectedSources.length > 1 ? 's' : ''}...` : "Ask anything about your documents..."}
                                className="w-full rounded-2xl border border-white/10 bg-white/10 py-4 pl-6 pr-14 text-sm shadow-2xl transition-all focus:border-indigo-500/50 focus:bg-white/20 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 text-white placeholder:text-slate-400 backdrop-blur-xl"
                            />
                            <button
                                type="submit"
                                disabled={isLoading || !input.trim()}
                                className="absolute right-3 rounded-xl p-2 bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:from-indigo-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-indigo-500/40 hover:scale-105 active:scale-95"
                            >
                                <ArrowRight size={18} />
                            </button>
                        </form>
                        <p className="mt-3 text-center text-[10px] text-slate-400 opacity-60 font-medium">
                            AI can make mistakes. Consider checking important information.
                        </p>
                    </div>
                </div>
            </div >
        </div >
    );
}
