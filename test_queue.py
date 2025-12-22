"""
Test script for queue system and API endpoints
"""

import requests
import time
import json

BASE_URL = "http://localhost:8000"

def test_queue_system():
    """Test the queue endpoints"""
    print("\n=== Testing Queue System ===\n")
    
    # 1. Enqueue a request
    print("1. Enqueueing request...")
    response = requests.post(
        f"{BASE_URL}/chat/queue",
        json={"message": "What is machine learning?"}
    )
    
    if response.status_code == 200:
        data = response.json()
        job_id = data['job_id']
        print(f"✓ Job queued successfully!")
        print(f"  Job ID: {job_id}")
        print(f"  Status: {data['status']}")
    else:
        print(f"✗ Failed to enqueue: {response.status_code}")
        return
    
    # 2. Check status immediately
    print(f"\n2. Checking job status...")
    time.sleep(0.5)
    
    response = requests.get(f"{BASE_URL}/chat/queue/{job_id}/status")
    if response.status_code == 200:
        status_data = response.json()
        print(f"✓ Status retrieved!")
        print(f"  Status: {status_data['status']}")
        print(f"  Query: {status_data['query']}")
        if status_data.get('queue_position'):
            print(f"  Queue Position: {status_data['queue_position']}")
    else:
        print(f"✗ Status check failed: {response.status_code}")
        print(f"  (Job may have already completed)")
    
    # 3. Stream results
    print(f"\n3. Streaming results from queue...")
    print("=" * 60)
    
    try:
        response = requests.get(
            f"{BASE_URL}/chat/queue/{job_id}/stream",
            stream=True,
            timeout=60
        )
        
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data:'):
                    data_str = line_str[5:].strip()
                    if data_str:
                        try:
                            event_data = json.loads(data_str)
                            print(f"Event: {event_data.get('event', 'unknown')}")
                        except:
                            pass
                elif line_str.startswith('event:'):
                    print(line_str)
                elif line_str.startswith(':'):
                    # Status comment
                    print(f"Status: {line_str[1:].strip()}")
        
        print("=" * 60)
        print("✓ Stream completed!")
        
    except Exception as e:
        print(f"✗ Stream error: {e}")

def test_direct_stream():
    """Test the direct streaming endpoint"""
    print("\n=== Testing Direct Stream Endpoint ===\n")
    
    try:
        print("Streaming response...")
        print("=" * 60)
        
        response = requests.get(
            f"{BASE_URL}/chat/stream",
            params={"query": "What is Python?"},
            stream=True,
            timeout=60
        )
        
        event_count = 0
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('event:'):
                    event_type = line_str[6:].strip()
                    event_count += 1
                    print(f"[{event_count}] Event: {event_type}")
        
        print("=" * 60)
        print(f"✓ Direct stream completed! ({event_count} events)")
        
    except Exception as e:
        print(f"✗ Stream error: {e}")

def test_api_health():
    """Test basic API connectivity"""
    print("\n=== Testing API Health ===\n")
    
    # Test root endpoint
    try:
        response = requests.get(f"{BASE_URL}/docs")
        if response.status_code == 200:
            print("✓ Backend is running")
            print(f"  Docs available at: {BASE_URL}/docs")
        else:
            print(f"✗ Backend returned: {response.status_code}")
    except Exception as e:
        print(f"✗ Cannot connect to backend: {e}")
        return False
    
    return True

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  QUEUE SYSTEM & API TEST SUITE")
    print("=" * 60)
    
    # Test API health first
    if not test_api_health():
        print("\n✗ Backend not running. Please start it first:")
        print("  cd backend && python -m app.main")
        exit(1)
    
    # Test direct streaming (simpler)
    test_direct_stream()
    
    # Test queue system
    test_queue_system()
    
    print("\n" + "=" * 60)
    print("  TESTS COMPLETE!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Open http://localhost:3000 in your browser")
    print("2. Type a message and see the streaming response")
    print("3. Check browser DevTools → Network tab to see SSE events")
    print("4. Check browser Console for Zustand store updates")
