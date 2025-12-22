"""
Simple test script to see SSE streaming in action.

Run this after starting the server to see the events stream in real-time.
"""

import requests
import json


def test_fake_stream():
    """Test the fake streaming demo endpoint."""
    url = "http://localhost:8000/chat/stream/demo"
    payload = {"message": "What is FastAPI?"}
    
    print("🚀 Testing fake SSE stream...")
    print("=" * 60)
    
    # Stream the response
    with requests.post(url, json=payload, stream=True) as response:
        response.raise_for_status()
        
        for line in response.iter_lines():
            if not line:
                continue
            
            line = line.decode('utf-8')
            
            # Parse SSE format
            if line.startswith('event:'):
                event_type = line.split(':', 1)[1].strip()
                print(f"\n📡 EVENT: {event_type}")
            elif line.startswith('data:'):
                data_json = line.split(':', 1)[1].strip()
                data = json.loads(data_json)
                
                # Pretty print based on event type
                if data.get('event') == 'tool_start':
                    print(f"   🔍 {data['display_message']}")
                
                elif data.get('event') == 'tool_end':
                    print(f"   ✅ {data.get('result_summary', 'Done')}")
                
                elif data.get('event') == 'citation':
                    print(f"   [{data['index']}] {data['title']}")
                    print(f"       {data['url']}")
                
                elif data.get('event') == 'content':
                    print(data['chunk'], end='', flush=True)
                
                elif data.get('event') == 'done':
                    print(f"\n\n✨ {data['message']}")
    
    print("=" * 60)


if __name__ == "__main__":
    try:
        test_fake_stream()
    except requests.exceptions.ConnectionError:
        print("❌ Error: Could not connect to server")
        print("   Make sure the server is running: python -m app.main")
    except Exception as e:
        print(f"❌ Error: {e}")
