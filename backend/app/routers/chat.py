"""
Chat router - the orchestrator for streaming responses.

This is where the main logic lives:
1. Analyze user message
2. Decide which tools to call (explicit logic, no agents)
3. Emit SSE events as work progresses
4. Stream LLM response with context

Now with queue system for rate limit protection.
"""

import asyncio
import time
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import AsyncIterator
import os

from app.services.llm import get_llm_service
from app.services.search import search_web, format_search_context, SearchResponse
from app.services.pdf import read_pdf, format_pdf_context, PDFContent
from app.services.queue import get_queue_manager
from app.services.structured_parser import StructuredDataParser
from app.schemas.events import (
    ToolStartEvent,
    ToolEndEvent,
    CitationEvent,
    ContentEvent,
    DoneEvent,
)
from app.utils.stream import format_sse
import json


router = APIRouter()


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""
    message: str


def should_search(message: str) -> bool:
    """
    Simple heuristic to determine if we should search.
    
    In production, you could:
    - Use an LLM call to decide
    - Use more sophisticated keyword matching
    - Let user explicitly trigger with commands
    
    For now: search if message is a question or contains certain keywords.
    """
    message_lower = message.lower()
    
    # Questions usually need search
    question_words = ["what", "who", "where", "when", "why", "how", "is", "are", "does", "do"]
    if any(message_lower.startswith(word) for word in question_words):
        return True
    
    # Explicit search keywords
    search_keywords = ["search", "find", "look up", "latest", "news", "current"]
    if any(keyword in message_lower for keyword in search_keywords):
        return True
    
    return False


# Request throttling (free tier: 5 requests per minute = 1 request every 12 seconds)
_last_request_time = 0
_request_lock = asyncio.Lock()
_min_interval = int(os.getenv("MIN_REQUEST_INTERVAL", "12"))  # seconds between requests


async def throttle_request():
    """
    Ensure minimum interval between API requests to avoid rate limits.
    
    Free tier allows 5 requests/minute = 1 request every 12 seconds.
    This prevents hitting rate limits by spacing out requests.
    """
    global _last_request_time
    
    async with _request_lock:
        current_time = time.time()
        time_since_last = current_time - _last_request_time
        
        if time_since_last < _min_interval:
            wait_time = _min_interval - time_since_last
            print(f"Throttling request. Waiting {wait_time:.1f}s to avoid rate limit...")
            await asyncio.sleep(wait_time)
        
        _last_request_time = time.time()


def extract_pdf_url(message: str) -> str | None:
    """
    Extract PDF URL from message if present.
    
    Simple pattern matching - could be enhanced with regex.
    """
    words = message.split()
    for word in words:
        if word.endswith(".pdf") or ".pdf" in word:
            # Clean up common formatting
            url = word.strip("()[]<>\"',")
            if url.startswith("http"):
                return url
    return None


