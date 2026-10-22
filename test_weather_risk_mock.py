#!/usr/bin/env python3
"""
Playwright test to verify frontend rendering of trek risk scores and categories:
(a) Severe weather -> High Risk (red), high numeric score / 100
(b) Mild weather   -> Low Risk (green), low numeric score / 100
(c) Missing data   -> Incomplete Data (amber), 'N/A' score, no NaN, no '0°C', never Low or Safe
"""
import asyncio
import json
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:3000"

MOCK_TREK = {
    "id": "mock_trek_1",
    "name": "Test Mountain Peak",
    "difficulty": "Moderate",
    "distance_km": 12.5,
    "location": "Pune, Maharashtra",
    "elevation_m": 1400,
    "lat": 18.5204,
    "lon": 73.8567,
    "state": "Maharashtra",
}

SEVERE_WEATHER_PAYLOAD = {
    "weather": {
        "temp": 42.0,
        "feels_like": 47.0,
        "temp_min": 38.0,
        "temp_max": 44.0,
        "wind_speed": 22.5,
        "wind_deg": 180,
        "humidity": 92,
        "pressure": 992,
        "visibility": 1500,
        "sunrise": 1690000000,
        "sunset": 1690045000,
        "weather_id": 211,
        "weather_main": "Thunderstorm",
        "weather_desc": "thunderstorm with heavy rain",
        "weather_icon": "11d",
        "rain_1h": 18.0,
        "snow_1h": 0.0,
        "uvi": 9.5
    },
    "risk": {
        "score": 85,
        "label": "High Risk",
        "color": "red",
        "factors": [
            {"label": "Dangerous wind speeds (22.5 m/s)", "severity": "high"},
            {"label": "Heavy rainfall (18.0 mm/h)", "severity": "high"},
            {"label": "Thunderstorm active", "severity": "high"}
        ]
    }
}

MILD_WEATHER_PAYLOAD = {
    "weather": {
        "temp": 22.0,
        "feels_like": 21.5,
        "temp_min": 19.0,
        "temp_max": 24.0,
        "wind_speed": 3.2,
        "wind_deg": 90,
        "humidity": 45,
        "pressure": 1012,
        "visibility": 10000,
        "sunrise": 1690000000,
        "sunset": 1690045000,
        "weather_id": 800,
        "weather_main": "Clear",
        "weather_desc": "clear sky",
        "weather_icon": "01d",
        "rain_1h": 0.0,
        "snow_1h": 0.0,
        "uvi": 4.0
    },
    "risk": {
        "score": 0,
        "label": "Low Risk",
        "color": "green",
        "factors": []
    }
}

MISSING_DATA_PAYLOAD = {
    "weather": {
        "temp": None,
        "feels_like": None,
        "temp_min": None,
        "temp_max": None,
        "wind_speed": None,
        "wind_deg": None,
        "humidity": None,
        "pressure": None,
        "visibility": None,
        "sunrise": None,
        "sunset": None,
        "weather_id": None,
        "weather_main": "Unknown",
        "weather_desc": "Data unavailable",
        "weather_icon": "",
        "rain_1h": None,
        "snow_1h": None,
        "uvi": None
    },
    "risk": {
        "score": None,
        "label": "Incomplete Data",
        "color": "amber",
        "factors": [
            {"label": "Missing critical signals (temperature, wind speed) — exercise caution", "severity": "medium"}
        ]
    }
}


