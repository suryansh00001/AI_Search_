"""
PDF reading tool - simple text extraction.

No embeddings, no chunking, no vector stores - just extract text.
Can be enhanced later if needed.
"""

import io
import os
import requests
from typing import TypedDict
from PyPDF2 import PdfReader


class PDFContent(TypedDict):
    """Extracted PDF content."""
    url: str
    title: str  # Extracted from metadata or filename
    text: str
    num_pages: int


def read_pdf(url: str, max_chars: int | None = None) -> PDFContent:
    """
    Download and extract text from a PDF URL.
    
    Args:
        url: URL to PDF file
        max_chars: Maximum characters to extract (prevent huge PDFs). Defaults to env MAX_PDF_CHARS or 50000
        
    Returns:
        PDFContent with extracted text and metadata
        
    Raises:
        ValueError: If URL is not accessible or not a PDF
        
    Example:
        >>> content = read_pdf("https://example.com/paper.pdf")
        >>> print(content["text"][:100])
    """
    # Download PDF
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        raise ValueError(f"Failed to download PDF: {str(e)}")
    
    # Check content type
    content_type = response.headers.get("content-type", "")
    if "pdf" not in content_type.lower():
        # Some servers don't set correct content-type, so we'll try anyway
        pass
    
    # Parse PDF
    try:
        # Use env variable or default to 50000 characters (~25-30 pages)
        if max_chars is None:
            max_chars = int(os.getenv("MAX_PDF_CHARS", "50000"))
        
        pdf_file = io.BytesIO(response.content)
        reader = PdfReader(pdf_file)
        
        # Extract metadata
        metadata = reader.metadata
        title = ""
        if metadata and metadata.title:
            title = metadata.title
        else:
            # Fallback: use last part of URL as title
            title = url.split("/")[-1].replace(".pdf", "")
        
        # Extract text from all pages
        text_parts = []
        total_chars = 0
        
        for page_num, page in enumerate(reader.pages, 1):
            page_text = page.extract_text()
            if total_chars + len(page_text) > max_chars:
                # Truncate to max_chars
                remaining = max_chars - total_chars
                text_parts.append(page_text[:remaining])
                print(f"PDF truncated at page {page_num}/{len(reader.pages)} (reached {max_chars} char limit)")
                break
            text_parts.append(page_text)
            total_chars += len(page_text)
        
        text = "\n\n".join(text_parts)
        
        return {
            "url": url,
            "title": title,
            "text": text,
            "num_pages": len(reader.pages)
        }
        
    except Exception as e:
        raise ValueError(f"Failed to parse PDF: {str(e)}")


def format_pdf_context(pdf_content: PDFContent) -> str:
    """
    Format PDF content into context string for LLM.
    
    Args:
        pdf_content: Content from read_pdf()
        
    Returns:
        Formatted context string
    """
    return (
        f"PDF Document: {pdf_content['title']}\n"
        f"URL: {pdf_content['url']}\n"
        f"Pages: {pdf_content['num_pages']}\n\n"
        f"Content:\n{pdf_content['text']}"
    )
