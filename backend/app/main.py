"""
FastAPI main application.

Simple setup:
- CORS for frontend
- Environment variables
- Health check
- Chat router
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
import httpx

from app.routers import chat


# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="Perplexity-Style AI Search",
    description="Streaming AI chat with search and PDF reading capabilities",
    version="1.0.0"
)

# CORS configuration - adjust origins for production
# For development: allow all origins (including file:// for test HTML)
# In production, lock this down to specific domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for testing
    allow_credentials=False,  # Must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router, prefix="/chat", tags=["chat"])


@app.get("/")
async def root():
    """Root endpoint - health check."""
    return {
        "status": "ok",
        "message": "Perplexity-style AI Search API",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/api/pdf-proxy")
async def pdf_proxy(url: str):
    """
    Proxy endpoint to fetch PDFs and serve them with proper CORS headers.
    This resolves CORS issues when loading PDFs from external sources.
    
    Args:
        url: The URL of the PDF to fetch
        
    Returns:
        StreamingResponse with PDF content and proper headers
    """
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
            
            # Check if it's actually a PDF
            content_type = response.headers.get('content-type', '')
            if 'pdf' not in content_type.lower():
                raise HTTPException(
                    status_code=400, 
                    detail=f"URL does not point to a PDF file. Content-Type: {content_type}"
                )
            
            # Return PDF with proper CORS headers
            return StreamingResponse(
                iter([response.content]),
                media_type="application/pdf",
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                    "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
                }
            )
    
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Failed to fetch PDF: {str(e)}"
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching PDF: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
