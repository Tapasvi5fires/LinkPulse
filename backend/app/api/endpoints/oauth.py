from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
from datetime import timedelta

from app.api import deps
from app.core import security
from app.core.config import settings
from app.crud.user import user as crud_user
from app.models.user import User

router = APIRouter()

# --- GOOGLE OAUTH ---

@router.get("/google/login")
async def google_login():
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google Client ID not configured")
    
    redirect_uri = f"{settings.BACKEND_URL}/api/v1/auth/google/callback"
    
    scope = "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}&scope={scope}&access_type=offline&prompt=consent"
    )
    return RedirectResponse(url)

@router.get("/google/callback")
async def google_callback(code: str, db: AsyncSession = Depends(deps.get_db)):
    # 1. Exchange code for token
    token_url = "https://oauth2.googleapis.com/token"
    redirect_uri = f"{settings.BACKEND_URL}/api/v1/auth/google/callback"
    
    data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }
    
    async with httpx.AsyncClient() as client:
        token_res = await client.post(token_url, data=data)
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange code for token")
        
        tokens = token_res.json()
        access_token = tokens.get("access_token")
        
        # 2. Get user info
        user_info_url = "https://www.googleapis.com/oauth2/v3/userinfo"
        user_res = await client.get(user_info_url, headers={"Authorization": f"Bearer {access_token}"})
        user_info = user_res.json()
        
    # 3. Handle user in DB
    email = user_info.get("email")
    google_id = user_info.get("sub")
    full_name = user_info.get("name")
    avatar_url = user_info.get("picture")
    
    if not email:
        raise HTTPException(status_code=400, detail="Google account has no email")
    
    # Check by google_id first
    user = await crud_user.get_by_google_id(db, google_id=google_id)
    if not user:
        # Check by email (maybe they already have a password account)
        user = await crud_user.get_by_email(db, email=email)
        if user:
            # Link existing account to Google
            user.google_id = google_id
            if not user.avatar_url: user.avatar_url = avatar_url
            db.add(user)
            await db.commit()
        else:
            # Create new user
            user = await crud_user.create_oauth(
                db, email=email, full_name=full_name, avatar_url=avatar_url, google_id=google_id
            )
            
    # 4. Issue LinkPulse Token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    lp_token = security.create_access_token(user.id, expires_delta=access_token_expires)
    
    # 5. Redirect back to frontend with token
    return RedirectResponse(f"{settings.FRONTEND_URL}/login?token={lp_token}")

# --- GITHUB OAUTH ---

@router.get("/github/login")
async def github_login():
    if not settings.GITHUB_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GitHub Client ID not configured")
    
    url = f"https://github.com/login/oauth/authorize?client_id={settings.GITHUB_CLIENT_ID}&scope=user:email"
    return RedirectResponse(url)

@router.get("/github/callback")
async def github_callback(code: str, db: AsyncSession = Depends(deps.get_db)):
    # 1. Exchange code for token
    token_url = "https://github.com/login/oauth/access_token"
    headers = {"Accept": "application/json"}
    data = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "client_secret": settings.GITHUB_CLIENT_SECRET,
        "code": code,
    }
    
    async with httpx.AsyncClient() as client:
        token_res = await client.post(token_url, data=data, headers=headers)
        tokens = token_res.json()
        access_token = tokens.get("access_token")
        
        # 2. Get user info
        user_res = await client.get("https://api.github.com/user", headers={"Authorization": f"Bearer {access_token}"})
        user_info = user_res.json()
        github_id = str(user_info.get("id"))
        full_name = user_info.get("name") or user_info.get("login")
        avatar_url = user_info.get("avatar_url")
        
        # 3. Get email (might be private)
        email_res = await client.get("https://api.github.com/user/emails", headers={"Authorization": f"Bearer {access_token}"})
        emails = email_res.json()
        
        primary_email = None
        if isinstance(emails, list) and len(emails) > 0:
            primary_email = next((e["email"] for e in emails if e.get("primary")), emails[0].get("email"))
        else:
            # Fallback to public email if available in user_info
            primary_email = user_info.get("email")

    if not primary_email:
        raise HTTPException(status_code=400, detail="GitHub account has no email or access denied")
        
    # 4. Handle user in DB
    user = await crud_user.get_by_github_id(db, github_id=github_id)
    if not user:
        user = await crud_user.get_by_email(db, email=primary_email)
        if user:
            user.github_id = github_id
            if not user.avatar_url: user.avatar_url = avatar_url
            db.add(user)
            await db.commit()
        else:
            user = await crud_user.create_oauth(
                db, email=primary_email, full_name=full_name, avatar_url=avatar_url, github_id=github_id
            )
            
    # 5. Issue Token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    lp_token = security.create_access_token(user.id, expires_delta=access_token_expires)
    
    return RedirectResponse(f"{settings.FRONTEND_URL}/login?token={lp_token}")
