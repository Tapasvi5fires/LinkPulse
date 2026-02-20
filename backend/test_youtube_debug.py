import sys
import io

# Fix encoding for print
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    from youtube_transcript_api import YouTubeTranscriptApi
    
    api = YouTubeTranscriptApi()
    transcript_list = api.list("D1eL1EnxXXQ")
    
    # Get the first transcript
    transcript = None
    for t in transcript_list:
        if t.language_code == 'en':
            transcript = t
            break
    
    if not transcript:
        transcript = next(iter(transcript_list))
        
    print(f"Fetching transcript: {transcript}")
    result = transcript.fetch()
    
    print(f"Result type: {type(result)}")
    print(f"Result dir: {dir(result)}")
    
    # Check if iterable
    try:
        iterator = iter(result)
        first_item = next(iterator)
        print(f"First item type: {type(first_item)}")
        print(f"First item: {first_item}")
    except TypeError:
        print("Result is not iterable")

except Exception as e:
    print(f"Error: {e}")
