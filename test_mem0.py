import requests
import json
import time

API_URL = "http://localhost:8000"
USER_ID = "test_user_123"

memories = [
    {"content": "Deadline for the project beta release is pushed to October 15th.", "metadata": {"type": "deadline"}},
    {"content": "Decision: We decided to use Postgres instead of MongoDB for the primary database.", "metadata": {"type": "decision"}},
]

print("Storing memories...")
for m in memories:
    payload = {
        "content": m["content"],
        "user_id": USER_ID,
        "metadata": m["metadata"]
    }
    resp = requests.post(f"{API_URL}/memory", json=payload)
    print(resp.json())
    time.sleep(5)

print("\nWaiting a few seconds for embeddings to be processed and indexed...")
time.sleep(2)

query = "what did we decide about the deadline"
print(f"\nSearching for: '{query}'")
resp = requests.get(f"{API_URL}/memory/search", params={"q": query, "user_id": USER_ID})
print(json.dumps(resp.json(), indent=2))
