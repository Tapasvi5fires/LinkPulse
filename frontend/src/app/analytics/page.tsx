'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Globe, Youtube, Instagram, Database, TrendingUp, Clock, Layers, Github } from 'lucide-react';

interface DataSource {
    id: string;
    source_url: string;
    source_type: string;
    title: string;
    ingested_at: string;
}

export default function AnalyticsPage() {
    const [sources, setSources] = useState<DataSource[]>([]);
    const [loading, setLoading] = useState(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';

    useEffect(() => {
        const fetchSources = async () => {
            const token = localStorage.getItem('token');
            if (!token) { setLoading(false); return; }
            try {
                const res = await fetch(`${apiUrl}/api/v1/ingestion/sources`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSources(data);
                }
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchSources();
    }, []);

    const stats = {
        total: sources.length,
        pdf: sources.filter(s => s.source_type === 'pdf').length,
        website: sources.filter(s => s.source_type === 'website').length,
        youtube: sources.filter(s => s.source_type === 'youtube').length,
        github: sources.filter(s => s.source_type === 'github').length,
        instagram: sources.filter(s => s.source_type === 'instagram').length,
    };

    const recentSources = [...sources].sort((a, b) =>
        new Date(b.ingested_at).getTime() - new Date(a.ingested_at).getTime()
    ).slice(0, 50); // Increased from 5 to 50

    const typeDistribution = [
        { type: 'PDF', count: stats.pdf, color: 'bg-red-500', icon: FileText, textColor: 'text-red-600 dark:text-red-400' },
        { type: 'Website', count: stats.website, color: 'bg-blue-500', icon: Globe, textColor: 'text-blue-600 dark:text-blue-400' },
        { type: 'YouTube', count: stats.youtube, color: 'bg-orange-500', icon: Youtube, textColor: 'text-orange-600 dark:text-orange-400' },
        { type: 'GitHub', count: stats.github, color: 'bg-slate-700', icon: Github, textColor: 'text-slate-700 dark:text-slate-300' },
        { type: 'Instagram', count: stats.instagram, color: 'bg-pink-500', icon: Instagram, textColor: 'text-pink-600 dark:text-pink-400' },
    ].filter(t => t.count > 0);

    const maxCount = Math.max(...typeDistribution.map(t => t.count), 1);

    return (
        <div className="flex min-h-screen bg-gray-50 dark:bg-slate-950">
            <Sidebar />
            <main className="flex-1 p-6 md:p-10 space-y-8 md:ml-64 overflow-y-auto h-screen">
                <header className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-lg">
                    <h1 className="text-3xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                        Analytics
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium">Knowledge base insights & statistics</p>
                </header>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    {[
                        { label: 'Total Sources', value: stats.total, icon: Database, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/20' },
                        { label: 'Documents', value: stats.pdf, icon: FileText, color: 'from-red-500 to-rose-600', shadow: 'shadow-red-500/20' },
                        { label: 'Websites', value: stats.website, icon: Globe, color: 'from-cyan-500 to-blue-600', shadow: 'shadow-cyan-500/20' },
                        { label: 'Videos', value: stats.youtube, icon: Youtube, color: 'from-orange-500 to-red-600', shadow: 'shadow-orange-500/20' },
                        { label: 'Repositories', value: stats.github, icon: Github, color: 'from-slate-600 to-slate-800', shadow: 'shadow-slate-500/20' },
                    ].map((stat, i) => (
                        <Card key={i} className="border-0 shadow-lg bg-white dark:bg-slate-900 overflow-hidden group hover:shadow-xl transition-all hover:-translate-y-0.5 duration-300">
                            <CardContent className="p-6 flex items-center gap-4">
                                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} text-white shadow-lg ${stat.shadow} shrink-0 group-hover:scale-110 transition-transform`}>
                                    <stat.icon size={24} />
                                </div>
                                <div>
                                    <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{loading ? '–' : stat.value}</p>
                                    <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mt-0.5">{stat.label}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Source Distribution */}
                    <Card className="border-0 shadow-lg bg-white dark:bg-slate-900">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <Layers size={20} className="text-indigo-500" />
                                Source Distribution
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {loading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)}
                                </div>
                            ) : typeDistribution.length === 0 ? (
                                <p className="text-gray-500 dark:text-slate-400 text-sm py-8 text-center">No sources ingested yet.</p>
                            ) : (
                                typeDistribution.map((item) => (
                                    <div key={item.type} className="flex items-center gap-3">
                                        <div className={`p-1.5 rounded-lg ${item.color}/10`}>
                                            <item.icon size={16} className={item.textColor} />
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 dark:text-slate-300 w-20">{item.type}</span>
                                        <div className="flex-1 bg-gray-100 dark:bg-slate-800 rounded-full h-4 overflow-hidden">
                                            <div
                                                className={`h-full ${item.color} rounded-full transition-all duration-1000 ease-out`}
                                                style={{ width: `${(item.count / maxCount) * 100}%` }}
                                            />
                                        </div>
                                        <span className="text-sm font-bold text-gray-900 dark:text-white w-8 text-right">{item.count}</span>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    {/* Recent Activity */}
                    <Card className="border-0 shadow-lg bg-white dark:bg-slate-900">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <Clock size={20} className="text-emerald-500" />
                                Recent Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)}
                                </div>
                            ) : recentSources.length === 0 ? (
                                <p className="text-gray-500 dark:text-slate-400 text-sm py-8 text-center">No recent activity.</p>
                            ) : (
                                <ScrollArea className="h-[400px] pr-4">
                                    <div className="space-y-2">
                                        {recentSources.map((source) => {
                                            let name = source.title || 'Untitled';
                                            if (source.source_url?.includes('data/storage')) {
                                                const parts = source.source_url.split(/[/\\]/);
                                                const filename = parts[parts.length - 1];
                                                if (filename.length > 37 && filename[36] === '_') {
                                                    name = filename.substring(37);
                                                } else {
                                                    name = filename;
                                                }
                                            }
                                            return (
                                                <div key={source.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors group">
                                                    <div className={`w-2 h-2 rounded-full shrink-0 ${source.source_type === 'pdf' ? 'bg-red-500' :
                                                        source.source_type === 'website' ? 'bg-blue-500' :
                                                            source.source_type === 'youtube' ? 'bg-orange-500' : 'bg-gray-400'
                                                        }`} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{name}</p>
                                                        <p className="text-[10px] text-gray-400 dark:text-slate-500">
                                                            {source.source_type.toUpperCase()} · {new Date(source.ingested_at).toLocaleDateString()} {new Date(source.ingested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                    <TrendingUp size={14} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
