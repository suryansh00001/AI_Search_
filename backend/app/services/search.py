"""
Web search tool using Tavily API.

Simple, explicit function - no frameworks, no magic.
"""

import os
from typing import TypedDict
from functools import lru_cache
from tavily import TavilyClient


class SearchResult(TypedDict):
    """Single search result from Tavily."""
    title: str
    url: str
    snippet: str
    score: float  # Relevance score


class SearchResponse(TypedDict):
    """Response from search tool."""
    query: str
    results: list[SearchResult]
    answer: str  # Tavily's AI-generated answer (optional to use)


@lru_cache(maxsize=100)
def search_web(query: str, max_results: int = 5) -> SearchResponse:
    """
    Search the web using Tavily API.
    
    Args:
        query: Search query
        max_results: Maximum number of results to return
        
    Returns:
        SearchResponse with results and optional AI answer
        
    Raises:
        ValueError: If TAVILY_API_KEY is not set
        
    Example:
        >>> results = search_web("What is FastAPI?")
        >>> print(results["results"][0]["title"])
        'FastAPI - Official Documentation'
    """
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        raise ValueError("TAVILY_API_KEY not found in environment")
    
    client = TavilyClient(api_key=api_key)
    
    # Tavily search with answer generation
    response = client.search(
        query=query,
        max_results=max_results,
        include_answer=True  # Get AI-generated answer
    )
    
    # Format results into our typed structure
    results: list[SearchResult] = []
    for result in response.get("results", []):
        results.append({
            "title": result.get("title", ""),
            "url": result.get("url", ""),
            "snippet": result.get("content", "")[:500],  # Limit snippet length
            "score": result.get("score", 0.0)
        })
    
    return {
        "query": query,
        "results": results,
        "answer": response.get("answer", "")
    }


def format_search_context(search_response: SearchResponse) -> str:
    """
    Format search results into context string for LLM.
    
    Args:
        search_response: Response from search_web()
        
    Returns:
        Formatted context string
    """
    context_parts = [f"Search results for: {search_response['query']}\n"]
    
    for idx, result in enumerate(search_response["results"], start=1):
        context_parts.append(
            f"[{idx}] {result['title']}\n"
            f"URL: {result['url']}\n"
            f"Content: {result['snippet']}\n"
        )
    
    return "\n".join(context_parts)
