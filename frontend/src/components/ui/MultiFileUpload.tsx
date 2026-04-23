'use client';

import { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2, FolderOpen, FileCode, FileImage, FileBox, FileArchive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from '@/components/ui/button';

interface MultiFileUploadProps {
    onUploadComplete?: (results: any) => void;
    folderName?: string;
}

interface FileStatus {
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    progress: number;
    message?: string;
}

// Supported file map for icons and validation
const SUPPORTED_TYPES = {
    'application/pdf': { icon: FileText, color: 'text-red-500' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: FileText, color: 'text-blue-600' },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': { icon: FileBox, color: 'text-orange-500' },
    'text/plain': { icon: FileText, color: 'text-slate-500' },
    'text/markdown': { icon: FileCode, color: 'text-indigo-500' },
    // Fallback for extensions if MIME type is generic
    '.md': { icon: FileCode, color: 'text-indigo-500' },
    '.docx': { icon: FileText, color: 'text-blue-600' },
    '.pptx': { icon: FileBox, color: 'text-orange-500' },
};

export function MultiFileUpload({ onUploadComplete, folderName: initialFolderName }: MultiFileUploadProps) {
    const [files, setFiles] = useState<FileStatus[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [customFolderName, setCustomFolderName] = useState(initialFolderName || "");

    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);

    const getFileIcon = (file: File) => {
        const type = file.type;
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();

        const info = SUPPORTED_TYPES[type as keyof typeof SUPPORTED_TYPES] ||
            SUPPORTED_TYPES[ext as keyof typeof SUPPORTED_TYPES];

        if (info) return <info.icon className={cn("h-5 w-5 shrink-0", info.color)} />;
        return <FileText className="h-5 w-5 text-gray-400 shrink-0" />;
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            addFiles(Array.from(e.target.files));
        }
    };

    const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const fileList = Array.from(e.target.files);
            // If it's a folder upload and no folder name is set, try to infer it from the first file's path
            const firstFile = fileList[0] as any;
            if (!customFolderName && firstFile.webkitRelativePath) {
                const folderName = firstFile.webkitRelativePath.split('/')[0];
                setCustomFolderName(folderName);
            }
            addFiles(fileList);
        }
    };

    const addFiles = (newFiles: File[]) => {
        const supportedExtensions = ['.pdf', '.docx', '.pptx', '.txt', '.md'];
        const validFiles = newFiles.filter(f => {
            const ext = '.' + f.name.split('.').pop()?.toLowerCase();
            return f.type.startsWith('text/') ||
                f.type.includes('pdf') ||
                f.type.includes('word') ||
                f.type.includes('presentation') ||
                supportedExtensions.includes(ext);
        });

        if (validFiles.length < newFiles.length) {
            const unsupportedCount = newFiles.length - validFiles.length;
            // Optionally notify about skipped files
            console.warn(`Skipped ${unsupportedCount} unsupported files.`);
        }

        setFiles(prev => [
            ...prev,
            ...validFiles.map(f => ({ file: f, status: 'pending' as const, progress: 0 }))
        ]);
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            addFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleUpload = async () => {
        setIsUploading(true);
        const formData = new FormData();

        const token = localStorage.getItem('token');
        if (!token) {
            alert("You must be logged in to upload files.");
            setIsUploading(false);
            return;
        }

        const pendingFiles = files.filter(f => f.status === 'pending');
        if (pendingFiles.length === 0) {
            setIsUploading(false);
            return;
        }

        // Initialize uploading state
        setFiles(prev => prev.map(f => f.status === 'pending' ? { ...f, status: 'uploading', progress: 0 } : f));

        // Simulate progress
        const progressInterval = setInterval(() => {
            setFiles(prev => prev.map(f => {
                if (f.status === 'uploading') {
                    const newProgress = Math.min(f.progress + Math.random() * 15, 95);
                    return { ...f, progress: newProgress };
                }
                return f;
            }));
        }, 400);

        pendingFiles.forEach(f => {
            formData.append('files', f.file);
        });

        const activeFolderName = customFolderName || initialFolderName;
        if (activeFolderName && activeFolderName.trim()) {
            formData.append('folder_name', activeFolderName.trim());
        }

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';
            const response = await fetch(`${apiUrl}/api/v1/ingestion/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            clearInterval(progressInterval);

            if (response.ok) {
                const data = await response.json();
                setFiles(prev => prev.map(f => f.status === 'uploading' ? { ...f, status: 'success', progress: 100, message: 'Ingestion started' } : f));
                if (onUploadComplete) onUploadComplete(data);
            } else {
                const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
                setFiles(prev => prev.map(f => f.status === 'uploading' ? { ...f, status: 'error', progress: 0, message: errorData.detail || 'Upload failed' } : f));
            }
        } catch (error) {
            clearInterval(progressInterval);
            console.error("Upload error:", error);
            setFiles(prev => prev.map(f => f.status === 'uploading' ? { ...f, status: 'error', progress: 0, message: 'Network error' } : f));
        } finally {
            setIsUploading(false);
        }
    };

    const hasPending = files.some(f => f.status === 'pending');
    const hasUploading = files.some(f => f.status === 'uploading');

    return (
        <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
            <div
                className={cn(
                    "relative group border-2 border-dashed rounded-3xl transition-all duration-300",
                    files.length > 0 ? "p-4" : "p-10",
                    isDragging ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 ring-4 ring-indigo-500/10" : "border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50/30 dark:bg-slate-900/20",
                    isUploading && "opacity-50 pointer-events-none"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className={cn("flex items-center gap-4 text-left", files.length > 0 ? "flex-row justify-center" : "flex-col")}>
                    <div className={cn(
                        "rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner group-hover:scale-110 transition-transform",
                        files.length > 0 ? "h-10 w-10" : "h-16 w-16"
                    )}>
                        <Upload className={cn(files.length > 0 ? "h-5 w-5" : "h-8 w-8")} />
                    </div>
                    <div className={files.length > 0 ? "flex-1" : "text-center"}>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {files.length > 0 ? "Add more sources" : "Drop your sources here"}
                        </h3>
                        {files.length === 0 && (
                            <p className="mt-1 text-xs text-slate-500 font-medium max-w-[240px]">
                                PDFs, Word, PPTs, Text, or even entire folders
                            </p>
                        )}
                    </div>
                    <div className={cn("flex gap-2.5", files.length === 0 && "mt-2")}>
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-xs"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            Select Files
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-xs"
                            onClick={() => folderInputRef.current?.click()}
                        >
                            <FolderOpen className="h-3 w-3 mr-1.5" />
                            Select Folder
                        </Button>
                    </div>
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md"
                    onChange={handleFileSelect}
                />
                <input
                    type="file"
                    ref={folderInputRef}
                    className="hidden"
                    // @ts-ignore
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={handleFolderSelect}
                />
            </div>

            {files.length > 0 && (
                <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Queue ({files.length} items)
                        </span>
                        <div className="flex gap-2">
                            {files.some(f => f.status === 'success') && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] uppercase font-bold text-indigo-500"
                                    onClick={() => setFiles(files.filter(f => f.status !== 'success'))}
                                >
                                    Clear Finished
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] uppercase font-bold text-red-500"
                                onClick={() => setFiles([])}
                            >
                                Clear All
                            </Button>
                        </div>
                    </div>
                    
                    {/* Horizontal Scroller for File Queue */}
                    <ScrollArea className="w-full border-b border-slate-200 dark:border-slate-800" type="always" bothAxes>
                        <div className="flex p-4 gap-4 min-w-max">
                            {files.map((fileStatus, index) => (
                                <div key={index} className="relative w-48 shrink-0 flex flex-col items-center p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-indigo-500/50 transition-all group shadow-sm">
                                    <div className="mb-3 relative">
                                        {getFileIcon(fileStatus.file)}
                                        {fileStatus.status === 'uploading' && (
                                            <div className="absolute -bottom-1 -right-1">
                                                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
                                            </div>
                                        )}
                                        {fileStatus.status === 'success' && (
                                            <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-0.5">
                                                <CheckCircle className="h-3 w-3 text-white" />
                                            </div>
                                        )}
                                        {fileStatus.status === 'error' && (
                                            <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-0.5">
                                                <AlertCircle className="h-3 w-3 text-white" />
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="w-full text-center space-y-1">
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate w-full px-1" title={fileStatus.file.name}>
                                            {fileStatus.file.name}
                                        </p>
                                        <p className="text-[10px] text-slate-500 font-medium">
                                            {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>

                                    {fileStatus.status === 'uploading' && (
                                        <div className="w-full mt-3 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${fileStatus.progress}%` }} />
                                        </div>
                                    )}

                                    {fileStatus.status === 'error' && (
                                        <p className="mt-2 text-[9px] font-bold text-red-500 leading-tight">
                                            {fileStatus.message}
                                        </p>
                                    )}

                                    {!isUploading && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                                            className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 bg-white dark:bg-slate-900 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm border border-slate-100 dark:border-slate-800"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </ScrollArea>

                    {(hasPending || isUploading) && (
                        <div className="p-5 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex flex-col w-full sm:w-auto">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Target Folder</label>
                                <div className="flex items-center gap-2 bg-white dark:bg-slate-950 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <FolderOpen size={14} className="text-amber-500" />
                                    <input
                                        className="bg-transparent border-none text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none placeholder:text-slate-600 w-full min-w-[150px]"
                                        placeholder="Ungrouped (click to name)"
                                        value={customFolderName}
                                        onChange={(e) => setCustomFolderName(e.target.value)}
                                    />
                                </div>
                            </div>
                            <Button
                                onClick={handleUpload}
                                disabled={isUploading || !hasPending}
                                className="w-full sm:w-auto rounded-xl px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold h-11 shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
                            >
                                {isUploading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Processing Ingestion...
                                    </>
                                ) : (
                                    'Start Ingestion'
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={cn("px-2 py-0.5 rounded-full border text-xs font-medium", className)}>
            {children}
        </div>
    );
}
