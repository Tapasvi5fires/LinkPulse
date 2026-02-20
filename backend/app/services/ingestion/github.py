import subprocess
import tempfile
import shutil
from typing import List
import os
import logging
from datetime import datetime
from app.services.ingestion.base import BaseIngestor, IngestedDocument

logger = logging.getLogger(__name__)

class GitHubIngestor(BaseIngestor):
    """
    Ingest a GitHub repository by cloning it locally (no API rate limits).
    Supports public repos. Format: 'owner/repo'
    """
    
    # File extensions to ingest
    VALID_EXTENSIONS = (
        # Documentation
        ".md", ".txt", ".rst", ".adoc",
        # Python
        ".py",
        # JavaScript / TypeScript
        ".js", ".ts", ".tsx", ".jsx", ".mjs", ".cjs",
        # Web
        ".html", ".css", ".scss", ".less", ".vue", ".svelte",
        # JVM
        ".java", ".kt", ".scala", ".gradle",
        # Systems
        ".cpp", ".c", ".h", ".hpp", ".cs", ".go", ".rs", ".swift",
        # Scripting
        ".rb", ".php", ".pl", ".sh", ".bash", ".zsh", ".ps1",
        # Config
        ".yaml", ".yml", ".json", ".toml", ".ini", ".cfg", ".env.example",
        # Data
        ".sql", ".graphql",
        # Other
        ".r", ".jl", ".dart", ".lua",
    )
    
    # Directories to skip
    SKIP_DIRS = {
        'node_modules', '.git', '__pycache__', '.venv', 'venv', 'env',
        '.next', 'dist', 'build', '.cache', '.tox', '.eggs',
        'vendor', 'bower_components', '.idea', '.vscode',
    }
    
    MAX_FILE_SIZE = 500_000  # 500KB per file

    async def ingest(self, source: str, **kwargs) -> List[IngestedDocument]:
        """
        Clone a GitHub repository and read all supported files.
        source: 'owner/repo' (e.g., 'facebook/react')
        """
        documents = []
        clone_url = f"https://github.com/{source}.git"
        tmp_dir = tempfile.mkdtemp(prefix="linkpulse_git_")
        
        try:
            logger.info(f"Cloning repository: {clone_url}")
            
            # Shallow clone (depth=1) for speed — only latest commit
            result = subprocess.run(
                ["git", "clone", "--depth", "1", "--single-branch", clone_url, tmp_dir],
                capture_output=True,
                text=True,
                timeout=120  # 2 minute timeout
            )
            
            if result.returncode != 0:
                logger.error(f"Git clone failed: {result.stderr}")
                raise Exception(f"Failed to clone repository: {result.stderr.strip()}")
            
            logger.info(f"Successfully cloned {source}. Scanning files...")
            
            # Walk the cloned directory
            file_count = 0
            for root, dirs, files in os.walk(tmp_dir):
                # Skip unwanted directories (modify dirs in-place to prevent recursion)
                dirs[:] = [d for d in dirs if d not in self.SKIP_DIRS]
                
                for filename in files:
                    filepath = os.path.join(root, filename)
                    rel_path = os.path.relpath(filepath, tmp_dir)
                    
                    # Check extension
                    if not filename.endswith(self.VALID_EXTENSIONS):
                        continue
                    
                    # Check file size
                    try:
                        file_size = os.path.getsize(filepath)
                        if file_size > self.MAX_FILE_SIZE:
                            logger.warning(f"Skipping large file {rel_path}: {file_size} bytes")
                            continue
                        if file_size < 10:
                            continue  # Skip near-empty files
                    except OSError:
                        continue
                    
                    # Read file content
                    try:
                        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                        
                        if not content.strip():
                            continue
                        
                        # Build GitHub URL for this file
                        github_url = f"https://github.com/{source}/blob/main/{rel_path.replace(os.sep, '/')}"
                        
                        documents.append(IngestedDocument(
                            content=content,
                            source_url=github_url,
                            source_type="github",
                            metadata={
                                "repo": source,
                                "path": rel_path.replace(os.sep, '/'),
                                "filename": filename,
                                "file_size": file_size,
                                "ingested_at": datetime.utcnow().isoformat()
                            }
                        ))
                        file_count += 1
                        
                    except Exception as read_error:
                        logger.warning(f"Error reading {rel_path}: {read_error}")
            
            logger.info(f"Extracted {file_count} files from {source}")
                    
        except subprocess.TimeoutExpired:
            logger.error(f"Clone timed out for {source}")
            raise Exception(f"Repository clone timed out (>2 min). Repo may be too large.")
        except Exception as e:
            logger.error(f"Error ingesting GitHub repo {source}: {e}")
            raise e
        finally:
            # Always clean up the temp directory
            try:
                shutil.rmtree(tmp_dir, ignore_errors=True)
                logger.info(f"Cleaned up temp clone directory")
            except Exception:
                pass
            
        return documents
