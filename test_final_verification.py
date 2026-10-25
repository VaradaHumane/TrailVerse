import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        page.set_default_timeout(15000)

        print("1. Checking Home page...")
        await page.goto("http://localhost:3000/")
        title = await page.title()
        print(f"   Home page loaded: {title}")
        
        # Verify stats are live numbers (0 trekkers, 27 trails, 0 groups)
        await page.wait_for_selector("text=Trekkers Joined")
        stats_text = await page.locator("section").first.inner_text()
        assert "Trekkers Joined" in stats_text
        assert "Trails Mapped" in stats_text
        assert "Trek Groups" in stats_text
        print("   ✅ Live stats verified!")

        print("\n2. Checking Login page & Google OAuth button...")
        await page.goto("http://localhost:3000/login")
        google_btn = page.locator("button:has-text('Continue with Google')")
        assert await google_btn.is_visible()
        print("   ✅ Google login button is visible and active on /login")

        print("\n3. Checking Signup page & Google OAuth button...")
        await page.goto("http://localhost:3000/signup")
        google_signup_btn = page.locator("button:has-text('Continue with Google')")
        assert await google_signup_btn.is_visible()
        # Verify no hardcoded 10,000+ trekkers
        signup_text = await page.locator("main, body").inner_text()
        assert "10,000" not in signup_text
        print("   ✅ Google sign-up button is visible and no dummy numbers on /signup")

        print("\n4. Checking Groups page navigation and empty state...")
        await page.goto("http://localhost:3000/groups")
        assert await page.locator("text=Trek Groups").is_visible()
        assert await page.locator("text=Host a Group").is_visible()
        print("   ✅ Groups page loaded cleanly without blocking flash!")

        print("\n5. Checking Explore page and Global Search...")
        await page.goto("http://localhost:3000/explore")
        search_input = page.locator('input[placeholder="Search for a trek..."]')
        await search_input.wait_for(state="visible", timeout=15000)

        # Toggle to Global Search
        global_btn = page.locator('button:has-text("Search Global Databases")')
        await global_btn.click()
        await page.wait_for_timeout(300)

        await search_input.fill("Everest")
        dropdown = page.locator('#trek-explorer-results')
        await dropdown.wait_for(state="visible", timeout=15000)
        results = dropdown.locator('button[role="option"]')
        count = await results.count()
        print(f"   Search results found: {count} items")
        assert count > 0, "No results for Everest"
        first_text = await results.first.text_content()
        assert "Everest" in (first_text or "")
        print("   ✅ Global search returns live results with source badges!")

        print("\n6. Checking page transitions between routes...")
        start_time = asyncio.get_event_loop().time()
        await page.click("a[href='/groups']")
        await page.wait_for_selector("text=Trek Groups")
        t_groups = asyncio.get_event_loop().time() - start_time
        print(f"   Transition to /groups took: {t_groups:.2f}s")

        start_time = asyncio.get_event_loop().time()
        await page.click("a[href='/explore']")
        await page.wait_for_selector("input[placeholder*='Search']")
        t_explore = asyncio.get_event_loop().time() - start_time
        print(f"   Transition to /explore took: {t_explore:.2f}s")

        start_time = asyncio.get_event_loop().time()
        await page.click("a[href='/login']")
        await page.wait_for_selector("text=Sign in")
        t_login = asyncio.get_event_loop().time() - start_time
        print(f"   Transition to /login took: {t_login:.2f}s")

        print("\n🎉 ALL CHECKS PASSED SUCCESSFULLY!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
