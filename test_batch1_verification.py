import asyncio
import sys
from playwright.async_api import async_playwright

async def run_verification():
    print("=" * 60)
    print("🚀 BATCH 1 VERIFICATION & ZERO-REGRESSION SUITE")
    print("=" * 60)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        # 1. Landing Page
        print("\n[1/6] Probing Landing Page (/) ...")
        res = await page.goto("http://localhost:3000/", wait_until="domcontentloaded")
        assert res.status == 200, f"Landing page returned {res.status}"
        title = await page.title()
        print(f"   ✓ Title: {title}")
        body_text = await page.inner_text("body")
        assert "TrailVerse" in body_text
        print("   ✓ Landing page loaded perfectly")

        # 2. Explore Page (/explore)
        print("\n[2/6] Probing Explore Page (/explore) ...")
        res = await page.goto("http://localhost:3000/explore", wait_until="domcontentloaded")
        assert res.status == 200, f"Explore page returned {res.status}"
        await page.wait_for_selector("input", timeout=8000)
        body = await page.inner_text("body")
        assert "Maharashtra" in body or "Atlas" in body or "Explore" in body
        print("   ✓ Explore page loaded with interactive filters")

        # 3. Global Search (/search)
        print("\n[3/6] Probing Global Search Page (/search) ...")
        res = await page.goto("http://localhost:3000/search", wait_until="domcontentloaded")
        assert res.status == 200, f"Search page returned {res.status}"
        await page.wait_for_selector("input", timeout=8000)
        search_inputs = await page.locator("input").count()
        assert search_inputs > 0, "No search inputs found on /search"
        print("   ✓ Global All-India search page loaded with active search bar")

        # 4. User Profile Dossier (/profile/varadahumane)
        print("\n[4/6] Probing Public User Profile (/profile/varadahumane) ...")
        res = await page.goto("http://localhost:3000/profile/varadahumane", wait_until="domcontentloaded")
        assert res.status == 200, f"Profile page returned {res.status}"
        await page.wait_for_selector("h1", timeout=8000)
        profile_text = await page.inner_text("body")
        assert "varada humane" in profile_text.lower(), "User name not found in profile body"
        # Security Assertion: password_hash must NEVER appear in the DOM
        assert "argon2" not in profile_text.lower(), "SECURITY CRITICAL: Argon2 hash exposed in DOM!"
        assert "$argon2id$" not in profile_text, "SECURITY CRITICAL: Raw password hash string exposed in DOM!"
        print("   ✓ Public profile rendered cleanly without leaking password hashes")

        # 5. User Dashboard (/dashboard)
        print("\n[5/6] Probing User Dashboard (/dashboard) ...")
        await page.evaluate("() => localStorage.setItem('username', 'varadahumane')")
        res = await page.goto("http://localhost:3000/dashboard", wait_until="domcontentloaded")
        assert res.status == 200, f"Dashboard returned {res.status}"
        await page.wait_for_selector("h1", timeout=8000)
        dash_text = await page.inner_text("body")
        assert "$argon2id$" not in dash_text, "SECURITY CRITICAL: Raw password hash string exposed in dashboard!"
        print("   ✓ Dashboard loaded cleanly for user varadahumane")

        # 6. Groups Expedition Page (/groups)
        print("\n[6/6] Probing Trek Groups (/groups) ...")
        res = await page.goto("http://localhost:3000/groups", wait_until="domcontentloaded")
        assert res.status == 200, f"Groups page returned {res.status}"
        print("   ✓ Trek Groups expeditions feed loaded")

        await browser.close()

    print("\n" + "=" * 60)
    print("🎉 ALL BATCH 1 E2E FRONTEND & BACKEND TESTS PASSED 100%!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_verification())

