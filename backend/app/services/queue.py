"""
Queue Manager for handling concurrent requests with rate limiting.

Uses asyncio.Queue to:
1. Accept requests immediately and return job ID
2. Process requests sequentially to avoid rate limits
3. Stream results via SSE as they're generated
"""

import asyncio
import uuid
from typing import Dict, AsyncIterator, Optional
from dataclasses import dataclass
from datetime import datetime
import time


@dataclass
class QueueJob:
    """Represents a queued chat request."""
    job_id: str
    query: str
    created_at: datetime
    status: str = "queued"  # queued, processing, completed, failed
    result_queue: asyncio.Queue = None
    
    def __post_init__(self):
        if self.result_queue is None:
            self.result_queue = asyncio.Queue()


class QueueManager:
    """
    Manages a queue of chat requests to prevent rate limit issues.
    
    Features:
    - Immediate job ID return
    - Sequential processing with rate limiting
    - SSE streaming per job
    - Job status tracking
    """
    
    def __init__(self, max_workers: int = 1, min_interval: float = 12.0):
        """
        Args:
            max_workers: Number of concurrent workers (1 for free tier)
            min_interval: Minimum seconds between requests (12 for free tier)
        """
        self.request_queue: asyncio.Queue[QueueJob] = asyncio.Queue()
        self.jobs: Dict[str, QueueJob] = {}
        self.max_workers = max_workers
        self.min_interval = min_interval
        self.last_request_time = 0
        self.workers_started = False
        self._lock = asyncio.Lock()
    
    async def start_workers(self):
        """Start background workers to process queue."""
        if self.workers_started:
            return
        
        self.workers_started = True
        for i in range(self.max_workers):
            asyncio.create_task(self._worker(i))
        print(f"✓ Queue manager started with {self.max_workers} worker(s)")
    
    async def enqueue(self, query: str) -> str:
        """
        Enqueue a new request and return job ID immediately.
        
        Args:
            query: User's question
            
        Returns:
            job_id: Unique identifier for tracking this request
        """
        job_id = str(uuid.uuid4())
        job = QueueJob(
            job_id=job_id,
            query=query,
            created_at=datetime.now()
        )
        
        self.jobs[job_id] = job
        await self.request_queue.put(job)
        
        # Ensure workers are running
        if not self.workers_started:
            await self.start_workers()
        
        print(f"📥 Enqueued job {job_id[:8]}... Queue size: {self.request_queue.qsize()}")
        return job_id
    
    async def _worker(self, worker_id: int):
        """
        Background worker that processes queued requests.
        
        Args:
            worker_id: Worker identifier for logging
        """
        print(f"Worker {worker_id} started")
        
        while True:
            try:
                # Get next job from queue
                job = await self.request_queue.get()
                
                # Rate limiting - ensure minimum interval between requests
                async with self._lock:
                    current_time = time.time()
                    time_since_last = current_time - self.last_request_time
                    
                    if time_since_last < self.min_interval:
                        wait_time = self.min_interval - time_since_last
                        print(f"⏳ Worker {worker_id} waiting {wait_time:.1f}s (rate limit)...")
                        await asyncio.sleep(wait_time)
                    
                    self.last_request_time = time.time()
                
                # Update job status
                job.status = "processing"
                print(f"🔄 Worker {worker_id} processing job {job.job_id[:8]}...")
                
                # Import here to avoid circular dependency
                from app.routers.chat import generate_stream_response
                
                try:
                    # Process the request and stream results
                    async for chunk in generate_stream_response(job.query):
                        await job.result_queue.put(("data", chunk))
                    
                    # Signal completion
                    await job.result_queue.put(("done", None))
                    job.status = "completed"
                    print(f"✓ Worker {worker_id} completed job {job.job_id[:8]}")
                    
                except Exception as e:
                    # Signal error
                    error_msg = f"Error: {type(e).__name__}: {str(e)}"
                    await job.result_queue.put(("error", error_msg))
                    job.status = "failed"
                    print(f"✗ Worker {worker_id} failed job {job.job_id[:8]}: {error_msg}")
                
            except Exception as e:
                print(f"✗ Worker {worker_id} error: {e}")
                await asyncio.sleep(1)
    
    async def stream_results(self, job_id: str) -> AsyncIterator[tuple[str, str]]:
        """
        Stream results for a specific job.
        
        Args:
            job_id: The job identifier
            
        Yields:
            (event_type, data) tuples:
            - ("status", "queued") - Job is waiting
            - ("status", "processing") - Job started
            - ("data", chunk) - SSE chunk
            - ("done", None) - Stream completed
            - ("error", message) - Error occurred
        """
        job = self.jobs.get(job_id)
        if not job:
            yield ("error", "Job not found")
            return
        
        # Send initial status
        if job.status == "queued":
            queue_position = self.get_queue_position(job_id)
            yield ("status", f"queued:{queue_position}")
        
        # Stream results as they arrive
        while True:
            try:
                event_type, data = await asyncio.wait_for(
                    job.result_queue.get(),
                    timeout=300  # 5 minute timeout
                )
                
                yield (event_type, data)
                
                if event_type in ("done", "error"):
                    break
                    
            except asyncio.TimeoutError:
                yield ("error", "Request timeout")
                break
        
        # Cleanup job after streaming completes
        await asyncio.sleep(60)  # Keep job for 1 minute for debugging
        if job_id in self.jobs:
            del self.jobs[job_id]
    
    def get_queue_position(self, job_id: str) -> int:
        """Get position of job in queue (1-based)."""
        # This is approximate since Queue doesn't support indexing
        return self.request_queue.qsize()
    
    def get_job_status(self, job_id: str) -> Optional[dict]:
        """Get current status of a job."""
        job = self.jobs.get(job_id)
        if not job:
            return None
        
        return {
            "job_id": job.job_id,
            "query": job.query,
            "status": job.status,
            "created_at": job.created_at.isoformat(),
            "queue_position": self.get_queue_position(job_id) if job.status == "queued" else None
        }


# Global singleton instance
_queue_manager: Optional[QueueManager] = None


def get_queue_manager() -> QueueManager:
    """Get or create the queue manager singleton."""
    global _queue_manager
    if _queue_manager is None:
        import os
        max_workers = int(os.getenv("QUEUE_WORKERS", "1"))
        min_interval = float(os.getenv("MIN_REQUEST_INTERVAL", "12"))
        _queue_manager = QueueManager(max_workers=max_workers, min_interval=min_interval)
    return _queue_manager
