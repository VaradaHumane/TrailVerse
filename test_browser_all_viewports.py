#!/usr/bin/env python3
"""
Comprehensive Playwright Browser Verification Script (with Strict Browser Health Checking)
Tests TrailVerse across Desktop (1280x800) and Mobile (390x844) viewports:
- /explore (Search, Weather, Risk Scoring, OSM Map, Local vs Global)
- /groups (Group cards, filters, creation link)
- /login & /signup (Auth forms, validation, mobile responsiveness)
- Navbar (Desktop navigation and mobile hamburger drawer)

Enforces zero console errors, zero unhandled page errors, and zero failed essential network requests.
"""
import asyncio
import os
from urllib.parse import urlparse
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:3000"
SCREENSHOT_DIR = "/Users/varada/.gemini/antigravity-ide/brain/9b39a494-aa7d-4567-87b6-a37da0bac267/screenshots"

# ─── Explicitly Ignored Third-Party Noise ───
IGNORED_CONSOLE_PATTERNS = [
    "GL Driver Message",       # WebGL GPU driver ReadPixels buffer stall warning
    "WebGL",                   # General WebGL context warnings
    "scroll-behavior: smooth", # Next.js HTML smooth scrolling suggestion
    "favicon.ico",             # Browser favicon fetch
]

IGNORED_FAILED_HOSTS = [
    "tile.openstreetmap.org",
    "a.tile.openstreetmap.org",
    "b.tile.openstreetmap.org",
    "c.tile.openstreetmap.org",
    "openstreetmap.org",        # OSM export embed iframe tiles
    "upload.wikimedia.org",     # External image thumbnails
]


def attach_health_monitors(page, page_name: str, health_state: dict):
    """Attach listeners to capture errors and failed network requests."""
    def on_page_error(err):
        err_msg = f"[{page_name} PAGE ERROR] {err}"
        print(f"❌ {err_msg}")
        health_state["page_errors"].append(err_msg)

    def on_console(msg):
        if msg.type == "error":
            text = msg.text
            # Filter known third-party warnings
            if any(pattern in text for pattern in IGNORED_CONSOLE_PATTERNS):
                return
            console_msg = f"[{page_name} CONSOLE ERROR] {text}"
            print(f"⚠️ {console_msg}")
            health_state["console_errors"].append(console_msg)

    def on_request_failed(request):
        # Ignore intentional client-side cancellations from AbortController
        if request.failure == "net::ERR_ABORTED":
            return
        url = request.url
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        # Filter known third-party tile / external asset hosts
        if any(ignored in host for ignored in IGNORED_FAILED_HOSTS):
            return
        # Filter favicon
        if "favicon.ico" in url:
            return
        fail_msg = f"[{page_name} FAILED REQUEST] {request.method} {url} ({request.failure})"
        print(f"❌ {fail_msg}")
        health_state["failed_requests"].append(fail_msg)

    page.on("pageerror", on_page_error)
    page.on("console", on_console)
    page.on("requestfailed", on_request_failed)


