import asyncio
from playwright.async_api import async_playwright
import json

async def test_insta_metadata(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Use a realistic user agent
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        print(f"Navigating to {url}...")
        try:
            # Navigate with a reasonable timeout
            await page.goto(url, timeout=30000, wait_until="networkidle")
            
            # 1. Try to get OpenGraph meta tags
            meta_tags = await page.evaluate("""() => {
                const tags = {};
                document.querySelectorAll('meta[property^="og:"]').forEach(el => {
                    tags[el.getAttribute('property')] = el.getAttribute('content');
                });
                return tags;
            }""")
            
            # 2. Try to get title tag
            title = await page.title()
            
            # 3. Try to get JSON-LD if present
            json_ld = await page.evaluate("""() => {
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                return Array.from(scripts).map(s => {
                    try { return JSON.parse(s.innerText); } catch(e) { return null; }
                }).filter(x => x !== null);
            }""")
            
            print("--- RESULTS ---")
            print(f"Title: {title}")
            print(f"OG Tags: {json.dumps(meta_tags, indent=2)}")
            # print(f"JSON-LD: {json.dumps(json_ld, indent=2)}")
            
            if not meta_tags.get("og:description") and not title:
                print("FAILURE: No metadata found. Might be blocked by login wall.")
            else:
                print("SUCCESS: Found metadata.")
                
        except Exception as e:
            print(f"ERROR: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    url = "https://www.instagram.com/reels/DXPU6W0Ez4s/"
    asyncio.run(test_insta_metadata(url))
