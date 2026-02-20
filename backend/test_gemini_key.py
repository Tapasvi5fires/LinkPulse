
import os
import sys
import traceback
from dotenv import load_dotenv
import google.generativeai as genai

# Redirect output to file
log_file = open("debug_output.txt", "w")
sys.stdout = log_file
sys.stderr = log_file

try:
    load_dotenv("../.env")
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("ERROR: GEMINI_API_KEY not found.")
        sys.exit(1)

    genai.configure(api_key=api_key)
    
    print("Attempting generation with 'models/gemini-2.0-flash'...")
    model = genai.GenerativeModel('models/gemini-2.0-flash')
    response = model.generate_content("Hello")
    print("SUCCESS with gemini-2.0-flash")
    print(f"Response: {response.text}")

except Exception as e:
    print(f"FAILURE: {e}")
    traceback.print_exc()

finally:
    log_file.close()