async def generate_stream_response(message: str) -> AsyncIterator[str]:
    """
    Main orchestration function - handles the entire chat flow.
    
    Flow:
    1. Analyze message → decide which tools to use
    2. Execute tools with progress events
    3. Build context from tool results
    4. Stream LLM response
    5. Emit done event
    
    Yields:
        SSE-formatted strings
    """
    llm = get_llm_service()
    context_parts: list[str] = []
    citation_index = 1
    
    # Get max results from env
    max_results = int(os.getenv("MAX_SEARCH_RESULTS", "3"))
    
    # --- Step 1: Search (if needed) ---
    search_response: SearchResponse | None = None
    
    if should_search(message):
        # Emit tool start
        yield format_sse(ToolStartEvent(
            tool="web_search",
            message="Searching the web..."
        ))
        
        try:
            search_response = search_web(message, max_results=max_results)
            
            # Emit tool end
            yield format_sse(ToolEndEvent(
                tool="web_search"
            ))
            
            # Emit citations for top results
            for result in search_response["results"][:max_results]:
                yield format_sse(CitationEvent(
                    index=citation_index,
                    url=result["url"],
                    title=result["title"],
                    snippet=result["snippet"][:200]  # Short preview
                ))
                citation_index += 1
            
            # Add to context
            context_parts.append(format_search_context(search_response))
            
        except Exception as e:
            # If search fails, continue without it
            yield format_sse(ToolEndEvent(
                tool_name="web_search",
                result_summary=f"Search unavailable"
            ))
    
    # --- Step 2: PDF Reading (if URL present) ---
    pdf_url = extract_pdf_url(message)
    pdf_content: PDFContent | None = None
    
    if pdf_url:
        yield format_sse(ToolStartEvent(
            tool="reading_pdf",
            message="Reading PDF document..."
        ))
        
        try:
            pdf_content = read_pdf(pdf_url)
            
            yield format_sse(ToolEndEvent(
                tool="reading_pdf"
            ))
            
            # Emit citation for PDF
            # Generate stable PDF ID from URL
            import hashlib
            pdf_id = hashlib.md5(pdf_content["url"].encode()).hexdigest()[:8]
            
            yield format_sse(CitationEvent(
                index=citation_index,
                url=pdf_content["url"],
                title=pdf_content["title"],
                snippet=f"PDF document - {pdf_content['num_pages']} pages",
                pdf_id=pdf_id,
                page_number=1  # Default to page 1, could be enhanced later
            ))
            citation_index += 1
            
            # Add to context
            context_parts.append(format_pdf_context(pdf_content))
            
        except Exception as e:
            yield format_sse(ToolEndEvent(
                tool="reading_pdf"
            ))
    
    # --- Step 3: Synthesizing Answer ---
    yield format_sse(ToolStartEvent(
        tool="synthesizing_answer",
        message="Generating answer..."
    ))
    
    # --- Step 4: Stream LLM Response ---
    context = "\n\n---\n\n".join(context_parts) if context_parts else ""
    
    try:
        chunk_count = 0
        accumulated_text = ""  # Accumulate text to parse for structured data
        parser = StructuredDataParser()
        
        async for chunk in llm.stream_completion(message, context):
            accumulated_text += chunk
            yield format_sse(ContentEvent(chunk=chunk))
            chunk_count += 1
            
            # Send keepalive comment every 50 chunks to prevent timeout
            if chunk_count % 50 == 0:
                yield ": keepalive\n\n"
        
        # After streaming completes, parse for structured data
        if accumulated_text:
            print(f"\n=== Parsing accumulated text ===")
            print(f"Text length: {len(accumulated_text)}")
            print(f"First 500 chars: {accumulated_text[:500]}")
            
            cleaned_text, structured_items = parser.parse(accumulated_text)
            
            # Send multiple structured_data events if found
            if structured_items:
                print(f"✓ Found {len(structured_items)} structured data items")
                for item in structured_items:
                    print(f"  - Type: {item['type']}, Data: {item}")
                    # Send each item as a separate structured_data event
                    yield f"event: structured_data\ndata: {json.dumps(item)}\n\n"
            else:
                print("✗ No structured data found")
                
    except Exception as e:
        print(f"Error during streaming: {str(e)}")  # Log to backend
        yield format_sse(ContentEvent(
            chunk=f"\n\n[Error: {str(e)}]"
        ))
    
    # End synthesis indicator
    yield format_sse(ToolEndEvent(
        tool="synthesizing_answer"
    ))
    
    # --- Step 5: Done ---
    yield format_sse(DoneEvent())


async def fake_stream_demo(message: str) -> AsyncIterator[str]:
    """
    DEMO: Fake streaming to understand SSE without AI complexity.
    
    This simulates the full flow with fake data and delays.
    Perfect for testing the frontend before connecting real AI.
    
    Flow:
    1. Emit tool_start (simulate search starting)
    2. Wait 1 second (simulate search API call)
    3. Emit tool_end + citations (simulate search results)
    4. Stream fake content chunks (simulate AI response)
    5. Emit done
    """
    
    # Step 1: Simulate search starting
    yield format_sse(ToolStartEvent(
        tool_name="search",
        display_message="Searching the web..."
    ))
    
    # Step 2: Simulate search API delay
    await asyncio.sleep(1)
    
    # Step 3: Simulate search completion with results
    yield format_sse(ToolEndEvent(
        tool_name="search",
        result_summary="Found 3 results"
    ))
    
    # Emit fake citations
    fake_sources = [
        {
            "title": "FastAPI Official Documentation",
            "url": "https://fastapi.tiangolo.com",
            "snippet": "FastAPI is a modern, fast web framework for building APIs"
        },
        {
            "title": "FastAPI GitHub Repository",
            "url": "https://github.com/tiangolo/fastapi",
            "snippet": "FastAPI framework, high performance, easy to learn"
        },
        {
            "title": "Real Python: FastAPI Tutorial",
            "url": "https://realpython.com/fastapi-python-web-apis/",
            "snippet": "Build modern APIs with Python and FastAPI"
        }
    ]
    
    for idx, source in enumerate(fake_sources, start=1):
        yield format_sse(CitationEvent(
            index=idx,
            url=source["url"],
            title=source["title"],
            snippet=source["snippet"]
        ))
    
    # Step 4: Stream fake AI response (word by word)
    fake_response = (
        "FastAPI is a modern, fast (high-performance) web framework "
        "for building APIs with Python 3.7+ based on standard Python "
        "type hints [1]. It's designed to be easy to use and learn, "
        "while also being production-ready [2]. Key features include "
        "automatic API documentation, data validation using Pydantic, "
        "and async support [3]."
    )
    
    words = fake_response.split()
    for word in words:
        yield format_sse(ContentEvent(chunk=word + " "))
        await asyncio.sleep(0.05)  # Simulate streaming delay
    
    # Step 5: Signal completion
    yield format_sse(DoneEvent())


