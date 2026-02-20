from typing import Any, List
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.api import deps
from app.services.retrieval.search import search_service
from app.models.user import User

router = APIRouter()

class SearchRequest(BaseModel):
    query: str
    k: int = 5

class SearchResponse(BaseModel):
    results: List[Any]

@router.post("/", response_model=SearchResponse)
async def search(
    request: SearchRequest,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Search for documents.
    """
    results = search_service.search(request.query, k=request.k)
    return {"results": results}
