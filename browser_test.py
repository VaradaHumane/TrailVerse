#!/usr/bin/env python3
"""Browser test script for Trek Explorer page - P1-1 verification"""
import asyncio
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:3000"
API_URL = "http://localhost:8000"

async def test_explore_page():
    async with async_playwright() as p:
        # Use the downloaded chromium headless shell
        browser = await p.chromium.launch(
            executable_path="/Users/varada/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell",
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        page = await browser.new_page()

        # Listen for console errors
        page.on("console", lambda msg: print(f"[CONSOLE {msg.type}] {msg.text}") if msg.type in ["error", "warning"] else None)
        page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))

        print("📍 Navigating to /explore...")
        await page.goto(f"{BASE_URL}/explore", wait_until="domcontentloaded", timeout=60000)
        print("✅ Page loaded")

        # Wait for the search input to be visible
        search_input = page.locator('input[placeholder="Search for a trek..."]')
        await search_input.wait_for(state="visible", timeout=15000)
        print("✅ Search input visible")

        # Give extra time for hydration
        await page.wait_for_timeout(1000)

        # === TEST 1: Local search (Maharashtra default) ===
        print("\n🔍 TEST 1: Local search for 'Kalsubai'")
        await search_input.fill("Kalsubai")
        await page.wait_for_timeout(800)  # debounce

        # Check dropdown appears with results
        dropdown = page.locator('#trek-explorer-results')
        await dropdown.wait_for(state="visible", timeout=10000)
        results = dropdown.locator('button[role="option"]')
        count = await results.count()
        print(f"   Found {count} local results")
        assert count > 0, "Expected at least 1 local result for Kalsubai"

        # Click first result
        await results.first.click()
        await page.wait_for_timeout(1000)  # weather fetch

        # Verify trek details card appears
        trek_header = page.locator('h2').filter(has_text="Kalsubai")
        await trek_header.wait_for(state="visible", timeout=10000)
        print("   ✅ Trek details card rendered")

        # Verify weather section loads
        weather_section = page.locator('text="Current Weather"')
        await weather_section.wait_for(state="visible", timeout=10000)
        temp_text = await page.locator('.text-4xl.font-bold.text-white').first.text_content()
        print(f"   ✅ Weather loaded: {temp_text}")

        # Verify risk assessment
        risk_text = await page.locator('text="Trek Risk Assessment"').text_content()
        risk_score = await page.locator('text=/[0-9]+\\/100/').first.text_content()
        print(f"   ✅ Risk assessment: {risk_score}")

        # Verify map iframe loads
        iframe = page.locator('iframe[src*="openstreetmap.org"]')
        await iframe.wait_for(state="attached", timeout=10000)
        print("   ✅ OSM map iframe present")

        # === TEST 2: Test another local trek ===
        print("\n🔍 TEST 2: Local search for 'Rajmachi'")
        await search_input.fill("")
        await page.wait_for_timeout(300)
        await search_input.fill("Rajmachi")
        await page.wait_for_timeout(800)

        await dropdown.wait_for(state="visible", timeout=10000)
        results = dropdown.locator('button[role="option"]')
        count = await results.count()
        print(f"   Found {count} local results")
        assert count > 0, "Expected at least 1 local result for Rajmachi"

        await results.first.click()
        await page.wait_for_timeout(1500)  # longer wait for weather + card

        # Check the actual header text - might be "Rajmachi Fort Trek"
        trek_header = page.locator('h2').filter(has_text="Rajmachi")
        await trek_header.wait_for(state="visible", timeout=15000)
        print("   ✅ Trek details card rendered")

        # === TEST 3: Global search toggle ===
        print("\n🌍 TEST 3: Search Global Databases toggle")
        global_btn = page.locator('button:has-text("Search Global Databases")')
        await global_btn.click()
        await page.wait_for_timeout(300)

        # Verify button text changes
        await page.locator('button:has-text("Show Local Only")').wait_for(state="visible", timeout=2000)
        print("   ✅ Global search mode activated")

        # Search for a trek via global (Wikidata + OSM)
        await search_input.fill("")
        await search_input.fill("Kalsubai")
        await page.wait_for_timeout(800)  # longer debounce for external API

        print("   Waiting for dropdown...")
        await dropdown.wait_for(state="visible", timeout=90000)
        print("   Dropdown visible!")
        results = dropdown.locator('button[role="option"]')
        count = await results.count()
        print(f"   Found {count} global results (Wikidata + OSM)")

        if count > 0:
            # Click first global result (likely Wikidata)
            await results.first.click()
            await page.wait_for_timeout(800)

            trek_header = page.locator('h2').filter(has_text="Kalsubai")
            await trek_header.wait_for(state="visible", timeout=5000)
            print("   ✅ Global trek details card rendered")

            # Verify weather loads for global result
            weather_section = page.locator('text="Current Weather"')
            await weather_section.wait_for(state="visible", timeout=5000)
            print("   ✅ Weather loaded for global result")

            # Verify risk loads
            risk_score = await page.locator('text=/[0-9]+\\/100/').first.text_content()
            print(f"   ✅ Risk assessment: {risk_score}")

            # Verify map loads
            iframe = page.locator('iframe[src*="openstreetmap.org"]')
            await iframe.wait_for(state="attached", timeout=5000)
            print("   ✅ OSM map iframe present for global result")
        else:
            print("   ⚠️ No global results found (may be expected for some queries)")

        # === TEST 4: Empty state when no results ===
        print("\n🔍 TEST 4: Empty state for unknown trek")
        # First toggle back to local search for faster empty state test
        local_btn = page.locator('button:has-text("Show Local Only")')
        if await local_btn.count() > 0:
            await local_btn.click()
            await page.wait_for_timeout(300)
            # Wait for button text to change
            await page.locator('button:has-text("Search Global Databases")').wait_for(state="visible", timeout=3000)
            print("   ✅ Toggled back to local search")

        await search_input.fill("")
        await page.wait_for_timeout(300)
        await search_input.fill("NonexistentTrekXYZ123")
        await page.wait_for_timeout(800)

        # The empty state is inside the dropdown div with class
        empty_state = page.locator('div:has-text("No treks found")').first
        await empty_state.wait_for(state="visible", timeout=10000)
        print("   ✅ Empty state shown correctly")

        # === TEST 5: Toggle to global again (already on local) ===
        print("\n🔄 TEST 5: Toggle to global search again")
        # Use first() to avoid strict mode violation (there's also a link in empty state)
        global_btn = page.locator('button:has-text("Search Global Databases")').first
        await global_btn.click()
        await page.wait_for_timeout(300)

        await page.locator('button:has-text("Show Local Only")').wait_for(state="visible", timeout=2000)
        print("   ✅ Global search mode activated again")

        await browser.close()
        print("\n🎉 ALL TESTS PASSED!")

if __name__ == "__main__":
    asyncio.run(test_explore_page())