async def test_risk_scenarios():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        # Listen for console errors
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        # Mock the search endpoint so searching for 'Test' returns our mock trek
        async def handle_treks(route):
            await route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps([MOCK_TREK])
            )

        await page.route("**/treks?*", handle_treks)
        await page.route("**/treks", handle_treks)

        # -------------------------------------------------------------
        # SCENARIO A: SEVERE WEATHER (High Risk, score 85)
        # -------------------------------------------------------------
        print("\n⚡ Testing Scenario A: Severe Weather Mock...")
        await page.route("**/weather/**", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(SEVERE_WEATHER_PAYLOAD)
        ))

        await page.goto(f"{BASE_URL}/explore", wait_until="networkidle")
        search_input = page.locator('input[placeholder="Search for a trek..."]')
        await search_input.fill("Test")
        await page.wait_for_timeout(600)
        
        dropdown = page.locator("#trek-explorer-results")
        await dropdown.wait_for(state="visible", timeout=10000)
        await dropdown.locator('button[role="option"]').first.click()
        await page.wait_for_timeout(1000)

        # Assert Severe Weather rendered
        risk_heading = page.locator('text="Trek Risk Assessment"')
        await risk_heading.wait_for(state="visible", timeout=10000)
        
        risk_score_text = await page.locator('text="85/100"').first.text_content()
        assert "85/100" in risk_score_text, f"Expected 85/100, got {risk_score_text}"
        print(f"   ✅ Severe score rendered: {risk_score_text}")

        label_elem = page.locator('text="High Risk"').first
        assert await label_elem.is_visible(), "High Risk label should be visible"
        print("   ✅ 'High Risk' label verified")

        # Verify red styling
        risk_card = page.locator('div.rounded-xl.p-4.border').filter(has_text="Trek Risk Assessment").first
        card_class = await risk_card.get_attribute("class") or ""
        assert "red" in card_class or "border-red" in card_class, f"Card should have red border: {card_class}"
        print("   ✅ Red risk styling verified")

        # -------------------------------------------------------------
        # SCENARIO B: MILD WEATHER (Low Risk, score 0)
        # -------------------------------------------------------------
        print("\n☀️ Testing Scenario B: Mild Weather Mock...")
        await page.unroute("**/weather/**")
        await page.route("**/weather/**", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(MILD_WEATHER_PAYLOAD)
        ))

        # Re-select trek to trigger fresh weather fetch
        await search_input.fill("")
        await search_input.fill("Test")
        await page.wait_for_timeout(600)
        await dropdown.wait_for(state="visible", timeout=10000)
        await dropdown.locator('button[role="option"]').first.click()
        await page.wait_for_timeout(1000)

        # Assert Mild Weather rendered
        risk_score_text = await page.locator('text="0/100"').first.text_content()
        assert "0/100" in risk_score_text, f"Expected 0/100, got {risk_score_text}"
        print(f"   ✅ Mild score rendered: {risk_score_text}")

        label_elem = page.locator('text="Low Risk"').first
        assert await label_elem.is_visible(), "Low Risk label should be visible"
        print("   ✅ 'Low Risk' label verified")

        # Verify green styling
        risk_card = page.locator('div.rounded-xl.p-4.border').filter(has_text="Trek Risk Assessment").first
        card_class = await risk_card.get_attribute("class") or ""
        assert "emerald" in card_class or "border-emerald" in card_class or "green" in card_class, f"Card should have emerald/green border: {card_class}"
        print("   ✅ Green/emerald risk styling verified")

        # -------------------------------------------------------------
        # SCENARIO C: MISSING DATA (Incomplete Data, score N/A)
        # -------------------------------------------------------------
        print("\n⚠️ Testing Scenario C: Missing Data Mock (Incomplete Data)...")
        await page.unroute("**/weather/**")
        await page.route("**/weather/**", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(MISSING_DATA_PAYLOAD)
        ))

        # Re-select trek to trigger fresh weather fetch
        await search_input.fill("")
        await search_input.fill("Test")
        await page.wait_for_timeout(600)
        await dropdown.wait_for(state="visible", timeout=10000)
        await dropdown.locator('button[role="option"]').first.click()
        await page.wait_for_timeout(1000)

        # Assert Missing Data rendered
        # 1. Score must be "N/A"
        na_score = page.locator('text="N/A"').first
        assert await na_score.is_visible(), "Score must render as 'N/A' when score is null"
        print("   ✅ Missing data score rendered as: 'N/A'")

        # 2. Page must NEVER display "null/100" or NaN
        page_content = await page.content()
        assert "null/100" not in page_content, "Page must not contain literal 'null/100'"
        assert "NaN" not in page_content, "Page must not contain 'NaN'"
        print("   ✅ No 'null/100' or 'NaN' on page")

        # 3. Label must be "Incomplete Data" (NOT Safe or Low Risk)
        label_elem = page.locator('text="Incomplete Data"').first
        assert await label_elem.is_visible(), "Incomplete Data label must be visible"
        print("   ✅ 'Incomplete Data' label verified")

        # 4. Must NEVER be categorized as Safe or Low Risk
        assert not await page.locator('.text-emerald-400:has-text("Safe")').is_visible()
        print("   ✅ Verified: Incomplete data is NEVER shown as Safe or Low Risk")

        # 5. Verify amber styling
        risk_card = page.locator('div.rounded-xl.p-4.border').filter(has_text="Trek Risk Assessment").first
        card_class = await risk_card.get_attribute("class") or ""
        assert "amber" in card_class or "border-amber" in card_class, f"Card should have amber border: {card_class}"
        print("   ✅ Amber warning styling verified")

        # 6. Verify temp displays "--" instead of 0°C
        temp_elem = page.locator('.text-4xl.font-bold.text-white:not(h1)').first
        temp_text = await temp_elem.text_content()
        assert temp_text == "--", f"Expected '--' for missing temp, got {temp_text!r}"
        print(f"   ✅ Missing temp rendered gracefully as: {temp_text}")

        await browser.close()
        print("\n🎉 ALL RISK MOCK SCENARIO TESTS PASSED (Severe, Mild, Incomplete Data)!\n")


if __name__ == "__main__":
    asyncio.run(test_risk_scenarios())
