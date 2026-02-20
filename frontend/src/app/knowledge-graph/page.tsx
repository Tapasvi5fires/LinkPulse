'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Share2, X, Search, Loader2, ZoomIn, ZoomOut, Maximize, RotateCcw,
    Github, FileText, Globe, Youtube, Instagram, FolderOpen,
    Link2, Layers, Hash, ChevronRight, ExternalLink, Network,
    Sparkles, MousePointer, Move, Grip, Info, Eye, EyeOff
} from 'lucide-react';

// ===== Types =====
interface GraphNode {
    id: number;
    label: string;
    type: string;
    url: string;
    repo: string;
    folder: string;
    path: string;
    chunks: number;
    size: number;
    // Simulation runtime
    x: number;
    y: number;
    vx: number;
    vy: number;
    fx?: number | null;
    fy?: number | null;
}

interface GraphEdge {
    source: number;
    target: number;
    relationship: string;
    weight: number;
}

interface GraphStats {
    total_nodes: number;
    total_edges: number;
    total_chunks: number;
    type_distribution: Record<string, number>;
    most_connected: { label: string; connections: number; type: string } | null;
}

// ===== Colors =====
const TYPE_COLORS: Record<string, { main: string; light: string; label: string }> = {
    'github': { main: '#64748b', light: '#94a3b8', label: 'GitHub' },
    'pdf': { main: '#ef4444', light: '#fca5a5', label: 'PDF' },
    'website': { main: '#3b82f6', light: '#93c5fd', label: 'Website' },
    'youtube': { main: '#f97316', light: '#fdba74', label: 'YouTube' },
    'instagram': { main: '#ec4899', light: '#f9a8d4', label: 'Instagram' },
    'file': { main: '#a855f7', light: '#d8b4fe', label: 'File' },
};
const DEFAULT_TC = { main: '#8b5cf6', light: '#c4b5fd', label: 'Other' };
const getTC = (t: string) => TYPE_COLORS[t] || DEFAULT_TC;

const REL_COLORS: Record<string, string> = {
    'same_repo': '#6366f1',
    'same_folder': '#f59e0b',
    'same_type': '#64748b',
};

