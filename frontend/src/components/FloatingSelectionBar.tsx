'use client';

import React from 'react';
import { Trash2, Sparkles, X, Download, Share2, CheckSquare } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FloatingSelectionBarProps {
    selectedCount: number;
    onClear: () => void;
    onDelete: () => void;
    onSummarize: () => void;
    onExport?: () => void;
}

export function FloatingSelectionBar({
    selectedCount,
    onClear,
    onDelete,
    onSummarize,
    onExport
}: FloatingSelectionBarProps) {
    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-8 duration-300">
            <div className="bg-slate-900/90 dark:bg-slate-800/90 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-6 ring-1 ring-black/20">
                {/* Selection Counter */}
                <div className="flex items-center gap-3 border-r border-white/10 pr-6">
                    <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <CheckSquare size={18} className="text-white" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-white leading-none">{selectedCount} Selected</p>
                        <button
                            onClick={onClear}
                            className="text-[10px] text-slate-400 hover:text-white transition-colors mt-1 underline decoration-dotted"
                        >
                            Deselect all
                        </button>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-white/10 gap-2 h-10 px-4 rounded-xl transition-all active:scale-95"
                        onClick={onSummarize}
                    >
                        <Sparkles size={16} className="text-amber-400" />
                        <span className="text-xs font-bold">Bulk Summarize</span>
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-white/10 gap-2 h-10 px-4 rounded-xl transition-all active:scale-95"
                        onClick={onExport}
                    >
                        <Download size={16} className="text-blue-400" />
                        <span className="text-xs font-bold">Export Data</span>
                    </Button>

                    <div className="w-px h-6 bg-white/10 mx-1" />

                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:bg-red-500/20 hover:text-red-300 gap-2 h-10 px-4 rounded-xl transition-all active:scale-95"
                        onClick={onDelete}
                    >
                        <Trash2 size={16} />
                        <span className="text-xs font-bold">Delete</span>
                    </Button>
                </div>

                {/* Close Button */}
                <button
                    onClick={onClear}
                    className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-all ml-2"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Subtle glow effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-xl opacity-50 -z-10 rounded-2xl" />
        </div>
    );
}
