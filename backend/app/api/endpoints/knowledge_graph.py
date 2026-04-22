from fastapi import APIRouter, Depends
from app.api import deps
from app.models.user import User
from app.services.processing.vector_db import vector_db
import logging
from typing import List, Dict, Any
from collections import defaultdict

logger = logging.getLogger(__name__)
router = APIRouter()


def _extract_source_info(meta: dict) -> dict:
    """Extract clean source info from a vector metadata entry."""
    source_url = meta.get("source_url") or meta.get("url") or ""
    source_type = meta.get("source_type", "file")
    title = meta.get("title", "")
    repo = meta.get("repo", "")
    path = meta.get("path", "")
    folder_name = meta.get("folder_name", "")

    # Build a display label
    if title:
        label = title
    elif path:
        label = path.split("/")[-1] if "/" in path else path.split("\\")[-1] if "\\" in path else path
    elif source_url:
        parts = source_url.replace("\\", "/").split("/")
        fname = parts[-1] if parts else source_url
        # Strip UUID prefix if present (pattern: 36char_filename)
        if len(fname) > 37 and fname[36] == "_":
            fname = fname[37:]
        label = fname
    else:
        label = "Unknown"

    return {
        "source_url": source_url,
        "source_type": source_type,
        "title": title,
        "label": label,
        "repo": repo,
        "path": path,
        "folder_name": folder_name,
    }


@router.get("/")
async def get_knowledge_graph(
    current_user: User = Depends(deps.get_current_active_user),
):
    """
    Build a knowledge graph from all ingested sources.
    Returns nodes (sources) and edges (connections based on shared repos, folders, types).
    """
    try:
        # Filter metadata by user_id
        metadata = vector_db.get_user_metadata(current_user.id)

        # --- Step 1: Aggregate chunks into unique sources ---
        source_map: Dict[str, Dict[str, Any]] = {}
        chunk_counts: Dict[str, int] = defaultdict(int)

        for _idx, meta in metadata.items():
            info = _extract_source_info(meta)
            url = info["source_url"]
            if not url:
                continue

            chunk_counts[url] += 1

            if url not in source_map:
                source_map[url] = info

        # --- Step 2: Build nodes ---
        nodes = []
        url_to_id: Dict[str, int] = {}

        for i, (url, info) in enumerate(source_map.items()):
            url_to_id[url] = i
            nodes.append({
                "id": i,
                "label": info["label"],
                "type": info["source_type"],
                "url": url,
                "repo": info["repo"],
                "folder": info["folder_name"],
                "path": info["path"],
                "chunks": chunk_counts[url],
                "size": min(max(chunk_counts[url], 3), 30),  # Node visual size
            })

        # --- Step 3: Build edges ---
        edges = []
        edge_set = set()

        def add_edge(src_id: int, tgt_id: int, relationship: str, weight: float):
            key = (min(src_id, tgt_id), max(src_id, tgt_id), relationship)
            if key not in edge_set:
                edge_set.add(key)
                edges.append({
                    "source": src_id,
                    "target": tgt_id,
                    "relationship": relationship,
                    "weight": weight,
                })

        # Group by repo
        repo_groups: Dict[str, List[int]] = defaultdict(list)
        folder_groups: Dict[str, List[int]] = defaultdict(list)
        type_groups: Dict[str, List[int]] = defaultdict(list)

        for node in nodes:
            nid = node["id"]
            if node["repo"]:
                repo_groups[node["repo"]].append(nid)
            if node["folder"]:
                folder_groups[node["folder"]].append(nid)
            type_groups[node["type"]].append(nid)

        # Same repo → strong edges
        for repo, nids in repo_groups.items():
            for i in range(len(nids)):
                for j in range(i + 1, min(i + 8, len(nids))):  # Cap edges per group
                    add_edge(nids[i], nids[j], "same_repo", 0.9)

        # Same folder → strong edges
        for folder, nids in folder_groups.items():
            for i in range(len(nids)):
                for j in range(i + 1, min(i + 8, len(nids))):
                    add_edge(nids[i], nids[j], "same_folder", 0.8)

        # Same type → weak edges (only if small set, max 3 per node)
        for stype, nids in type_groups.items():
            if len(nids) <= 15:
                for i in range(len(nids)):
                    for j in range(i + 1, min(i + 4, len(nids))):
                        add_edge(nids[i], nids[j], "same_type", 0.3)

        # --- Step 4: Stats ---
        type_dist = {}
        for stype, nids in type_groups.items():
            type_dist[stype] = len(nids)

        # Most connected node
        connection_count = defaultdict(int)
        for edge in edges:
            connection_count[edge["source"]] += 1
            connection_count[edge["target"]] += 1

        most_connected = None
        if connection_count:
            mc_id = max(connection_count, key=connection_count.get)
            mc_node = next((n for n in nodes if n["id"] == mc_id), None)
            if mc_node:
                most_connected = {
                    "label": mc_node["label"],
                    "connections": connection_count[mc_id],
                    "type": mc_node["type"],
                }

        stats = {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "total_chunks": sum(chunk_counts.values()),
            "type_distribution": type_dist,
            "most_connected": most_connected,
        }

        return {"nodes": nodes, "edges": edges, "stats": stats}

    except Exception as e:
        logger.error(f"Error building knowledge graph: {e}", exc_info=True)
        return {"nodes": [], "edges": [], "stats": {"total_nodes": 0, "total_edges": 0, "total_chunks": 0, "type_distribution": {}, "most_connected": None}}
