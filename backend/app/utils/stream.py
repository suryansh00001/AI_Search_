"""
Utilities for formatting Server-Sent Events (SSE).

SSE format:
    event: <event_type>
    data: <json_data>
    \n
"""

import json
from typing import Any
from app.schemas.events import StreamEvent


def format_sse(event: StreamEvent) -> str:
    """
    Format a Pydantic event model into SSE format.
    
    Args:
        event: Any event model from schemas.events
        
    Returns:
        Formatted SSE string with event type and JSON data
        
    Example:
        >>> event = ContentEvent(chunk="Hello")
        >>> format_sse(event)
        'event: content\\ndata: {"event":"content","chunk":"Hello"}\\n\\n'
    """
    event_type = event.event
    data = event.model_dump_json()
    
    return f"event: {event_type}\ndata: {data}\n\n"


def format_sse_raw(event_type: str, data: dict[str, Any]) -> str:
    """
    Format raw data into SSE format (for edge cases).
    
    Args:
        event_type: SSE event type
        data: Dictionary to serialize as JSON
        
    Returns:
        Formatted SSE string
    """
    json_data = json.dumps(data)
    return f"event: {event_type}\ndata: {json_data}\n\n"
