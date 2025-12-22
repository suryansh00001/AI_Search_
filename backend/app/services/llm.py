"""
LLM service using Google Gemini API with streaming.

Simple, direct implementation - no complex frameworks.
"""

import os
import asyncio
from typing import AsyncIterator
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from .structured_parser import add_generative_ui_instruction


class LLMService:
    """
    Simple wrapper for Google Gemini streaming API.
    
    Responsibilities:
    1. Initialize Gemini client with API key
    2. Stream chat completions
    3. Handle errors gracefully
    
    Why Gemini?
    - Free tier available
    - Good quality responses
    - Native streaming support
    - Simple API
    """
    
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not found in environment")
        
        genai.configure(api_key=api_key)
        
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        temperature = float(os.getenv("GEMINI_TEMPERATURE", "0.5"))
        max_tokens = int(os.getenv("GEMINI_MAX_TOKENS", "1024"))
        self.max_retries = int(os.getenv("GEMINI_MAX_RETRIES", "3"))
        
        # Initialize Gemini model
        self.model = genai.GenerativeModel(
            model_name=model_name,
            generation_config={
                "temperature": temperature,
                "top_p": 0.95,
                "top_k": 40,
                "max_output_tokens": max_tokens,
            }
        )
    
    async def stream_completion(
        self,
        user_message: str,
        context: str = ""
    ) -> AsyncIterator[str]:
        """
        Stream a chat completion from Gemini with retry logic.
        
        Args:
            user_message: The user's question/prompt
            context: Optional context from tools (search results, PDF content)
            
        Yields:
            Text chunks from the LLM
            
        Example:
            async for chunk in llm.stream_completion("What is AI?"):
                print(chunk, end="")
        """
        # Build prompt with context if available
        prompt = user_message
        if context:
            base_instruction = (
                "Use the following context to answer the user's question. "
                "Include numbered citations [1], [2], etc. when referencing sources."
            )
            # Add generative UI instruction to encourage structured data
            prompt = (
                f"{base_instruction}\n"
                f"{add_generative_ui_instruction('')}\n\n"
                f"Context:\n{context}\n\n"
                f"Question: {user_message}"
            )
        else:
            # Add generative UI instruction even without context
            prompt = add_generative_ui_instruction(user_message)
        
        retry_count = 0
        base_delay = 1.0  # Start with 1 second
        
        while retry_count <= self.max_retries:
            try:
                # Stream from Gemini
                response = await self.model.generate_content_async(
                    prompt,
                    stream=True
                )
                
                has_content = False
                async for chunk in response:
                    # Check if chunk has text before accessing it
                    if hasattr(chunk, 'text') and chunk.text:
                        has_content = True
                        yield chunk.text
                    elif hasattr(chunk, 'candidates') and chunk.candidates:
                        # Log finish reason for debugging
                        candidate = chunk.candidates[0]
                        if hasattr(candidate, 'finish_reason') and candidate.finish_reason:
                            finish_reason = candidate.finish_reason
                            # 1 = STOP (normal), 2 = MAX_TOKENS, 3 = SAFETY, 4 = RECITATION, 5 = OTHER
                            if finish_reason == 3:  # SAFETY
                                print(f"Content blocked by safety filters")
                                if not has_content:
                                    yield "\n\n[Content was blocked by safety filters. Please rephrase your question.]"
                            elif finish_reason == 2:  # MAX_TOKENS
                                print(f"Response truncated due to token limit")
                                # Notify user that response was truncated
                                if has_content:
                                    yield "\n\n[Note: Response reached maximum length limit. Try asking for a more concise answer or break your question into parts.]"
                            elif finish_reason != 1:  # Not normal STOP
                                print(f"Response ended with finish_reason: {finish_reason}")
                                # Notify user of unexpected finish reason
                                if has_content:
                                    yield f"\n\n[Note: Response ended unexpectedly (reason: {finish_reason}). Please try again.]"
                
                # Success - exit retry loop
                return
                    
            except google_exceptions.ResourceExhausted as e:
                # Rate limit hit - parse retry delay from error or use exponential backoff
                error_str = str(e)
                retry_count += 1
                
                # Try to parse retry_delay from error message
                # Format: "retry_delay { seconds: 48 }"
                wait_time = base_delay * (2 ** retry_count)  # Exponential backoff
                
                if "retry_delay" in error_str and "seconds:" in error_str:
                    try:
                        # Extract seconds from error message
                        import re
                        match = re.search(r'seconds:\s*(\d+)', error_str)
                        if match:
                            wait_time = int(match.group(1))
                    except:
                        pass
                
                if retry_count <= self.max_retries:
                    print(f"Rate limit hit. Waiting {wait_time}s before retry {retry_count}/{self.max_retries}...")
                    yield f"\n\n[Rate limit reached. Retrying in {wait_time} seconds...]\n\n"
                    await asyncio.sleep(wait_time)
                else:
                    print(f"Max retries exceeded. Rate limit: {error_str}")
                    yield f"\n\n[Error: Rate limit exceeded. Gemini free tier allows 5 requests per minute. Please wait a minute and try again.]"
                    return
                    
            except Exception as e:
                # Other errors - don't retry
                print(f"LLM streaming error: {type(e).__name__}: {str(e)}")
                yield f"\n\n[Error: Unable to complete response. Please try again.]"
                return


# Singleton instance
_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    """Get or create the LLM service singleton."""
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
