"""
SSE Event schemas for streaming chat responses.

Each event type corresponds to a specific UI state:
- tool_start: Show loading indicator for tool execution
- tool_end: Hide loading indicator, optionally show result
- citation: Register a source for inline citation [1], [2]
- content: Stream AI text chunks (delta format)
- done: Signal completion, close stream
"""

from pydantic import BaseModel
from typing import Literal, Optional


class ToolStartEvent(BaseModel):
    """Emitted when a tool starts executing."""
    event: Literal["tool_start"] = "tool_start"
    tool: str  # "web_search", "reading_pdf", "synthesizing_answer"
    message: str  # "Searching the web...", "Reading PDF..."


class ToolEndEvent(BaseModel):
    """Emitted when a tool completes execution."""
    event: Literal["tool_end"] = "tool_end"
    tool: str  # "web_search", "reading_pdf", "synthesizing_answer"


class CitationEvent(BaseModel):
    """Emitted to register a source for citation."""
    event: Literal["citation"] = "citation"
    index: int  # 1, 2, 3... (for [1], [2], [3])
    url: str
    title: str
    snippet: Optional[str] = None  # Optional preview text
    
    # PDF-specific fields (optional)
    pdf_id: Optional[str] = None  # Unique ID for PDF (hash of URL or filename)
    page_number: Optional[int] = None  # Specific page number if known


class ContentEvent(BaseModel):
    """Emitted for each chunk of AI-generated text."""
    event: Literal["content"] = "content"
    chunk: str  # Delta text chunk


class DoneEvent(BaseModel):
    """Emitted when streaming is complete."""
    event: Literal["done"] = "done"
    message: str = "Stream complete"


# Union type for all events (useful for type checking)
StreamEvent = ToolStartEvent | ToolEndEvent | CitationEvent | ContentEvent | DoneEvent
