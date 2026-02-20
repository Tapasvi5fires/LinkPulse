'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MultiFileUpload } from '@/components/ui/MultiFileUpload';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, File, Github, Youtube, Globe, Instagram, Loader2, Plus, RefreshCw, FileQuestion, Sparkles, Trash2, ExternalLink, Download, Copy, Check, Search, Filter, ChevronDown, ChevronRight, Folder, FolderOpen, CheckSquare, Square, X, ArrowUpDown, Minus, Hash, Code2, FileCode, FileImage, Database, LayoutGrid } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge"
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useRouter } from 'next/navigation';
import { FloatingSelectionBar } from '@/components/FloatingSelectionBar';
import { ChevronRight as ChevronRightIcon } from 'lucide-react';

interface DataSource {
    id: string;
    source_url: string;
    source_type: string;
    title: string;
    ingested_at: string;
    metadata?: any;
    download_url?: string;
    group?: string | null;
    repo?: string | null;
    path?: string | null;
    folder_name?: string | null;
}

interface SourceGroup {
    key: string;
    type: 'github' | 'folder' | 'website' | 'single';
    label: string;
    sources: DataSource[];
    sourceType: string;
    latestDate: string;
}

export default function DashboardPage() {
    const [sources, setSources] = useState<DataSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [authChecking, setAuthChecking] = useState(true);
    const [ingestOpen, setIngestOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("pdf");
    const [urlInput, setUrlInput] = useState("");
    const [multiUrlInput, setMultiUrlInput] = useState("");
    const [depthInput, setDepthInput] = useState("0");
    const [processing, setProcessing] = useState(false);
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [summaryContent, setSummaryContent] = useState("");
    const [summarizing, setSummarizing] = useState(false);
    const router = useRouter();

    const [contentOpen, setContentOpen] = useState(false);
    const [contentData, setContentData] = useState("");
    const [loadingContent, setLoadingContent] = useState(false);
    const [viewingSource, setViewingSource] = useState<{ type: string, url: string, downloadUrl?: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [groupSearchQuery, setGroupSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [peekHoveredGroup, setPeekHoveredGroup] = useState<string | null>(null);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
    const [folderInput, setFolderInput] = useState("");
    const [sortBy, setSortBy] = useState<'date' | 'name' | 'type' | 'files'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('linkpulse_sort') as any) || 'date';
        }
        return 'date';
    });
    const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
    const [activeTasks, setActiveTasks] = useState<any[]>([]);

    const fetchTasks = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await fetch('http://localhost:8090/api/v1/ingestion/tasks', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setActiveTasks(data);

                // If any task is complete, refresh sources
                const hasFinished = data.some((t: any) => t.status === 'completed');
                if (hasFinished) fetchSources();
            }
        } catch (error) {
            console.error("Failed to fetch tasks:", error);
        }
    };

    const fetchSources = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        setLoading(true);
        try {
            const response = await fetch('http://localhost:8090/api/v1/ingestion/sources', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setSources(data);
            }
        } catch (error) {
            console.error("Failed to fetch sources:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.replace('/login');
        } else {
            setAuthChecking(false);
            fetchSources();
            fetchTasks();
        }

        // Poll for tasks every 3 seconds
        const taskInterval = setInterval(fetchTasks, 3000);

        // Refresh sources every 10 seconds just in case
        const sourcesInterval = setInterval(fetchSources, 10000);

        return () => {
            clearInterval(taskInterval);
            clearInterval(sourcesInterval);
        };
    }, [router]);

    // Persist sort preference
    useEffect(() => {
        localStorage.setItem('linkpulse_sort', sortBy);
    }, [sortBy]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectMode) return;
            // Ctrl+A / Cmd+A to select all
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                setSelectedUrls(new Set(sources.map(s => s.source_url)));
            }
            // Escape to exit select mode
            if (e.key === 'Escape') {
                setSelectMode(false);
                setSelectedUrls(new Set());
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectMode, sources]);

    const handleUrlIngest = async (type: string) => {
        setProcessing(true);
        const token = localStorage.getItem('token');

        try {
            const endpoint = 'http://localhost:8090/api/v1/ingestion/url';
            const body = { source_url: urlInput, source_type: type, depth: parseInt(depthInput) };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                setIngestOpen(false);
                setUrlInput("");
                fetchSources();
            } else {
                alert("Ingestion failed");
            }
        } catch (e) {
            console.error(e);
            alert("Error submitting URL");
        } finally {
            setProcessing(false);
        }
    };

    const handleMultiUrlIngest = async () => {
        const urls = multiUrlInput
            .split('\n')
            .map(u => u.trim())
            .filter(u => u.length > 0 && (u.startsWith('http://') || u.startsWith('https://')));

        if (urls.length === 0) return;
        setProcessing(true);
        const token = localStorage.getItem('token');

        let successCount = 0;
        try {
            for (const url of urls) {
                const response = await fetch('http://localhost:8090/api/v1/ingestion/url', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ source_url: url, source_type: 'website', depth: parseInt(depthInput) })
                });
                if (response.ok) successCount++;
            }

            setIngestOpen(false);
            setMultiUrlInput("");
            setUrlInput("");
            fetchSources();
        } catch (e) {
            console.error(e);
            alert(`Ingested ${successCount}/${urls.length} URLs. Some failed.`);
        } finally {
            setProcessing(false);
        }
    };

    const handleSummarize = async (sourceUrl: string) => {
        setSummarizing(true);
        setSummaryContent(""); // Clear previous
        setSummaryOpen(true);

        try {
            const token = localStorage.getItem('token');
            // Ensure trailing slash to avoid 307 redirect which might strip headers
            const response = await fetch('http://localhost:8090/api/v1/summary/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ source_url: sourceUrl })
            });

            if (response.ok) {
                const data = await response.json();
                setSummaryContent(data.summary);
            } else {
                setSummaryContent("Failed to generate summary. Ensure the source content is accessible or try again.");
            }
        } catch (e) {
            console.error(e);
            setSummaryContent("Error generating summary.");
        } finally {
            setSummarizing(false);
        }
    };



    const handleViewContent = async (source: DataSource) => {
        setLoadingContent(true);
        setContentData("");
        setContentOpen(true);
        setViewingSource({
            type: source.source_type,
            url: source.source_url,
            downloadUrl: source.download_url
        });

        // For PDFs with download URLs, skip text extraction — show inline
        if (source.source_type === 'pdf' && source.download_url) {
            setLoadingContent(false);
            return;
        }

        // For YouTube, just show the embed — don't fetch text
        if (source.source_type === 'youtube') {
            setLoadingContent(false);
            return;
        }

        // For websites, skip text extraction — show iframe or link
        if (source.source_type === 'website') {
            setLoadingContent(false);
            return;
        }

        // For other types, fetch extracted text
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8090/api/v1/ingestion/content', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ source_url: source.source_url })
            });

            if (response.ok) {
                const data = await response.json();
                setContentData(data.content || "No content found.");
            } else {
                setContentData("Failed to load content.");
            }
        } catch (e) {
            console.error(e);
            setContentData("Error loading content.");
        } finally {
            setLoadingContent(false);
        }
    };

    const handleDeleteSource = async (sourceUrl: string) => {
        if (!confirm("Are you sure you want to delete this source? This action cannot be undone.")) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8090/api/v1/ingestion/sources', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ source_url: sourceUrl })
            });

            if (response.ok) {
                // Remove from state immediately for better UI
                setSources(sources.filter(s => s.source_url !== sourceUrl));
            } else {
                alert("Failed to delete source.");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting source.");
        }
    };

    const getIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case 'pdf': return <FileText className="h-5 w-5 text-red-500" />;
            case 'github': return <Github className="h-5 w-5 text-gray-900 dark:text-gray-100" />;
            case 'youtube': return <Youtube className="h-5 w-5 text-red-600" />;
            case 'instagram': return <Instagram className="h-5 w-5 text-pink-600" />;
            case 'website': return <Globe className="h-5 w-5 text-blue-500" />;
            case 'folder': return <Folder className="h-5 w-5 text-amber-500" />;
            default: return <FileQuestion className="h-5 w-5 text-gray-400" />;
        }
    };

    // Group sources by their group field
    const groupSources = (sources: DataSource[]): SourceGroup[] => {
        const groupMap = new Map<string, DataSource[]>();
        const ungrouped: DataSource[] = [];

        for (const source of sources) {
            if (source.group) {
                const existing = groupMap.get(source.group) || [];
                existing.push(source);
                groupMap.set(source.group, existing);
            } else {
                ungrouped.push(source);
            }
        }

        const groups: SourceGroup[] = [];

        // Create grouped entries
        groupMap.forEach((items, key) => {
            const isGithub = key.startsWith('github:');
            const isFolder = key.startsWith('folder:');
            const isWebsite = key.startsWith('website:');
            const label = key.replace(/^(github:|folder:|website:)/, '');
            const latestDate = items.reduce((latest, s) => {
                const d = s.ingested_at;
                return d > latest ? d : latest;
            }, items[0]?.ingested_at || '');

            groups.push({
                key,
                type: isGithub ? 'github' : isFolder ? 'folder' : isWebsite ? 'website' : 'single',
                label,
                sources: items.sort((a, b) => (a.path || a.source_url).localeCompare(b.path || b.source_url)),
                sourceType: items[0]?.source_type || 'unknown',
                latestDate,
            });
        });

        // Create single entries for ungrouped
        for (const source of ungrouped) {
            groups.push({
                key: source.source_url,
                type: 'single',
                label: source.title || source.source_url,
                sources: [source],
                sourceType: source.source_type,
                latestDate: source.ingested_at,
            });
        }

        // Sort by date desc
        groups.sort((a, b) => (b.latestDate || '').localeCompare(a.latestDate || ''));
        return groups;
    };

    const toggleGroupExpand = (key: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleSelect = (url: string) => {
        setSelectedUrls(prev => {
            const next = new Set(prev);
            if (next.has(url)) next.delete(url);
            else next.add(url);
            return next;
        });
    };

    const toggleSelectGroup = (group: SourceGroup) => {
        const urls = group.sources.map(s => s.source_url);
        setSelectedUrls(prev => {
            const next = new Set(prev);
            const allSelected = urls.every(u => next.has(u));
            if (allSelected) {
                urls.forEach(u => next.delete(u));
            } else {
                urls.forEach(u => next.add(u));
            }
            return next;
        });
    };

    const isRecent = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
        return diffInMinutes < 5;
    };

    const Breadcrumbs = ({ path, type, repo }: { path: string, type: string, repo?: string }) => {
        if (!path && !repo) return null;

        const parts = path ? path.split('/').filter(Boolean) : [];
        const repoParts = repo ? repo.split('/').filter(Boolean) : [];

        return (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar">
                <div className="flex items-center gap-1.5 shrink-0">
                    {type === 'github' ? <Github size={12} className="text-slate-400" /> : <Folder size={12} className="text-slate-400" />}
                    {repoParts.length > 0 && (
                        <>
                            <span className="text-[11px] font-bold text-slate-500 hover:text-indigo-500 cursor-pointer transition-colors max-w-[120px] truncate">{repoParts[0]}</span>
                            <ChevronRightIcon size={10} className="text-slate-300" />
                            <span className="text-[11px] font-bold text-slate-500 hover:text-indigo-500 cursor-pointer transition-colors max-w-[120px] truncate">{repoParts[1]}</span>
                        </>
                    )}
                </div>
                {parts.length > 0 && <ChevronRightIcon size={10} className="text-slate-300 shrink-0" />}
                {parts.map((part, i) => (
                    <React.Fragment key={i}>
                        <span className={`text-[11px] font-medium max-w-[150px] truncate ${i === parts.length - 1 ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 hover:text-indigo-400 cursor-pointer transition-colors'}`}>
                            {part}
                        </span>
                        {i < parts.length - 1 && <ChevronRightIcon size={10} className="text-slate-300 shrink-0" />}
                    </React.Fragment>
                ))}
            </div>
        );
    };

    const handleBulkDelete = async () => {
        if (selectedUrls.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedUrls.size} source(s)? This action cannot be undone.`)) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:8090/api/v1/ingestion/sources/bulk-delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ source_urls: Array.from(selectedUrls) })
            });

            if (response.ok) {
                setSources(sources.filter(s => !selectedUrls.has(s.source_url)));
                setSelectedUrls(new Set());
                setSelectMode(false);
            } else {
                alert("Failed to delete selected sources.");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting sources.");
        }
    };

    const handleDeleteGroup = async (group: SourceGroup) => {
        const groupLabel = group.type === 'github' ? 'repository' : group.type === 'folder' ? 'folder' : group.type === 'website' ? 'website' : 'group';
        if (!confirm(`Delete entire ${groupLabel} "${group.label}" (${group.sources.length} ${group.type === 'website' ? 'pages' : 'files'})? This cannot be undone.`)) return;

        try {
            const token = localStorage.getItem('token');
            const urls = group.sources.map(s => s.source_url);
            const response = await fetch('http://localhost:8090/api/v1/ingestion/sources/bulk-delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ source_urls: urls })
            });

            if (response.ok) {
                setSources(sources.filter(s => !urls.includes(s.source_url)));
            } else {
                alert("Failed to delete group.");
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting group.");
        }
    };

    const getDisplayName = (source: DataSource) => {
        let displayName = source.title || "Untitled";
        if (source.path) {
            displayName = source.path;
        } else if (source.source_url && source.source_url.includes("data/storage")) {
            const parts = source.source_url.split(/[/\\]/);
            let filename = parts[parts.length - 1];
            if (filename.length > 37 && filename[36] === '_') {
                displayName = filename.substring(37);
            } else {
                displayName = filename;
            }
        }
        return displayName;
    };

    // File extension color-coding
    const getFileExtInfo = (filename: string) => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const extMap: Record<string, { color: string; bg: string }> = {
            'py': { color: '#3572A5', bg: 'bg-blue-100 dark:bg-blue-900/30' },
            'js': { color: '#f7df1e', bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
            'ts': { color: '#3178c6', bg: 'bg-blue-100 dark:bg-blue-900/30' },
            'tsx': { color: '#3178c6', bg: 'bg-blue-100 dark:bg-blue-900/30' },
            'jsx': { color: '#61dafb', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
            'css': { color: '#563d7c', bg: 'bg-purple-100 dark:bg-purple-900/30' },
            'html': { color: '#e34c26', bg: 'bg-orange-100 dark:bg-orange-900/30' },
            'json': { color: '#292929', bg: 'bg-slate-100 dark:bg-slate-700/30' },
            'md': { color: '#083fa1', bg: 'bg-blue-100 dark:bg-blue-900/30' },
            'sql': { color: '#e38c00', bg: 'bg-amber-100 dark:bg-amber-900/30' },
            'java': { color: '#b07219', bg: 'bg-orange-100 dark:bg-orange-900/30' },
            'go': { color: '#00ADD8', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
            'rs': { color: '#dea584', bg: 'bg-orange-100 dark:bg-orange-900/30' },
            'rb': { color: '#701516', bg: 'bg-red-100 dark:bg-red-900/30' },
            'php': { color: '#4F5D95', bg: 'bg-indigo-100 dark:bg-indigo-900/30' },
            'yml': { color: '#cb171e', bg: 'bg-red-100 dark:bg-red-900/30' },
            'yaml': { color: '#cb171e', bg: 'bg-red-100 dark:bg-red-900/30' },
            'toml': { color: '#9c4221', bg: 'bg-orange-100 dark:bg-orange-900/30' },
            'pdf': { color: '#e5252a', bg: 'bg-red-100 dark:bg-red-900/30' },
            'txt': { color: '#6b7280', bg: 'bg-slate-100 dark:bg-slate-700/30' },
            'docx': { color: '#2b579a', bg: 'bg-blue-100 dark:bg-blue-900/30' },
            'pptx': { color: '#d24726', bg: 'bg-orange-100 dark:bg-orange-900/30' },
        };
        return extMap[ext] || { color: '#6b7280', bg: 'bg-slate-100 dark:bg-slate-700/30' };
    };

    // Get selection state for a group: 'none' | 'partial' | 'all'
    const getGroupSelectionState = (group: SourceGroup): 'none' | 'partial' | 'all' => {
        const selected = group.sources.filter(s => selectedUrls.has(s.source_url)).length;
        if (selected === 0) return 'none';
        if (selected === group.sources.length) return 'all';
        return 'partial';
    };

    // Sort groups
    const sortGroups = (groups: SourceGroup[]): SourceGroup[] => {
        return [...groups].sort((a, b) => {
            switch (sortBy) {
                case 'name': return a.label.localeCompare(b.label);
                case 'type': return a.sourceType.localeCompare(b.sourceType);
                case 'files': return b.sources.length - a.sources.length;
                case 'date': default: return (b.latestDate || '').localeCompare(a.latestDate || '');
            }
        });
    };

    if (authChecking) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
                    <p className="text-slate-400 font-bold animate-pulse">Initializing Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden">
            <Sidebar />
            <main className="flex-1 md:ml-64 relative z-10 transition-colors duration-500 bg-[conic-gradient(at_bottom_left,_var(--tw-gradient-stops))] from-slate-100 via-rose-100 to-teal-100 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900 h-screen flex flex-col overflow-hidden">

                {/* Sticky Header Section */}
                <div className="sticky top-0 z-30 px-6 md:px-10 pt-6 md:pt-10 pb-4 space-y-6 bg-transparent backdrop-blur-md border-b border-slate-200/20 dark:border-slate-800/20 shadow-sm shrink-0">
                    {/* Active Ingestions */}
                    {activeTasks.length > 0 && (
                        <div className="animate-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center justify-between mb-3 px-2">
                                <h2 className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                                    <div className="flex gap-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="h-1.5 w-1.5 rounded-full bg-indigo-300 animate-bounce"></div>
                                    </div>
                                    Active Ingestions ({activeTasks.length})
                                </h2>
                            </div>
                            <ScrollArea className="max-h-[200px] pr-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-2">
                                    {activeTasks.map((task: any) => (
                                        <div key={task.task_id} className="relative group overflow-hidden rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-indigo-200/50 dark:border-indigo-800/50 p-4 shadow-lg shadow-indigo-500/5">
                                            <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                                <div className="h-full bg-indigo-500 animate-loading-bar" />
                                            </div>
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                                                        {task.source_type === 'youtube' ? <Youtube className="h-5 w-5 text-red-500" /> :
                                                            task.source_type === 'github' ? <Github className="h-5 w-5" /> :
                                                                task.source_type === 'website' ? <Globe className="h-5 w-5 text-blue-500" /> :
                                                                    <FileText className="h-5 w-5 text-indigo-500" />}
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{task.url}</p>
                                                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">{task.status}</p>
                                                    </div>
                                                </div>
                                                <Loader2 className="h-4 w-4 animate-spin text-indigo-500 shrink-0" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    )}

                    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 rounded-2xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-gray-200/50 dark:border-slate-800/50 shadow-xl">
                        <div>
                            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">LinkPulse Dashboard</h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium italic opacity-80">Autonomous Knowledge Base & Intelligence Engine</p>
                        </div>

                        <Dialog open={ingestOpen} onOpenChange={setIngestOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2 shadow-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white border-0 transition-all duration-300 hover:scale-105">
                                    <Plus size={18} /> Add Source
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[650px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/50 via-white to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 shadow-2xl">
                                <DialogHeader className="pb-2">
                                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                        <div className="p-1.5 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-lg">
                                            <Plus size={16} className="text-white" />
                                        </div>
                                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                                            Add to Knowledge Base
                                        </span>
                                    </DialogTitle>
                                    <DialogDescription className="text-slate-500 dark:text-slate-400">
                                        Choose a source type below and feed your AI brain ✨
                                    </DialogDescription>
                                </DialogHeader>

                                <Tabs defaultValue="pdf" value={activeTab} onValueChange={setActiveTab} className="w-full mt-6">
                                    <TabsList className="grid w-full grid-cols-5 h-14 p-1.5 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700">
                                        <TabsTrigger value="pdf" className="flex flex-col gap-1 items-center justify-center rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-sm transition-all duration-300 group">
                                            <FileText size={18} className="group-hover:scale-110 transition-transform duration-300" />
                                            <span className="text-[10px] font-semibold">Files</span>
                                        </TabsTrigger>
                                        <TabsTrigger value="website" className="flex flex-col gap-1 items-center justify-center rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400 data-[state=active]:shadow-sm transition-all duration-300 group">
                                            <Globe size={18} className="group-hover:scale-110 transition-transform duration-300" />
                                            <span className="text-[10px] font-semibold">Web</span>
                                        </TabsTrigger>
                                        <TabsTrigger value="youtube" className="flex flex-col gap-1 items-center justify-center rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400 data-[state=active]:shadow-sm transition-all duration-300 group">
                                            <Youtube size={18} className="group-hover:scale-110 transition-transform duration-300" />
                                            <span className="text-[10px] font-semibold">YouTube</span>
                                        </TabsTrigger>
                                        <TabsTrigger value="github" className="flex flex-col gap-1 items-center justify-center rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-slate-900 dark:data-[state=active]:text-slate-100 data-[state=active]:shadow-sm transition-all duration-300 group">
                                            <Github size={18} className="group-hover:scale-110 transition-transform duration-300" />
                                            <span className="text-[10px] font-semibold">GitHub</span>
                                        </TabsTrigger>
                                        <TabsTrigger value="instagram" className="flex flex-col gap-1 items-center justify-center rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-pink-600 dark:data-[state=active]:text-pink-400 data-[state=active]:shadow-sm transition-all duration-300 group">
                                            <Instagram size={18} className="group-hover:scale-110 transition-transform duration-300" />
                                            <span className="text-[10px] font-semibold">Social</span>
                                        </TabsTrigger>
                                    </TabsList>

                                    <div className="mt-6 space-y-4">
                                        <TabsContent value="pdf" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors group">
                                                <div className="flex flex-col items-center justify-center mb-6 text-center space-y-2">
                                                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full mb-2 group-hover:scale-110 transition-transform duration-300">
                                                        <FileText size={24} />
                                                    </div>
                                                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">Upload Documents</h3>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">Support for PDF, DOCX, TXT, MD, & PPTX</p>
                                                </div>
                                                <div className="mb-4">
                                                    <Label htmlFor="folder-name" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-1.5">
                                                        <Folder size={14} className="text-amber-500" /> Folder Name <span className="text-slate-400 text-xs font-normal">(optional — groups files together)</span>
                                                    </Label>
                                                    <Input id="folder-name" placeholder="e.g. Company SOPs, Research Papers" value={folderInput} onChange={(e) => setFolderInput(e.target.value)}
                                                        className="h-10 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700" />
                                                </div>
                                                <MultiFileUpload folderName={folderInput} onUploadComplete={() => {
                                                    setTimeout(() => {
                                                        setIngestOpen(false);
                                                        setFolderInput("");
                                                        fetchSources();
                                                    }, 1500);
                                                }} />
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="website" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            {/* Single URL Mode */}
                                            <div className="space-y-3">
                                                <Label htmlFor="web-url" className="text-base font-medium flex items-center gap-2">
                                                    <Globe size={16} className="text-emerald-500" /> Website URL
                                                </Label>
                                                <div className="relative">
                                                    <Input id="web-url" placeholder="https://example.com" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="pl-10 h-12 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 transition-all" />
                                                    <div className="absolute left-3 top-3 text-slate-400">
                                                        <Globe size={20} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="web-depth" className="font-medium">Crawl Depth</Label>
                                                <Select value={depthInput} onValueChange={setDepthInput}>
                                                    <SelectTrigger className="h-11 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
                                                        <SelectValue placeholder="Select depth" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="0">🔍 Current Page Only</SelectItem>
                                                        <SelectItem value="1">🔗 Direct Links (1 level)</SelectItem>
                                                        <SelectItem value="2">🌐 Deep Crawl (2 levels - Slow)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Button
                                                onClick={() => handleUrlIngest('website')}
                                                disabled={!urlInput || processing}
                                                className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white transition-all shadow-lg hover:shadow-xl hover:shadow-emerald-500/20 disabled:opacity-70 group"
                                            >
                                                {processing ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Loader2 className="animate-spin" size={18} />
                                                        <span>Crawling Website...</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Globe size={18} className="group-hover:rotate-12 transition-transform" />
                                                        <span>Ingest Website</span>
                                                    </div>
                                                )}
                                            </Button>

                                            {/* Divider */}
                                            <div className="relative my-2">
                                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-700"></div></div>
                                                <div className="relative flex justify-center text-xs"><span className="bg-white dark:bg-slate-950 px-3 text-slate-400 font-semibold">OR BULK IMPORT</span></div>
                                            </div>

                                            {/* Multi-URL Mode */}
                                            <div className="space-y-3">
                                                <Label className="text-base font-medium flex items-center gap-2">
                                                    <LayoutGrid size={16} className="text-emerald-500" /> Multiple URLs
                                                    {(() => {
                                                        const count = multiUrlInput.split('\n').filter(u => u.trim().startsWith('http')).length;
                                                        return count > 0 ? (
                                                            <Badge variant="secondary" className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
                                                                {count} URL{count > 1 ? 's' : ''}
                                                            </Badge>
                                                        ) : null;
                                                    })()}
                                                </Label>
                                                <textarea
                                                    placeholder={"Paste one URL per line:\nhttps://docs.example.com/guide\nhttps://docs.example.com/api\nhttps://docs.example.com/faq"}
                                                    value={multiUrlInput}
                                                    onChange={(e) => setMultiUrlInput(e.target.value)}
                                                    rows={4}
                                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-sm font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
                                                />
                                                <p className="text-[11px] text-slate-400 dark:text-slate-500 ml-1">
                                                    Pages from the same domain are automatically grouped together.
                                                </p>
                                            </div>
                                            <Button
                                                onClick={handleMultiUrlIngest}
                                                disabled={!multiUrlInput.trim() || processing}
                                                className="w-full h-11 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white transition-all shadow-lg hover:shadow-xl hover:shadow-teal-500/20 disabled:opacity-70 group"
                                            >
                                                {processing ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Loader2 className="animate-spin" size={18} />
                                                        <span>Ingesting URLs...</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <LayoutGrid size={18} className="group-hover:scale-110 transition-transform" />
                                                        <span>Ingest All URLs</span>
                                                    </div>
                                                )}
                                            </Button>
                                        </TabsContent>

                                        <TabsContent value="youtube" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="space-y-3">
                                                <Label htmlFor="yt-url" className="text-base font-medium flex items-center gap-2">
                                                    <Youtube size={16} className="text-red-500" /> YouTube Video URL
                                                </Label>
                                                <div className="relative">
                                                    <Input id="yt-url" placeholder="https://youtube.com/watch?v=..." value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="pl-10 h-12 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-red-500 transition-all" />
                                                    <div className="absolute left-3 top-3 text-slate-400">
                                                        <Youtube size={20} />
                                                    </div>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                                                    Extracts transcript and metadata from public YouTube videos.
                                                </p>
                                            </div>
                                            <Button
                                                onClick={() => handleUrlIngest('youtube')}
                                                disabled={!urlInput || processing}
                                                className="w-full h-11 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white transition-all shadow-lg hover:shadow-xl hover:shadow-red-500/20 disabled:opacity-70 group"
                                            >
                                                {processing ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Loader2 className="animate-spin" size={18} />
                                                        <span>Extracting Transcript...</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Youtube size={18} className="group-hover:scale-110 transition-transform" />
                                                        <span>Ingest Video</span>
                                                    </div>
                                                )}
                                            </Button>
                                        </TabsContent>

                                        <TabsContent value="github" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="space-y-3">
                                                <Label htmlFor="github-repo" className="text-base font-medium flex items-center gap-2">
                                                    <Github size={16} /> Repository Path
                                                </Label>
                                                <div className="relative">
                                                    <Input
                                                        id="github-repo"
                                                        placeholder="owner/repo (e.g., facebook/react)"
                                                        value={urlInput}
                                                        onChange={(e) => setUrlInput(e.target.value)}
                                                        className="pl-10 h-12 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-slate-500 transition-all font-mono text-sm"
                                                    />
                                                    <div className="absolute left-3 top-3 text-slate-400">
                                                        <Github size={20} />
                                                    </div>
                                                </div>
                                                <div className="text-xs text-muted-foreground p-3 bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-lg text-yellow-700 dark:text-yellow-400 flex gap-2 items-start">
                                                    <div className="mt-0.5 min-w-[4px] h-4 bg-yellow-400 rounded-full"></div>
                                                    <p>Recursive ingestion enabled. Large repositories (&gt;50mb) may take some time to process.</p>
                                                </div>
                                            </div>
                                            <Button
                                                onClick={() => handleUrlIngest('github')}
                                                disabled={!urlInput || processing}
                                                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-all shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed group"
                                            >
                                                {processing ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Loader2 className="animate-spin" size={18} />
                                                        <span>Cloning & Ingesting...</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Github size={18} className="group-hover:rotate-12 transition-transform" />
                                                        <span>Ingest Repository</span>
                                                    </div>
                                                )}
                                            </Button>
                                        </TabsContent>

                                        <TabsContent value="instagram" className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="space-y-3">
                                                <Label htmlFor="insta-url" className="text-base font-medium flex items-center gap-2">
                                                    <Instagram size={16} className="text-pink-500" /> Instagram Post URL
                                                </Label>
                                                <div className="relative">
                                                    <Input id="insta-url" placeholder="https://instagram.com/p/..." value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="pl-10 h-12 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-pink-500 transition-all" />
                                                    <div className="absolute left-3 top-3 text-slate-400">
                                                        <Instagram size={20} />
                                                    </div>
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 ml-1">
                                                    Extracts caption and metadata from public Instagram posts.
                                                </p>
                                            </div>
                                            <Button
                                                onClick={() => handleUrlIngest('instagram')}
                                                disabled={!urlInput || processing}
                                                className="w-full h-11 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:from-pink-600 hover:via-purple-600 hover:to-indigo-600 text-white transition-all shadow-lg hover:shadow-xl hover:shadow-pink-500/20 disabled:opacity-70 group"
                                            >
                                                {processing ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Loader2 className="animate-spin" size={18} />
                                                        <span>Fetching Post...</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Instagram size={18} className="group-hover:rotate-12 transition-transform" />
                                                        <span>Ingest Post</span>
                                                    </div>
                                                )}
                                            </Button>
                                        </TabsContent>
                                    </div>
                                </Tabs>
                            </DialogContent>
                        </Dialog>
                        {/* Summary Dialog */}
                        <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
                            <DialogContent className="sm:max-w-[900px] h-[90vh] flex flex-col p-0 gap-0 bg-white dark:bg-slate-900 border border-purple-300 dark:border-purple-700 shadow-2xl overflow-hidden rounded-2xl">
                                <DialogHeader className="px-8 py-5 border-b border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/60 dark:to-pink-900/60 shrink-0">
                                    <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 flex items-center gap-2">
                                        <Sparkles className="h-6 w-6 text-purple-500 animate-pulse" />
                                        AI-Powered Summary
                                    </DialogTitle>
                                    <DialogDescription className="text-gray-600 dark:text-gray-400">
                                        Comprehensive insights generated from your data source.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="flex-1 overflow-hidden">
                                    <ScrollArea className="h-full w-full">
                                        <div className="p-8">
                                            {summaryContent ? (
                                                <div className="prose dark:prose-invert max-w-none prose-sm prose-headings:font-bold prose-headings:text-purple-700 dark:prose-headings:text-purple-300 prose-p:text-gray-800 dark:prose-p:text-gray-200 prose-li:text-gray-800 dark:prose-li:text-gray-200 prose-strong:text-purple-800 dark:prose-strong:text-purple-200">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {summaryContent}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center gap-6 py-20">
                                                    <div className="relative">
                                                        <div className="h-16 w-16 rounded-full border-4 border-purple-200 dark:border-purple-800 border-t-purple-500 animate-spin"></div>
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <Sparkles className="h-5 w-5 text-purple-500 animate-pulse" />
                                                        </div>
                                                    </div>
                                                    <p className="text-muted-foreground text-sm animate-pulse font-medium">Generating comprehensive analysis...</p>
                                                </div>
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                                {summaryContent && (
                                    <div className="px-6 py-3 border-t border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 flex items-center justify-between shrink-0">
                                        <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                                            {summaryContent.split(/\s+/).length} words
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="text-xs h-8 gap-1.5 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(summaryContent);
                                                }}
                                            >
                                                <Copy size={12} /> Copy
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="text-xs h-8 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                                                onClick={() => {
                                                    const printWindow = window.open('', '_blank');
                                                    if (printWindow) {
                                                        printWindow.document.write(`
                                                        <html><head><title>AI Summary</title>
                                                        <style>body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#1e293b}h1,h2,h3{color:#7c3aed}ul{padding-left:20px}li{margin:8px 0}</style>
                                                        </head><body>${document.querySelector('.prose')?.innerHTML || summaryContent}</body></html>
                                                    `);
                                                        printWindow.document.close();
                                                        printWindow.print();
                                                    }
                                                }}
                                            >
                                                <Download size={12} /> Export PDF
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </DialogContent>
                        </Dialog>
                        {/* Content View Dialog */}
                        <Dialog open={contentOpen} onOpenChange={(open) => { setContentOpen(open); if (!open) setViewingSource(null); }}>
                            <DialogContent className="sm:max-w-[950px] h-[90vh] flex flex-col p-0 gap-0 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 shadow-2xl overflow-hidden rounded-2xl">
                                <DialogHeader className="px-6 py-4 border-b border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/60 dark:to-indigo-900/60 shrink-0">
                                    <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-blue-500" />
                                        Source Content
                                    </DialogTitle>
                                    <div className="mt-1 flex items-center gap-3">
                                        <DialogDescription className="text-gray-600 dark:text-gray-400">
                                            {viewingSource?.type === 'pdf' ? 'Viewing PDF document' :
                                                viewingSource?.type === 'youtube' ? 'Watching YouTube video' :
                                                    viewingSource?.type === 'website' ? 'Viewing website' :
                                                        viewingSource?.type === 'github' ? 'Viewing GitHub source code' :
                                                            'Viewing extracted content'}
                                        </DialogDescription>
                                        {(viewingSource?.type === 'github' || viewingSource?.type === 'file' || viewingSource?.url.includes('path=')) && (
                                            <>
                                                <div className="h-3 w-px bg-blue-300 dark:bg-blue-800" />
                                                <Breadcrumbs
                                                    path={viewingSource.url.includes('path=') ? new URL(viewingSource.url).searchParams.get('path') || '' : ''}
                                                    type={viewingSource.type}
                                                    repo={viewingSource.url.includes('github.com') ? viewingSource.url.split('github.com/')[1]?.split('/blob')[0] : undefined}
                                                />
                                            </>
                                        )}
                                    </div>
                                </DialogHeader>
                                <div className="flex-1 overflow-hidden relative bg-white dark:bg-slate-900">
                                    {loadingContent ? (
                                        <div className="flex flex-col items-center justify-center gap-4 py-20 h-full">
                                            <div className="relative">
                                                <div className="h-16 w-16 rounded-full border-4 border-blue-200 dark:border-blue-800 border-t-blue-500 animate-spin"></div>
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="h-5 w-5 rounded-full bg-blue-500 animate-pulse"></div>
                                                </div>
                                            </div>
                                            <p className="text-gray-600 dark:text-gray-400 animate-pulse text-lg font-medium">Loading content...</p>
                                        </div>
                                    ) : viewingSource?.type === 'pdf' && viewingSource?.downloadUrl ? (
                                        <iframe
                                            src={`http://localhost:8090${viewingSource.downloadUrl}`}
                                            className="w-full h-full border-0"
                                            title="PDF Viewer"
                                        />
                                    ) : viewingSource?.type === 'youtube' ? (
                                        <div className="flex flex-col h-full">
                                            <div className="flex-1 flex items-center justify-center bg-black p-4">
                                                {(() => {
                                                    const url = viewingSource.url;
                                                    let videoId = '';
                                                    if (url.includes('youtube.com/watch')) {
                                                        videoId = new URL(url).searchParams.get('v') || '';
                                                    } else if (url.includes('youtu.be/')) {
                                                        videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
                                                    }
                                                    return videoId ? (
                                                        <iframe
                                                            src={`https://www.youtube.com/embed/${videoId}?autoplay=0`}
                                                            className="w-full max-w-4xl aspect-video rounded-lg"
                                                            allowFullScreen
                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                            title="YouTube Video"
                                                        />
                                                    ) : (
                                                        <div className="text-center text-white">
                                                            <p className="text-lg font-medium mb-4">Could not extract video ID</p>
                                                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Open on YouTube →</a>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                                                <a href={viewingSource.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2">
                                                    <ExternalLink size={14} /> Open on YouTube
                                                </a>
                                            </div>
                                        </div>
                                    ) : viewingSource?.type === 'website' ? (
                                        <div className="flex flex-col h-full">
                                            <div className="p-6 flex flex-col items-center justify-center gap-6 flex-1">
                                                <div className="p-4 rounded-2xl bg-blue-100 dark:bg-blue-900/30">
                                                    <Globe className="h-12 w-12 text-blue-500" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Website Source</p>
                                                    <a href={viewingSource.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline text-sm break-all">
                                                        {viewingSource.url}
                                                    </a>
                                                </div>
                                                <Button onClick={() => window.open(viewingSource.url, '_blank')} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                                                    <ExternalLink size={16} /> Visit Website
                                                </Button>
                                            </div>
                                        </div>
                                    ) : viewingSource?.type === 'github' ? (
                                        <div className="flex flex-col h-full">
                                            {/* File path header */}
                                            <div className="px-4 py-2 bg-slate-800 dark:bg-slate-950 border-b border-slate-700 flex items-center justify-between shrink-0">
                                                <div className="flex items-center gap-2 text-slate-300 text-sm font-mono">
                                                    <Github className="h-4 w-4" />
                                                    <span className="text-slate-400">{viewingSource.url.split('/blob/main/')[1] || viewingSource.url.split('/').slice(-1)[0]}</span>
                                                </div>
                                                <a href={viewingSource.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                                    <ExternalLink size={12} /> View on GitHub
                                                </a>
                                            </div>
                                            {/* Code content with line numbers */}
                                            <ScrollArea className="h-full w-full">
                                                <div className="flex">
                                                    <div className="py-4 px-2 text-right select-none bg-slate-900 dark:bg-black border-r border-slate-700 shrink-0">
                                                        {contentData.split('\n').map((_, i) => (
                                                            <div key={i} className="text-slate-600 text-xs font-mono leading-6 px-2">{i + 1}</div>
                                                        ))}
                                                    </div>
                                                    <pre className="flex-1 p-4 text-sm font-mono leading-6 text-green-300 bg-slate-900 dark:bg-black overflow-x-auto">
                                                        <code>{contentData}</code>
                                                    </pre>
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    ) : (
                                        <ScrollArea className="h-full w-full">
                                            <div className="p-6 whitespace-pre-wrap text-sm md:text-base font-mono leading-relaxed text-gray-800 dark:text-gray-200 selection:bg-blue-500/30 pb-10">
                                                {contentData}
                                            </div>
                                        </ScrollArea>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </header>

                    {/* Dashboard Stats — Premium Aesthetic */}
                    {!loading && sources.length > 0 && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-100">
                            {[
                                { label: 'Total Sources', value: sources.length, icon: Database, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
                                { label: 'Web Pages', value: sources.filter(s => s.source_type === 'website').length, icon: Globe, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                                { label: 'YouTube Videos', value: sources.filter(s => s.source_type === 'youtube').length, icon: Youtube, color: 'text-red-500', bg: 'bg-red-500/10' },
                                { label: 'Code Assets', value: sources.filter(s => s.source_type === 'github').length, icon: Github, color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-500/10' },
                            ].map((stat, i) => (
                                <div key={i} className="group p-4 rounded-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-500/50 transition-all hover:-translate-y-1">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
                                            <stat.icon size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</p>
                                            <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">{stat.value}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Stats Row + Search + Filter */}
                    {/* Source Stats Banner */}
                    {!loading && sources.length > 0 && (() => {
                        const groups = groupSources(sources);
                        const githubCount = sources.filter(s => s.source_type === 'github').length;
                        const pdfCount = sources.filter(s => s.source_type === 'pdf').length;
                        const webCount = sources.filter(s => s.source_type === 'website').length;
                        const ytCount = sources.filter(s => s.source_type === 'youtube').length;
                        const igCount = sources.filter(s => s.source_type === 'instagram').length;
                        return (
                            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/40 text-xs text-slate-600 dark:text-slate-400 font-medium">
                                <Database size={14} className="text-indigo-500" />
                                <span className="font-bold text-slate-800 dark:text-slate-200">{sources.length} sources</span>
                                <span className="text-slate-300 dark:text-slate-600">in</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{groups.length} groups</span>
                                <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
                                <div className="hidden sm:flex items-center gap-2 flex-wrap">
                                    {githubCount > 0 && <span className="flex items-center gap-1"><Github size={12} />{githubCount}</span>}
                                    {pdfCount > 0 && <span className="flex items-center gap-1 text-red-500"><FileText size={12} />{pdfCount}</span>}
                                    {webCount > 0 && <span className="flex items-center gap-1 text-blue-500"><Globe size={12} />{webCount}</span>}
                                    {ytCount > 0 && <span className="flex items-center gap-1 text-red-600"><Youtube size={12} />{ytCount}</span>}
                                    {igCount > 0 && <span className="flex items-center gap-1 text-pink-500"><Instagram size={12} />{igCount}</span>}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Toolbar Row */}
                    <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
                        {/* Filter pills */}
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                { label: 'All', value: 'all', count: sources.length, color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300', activeColor: 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900' },
                                { label: 'PDF', value: 'pdf', count: sources.filter(s => s.source_type === 'pdf').length, color: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400', activeColor: 'bg-red-600 text-white' },
                                { label: 'Web', value: 'website', count: sources.filter(s => s.source_type === 'website').length, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400', activeColor: 'bg-blue-600 text-white' },
                                { label: 'YouTube', value: 'youtube', count: sources.filter(s => s.source_type === 'youtube').length, color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400', activeColor: 'bg-orange-600 text-white' },
                                { label: 'GitHub', value: 'github', count: sources.filter(s => s.source_type === 'github').length, color: 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300', activeColor: 'bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900' },
                                { label: 'Social', value: 'instagram', count: sources.filter(s => s.source_type === 'instagram').length, color: 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400', activeColor: 'bg-pink-600 text-white' },
                            ].filter(f => f.value === 'all' || f.count > 0).map(f => (
                                <button key={f.value} onClick={() => setTypeFilter(f.value)}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${typeFilter === f.value ? f.activeColor + ' shadow-md scale-105' : f.color + ' hover:scale-105 hover:shadow-sm'}`}>
                                    {f.label} {f.count > 0 && <span className="ml-0.5 opacity-75">({f.count})</span>}
                                </button>
                            ))}
                        </div>

                        {/* Search + Sort + Select */}
                        <div className="flex items-center gap-2 w-full lg:w-auto">
                            <div className="relative flex-1 lg:w-72">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="text" placeholder="Search sources..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
                            </div>

                            {/* Sort dropdown */}
                            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                                <SelectTrigger className="w-[130px] h-9 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                                    <ArrowUpDown size={13} className="mr-1 text-slate-400" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="date">Newest First</SelectItem>
                                    <SelectItem value="name">Name A-Z</SelectItem>
                                    <SelectItem value="type">By Type</SelectItem>
                                    <SelectItem value="files">Most Files</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Select mode toggle */}
                            <Button variant={selectMode ? "default" : "outline"} size="sm"
                                onClick={() => { setSelectMode(!selectMode); setSelectedUrls(new Set()); }}
                                className={`h-9 text-xs gap-1.5 font-bold transition-all ${selectMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                {selectMode ? <X size={14} /> : <CheckSquare size={14} />}
                                {selectMode ? 'Done' : 'Select'}
                            </Button>
                        </div>
                    </div>

                    {/* Select mode banner */}
                    {selectMode && (() => {
                        const selArray = Array.from(selectedUrls);
                        const selSources = sources.filter(s => selArray.indexOf(s.source_url) >= 0);
                        const typeCounts: Record<string, number> = {};
                        selSources.forEach(s => { typeCounts[s.source_type] = (typeCounts[s.source_type] || 0) + 1; });
                        return (
                            <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                                    <CheckSquare size={16} className="text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium">
                                            Click cards to select • Click groups to select all files
                                        </p>
                                        <span className="text-[10px] text-indigo-500/70 dark:text-indigo-400/50 hidden sm:inline-flex items-center gap-1">
                                            <kbd className="px-1 py-0.5 bg-indigo-100 dark:bg-indigo-900/60 rounded text-[9px] font-mono border border-indigo-200 dark:border-indigo-800">Ctrl+A</kbd> select all
                                            <kbd className="ml-1 px-1 py-0.5 bg-indigo-100 dark:bg-indigo-900/60 rounded text-[9px] font-mono border border-indigo-200 dark:border-indigo-800">Esc</kbd> exit
                                        </span>
                                    </div>
                                    {selectedUrls.size > 0 && (
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{selectedUrls.size} selected</span>
                                            {Object.entries(typeCounts).map(([type, count]) => (
                                                <span key={type} className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 font-medium border border-indigo-200/50 dark:border-indigo-800/50">
                                                    {count} {type}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 font-bold"
                                    onClick={() => {
                                        if (selectedUrls.size === sources.length) setSelectedUrls(new Set());
                                        else setSelectedUrls(new Set(sources.map(s => s.source_url)));
                                    }}>
                                    {selectedUrls.size === sources.length ? 'Deselect All' : 'Select All'}
                                </Button>
                            </div>
                        );
                    })()}
                </div>

                <ScrollArea className="flex-1 px-6 md:px-10 pb-10">
                    <div className="space-y-8 py-6">
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {(() => {
                                const filteredSources = sources.filter(s => {
                                    const matchesType = typeFilter === 'all' || s.source_type === typeFilter;
                                    const matchesSearch = !searchQuery ||
                                        (s.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        (s.source_url || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        (s.path || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        (s.repo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        (s.folder_name || '').toLowerCase().includes(searchQuery.toLowerCase());
                                    return matchesType && matchesSearch;
                                });
                                const groups = sortGroups(groupSources(filteredSources));

                                return loading ? (
                                    <>{[...Array(8)].map((_, i) => (
                                        <div key={i} className="animate-pulse rounded-2xl bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
                                            <div className="h-2 bg-gradient-to-r from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600" />
                                            <div className="p-5 space-y-3">
                                                <div className="flex justify-between"><div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-md" /><div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-lg" /></div>
                                                <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded" />
                                                <div className="h-3 w-1/2 bg-slate-100 dark:bg-slate-700/50 rounded" />
                                            </div>
                                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 grid grid-cols-2 gap-2"><div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" /><div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg" /></div>
                                        </div>
                                    ))}</>
                                ) : groups.length === 0 ? (
                                    <div className="col-span-full py-20 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
                                        <div className="relative mb-10 scale-110">
                                            <div className="absolute inset-0 bg-indigo-500/10 blur-[100px] rounded-full" />
                                            <div className="h-36 w-36 rounded-full border-2 border-indigo-500/20 flex items-center justify-center bg-white/5 backdrop-blur-3xl relative z-10 ring-8 ring-indigo-500/5">
                                                <Database size={64} className="text-indigo-400/80 animate-pulse" />
                                            </div>
                                            <div className="absolute -top-3 -right-3 h-12 w-12 rounded-2xl bg-gradient-to-tr from-cyan-400 to-blue-500 border border-white/20 flex items-center justify-center shadow-xl animate-bounce z-20">
                                                <Sparkles size={20} className="text-white" />
                                            </div>
                                            <div className="absolute -bottom-2 -left-6 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-20 transform -rotate-12">
                                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Ready to Build</span>
                                            </div>
                                        </div>
                                        <h2 className="text-4xl font-black text-slate-800 dark:text-slate-100 mb-4 tracking-tight">Fuel Your Intelligence</h2>
                                        <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto mb-10 leading-relaxed font-medium text-lg">
                                            {sources.length === 0
                                                ? "Your knowledge base is currently a blank slate. Connect your first source to see LinkPulse extract insights and build your private LLM context."
                                                : "No matching documents found in your brain. Try a different search term or clear your filters."}
                                        </p>
                                        {sources.length === 0 && (
                                            <Button
                                                size="lg"
                                                className="h-16 px-12 gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-lg rounded-2xl shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all duration-300"
                                                onClick={() => setIngestOpen(true)}
                                            >
                                                <Plus size={24} /> Start Ingesting
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    groups.map((group, index) => {
                                        const isMulti = group.sources.length > 1 && group.type !== 'single' || group.type === 'website';
                                        const isExpanded = expandedGroups.has(group.key);
                                        const isHovered = hoveredGroup === group.key;
                                        const selState = isMulti ? getGroupSelectionState(group) : (selectedUrls.has(group.sources[0].source_url) ? 'all' : 'none');
                                        const isSelected = selState === 'all' || selState === 'partial';

                                        const colorMap: Record<string, { gradient: string; badge: string; ring: string }> = {
                                            'github': { gradient: 'linear-gradient(135deg, #1e293b, #475569)', badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700', ring: 'ring-slate-400' },
                                            'pdf': { gradient: 'linear-gradient(135deg, #ef4444, #f87171)', badge: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30', ring: 'ring-red-400' },
                                            'youtube': { gradient: 'linear-gradient(135deg, #dc2626, #ef4444)', badge: 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-900/30', ring: 'ring-red-400' },
                                            'website': { gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)', badge: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/30', ring: 'ring-blue-400' },
                                            'instagram': { gradient: 'linear-gradient(135deg, #db2777, #f472b6)', badge: 'bg-pink-50 text-pink-600 border-pink-100 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-900/30', ring: 'ring-pink-400' },
                                        };
                                        const gc = colorMap[group.sourceType] || { gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)', badge: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30', ring: 'ring-amber-400' };

                                        const handleCardClick = () => {
                                            if (!selectMode) return;
                                            if (isMulti) toggleSelectGroup(group);
                                            else toggleSelect(group.sources[0].source_url);
                                        };

                                        return (
                                            <div key={group.key}
                                                className={`relative rounded-2xl overflow-hidden shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 fill-mode-backwards
                                            ${isExpanded ? 'sm:col-span-2 lg:col-span-2' : ''}
                                            ${selectMode ? 'cursor-pointer' : ''}
                                            ${isSelected ? 'ring-2 ring-indigo-500 dark:ring-indigo-400 shadow-indigo-500/20 shadow-xl scale-[1.02]' : 'ring-1 ring-slate-200/80 dark:ring-slate-700/60'}
                                            ${selectMode && !isSelected && isHovered ? 'ring-2 ring-indigo-300 dark:ring-indigo-600 shadow-lg' : ''}
                                            ${!selectMode ? 'hover:shadow-2xl hover:-translate-y-1' : ''}
                                            ${isRecent(group.latestDate) ? 'premium-glow-pulse ring-2 ring-indigo-500/50 animate-pulse-subtle' : ''}
                                            bg-white dark:bg-slate-900/90 backdrop-blur-sm`}
                                                style={{ animationDelay: `${index * 50}ms` }}
                                                onClick={handleCardClick}
                                                onMouseEnter={() => setHoveredGroup(group.key)}
                                                onMouseLeave={() => setHoveredGroup(null)}
                                            >
                                                {/* Top Hover Target for Quick Peek (Targeted UX) */}
                                                {isMulti && !isExpanded && (
                                                    <div className="absolute top-0 inset-x-0 h-8 z-30"
                                                        onMouseEnter={() => setPeekHoveredGroup(group.key)}
                                                        onMouseLeave={() => setPeekHoveredGroup(null)}
                                                    />
                                                )}

                                                {/* Top gradient bar */}
                                                <div className="h-1.5 w-full" style={{ background: gc.gradient }} />

                                                {/* Internal Preview Scroller (Visible ONLY when top zone is hovered) */}
                                                {isMulti && peekHoveredGroup === group.key && !isExpanded && (
                                                    <div className="absolute inset-x-0 top-1.5 z-20 h-24 bg-slate-900/90 backdrop-blur-md border-b border-indigo-500/50 animate-in slide-in-from-top-full duration-300 overflow-hidden">
                                                        <div className="p-2 flex flex-col h-full">
                                                            <div className="flex items-center justify-between mb-1 px-1">
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Quick Peek</span>
                                                                <span className="text-[9px] font-bold text-slate-500">{group.sources.length} items</span>
                                                            </div>
                                                            <ScrollArea className="flex-1">
                                                                <div className="space-y-1.5 px-1 py-1">
                                                                    {group.sources.slice(0, 10).map((s, i) => (
                                                                        <div key={i} className="flex items-center gap-2 text-[10px] text-slate-300 hover:text-indigo-300 transition-colors truncate">
                                                                            {s.source_type === 'pdf' ? <FileText size={8} /> : <File size={8} />}
                                                                            {getDisplayName(s)}
                                                                        </div>
                                                                    ))}
                                                                    {group.sources.length > 10 && (
                                                                        <div className="text-[9px] text-slate-500 italic pl-4">+{group.sources.length - 10} more files...</div>
                                                                    )}
                                                                </div>
                                                            </ScrollArea>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Selection checkmark overlay */}
                                                {selectMode && (
                                                    <div className={`absolute top-4 right-4 z-10 transition-all duration-200 ${isSelected ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}>
                                                        <div className={`h-7 w-7 rounded-full flex items-center justify-center shadow-lg ${selState === 'all' ? 'bg-indigo-600 text-white' : selState === 'partial' ? 'bg-amber-500 text-white' : 'bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600'}`}>
                                                            {selState === 'all' ? <Check size={14} strokeWidth={3} /> : selState === 'partial' ? <Minus size={14} strokeWidth={3} /> : null}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Unselected checkbox hint on hover */}
                                                {selectMode && !isSelected && isHovered && (
                                                    <div className="absolute top-4 right-4 z-10 animate-in fade-in duration-150">
                                                        <div className="h-7 w-7 rounded-full border-2 border-indigo-300 dark:border-indigo-600 bg-white/80 dark:bg-slate-800/80 flex items-center justify-center">
                                                            <Plus size={12} className="text-indigo-400" />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Selection glow overlay */}
                                                {isSelected && <div className="absolute inset-0 bg-indigo-500/5 dark:bg-indigo-400/5 pointer-events-none" />}

                                                {/* Card Header */}
                                                <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Badge variant="secondary" className={`text-[10px] font-bold px-2 py-0.5 border ${gc.badge}`}>
                                                            {group.sourceType.toUpperCase()}
                                                        </Badge>
                                                        {isMulti && (
                                                            <Badge variant="secondary" className="text-[10px] font-bold px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800">
                                                                <Hash size={10} className="mr-0.5" />{group.sources.length} {group.type === 'website' ? 'pages' : 'files'}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className={`p-2 rounded-xl transition-colors ${isSelected ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                                        {isMulti && group.type === 'github' ? <Github className="h-5 w-5" /> :
                                                            isMulti && group.type === 'folder' ? <FolderOpen className="h-5 w-5 text-amber-500" /> :
                                                                isMulti && group.type === 'website' ? <Globe className="h-5 w-5 text-blue-500" /> :
                                                                    getIcon(group.sourceType)}
                                                    </div>
                                                </div>

                                                {/* Card Body */}
                                                <div className="px-5 pb-4">
                                                    <h3 className="text-[15px] font-bold text-slate-800 dark:text-slate-100 truncate mb-1" title={group.label}>
                                                        {isMulti ? group.label : getDisplayName(group.sources[0])}
                                                    </h3>
                                                    {!isMulti && (
                                                        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mb-2" title={group.sources[0].source_url}>
                                                            {group.sources[0].source_url}
                                                        </p>
                                                    )}
                                                    {isMulti && !isExpanded && (
                                                        <div className="flex items-center gap-1 mt-1 mb-2 flex-wrap">
                                                            {group.type === 'website' ? (
                                                                // For website groups, show page paths instead of file extensions
                                                                <>
                                                                    {group.sources.slice(0, 3).map((s, i) => {
                                                                        const pageTitle = s.title || new URL(s.source_url).pathname.split('/').filter(Boolean).pop() || 'page';
                                                                        return (
                                                                            <span key={i} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                                                                                <Globe size={8} className="text-blue-400 shrink-0" />
                                                                                {pageTitle.length > 25 ? pageTitle.substring(0, 25) + '…' : pageTitle}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                    {group.sources.length > 3 && <span className="text-[10px] text-slate-400 font-medium">+{group.sources.length - 3} pages</span>}
                                                                </>
                                                            ) : (
                                                                // For other groups (github, folder), show file extensions
                                                                <>
                                                                    {group.sources.slice(0, 4).map((s, i) => {
                                                                        const fname = s.path || getDisplayName(s);
                                                                        const extInfo = getFileExtInfo(fname);
                                                                        return (
                                                                            <span key={i} className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded ${extInfo.bg} text-slate-600 dark:text-slate-300`}>
                                                                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: extInfo.color }} />
                                                                                {fname.split('/').pop()?.substring(0, 15)}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                    {group.sources.length > 4 && <span className="text-[10px] text-slate-400 font-medium">+{group.sources.length - 4}</span>}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Expanded tree or Details view (Universal Expansion) */}
                                                    {isExpanded && (
                                                        <div className="mt-3 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                                            <div className="px-3 py-2 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-4">
                                                                <div className="flex items-center gap-2">
                                                                    {group.type === 'website' ? <Globe size={12} className="text-blue-500" /> : <Folder size={12} className="text-indigo-500" />}
                                                                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                                                        {group.sources.length} {group.type === 'website' ? 'pages' : 'files'}
                                                                    </span>
                                                                </div>
                                                                <div className="relative flex-1 max-w-[200px]">
                                                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={10} />
                                                                    <Input
                                                                        placeholder="Filter group content..."
                                                                        className="h-6 pl-6 pr-2 text-[10px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus-visible:ring-indigo-500"
                                                                        value={groupSearchQuery}
                                                                        onChange={(e) => setGroupSearchQuery(e.target.value)}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                </div>
                                                            </div>
                                                            <ScrollArea className="max-h-[350px] overflow-auto">
                                                                <div className="divide-y divide-slate-100 dark:divide-slate-800 whitespace-nowrap">
                                                                    {group.sources.filter(s => !groupSearchQuery ||
                                                                        (s.title || '').toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
                                                                        (s.path || '').toLowerCase().includes(groupSearchQuery.toLowerCase()) ||
                                                                        (s.source_url || '').toLowerCase().includes(groupSearchQuery.toLowerCase())
                                                                    ).map((source) => {
                                                                        const fileSelected = selectedUrls.has(source.source_url);
                                                                        // Source-type-aware display
                                                                        const isWebPage = source.source_type === 'website';
                                                                        const itemIcon = isWebPage
                                                                            ? <Globe size={14} className="text-blue-400 shrink-0" />
                                                                            : source.source_type === 'github'
                                                                                ? <Github size={14} className="text-slate-500 shrink-0" />
                                                                                : source.source_type === 'youtube'
                                                                                    ? <Youtube size={14} className="text-orange-400 shrink-0" />
                                                                                    : source.source_type === 'pdf'
                                                                                        ? <FileText size={14} className="text-red-400 shrink-0" />
                                                                                        : (() => {
                                                                                            const fname = source.path || getDisplayName(source);
                                                                                            const extInfo = getFileExtInfo(fname);
                                                                                            return <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: extInfo.color }} />;
                                                                                        })();

                                                                        const itemName = isWebPage
                                                                            ? (source.title || (() => { try { const p = new URL(source.source_url).pathname; return p === '/' ? 'Home' : p.split('/').filter(Boolean).join(' / '); } catch { return source.source_url; } })())
                                                                            : (source.path || getDisplayName(source));

                                                                        const itemSubtext = isWebPage
                                                                            ? (() => { try { return new URL(source.source_url).pathname; } catch { return ''; } })()
                                                                            : '';

                                                                        return (
                                                                            <div key={source.source_url}
                                                                                className={`group/file flex items-center justify-between gap-2 px-3 py-2.5 transition-all duration-150 ${fileSelected ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                                                    {selectMode && (
                                                                                        <button onClick={(e) => { e.stopPropagation(); toggleSelect(source.source_url); }}
                                                                                            className="shrink-0 transition-transform hover:scale-110">
                                                                                            {fileSelected
                                                                                                ? <div className="h-5 w-5 rounded bg-indigo-600 flex items-center justify-center"><Check size={12} className="text-white" strokeWidth={3} /></div>
                                                                                                : <div className="h-5 w-5 rounded border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-400" />}
                                                                                        </button>
                                                                                    )}
                                                                                    {itemIcon}
                                                                                    <div className="min-w-0 flex-1">
                                                                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate block" title={source.source_url}>
                                                                                            {itemName}
                                                                                        </span>
                                                                                        {isWebPage && itemSubtext && itemName !== itemSubtext && (
                                                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate block font-mono">
                                                                                                {itemSubtext}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex gap-0.5 shrink-0 opacity-0 group-hover/file:opacity-100 transition-opacity">
                                                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-purple-500 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg"
                                                                                        onClick={(e) => { e.stopPropagation(); handleSummarize(source.source_url); }} disabled={summarizing} title="Summarize">
                                                                                        <Sparkles size={13} />
                                                                                    </Button>
                                                                                    {isWebPage ? (
                                                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                                                                                            onClick={(e) => { e.stopPropagation(); window.open(source.source_url, '_blank'); }} title="Open in Browser">
                                                                                            <ExternalLink size={13} />
                                                                                        </Button>
                                                                                    ) : (
                                                                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                                                                                            onClick={(e) => { e.stopPropagation(); handleViewContent(source); }} title="View">
                                                                                            <FileText size={13} />
                                                                                        </Button>
                                                                                    )}
                                                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteSource(source.source_url); }} title="Delete">
                                                                                        <Trash2 size={13} />
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </ScrollArea>
                                                        </div>
                                                    )}

                                                    {/* Date */}
                                                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 dark:border-slate-700/50">
                                                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                                            {new Date(group.latestDate).toLocaleDateString()}
                                                        </span>
                                                        {isMulti && selState !== 'none' && (
                                                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                                                {group.sources.filter(s => selectedUrls.has(s.source_url)).length}/{group.sources.length} selected
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Card Footer Actions */}
                                                <div className="bg-slate-50/80 dark:bg-slate-800/40 p-3 grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
                                                    {isMulti ? (
                                                        <>
                                                            <Button variant="secondary" size="sm" className="w-full text-xs h-8 items-center gap-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/40 transition-colors rounded-lg font-semibold"
                                                                onClick={() => handleSummarize(group.sources[0].source_url)} disabled={summarizing}>
                                                                <Sparkles size={12} className="shrink-0" /> Summarize
                                                            </Button>
                                                            <Button variant="secondary" size="sm" className="w-full text-xs h-8 items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40 transition-colors rounded-lg font-semibold"
                                                                onClick={() => toggleGroupExpand(group.key)}>
                                                                {isExpanded ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
                                                                {isExpanded ? 'Collapse' : group.type === 'website' ? 'View Pages' : 'View Files'}
                                                            </Button>
                                                            {group.type === 'website' && (
                                                                <Button variant="secondary" size="sm" className="w-full text-xs h-8 items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/40 transition-colors rounded-lg font-semibold"
                                                                    onClick={() => window.open(`https://${group.label}`, '_blank')}>
                                                                    <ExternalLink size={12} className="shrink-0" /> Visit Site
                                                                </Button>
                                                            )}
                                                            <Button variant="secondary" size="sm" className={`${group.type === 'website' ? '' : 'col-span-2'} w-full text-xs h-8 items-center gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40 transition-colors rounded-lg font-semibold`}
                                                                onClick={() => handleDeleteGroup(group)}>
                                                                <Trash2 size={12} className="shrink-0" /> Delete All ({group.sources.length})
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button variant="secondary" size="sm" className="w-full text-xs h-8 items-center gap-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/40 transition-colors rounded-lg font-semibold"
                                                                onClick={() => handleSummarize(group.sources[0].source_url || "")} disabled={summarizing}>
                                                                <Sparkles size={12} className="shrink-0" /> Summarize
                                                            </Button>
                                                            <Button variant="secondary" size="sm" className="w-full text-xs h-8 items-center gap-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40 transition-colors rounded-lg font-semibold"
                                                                onClick={() => toggleGroupExpand(group.key)}>
                                                                {isExpanded ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
                                                                {isExpanded ? 'Collapse' : 'View Details'}
                                                            </Button>
                                                            {group.sources[0].download_url && (
                                                                <Button variant="secondary" size="sm" className="w-full text-xs h-8 items-center gap-1.5 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40 transition-colors rounded-lg font-semibold"
                                                                    onClick={() => window.open(`http://localhost:8090${group.sources[0].download_url}`, '_blank')}>
                                                                    <ExternalLink size={12} className="shrink-0" /> Download
                                                                </Button>
                                                            )}
                                                            <Button variant="secondary" size="sm" className="w-full text-xs h-8 items-center gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40 transition-colors rounded-lg font-semibold"
                                                                onClick={() => handleDeleteSource(group.sources[0].source_url || "")}>
                                                                <Trash2 size={12} className="shrink-0" /> Delete
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })
                                );
                            })()}
                        </div>
                    </div>
                </ScrollArea>

                {/* Floating Selection Bar — Extraordinarily Premium UI */}
                <FloatingSelectionBar
                    selectedCount={selectedUrls.size}
                    onClear={() => { setSelectedUrls(new Set()); setSelectMode(false); }}
                    onDelete={handleBulkDelete}
                    onSummarize={() => {
                        const urls = Array.from(selectedUrls);
                        if (urls.length > 0) handleSummarize(urls[0]); // For now handle one, but component is ready for bulk
                    }}
                    onExport={() => alert("Bulk Export feature coming soon!")}
                />
            </main>
        </div>
    );
}