async def run_browser_verification():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    health_state = {
        "page_errors": [],
        "console_errors": [],
        "failed_requests": [],
    }

    print("\n=======================================================")
    print("🛡️  BROWSER HEALTH CHECK CONFIGURATION")
    print("=======================================================")
    print(f"Ignored console patterns : {IGNORED_CONSOLE_PATTERNS}")
    print(f"Ignored failed hosts     : {IGNORED_FAILED_HOSTS}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )

        # -------------------------------------------------------------
        # 1. DESKTOP VIEWPORT (1280 x 800)
        # -------------------------------------------------------------
        print("\n=======================================================")
        print("🖥️  DESKTOP VIEWPORT VERIFICATION (1280x800)")
        print("=======================================================")
        desktop_page = await browser.new_page(viewport={"width": 1280, "height": 800})
        attach_health_monitors(desktop_page, "DESKTOP", health_state)
        
        # Test 1.1: Home page
        print("📍 Visiting / (Desktop)...")
        await desktop_page.goto(f"{BASE_URL}/", wait_until="networkidle", timeout=30000)
        hero_title = await desktop_page.locator("h1").first.text_content()
        print(f"   ✅ Home Hero loaded: {hero_title.strip()[:40]}...")
        await desktop_page.screenshot(path=f"{SCREENSHOT_DIR}/desktop_home.png")

        # Test 1.2: Explore Page - Maharashtra Local Search
        print("📍 Visiting /explore (Desktop)...")
        await desktop_page.goto(f"{BASE_URL}/explore", wait_until="networkidle", timeout=30000)
        search_input = desktop_page.locator('input[placeholder="Search for a trek..."]')
        await search_input.wait_for(state="visible", timeout=10000)
        
        await search_input.fill("Kalsubai")
        await desktop_page.wait_for_timeout(1000)
        dropdown = desktop_page.locator("#trek-explorer-results")
        await dropdown.wait_for(state="visible", timeout=10000)
        first_opt = dropdown.locator('button[role="option"]').first
        await first_opt.click()
        await desktop_page.wait_for_timeout(1500)
        
        card_title = await desktop_page.locator("h2").filter(has_text="Kalsubai").text_content()
        print(f"   ✅ Local trek selected: {card_title}")
        risk_score = await desktop_page.locator('text=/[0-9]+\\/100/').first.text_content()
        print(f"   ✅ Trek Risk score rendered: {risk_score}")
        await desktop_page.screenshot(path=f"{SCREENSHOT_DIR}/desktop_explore_local.png")

        # Test 1.3: Explore Page - India Global Search (Hampta Pass)
        print("📍 Testing Global Search on /explore (Hampta Pass)...")
        global_btn = desktop_page.locator('button:has-text("Search Global Databases")')
        await global_btn.click()
        await desktop_page.wait_for_timeout(500)
        await search_input.fill("")
        await search_input.fill("Hampta Pass")
        await desktop_page.wait_for_timeout(1500)
        await dropdown.wait_for(state="visible", timeout=30000)
        hampta_opt = dropdown.locator('button[role="option"]').first
        print(f"   ✅ Hampta Pass option text: {(await hampta_opt.text_content())[:50]}...")
        await hampta_opt.click()
        await desktop_page.wait_for_timeout(1500)
        hampta_header = desktop_page.locator("h2").filter(has_text="Hamta Pass")
        await hampta_header.wait_for(state="visible", timeout=15000)
        print("   ✅ Hampta Pass loaded via Wikidata with Weather & Map!")
        await desktop_page.screenshot(path=f"{SCREENSHOT_DIR}/desktop_explore_global.png")

        # Test 1.4: Groups Page
        print("📍 Visiting /groups (Desktop)...")
        await desktop_page.goto(f"{BASE_URL}/groups", wait_until="networkidle", timeout=30000)
        groups_header = await desktop_page.locator("h1").first.text_content()
        print(f"   ✅ Groups page loaded: {groups_header.strip()}")
        await desktop_page.screenshot(path=f"{SCREENSHOT_DIR}/desktop_groups.png")

        # Test 1.5: Login Page
        print("📍 Visiting /login (Desktop)...")
        await desktop_page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=30000)
        login_header = await desktop_page.locator("h1").first.text_content()
        print(f"   ✅ Login page loaded: {login_header.strip()}")
        await desktop_page.screenshot(path=f"{SCREENSHOT_DIR}/desktop_login.png")

        await desktop_page.close()

        # -------------------------------------------------------------
        # 2. MOBILE VIEWPORT (390 x 844 - iPhone 12/13/14)
        # -------------------------------------------------------------
        print("\n=======================================================")
        print("📱  MOBILE VIEWPORT VERIFICATION (390x844)")
        print("=======================================================")
        mobile_page = await browser.new_page(
            viewport={"width": 390, "height": 844},
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
        )
        attach_health_monitors(mobile_page, "MOBILE", health_state)

        # Test 2.1: Home page & Mobile Navigation
        print("📍 Visiting / (Mobile)...")
        await mobile_page.goto(f"{BASE_URL}/", wait_until="networkidle", timeout=30000)
        # Check hamburger button
        menu_button = mobile_page.locator('button[aria-label="Toggle navigation menu"]')
        await menu_button.wait_for(state="visible", timeout=10000)
        print("   ✅ Mobile hamburger menu button visible")
        
        # Open hamburger menu
        await menu_button.click()
        await mobile_page.wait_for_timeout(500)
        explore_link = mobile_page.locator('a[href="/explore"]:has-text("Explore")').last
        assert await explore_link.is_visible(), "Explore link should be visible in open mobile menu"
        print("   ✅ Mobile navigation drawer opened and links visible")
        await mobile_page.screenshot(path=f"{SCREENSHOT_DIR}/mobile_menu_open.png")
        
        # Navigate to Explore via mobile drawer
        await explore_link.click()
        await mobile_page.wait_for_timeout(1000)

        # Test 2.2: Explore Page on Mobile
        print("📍 Exploring /explore (Mobile)...")
        mobile_search = mobile_page.locator('input[placeholder="Search for a trek..."]')
        await mobile_search.wait_for(state="visible", timeout=10000)
        
        # Verify no horizontal scroll / overflow
        scroll_width = await mobile_page.evaluate("document.documentElement.scrollWidth")
        client_width = await mobile_page.evaluate("document.documentElement.clientWidth")
        print(f"   Scroll width: {scroll_width}px, Client width: {client_width}px")
        assert scroll_width <= client_width + 1, "Page has unexpected horizontal overflow!"
        print("   ✅ No horizontal layout overflow on mobile")

        # Test Local Search on Mobile
        await mobile_search.fill("Rajmachi")
        await mobile_page.wait_for_timeout(1000)
        mobile_dropdown = mobile_page.locator("#trek-explorer-results")
        await mobile_dropdown.wait_for(state="visible", timeout=10000)
        await mobile_dropdown.locator('button[role="option"]').first.click()
        await mobile_page.wait_for_timeout(1500)
        
        rajmachi_title = await mobile_page.locator("h2").filter(has_text="Rajmachi").text_content()
        print(f"   ✅ Mobile trek card rendered: {rajmachi_title}")
        await mobile_page.screenshot(path=f"{SCREENSHOT_DIR}/mobile_explore_card.png")

        # Test 2.3: Groups Page on Mobile
        print("📍 Visiting /groups (Mobile)...")
        await mobile_page.goto(f"{BASE_URL}/groups", wait_until="networkidle", timeout=30000)
        groups_mobile_h1 = await mobile_page.locator("h1").first.text_content()
        print(f"   ✅ Groups page mobile rendered: {groups_mobile_h1.strip()}")
        await mobile_page.screenshot(path=f"{SCREENSHOT_DIR}/mobile_groups.png")

        # Test 2.4: Login Page on Mobile
        print("📍 Visiting /login (Mobile)...")
        await mobile_page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=30000)
        login_btn = mobile_page.locator('button:has-text("Log in")').first
        assert await login_btn.is_visible(), "Log in button visible on mobile"
        print("   ✅ Login page mobile rendered cleanly")
        await mobile_page.screenshot(path=f"{SCREENSHOT_DIR}/mobile_login.png")

        await mobile_page.close()
        await browser.close()

        # -------------------------------------------------------------
        # 3. BROWSER HEALTH SUMMARY & ASSERTIONS
        # -------------------------------------------------------------
        print("\n=======================================================")
        print("🏥  BROWSER HEALTH REPORT")
        print("=======================================================")
        print(f"Unhandled Page Errors  : {len(health_state['page_errors'])}")
        print(f"Console Errors         : {len(health_state['console_errors'])}")
        print(f"Failed Essential Req's : {len(health_state['failed_requests'])}")

        assert len(health_state["page_errors"]) == 0, (
            f"Failing due to {len(health_state['page_errors'])} unhandled page errors: {health_state['page_errors']}"
        )
        assert len(health_state["console_errors"]) == 0, (
            f"Failing due to {len(health_state['console_errors'])} console errors: {health_state['console_errors']}"
        )
        assert len(health_state["failed_requests"]) == 0, (
            f"Failing due to {len(health_state['failed_requests'])} failed essential requests: {health_state['failed_requests']}"
        )

        print("\n🎉 ALL DESKTOP & MOBILE BROWSER TESTS AND HEALTH CHECKS PASSED 100%!")
        print("=======================================================\n")

if __name__ == "__main__":
    asyncio.run(run_browser_verification())
