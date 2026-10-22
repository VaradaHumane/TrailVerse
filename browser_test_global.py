#!/usr/bin/env python3
"""Browser test for Global Search — outside-Maharashtra Indian treks"""
import asyncio
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:3000"

async def test_global_search():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        page = await browser.new_page()
        page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))

        print("📍 Navigating to /explore...")
        await page.goto(f"{BASE_URL}/explore", wait_until="domcontentloaded", timeout=60000)
        print("✅ Page loaded")

        search_input = page.locator('input[placeholder="Search for a trek..."]')
        await search_input.wait_for(state="visible", timeout=15000)
        await page.wait_for_timeout(1000)

        # Toggle to Global Search
        print("\n🌍 Activating Global Search mode...")
        global_btn = page.locator('button:has-text("Search Global Databases")')
        await global_btn.click()
        await page.wait_for_timeout(300)
        await page.locator('button:has-text("Show Local Only")').wait_for(state="visible", timeout=3000)
        print("✅ Global search mode activated")

        # --- TEST: Kedarkantha (Uttarakhand) ---
        print("\n🏔️ TEST: Search for 'Kedarkantha' (Uttarakhand)")
        await search_input.fill("")
        await page.wait_for_timeout(200)
        await search_input.fill("Kedarkantha")
        await page.wait_for_timeout(1000)

        dropdown = page.locator('#trek-explorer-results')
        await dropdown.wait_for(state="visible", timeout=90000)
        results = dropdown.locator('button[role="option"]')
        count = await results.count()
        print(f"   Found {count} results")
        assert count > 0, "No results for Kedarkantha!"

        first_text = await results.first.text_content()
        print(f"   First result text: {first_text}")
        assert "Kedarkantha" in first_text, f"Expected 'Kedarkantha' in result, got: {first_text}"

        # Click the result
        await results.first.click()
        await page.wait_for_timeout(1500)

        trek_header = page.locator('h2').filter(has_text="Kedarkantha")
        await trek_header.wait_for(state="visible", timeout=15000)
        print("   ✅ Kedarkantha (Uttarakhand) found through Global Search!")

        # Verify weather loads
        weather = page.locator('text="Current Weather"')
        await weather.wait_for(state="visible", timeout=10000)
        print("   ✅ Weather loaded for Kedarkantha")

        # --- TEST: Tadiandamol (Karnataka) ---
        print("\n🏔️ TEST: Search for 'Tadiandamol' (Karnataka)")
        await search_input.fill("")
        await page.wait_for_timeout(200)
        await search_input.fill("Tadiandamol")
        await page.wait_for_timeout(1000)

        await dropdown.wait_for(state="visible", timeout=90000)
        results = dropdown.locator('button[role="option"]')
        count = await results.count()
        print(f"   Found {count} results")
        assert count > 0, "No results for Tadiandamol!"

        first_text = await results.first.text_content()
        print(f"   First result text: {first_text}")

        await results.first.click()
        await page.wait_for_timeout(1500)

        trek_header = page.locator('h2').filter(has_text="Tadiandamol")
        await trek_header.wait_for(state="visible", timeout=15000)
        print("   ✅ Tadiandamol (Karnataka) found through Global Search!")

        # --- TEST: Toggle back to local search, verify MH still works ---
        print("\n🔄 TEST: Switch back to Local Search")
        local_btn = page.locator('button:has-text("Show Local Only")').first
        await local_btn.click()
        await page.wait_for_timeout(300)
        await page.locator('button:has-text("Search Global Databases")').wait_for(state="visible", timeout=3000)
        print("   ✅ Toggled back to local search")

        await search_input.fill("")
        await page.wait_for_timeout(200)
        await search_input.fill("Sinhagad")
        await page.wait_for_timeout(800)

        await dropdown.wait_for(state="visible", timeout=10000)
        results = dropdown.locator('button[role="option"]')
        count = await results.count()
        print(f"   Found {count} local result(s)")
        assert count > 0, "No results for Sinhagad (local)!"

        first_text = await results.first.text_content()
        print(f"   First result: {first_text}")
        print("   ✅ Maharashtra local search still works!")

        await browser.close()
        print("\n🎉 ALL GLOBAL SEARCH TESTS PASSED!")
        print("   - Kedarkantha (Uttarakhand) ✅")
        print("   - Tadiandamol (Karnataka) ✅")
        print("   - Sinhagad (Maharashtra local) ✅")

if __name__ == "__main__":
    asyncio.run(test_global_search())