@router.get("/stream/demo")
async def chat_stream_demo(query: str):
    """
    DEMO endpoint - fake streaming without AI.
    
    Use this to test SSE functionality without API keys.
    
    Request:
        GET /chat/stream/demo?query=What+is+FastAPI
    
    Response:
        Server-Sent Events stream with fake data
    """
    return StreamingResponse(
        fake_stream_demo(query),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable buffering in nginx
        }
    )


@router.get("/stream")
async def chat_stream(query: str):
    """
    Main chat endpoint - streams SSE response with REAL AI.
    
    This uses the real LLM streaming and tool execution.
    Requires GOOGLE_API_KEY and optionally TAVILY_API_KEY in .env
    
    Request:
        GET /chat/stream?query=What+is+FastAPI
    
    Response:
        Server-Sent Events stream with multiple event types
    """
    return StreamingResponse(
        generate_stream_response(query),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


# --- Queue-Based Endpoints (New) ---

@router.post("/queue")
async def enqueue_request(request: ChatRequest):
    """
    Enqueue a chat request and return job ID immediately.
    
    This endpoint accepts requests and returns immediately with a job ID.
    Use /queue/stream/{job_id} to stream results.
    
    Request:
        POST /chat/queue
        Body: {"message": "What is FastAPI?"}
    
    Response:
        {
            "job_id": "uuid",
            "status": "queued",
            "message": "Request queued successfully"
        }
    """
    queue_manager = get_queue_manager()
    job_id = await queue_manager.enqueue(request.message)
    
    return {
        "job_id": job_id,
        "status": "queued",
        "message": "Request queued successfully"
    }


@router.get("/queue/{job_id}/status")
async def get_job_status(job_id: str):
    """
    Get current status of a queued job.
    
    Request:
        GET /chat/queue/{job_id}/status
    
    Response:
        {
            "job_id": "uuid",
            "query": "What is FastAPI?",
            "status": "queued|processing|completed|failed",
            "created_at": "2025-12-22T10:30:00",
            "queue_position": 2
        }
    """
    queue_manager = get_queue_manager()
    status = queue_manager.get_job_status(job_id)
    
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return status


@router.get("/queue/{job_id}/stream")
async def stream_job_results(job_id: str):
    """
    Stream results for a queued job via SSE.
    
    This endpoint will:
    1. Send status updates while job is queued
    2. Stream SSE events once job starts processing
    3. Complete when job finishes
    
    Request:
        GET /chat/queue/{job_id}/stream
    
    Response:
        Server-Sent Events stream
        
    Event types:
        - status: Job status updates (queued:N, processing)
        - tool_start/tool_end/citation/content/done: Normal SSE events
        - error: Error message
    """
    queue_manager = get_queue_manager()
    
    async def stream_wrapper():
        async for event_type, data in queue_manager.stream_results(job_id):
            if event_type == "status":
                # Send status as comment (non-standard but works)
                yield f": {data}\n\n"
            elif event_type == "data":
                # Forward SSE chunks directly
                yield data
            elif event_type == "error":
                # Send error event
                yield f"event: error\ndata: {data}\n\n"
                break
            elif event_type == "done":
                break
    
    return StreamingResponse(
        stream_wrapper(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )
