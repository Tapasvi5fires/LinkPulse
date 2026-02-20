'use client';

import { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";

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

export function MultiFileUpload({ onUploadComplete, folderName }: MultiFileUploadProps) {
    const [files, setFiles] = useState<FileStatus[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            addFiles(Array.from(e.target.files));
        }
    };

    const addFiles = (newFiles: File[]) => {
        const pdfFiles = newFiles.filter(f => f.type === 'application/pdf');
        if (pdfFiles.length < newFiles.length) {
            alert("Only PDF files are supported.");
        }

        setFiles(prev => [
            ...prev,
            ...pdfFiles.map(f => ({ file: f, status: 'pending' as const, progress: 0 }))
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
                    const newProgress = Math.min(f.progress + Math.random() * 10, 90);
                    return { ...f, progress: newProgress };
                }
                return f;
            }));
        }, 500);

        pendingFiles.forEach(f => {
            formData.append('files', f.file);
        });

        // Append folder name if provided
        if (folderName && folderName.trim()) {
            formData.append('folder_name', folderName.trim());
        }

        try {
            const response = await fetch('http://localhost:8090/api/v1/ingestion/upload', {
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
                if (response.status === 401 || response.status === 403) {
                    alert("Session expired. Please log in again.");
                    // Optional: Redirect to login if router is available, but alert is good for now
                    setFiles(prev => prev.map(f => f.status === 'uploading' ? { ...f, status: 'error', progress: 0, message: 'Session expired' } : f));
                } else {
                    const errorData = await response.json();
                    setFiles(prev => prev.map(f => f.status === 'uploading' ? { ...f, status: 'error', progress: 0, message: errorData.detail || 'Upload failed' } : f));
                }
            }
        } catch (error) {
            clearInterval(progressInterval);
            console.error("Upload error:", error);
            setFiles(prev => prev.map(f => f.status === 'uploading' ? { ...f, status: 'error', progress: 0, message: 'Network error' } : f));
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
            <div
                className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                    isDragging ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300 dark:border-gray-700",
                    isUploading && "opacity-50 pointer-events-none"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Drag & drop PDFs here, or click to select
                </p>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    accept=".pdf"
                    onChange={handleFileSelect}
                />
            </div>

            {files.length > 0 && (
                <ScrollArea className="max-h-[300px] pr-4">
                    <div className="space-y-2 pb-1">
                        {files.map((fileStatus, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-100 dark:border-gray-700">
                                <div className="flex items-center space-x-3 overflow-hidden">
                                    <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                    <span className="text-sm truncate max-w-[200px]">{fileStatus.file.name}</span>
                                    <span className="text-xs text-gray-500">({(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                </div>

                                <div className="flex-1 px-4">
                                    {fileStatus.status === 'uploading' && (
                                        <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                            <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${fileStatus.progress}%` }}></div>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center space-x-2">
                                    {fileStatus.status === 'uploading' && <span className="text-xs text-gray-500">{Math.round(fileStatus.progress)}%</span>}
                                    {fileStatus.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                                    {fileStatus.status === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}

                                    {fileStatus.status !== 'uploading' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                                            className="text-gray-400 hover:text-red-500"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            )}

            {files.length > 0 && (
                <div className="flex justify-end pt-4">
                    <button
                        onClick={handleUpload}
                        disabled={isUploading || files.every(f => f.status === 'success')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                        {isUploading ? 'Uploading...' : 'Upload & Ingest'}
                    </button>
                </div>
            )}
        </div>
    );
}
