"""
Run this script to refresh your listening list from Anghami.
Usage: python fetch_listening.py

Requires Chrome to be CLOSED before running (so cookies can be read).
"""

import json
import time
import browser_cookie3
from playwright.sync_api import sync_playwright

PROFILE_URL = "https://play.anghami.com/profile/72755919?sectionId=7"
OUTPUT_FILE = "listening.json"


def get_chrome_cookies():
    """Extract anghami.com cookies from Chrome."""
    try:
        jar = browser_cookie3.chrome(domain_name=".anghami.com")
        cookies = []
        for c in jar:
            cookies.append({
                "name": c.name,
                "value": c.value,
                "domain": c.domain,
                "path": c.path,
            })
        print(f"Extracted {len(cookies)} cookies from Chrome.")
        return cookies
    except Exception as e:
        print(f"Could not read Chrome cookies: {e}")
        print("Make sure Chrome is fully closed before running this script.")
        return []


def scrape_listening():
    cookies = get_chrome_cookies()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)  # visible so you can see what happens
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

        if cookies:
            context.add_cookies(cookies)

        page = context.new_page()
        print("Loading Anghami profile...")
        page.goto(PROFILE_URL, wait_until="networkidle", timeout=30000)

        # Wait long enough for CAPTCHA solving + JS rendering
        print("Waiting 20 seconds — solve any CAPTCHA in the browser window...")
        time.sleep(20)

        # Save HTML for debugging
        html = page.content()
        with open("anghami_debug.html", "w", encoding="utf-8") as f:
            f.write(html)

        # Extract songs using correct Anghami selectors
        # Use parallel extraction from the full page (avoids nested-tag issues inside rows)
        songs = page.evaluate("""() => {
            function textOf(el) { return el ? el.textContent.trim() : ''; }

            // Collect all three lists in parallel
            const rows   = [...document.querySelectorAll('a.table-row')];
            const titles = [...document.querySelectorAll('[class*="cell-title"]')];
            const artists= [...document.querySelectorAll('[class*="cell-artist"]')];

            const results = [];
            for (let i = 0; i < titles.length; i++) {
                const title  = textOf(titles[i]);
                const artist = textOf(artists[i]);
                const href   = rows[i] ? rows[i].getAttribute('href') : null;
                const url    = href ? (href.startsWith('http') ? href : 'https://play.anghami.com' + href) : null;
                if (title) results.push({ title, artist, url });
            }
            return results;
        }""")

        browser.close()

        if not songs:
            print("No songs found — check anghami_debug.html to inspect the page structure.")
            return

        print(f"Found {len(songs)} songs. Saving top 30.")
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(songs[:30], f, ensure_ascii=False, indent=2)
        print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    scrape_listening()
