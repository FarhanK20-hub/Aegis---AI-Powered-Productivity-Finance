import requests
import time

API_URL = "http://localhost:8000/agents/planner/parse"
USER_ID = 1

prompts = [
    "I have to submit my ethics assignment tomorrow",
    "Need to call the plumber on Friday afternoon, should take 30 mins, highly urgent",
    "Read the new system design book",
    "Schedule a meeting with the client next Monday at 10am",
    "Buy groceries"
]

print("Testing Planner Agent...\n")

for i, prompt in enumerate(prompts):
    print(f"--- Request {i+1} ---")
    print(f"Input: {prompt}")
    payload = {
        "raw_text": prompt,
        "user_id": USER_ID
    }
    
    try:
        resp = requests.post(API_URL, json=payload)
        print(f"Status Code: {resp.status_code}")
        if resp.status_code == 200:
            print("Response:", resp.json())
        else:
            print("Error Response:", resp.text)
    except Exception as e:
        print("Exception:", e)
    
    print()
    if i < len(prompts) - 1:
        print("Waiting 5 seconds to respect free-tier RPM limits...")
        time.sleep(5)