// ===== Component =====
export default function KnowledgeGraphPage() {
    // Data
    const [nodes, setNodes] = useState<GraphNode[]>([]);
    const [edges, setEdges] = useState<GraphEdge[]>([]);
    const [stats, setStats] = useState<GraphStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Interaction state
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [showLabels, setShowLabels] = useState(true);
    const [showEdgeLabels, setShowEdgeLabels] = useState(false);

    // Canvas state
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const animFrameRef = useRef<number>(0);

    // Transform (zoom/pan)
    const transformRef = useRef({ x: 0, y: 0, scale: 1 });
    const [transformDisplay, setTransformDisplay] = useState({ scale: 1 });

    // Drag state
    const dragRef = useRef<{
        type: 'none' | 'pan' | 'node';
        nodeId: number | null;
        startX: number;
        startY: number;
        lastX: number;
        lastY: number;
    }>({ type: 'none', nodeId: null, startX: 0, startY: 0, lastX: 0, lastY: 0 });

    // Simulation
    const simRef = useRef<{
        nodes: GraphNode[];
        edges: GraphEdge[];
        alpha: number;
        running: boolean;
    }>({ nodes: [], edges: [], alpha: 1, running: false });

    // ===== Fetch data =====
    useEffect(() => {
        const fetchGraph = async () => {
            try {
                setLoading(true);
                const token = localStorage.getItem('token');
                const headers: HeadersInit = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;
                const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';
                const res = await fetch(`${apiUrl}/api/v1/knowledge-graph`, { headers });
                if (!res.ok) throw new Error('Failed to fetch graph data');
                const data = await res.json();

                // Initialize positions randomly in a circle
                const nodeCount = data.nodes.length;
                const radius = Math.max(200, nodeCount * 15);
                const initializedNodes: GraphNode[] = data.nodes.map((n: any, i: number) => {
                    const angle = (2 * Math.PI * i) / nodeCount;
                    return {
                        ...n,
                        x: radius * Math.cos(angle) + (Math.random() - 0.5) * 50,
                        y: radius * Math.sin(angle) + (Math.random() - 0.5) * 50,
                        vx: 0,
                        vy: 0,
                    };
                });

                setNodes(initializedNodes);
                setEdges(data.edges);
                setStats(data.stats);
                setError(null);

                // Start simulation
                simRef.current = {
                    nodes: initializedNodes,
                    edges: data.edges,
                    alpha: 1,
                    running: true,
                };
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchGraph();
    }, []);

    // ===== Force simulation =====
    const simulate = useCallback(() => {
        const sim = simRef.current;
        if (!sim.running || sim.alpha < 0.001) return;

        const ns = sim.nodes;
        const es = sim.edges;
        const centerX = 0, centerY = 0;
        const repulsion = 3000;
        const attraction = 0.005;
        const centerPull = 0.01;
        const damping = 0.85;

        // Reset forces
        for (const n of ns) {
            if (n.fx != null) { n.x = n.fx; n.vx = 0; }
            if (n.fy != null) { n.y = n.fy; n.vy = 0; }
        }

        // Repulsion (all pairs)
        for (let i = 0; i < ns.length; i++) {
            for (let j = i + 1; j < ns.length; j++) {
                const dx = ns[j].x - ns[i].x;
                const dy = ns[j].y - ns[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = repulsion / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                if (ns[i].fx == null) { ns[i].vx -= fx; }
                if (ns[i].fy == null) { ns[i].vy -= fy; }
                if (ns[j].fx == null) { ns[j].vx += fx; }
                if (ns[j].fy == null) { ns[j].vy += fy; }
            }
        }

        // Attraction along edges
        for (const e of es) {
            const src = ns.find(n => n.id === e.source);
            const tgt = ns.find(n => n.id === e.target);
            if (!src || !tgt) continue;
            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const idealDist = e.weight > 0.5 ? 120 : 200;
            const force = (dist - idealDist) * attraction * e.weight;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (src.fx == null) { src.vx += fx; }
            if (src.fy == null) { src.vy += fy; }
            if (tgt.fx == null) { tgt.vx -= fx; }
            if (tgt.fy == null) { tgt.vy -= fy; }
        }

        // Center pull
        for (const n of ns) {
            if (n.fx == null) n.vx += (centerX - n.x) * centerPull;
            if (n.fy == null) n.vy += (centerY - n.y) * centerPull;
        }

        // Apply velocity
        for (const n of ns) {
            if (n.fx == null) {
                n.vx *= damping;
                n.x += n.vx * sim.alpha;
            }
            if (n.fy == null) {
                n.vy *= damping;
                n.y += n.vy * sim.alpha;
            }
        }

        sim.alpha *= 0.995;
    }, []);

    // ===== Filtering =====
    const filteredNodeIds = useMemo(() => {
        const ids = new Set<number>();
        const q = searchQuery.toLowerCase();
        for (const n of nodes) {
            if (typeFilter !== 'all' && n.type !== typeFilter) continue;
            if (q && !n.label.toLowerCase().includes(q) && !n.url.toLowerCase().includes(q) && !n.repo.toLowerCase().includes(q)) continue;
            ids.add(n.id);
        }
        return ids;
    }, [nodes, typeFilter, searchQuery]);

    const filteredEdges = useMemo(() => {
        return edges.filter(e => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));
    }, [edges, filteredNodeIds]);

    // ===== Get connections for selected node =====
    const selectedConnections = useMemo(() => {
        if (!selectedNode) return [];
        return edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
            .map(e => {
                const connId = e.source === selectedNode.id ? e.target : e.source;
                const connNode = nodes.find(n => n.id === connId);
                return { edge: e, node: connNode };
            }).filter(c => c.node);
    }, [selectedNode, edges, nodes]);

    // ===== Canvas to world coords =====
    const screenToWorld = useCallback((sx: number, sy: number): [number, number] => {
        const t = transformRef.current;
        return [(sx - t.x) / t.scale, (sy - t.y) / t.scale];
    }, []);

    const findNodeAt = useCallback((wx: number, wy: number): GraphNode | null => {
        const sim = simRef.current;
        let closest: GraphNode | null = null;
        let closestDist = Infinity;
        for (const n of sim.nodes) {
            if (!filteredNodeIds.has(n.id)) continue;
            const dx = n.x - wx;
            const dy = n.y - wy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const radius = Math.max(n.size || 5, 8);
            if (dist < radius + 5 && dist < closestDist) {
                closest = n;
                closestDist = dist;
            }
        }
        return closest;
    }, [filteredNodeIds]);

    // ===== Mouse handlers =====
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const t = transformRef.current;
            const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
            const newScale = Math.max(0.1, Math.min(10, t.scale * zoomFactor));

            // Zoom towards cursor
            t.x = mx - (mx - t.x) * (newScale / t.scale);
            t.y = my - (my - t.y) * (newScale / t.scale);
            t.scale = newScale;
            setTransformDisplay({ scale: newScale });
        };

        const handleMouseDown = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const [wx, wy] = screenToWorld(sx, sy);
            const node = findNodeAt(wx, wy);

            if (node) {
                dragRef.current = { type: 'node', nodeId: node.id, startX: sx, startY: sy, lastX: sx, lastY: sy };
                node.fx = node.x;
                node.fy = node.y;
                simRef.current.alpha = Math.max(simRef.current.alpha, 0.3);
            } else {
                dragRef.current = { type: 'pan', nodeId: null, startX: sx, startY: sy, lastX: sx, lastY: sy };
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const drag = dragRef.current;

            if (drag.type === 'pan') {
                const t = transformRef.current;
                t.x += sx - drag.lastX;
                t.y += sy - drag.lastY;
                drag.lastX = sx;
                drag.lastY = sy;
                canvas.style.cursor = 'grabbing';
            } else if (drag.type === 'node' && drag.nodeId !== null) {
                const [wx, wy] = screenToWorld(sx, sy);
                const node = simRef.current.nodes.find(n => n.id === drag.nodeId);
                if (node) {
                    node.fx = wx;
                    node.fy = wy;
                    node.x = wx;
                    node.y = wy;
                    simRef.current.alpha = Math.max(simRef.current.alpha, 0.1);
                }
                canvas.style.cursor = 'grabbing';
            } else {
                // Hover detection
                const [wx, wy] = screenToWorld(sx, sy);
                const hNode = findNodeAt(wx, wy);
                setHoveredNode(hNode);
                canvas.style.cursor = hNode ? 'pointer' : 'default';
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            const drag = dragRef.current;
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;

            if (drag.type === 'node' && drag.nodeId !== null) {
                const node = simRef.current.nodes.find(n => n.id === drag.nodeId);
                if (node) {
                    // If barely moved, treat as click
                    const dx = sx - drag.startX;
                    const dy = sy - drag.startY;
                    if (Math.sqrt(dx * dx + dy * dy) < 5) {
                        setSelectedNode(prev => prev?.id === node.id ? null : node);
                    }
                    node.fx = null;
                    node.fy = null;
                }
            } else if (drag.type === 'pan') {
                const dx = sx - drag.startX;
                const dy = sy - drag.startY;
                if (Math.sqrt(dx * dx + dy * dy) < 3) {
                    // Click on empty space → deselect
                    setSelectedNode(null);
                }
            }

            dragRef.current = { type: 'none', nodeId: null, startX: 0, startY: 0, lastX: 0, lastY: 0 };
            canvas.style.cursor = 'default';
        };

        const handleMouseLeave = () => {
            if (dragRef.current.type === 'node' && dragRef.current.nodeId !== null) {
                const node = simRef.current.nodes.find(n => n.id === dragRef.current.nodeId);
                if (node) { node.fx = null; node.fy = null; }
            }
            dragRef.current = { type: 'none', nodeId: null, startX: 0, startY: 0, lastX: 0, lastY: 0 };
            setHoveredNode(null);
        };

        canvas.addEventListener('wheel', handleWheel, { passive: false });
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            canvas.removeEventListener('wheel', handleWheel);
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [screenToWorld, findNodeAt, filteredNodeIds]);

    // ===== Render loop =====
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let running = true;
        const render = () => {
            if (!running) return;

            // Resize canvas
            const container = containerRef.current;
            if (container) {
                const dpr = window.devicePixelRatio || 1;
                const w = container.clientWidth;
                const h = container.clientHeight;
                if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
                    canvas.width = w * dpr;
                    canvas.height = h * dpr;
                    canvas.style.width = w + 'px';
                    canvas.style.height = h + 'px';
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

                    // Center on first load
                    if (transformRef.current.x === 0 && transformRef.current.y === 0) {
                        transformRef.current.x = w / 2;
                        transformRef.current.y = h / 2;
                    }
                }
            }

            // Run simulation
            simulate();

            const t = transformRef.current;
            const w = canvas.clientWidth;
            const h = canvas.clientHeight;

            // Clear
            ctx.clearRect(0, 0, w, h);

            // Background
            ctx.fillStyle = '#0a0e1a';
            ctx.fillRect(0, 0, w, h);

            // Grid dots
            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.scale(t.scale, t.scale);

            const gridSize = 60;
            const startX = Math.floor(-t.x / t.scale / gridSize) * gridSize - gridSize;
            const startY = Math.floor(-t.y / t.scale / gridSize) * gridSize - gridSize;
            const endX = startX + w / t.scale + gridSize * 2;
            const endY = startY + h / t.scale + gridSize * 2;

            ctx.fillStyle = 'rgba(100,116,139,0.08)';
            for (let gx = startX; gx < endX; gx += gridSize) {
                for (let gy = startY; gy < endY; gy += gridSize) {
                    ctx.beginPath();
                    ctx.arc(gx, gy, 1, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            const sim = simRef.current;

            // Draw edges
            for (const e of filteredEdges) {
                const src = sim.nodes.find(n => n.id === e.source);
                const tgt = sim.nodes.find(n => n.id === e.target);
                if (!src || !tgt) continue;

                const isConnectedToSelected = selectedNode && (e.source === selectedNode.id || e.target === selectedNode.id);
                const isConnectedToHovered = hoveredNode && (e.source === hoveredNode.id || e.target === hoveredNode.id);

                ctx.beginPath();
                ctx.moveTo(src.x, src.y);
                ctx.lineTo(tgt.x, tgt.y);

                if (isConnectedToSelected) {
                    ctx.strokeStyle = REL_COLORS[e.relationship] || '#6366f1';
                    ctx.lineWidth = 2.5 / t.scale;
                    ctx.globalAlpha = 0.8;
                } else if (isConnectedToHovered) {
                    ctx.strokeStyle = REL_COLORS[e.relationship] || '#94a3b8';
                    ctx.lineWidth = 2 / t.scale;
                    ctx.globalAlpha = 0.6;
                } else if (selectedNode || hoveredNode) {
                    ctx.strokeStyle = '#334155';
                    ctx.lineWidth = 0.5 / t.scale;
                    ctx.globalAlpha = 0.2;
                } else {
                    ctx.strokeStyle = REL_COLORS[e.relationship] || '#475569';
                    ctx.lineWidth = (e.weight > 0.5 ? 1.5 : 0.8) / t.scale;
                    ctx.globalAlpha = e.weight > 0.5 ? 0.25 : 0.12;
                }
                ctx.stroke();
                ctx.globalAlpha = 1;

                // Edge label
                if (showEdgeLabels && (isConnectedToSelected || isConnectedToHovered) && t.scale > 0.8) {
                    const mx = (src.x + tgt.x) / 2;
                    const my = (src.y + tgt.y) / 2;
                    const label = e.relationship === 'same_repo' ? 'Same Repo' : e.relationship === 'same_folder' ? 'Same Folder' : 'Same Type';
                    const fs = Math.max(9, 11 / t.scale);
                    ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const tw = ctx.measureText(label).width + 8;
                    ctx.fillStyle = 'rgba(15,23,42,0.85)';
                    roundRect(ctx, mx - tw / 2, my - fs / 2 - 3, tw, fs + 6, 4);
                    ctx.fill();
                    ctx.fillStyle = REL_COLORS[e.relationship] || '#94a3b8';
                    ctx.fillText(label, mx, my);
                }
            }

            // Draw nodes
            for (const n of sim.nodes) {
                if (!filteredNodeIds.has(n.id)) continue;
                if (!isFinite(n.x) || !isFinite(n.y)) continue;

                const tc = getTC(n.type);
                const baseSize = Math.max(n.size || 5, 5);
                const isHovered = hoveredNode?.id === n.id;
                const isSelected = selectedNode?.id === n.id;
                const isSearchMatch = searchQuery && n.label.toLowerCase().includes(searchQuery.toLowerCase());
                const isConnectedToSelected = selectedNode && edges.some(e =>
                    (e.source === selectedNode.id && e.target === n.id) || (e.target === selectedNode.id && e.source === n.id));
                const isDimmed = (selectedNode || hoveredNode) && !isSelected && !isHovered && !isConnectedToSelected &&
                    !(hoveredNode && edges.some(e => (e.source === hoveredNode.id && e.target === n.id) || (e.target === hoveredNode.id && e.source === n.id)));

                // Outer glow
                if (isSelected || isHovered || isSearchMatch) {
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, baseSize + 8, 0, Math.PI * 2);
                    ctx.fillStyle = isSelected ? 'rgba(99,102,241,0.25)' : isSearchMatch ? 'rgba(234,179,8,0.25)' : 'rgba(255,255,255,0.15)';
                    ctx.fill();
                }

                // Pulse ring for selected
                if (isSelected) {
                    const pulseSize = baseSize + 12 + Math.sin(Date.now() / 300) * 3;
                    ctx.beginPath();
                    ctx.arc(n.x, n.y, pulseSize, 0, Math.PI * 2);
                    ctx.strokeStyle = 'rgba(99,102,241,0.3)';
                    ctx.lineWidth = 1.5 / t.scale;
                    ctx.stroke();
                }

                // Main node
                ctx.beginPath();
                ctx.arc(n.x, n.y, baseSize, 0, Math.PI * 2);
                ctx.fillStyle = isDimmed ? '#334155' : tc.main;
                ctx.globalAlpha = isDimmed ? 0.3 : 1;
                ctx.fill();

                // Inner highlight
                ctx.beginPath();
                ctx.arc(n.x - baseSize * 0.25, n.y - baseSize * 0.25, baseSize * 0.45, 0, Math.PI * 2);
                ctx.fillStyle = isDimmed ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.25)';
                ctx.fill();

                // Border
                ctx.beginPath();
                ctx.arc(n.x, n.y, baseSize, 0, Math.PI * 2);
                ctx.strokeStyle = isSelected ? '#818cf8' : isHovered ? '#fff' : isDimmed ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)';
                ctx.lineWidth = (isSelected ? 2.5 : isHovered ? 2 : 1) / t.scale;
                ctx.stroke();
                ctx.globalAlpha = 1;

                // Label
                if (showLabels && !isDimmed) {
                    const shouldShow = t.scale > 0.6 || isHovered || isSelected || isSearchMatch;
                    if (shouldShow) {
                        const fs = Math.max(9, Math.min(13, 12 / t.scale));
                        ctx.font = `${isSelected || isHovered ? '700' : '500'} ${fs}px Inter, system-ui, sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'top';

                        let label = n.label;
                        if (label.length > 25) label = label.substring(0, 23) + '…';

                        // Background pill
                        const tw = ctx.measureText(label).width + 10;
                        const lx = n.x;
                        const ly = n.y + baseSize + 4;

                        ctx.fillStyle = 'rgba(15,23,42,0.85)';
                        roundRect(ctx, lx - tw / 2, ly - 1, tw, fs + 6, 4);
                        ctx.fill();

                        ctx.fillStyle = isSelected ? '#a5b4fc' : isHovered ? '#fff' : '#cbd5e1';
                        ctx.fillText(label, lx, ly + 2);

                        // Chunk count badge
                        if ((isSelected || isHovered) && n.chunks > 0) {
                            const badge = `${n.chunks} chunks`;
                            ctx.font = `600 ${Math.max(8, 9 / t.scale)}px Inter, system-ui, sans-serif`;
                            const bw = ctx.measureText(badge).width + 8;
                            ctx.fillStyle = tc.main;
                            roundRect(ctx, lx - bw / 2, ly + fs + 8, bw, 14, 3);
                            ctx.fill();
                            ctx.fillStyle = '#fff';
                            ctx.fillText(badge, lx, ly + fs + 10);
                        }
                    }
                }
            }

            ctx.restore();

            animFrameRef.current = requestAnimationFrame(render);
        };

        animFrameRef.current = requestAnimationFrame(render);
        return () => {
            running = false;
            cancelAnimationFrame(animFrameRef.current);
        };
    }, [simulate, filteredNodeIds, filteredEdges, selectedNode, hoveredNode, nodes, edges, searchQuery, showLabels, showEdgeLabels]);

    // ===== Controls =====
    const zoomIn = () => {
        const t = transformRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const cx = canvas.clientWidth / 2;
        const cy = canvas.clientHeight / 2;
        const newScale = Math.min(10, t.scale * 1.4);
        t.x = cx - (cx - t.x) * (newScale / t.scale);
        t.y = cy - (cy - t.y) * (newScale / t.scale);
        t.scale = newScale;
        setTransformDisplay({ scale: newScale });
    };

    const zoomOut = () => {
        const t = transformRef.current;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const cx = canvas.clientWidth / 2;
        const cy = canvas.clientHeight / 2;
        const newScale = Math.max(0.1, t.scale / 1.4);
        t.x = cx - (cx - t.x) * (newScale / t.scale);
        t.y = cy - (cy - t.y) * (newScale / t.scale);
        t.scale = newScale;
        setTransformDisplay({ scale: newScale });
    };

    const centerGraph = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const t = transformRef.current;
        const sim = simRef.current;
        if (sim.nodes.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const n of sim.nodes) {
            if (!filteredNodeIds.has(n.id)) continue;
            minX = Math.min(minX, n.x);
            maxX = Math.max(maxX, n.x);
            minY = Math.min(minY, n.y);
            maxY = Math.max(maxY, n.y);
        }
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const graphW = maxX - minX + 100;
        const graphH = maxY - minY + 100;
        const scale = Math.min(w / graphW, h / graphH, 2) * 0.85;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        t.scale = scale;
        t.x = w / 2 - cx * scale;
        t.y = h / 2 - cy * scale;
        setTransformDisplay({ scale });
    };

    const reheatSimulation = () => {
        simRef.current.alpha = 1;
    };

    // Auto-center on first load
    useEffect(() => {
        if (!loading && nodes.length > 0) {
            const timer = setTimeout(centerGraph, 800);
            return () => clearTimeout(timer);
        }
    }, [loading, nodes.length]);

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col md:ml-64 bg-[#0a0e1a] relative">
                {/* Header */}
                <header className="flex h-14 items-center justify-between px-5 bg-[#0f1629]/90 backdrop-blur-xl border-b border-slate-800/50 z-20">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/20">
                            <Share2 size={16} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-white">Knowledge Graph</h1>
                            <p className="text-[10px] text-slate-500">
                                {loading ? 'Loading...' : stats ? `${stats.total_nodes} sources • ${stats.total_edges} connections • ${stats.total_chunks} chunks` : 'No data'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <div className="relative w-48">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search sources..."
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-700/50 bg-slate-800/50 text-[11px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                                    <X size={12} className="text-slate-500 hover:text-slate-300" />
                                </button>
                            )}
                        </div>

                        {/* Toggle labels */}
                        <button onClick={() => setShowLabels(!showLabels)}
                            className={`p-2 rounded-lg border transition-all ${showLabels ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400' : 'border-slate-700/50 text-slate-500 hover:text-slate-300'}`}
                            title={showLabels ? 'Hide Labels' : 'Show Labels'}>
                            {showLabels ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>

                        {/* Toggle edge labels */}
                        <button onClick={() => setShowEdgeLabels(!showEdgeLabels)}
                            className={`p-2 rounded-lg border transition-all ${showEdgeLabels ? 'bg-amber-600/20 border-amber-500/30 text-amber-400' : 'border-slate-700/50 text-slate-500 hover:text-slate-300'}`}
                            title={showEdgeLabels ? 'Hide Edge Labels' : 'Show Edge Labels'}>
                            <Link2 size={14} />
                        </button>
                    </div>
                </header>

                {/* Type Filter */}
                <div className="flex items-center gap-1.5 px-5 py-2 bg-[#0f1629]/60 border-b border-slate-800/30">
                    {[
                        { label: 'All', value: 'all', count: stats?.total_nodes || 0 },
                        ...Object.entries(stats?.type_distribution || {}).map(([type, count]) => ({
                            label: getTC(type).label,
                            value: type,
                            count: count as number,
                        }))
                    ].filter(f => f.count > 0).map(f => {
                        const tc = getTC(f.value);
                        const isActive = typeFilter === f.value;
                        return (
                            <button
                                key={f.value}
                                onClick={() => setTypeFilter(f.value)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${isActive
                                    ? 'bg-slate-700/80 text-white ring-1 ring-slate-600'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                                    }`}
                            >
                                {f.value !== 'all' && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tc.main }} />}
                                {f.label} <span className="opacity-50">{f.count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Main */}
                <div className="flex-1 flex relative overflow-hidden">
                    {/* Canvas */}
                    <div ref={containerRef} className="flex-1 relative">
                        {loading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0e1a]">
                                <div className="relative">
                                    <div className="absolute -inset-8 bg-gradient-to-r from-violet-500/20 to-indigo-500/20 rounded-full blur-2xl animate-pulse" />
                                    <div className="relative p-6 bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50">
                                        <Loader2 size={28} className="animate-spin text-indigo-400 mx-auto mb-3" />
                                        <p className="text-sm font-medium text-slate-300">Building Knowledge Graph...</p>
                                        <p className="text-[10px] text-slate-500 mt-1">Analyzing source connections</p>
                                    </div>
                                </div>
                            </div>
                        ) : error ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e1a]">
                                <div className="p-8 bg-slate-800/50 rounded-2xl border border-red-500/20 text-center max-w-sm">
                                    <Network size={36} className="text-red-400 mx-auto mb-3" />
                                    <p className="text-sm font-semibold text-white mb-1">Failed to load graph</p>
                                    <p className="text-xs text-slate-400">{error}</p>
                                </div>
                            </div>
                        ) : nodes.length === 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e1a]">
                                <div className="p-10 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-center max-w-md">
                                    <Share2 size={44} className="text-slate-600 mx-auto mb-3" />
                                    <h3 className="text-lg font-bold text-white mb-2">No Sources Found</h3>
                                    <p className="text-sm text-slate-400">Add documents in the Dashboard to see your knowledge graph.</p>
                                </div>
                            </div>
                        ) : (
                            <canvas
                                ref={canvasRef}
                                className="absolute inset-0 w-full h-full"
                            />
                        )}

                        {/* Zoom Controls */}
                        {!loading && !error && nodes.length > 0 && (
                            <div className="absolute bottom-5 left-5 flex flex-col gap-0.5 bg-slate-800/80 backdrop-blur-xl rounded-xl border border-slate-700/50 shadow-2xl overflow-hidden">
                                <button onClick={zoomIn} className="p-2.5 hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors" title="Zoom In">
                                    <ZoomIn size={15} />
                                </button>
                                <div className="h-px bg-slate-700/40 mx-1" />
                                <button onClick={zoomOut} className="p-2.5 hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors" title="Zoom Out">
                                    <ZoomOut size={15} />
                                </button>
                                <div className="h-px bg-slate-700/40 mx-1" />
                                <button onClick={centerGraph} className="p-2.5 hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors" title="Fit to View">
                                    <Maximize size={15} />
                                </button>
                                <div className="h-px bg-slate-700/40 mx-1" />
                                <button onClick={reheatSimulation} className="p-2.5 hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors" title="Re-layout">
                                    <RotateCcw size={15} />
                                </button>
                            </div>
                        )}

                        {/* Zoom level indicator */}
                        {!loading && nodes.length > 0 && (
                            <div className="absolute bottom-5 left-20 bg-slate-800/70 backdrop-blur-sm rounded-lg px-2.5 py-1 border border-slate-700/30">
                                <span className="text-[10px] font-mono text-slate-400">{Math.round(transformDisplay.scale * 100)}%</span>
                            </div>
                        )}

                        {/* Legend */}
                        {!loading && nodes.length > 0 && !selectedNode && (
                            <div className="absolute bottom-5 right-5 bg-slate-800/80 backdrop-blur-xl rounded-xl border border-slate-700/50 p-3 shadow-xl">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Node Types</p>
                                <div className="space-y-1">
                                    {Object.entries(stats?.type_distribution || {}).map(([type, count]) => (
                                        <div key={type} className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getTC(type).main }} />
                                            <span className="text-[10px] text-slate-300">{getTC(type).label}</span>
                                            <span className="text-[10px] text-slate-600 ml-auto">{count as number}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="h-px bg-slate-700/50 my-2" />
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Connections</p>
                                <div className="space-y-1">
                                    {[
                                        { label: 'Same Repo', color: REL_COLORS['same_repo'] },
                                        { label: 'Same Folder', color: REL_COLORS['same_folder'] },
                                        { label: 'Same Type', color: REL_COLORS['same_type'] },
                                    ].map(r => (
                                        <div key={r.label} className="flex items-center gap-2">
                                            <div className="w-4 h-0.5 rounded" style={{ backgroundColor: r.color }} />
                                            <span className="text-[10px] text-slate-400">{r.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Stats Cards */}
                        {!loading && stats && stats.total_nodes > 0 && (
                            <div className="absolute top-4 left-4 flex gap-2">
                                {[
                                    { label: 'Sources', value: stats.total_nodes, icon: Layers, color: 'from-violet-500 to-indigo-500' },
                                    { label: 'Links', value: stats.total_edges, icon: Link2, color: 'from-cyan-500 to-blue-500' },
                                    { label: 'Chunks', value: stats.total_chunks, icon: Hash, color: 'from-amber-500 to-orange-500' },
                                ].map(c => (
                                    <div key={c.label} className="bg-slate-800/70 backdrop-blur-xl rounded-lg border border-slate-700/40 px-3 py-2 shadow-lg">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <div className={`p-1 rounded bg-gradient-to-br ${c.color}`}>
                                                <c.icon size={9} className="text-white" />
                                            </div>
                                            <span className="text-[9px] text-slate-500 font-medium">{c.label}</span>
                                        </div>
                                        <p className="text-base font-bold text-white">{c.value.toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Instructions Tooltip */}
                        {!loading && nodes.length > 0 && !selectedNode && (
                            <div className="absolute top-4 right-4 bg-slate-800/70 backdrop-blur-xl rounded-lg border border-slate-700/40 px-3 py-2 shadow-lg max-w-[200px]">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Controls</p>
                                <div className="space-y-1 text-[10px] text-slate-400">
                                    <div className="flex items-center gap-2"><MousePointer size={10} /> Click node to inspect</div>
                                    <div className="flex items-center gap-2"><Move size={10} /> Drag to move nodes</div>
                                    <div className="flex items-center gap-2"><Grip size={10} /> Drag empty space to pan</div>
                                    <div className="flex items-center gap-2"><ZoomIn size={10} /> Scroll to zoom</div>
                                </div>
                            </div>
                        )}

                        {/* Most Connected */}
                        {!loading && stats?.most_connected && !selectedNode && (
                            <div className="absolute top-[90px] left-4 bg-slate-800/70 backdrop-blur-xl rounded-lg border border-indigo-500/20 px-3 py-2 shadow-lg max-w-[180px]">
                                <div className="flex items-center gap-1 mb-0.5">
                                    <Sparkles size={10} className="text-indigo-400" />
                                    <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Hub Node</span>
                                </div>
                                <p className="text-[11px] font-semibold text-white truncate">{stats.most_connected.label}</p>
                                <p className="text-[10px] text-slate-500">{stats.most_connected.connections} connections</p>
                            </div>
                        )}
                    </div>

                    {/* Detail Panel */}
                    {selectedNode && (
                        <div className="w-[360px] bg-[#0f1629]/95 backdrop-blur-xl border-l border-slate-700/40 flex flex-col shadow-2xl animate-in slide-in-from-right-5 duration-200">
                            {/* Header */}
                            <div className="p-4 border-b border-slate-800/50">
                                <div className="flex items-center justify-between mb-2">
                                    <Badge variant="outline" className="text-[9px] uppercase tracking-wider" style={{ borderColor: getTC(selectedNode.type).main + '60', color: getTC(selectedNode.type).light, backgroundColor: getTC(selectedNode.type).main + '15' }}>
                                        <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: getTC(selectedNode.type).main }} />
                                        {getTC(selectedNode.type).label}
                                    </Badge>
                                    <button onClick={() => setSelectedNode(null)} className="p-1 hover:bg-slate-800 rounded-md transition-colors">
                                        <X size={14} className="text-slate-500" />
                                    </button>
                                </div>
                                <h2 className="text-sm font-bold text-white leading-snug">{selectedNode.label}</h2>
                                {selectedNode.repo && (
                                    <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1.5"><Github size={10} /> {selectedNode.repo}</p>
                                )}
                                {selectedNode.folder && (
                                    <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1"><FolderOpen size={10} /> {selectedNode.folder}</p>
                                )}
                                {selectedNode.path && (
                                    <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1 font-mono truncate"><FileText size={10} /> {selectedNode.path}</p>
                                )}
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-3 gap-2 p-4">
                                <div className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/30 text-center">
                                    <p className="text-[9px] text-slate-500">Chunks</p>
                                    <p className="text-lg font-bold text-white">{selectedNode.chunks}</p>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/30 text-center">
                                    <p className="text-[9px] text-slate-500">Links</p>
                                    <p className="text-lg font-bold text-white">{selectedConnections.length}</p>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-2.5 border border-slate-700/30 text-center">
                                    <p className="text-[9px] text-slate-500">Size</p>
                                    <p className="text-lg font-bold text-white">{selectedNode.size}</p>
                                </div>
                            </div>

                            {/* URL */}
                            {selectedNode.url && (
                                <div className="px-4 pb-3">
                                    <p className="text-[9px] text-slate-600 font-medium mb-1">Source URL</p>
                                    <div className="flex items-center gap-2 px-2.5 py-2 bg-slate-800/40 rounded-lg border border-slate-700/20">
                                        <Link2 size={11} className="text-slate-500 shrink-0" />
                                        <span className="text-[10px] text-slate-400 truncate font-mono flex-1">{selectedNode.url}</span>
                                        {selectedNode.url.startsWith('http') && (
                                            <a href={selectedNode.url} target="_blank" rel="noreferrer" className="shrink-0 hover:text-indigo-400 text-slate-600 transition-colors">
                                                <ExternalLink size={11} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Connections */}
                            <div className="flex-1 overflow-hidden flex flex-col px-4 pb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider">
                                        Connected Sources ({selectedConnections.length})
                                    </p>
                                </div>
                                <ScrollArea className="flex-1">
                                    <div className="space-y-1 pr-1">
                                        {selectedConnections.map((conn, i) => {
                                            const cn = conn.node!;
                                            const tc = getTC(cn.type);
                                            const relLabel = conn.edge.relationship === 'same_repo' ? 'Same Repo' :
                                                conn.edge.relationship === 'same_folder' ? 'Same Folder' : 'Same Type';
                                            const relColor = REL_COLORS[conn.edge.relationship] || '#64748b';
                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => {
                                                        setSelectedNode(cn);
                                                        const t = transformRef.current;
                                                        const canvas = canvasRef.current;
                                                        if (canvas) {
                                                            const w = canvas.clientWidth;
                                                            const h = canvas.clientHeight;
                                                            t.x = w / 2 - cn.x * t.scale;
                                                            t.y = h / 2 - cn.y * t.scale;
                                                        }
                                                    }}
                                                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-800/30 hover:bg-slate-800/60 border border-slate-700/20 hover:border-slate-600/40 cursor-pointer transition-all group"
                                                >
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tc.main }} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-medium text-slate-300 truncate group-hover:text-white">{cn.label}</p>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: relColor + '20', color: relColor }}>{relLabel}</span>
                                                            <span className="text-[9px] text-slate-600">{cn.chunks} chunks</span>
                                                        </div>
                                                    </div>
                                                    <ChevronRight size={12} className="text-slate-700 group-hover:text-slate-400 shrink-0" />
                                                </div>
                                            );
                                        })}
                                        {selectedConnections.length === 0 && (
                                            <div className="text-center py-6">
                                                <Share2 size={18} className="text-slate-700 mx-auto mb-1.5" />
                                                <p className="text-[11px] text-slate-600">No connections</p>
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper: rounded rect
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
