"""
Deterministic unit test suite for TrailVerse trek risk scoring.

Tests cover all required scenarios:
1. mild
2. wind
3. rain (including 1h and 3h normalization)
4. snow/cold
5. visibility
6. thunderstorm
7. multi-severe
8. missing (missing data must NOT read as 'safe')
9. invalid (wrong types, negative/malformed values)
10. thresholds (boundary conditions)
11. recovery (severe to mild transition)
12. score/category/explanation consistency
"""

import unittest
import sys
import os

# Add parent directory to sys.path so main can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from main import _compute_trek_risk, _normalize_owm_response


class TestTrekRiskScoring(unittest.TestCase):

    def test_1_mild_weather(self):
        """Mild clear weather should produce Low Risk (score < 35, color green)."""
        weather = {
            "temp": 22.0,
            "wind_speed": 3.0,
            "visibility": 10000,
            "rain_1h": 0.0,
            "snow_1h": 0.0,
            "weather_id": 800,
            "uvi": 2.0,
        }
        res = _compute_trek_risk(weather)
        self.assertEqual(res["score"], 0)
        self.assertEqual(res["label"], "Low Risk")
        self.assertEqual(res["color"], "green")
        self.assertEqual(len(res["factors"]), 0)

    def test_2_wind_scoring(self):
        """Strong wind (10-16 m/s) and dangerous wind (>=17 m/s)."""
        # Strong wind
        weather_strong = {
            "temp": 20.0,
            "wind_speed": 12.0,
            "visibility": 10000,
            "weather_id": 800,
        }
        res_strong = _compute_trek_risk(weather_strong)
        self.assertEqual(res_strong["score"], 15)
        self.assertTrue(any("Strong winds" in f["label"] for f in res_strong["factors"]))
        self.assertEqual(res_strong["label"], "Low Risk")

        # Dangerous wind
        weather_danger = {
            "temp": 20.0,
            "wind_speed": 18.0,
            "visibility": 10000,
            "weather_id": 800,
        }
        res_danger = _compute_trek_risk(weather_danger)
        self.assertEqual(res_danger["score"], 30)
        self.assertTrue(any("Dangerous wind speeds" in f["label"] for f in res_danger["factors"]))

    def test_3_rain_scoring(self):
        """Light, moderate, and heavy rainfall scoring and 3h normalization."""
        base = {"temp": 20.0, "wind_speed": 2.0, "visibility": 10000, "weather_id": 500}

        # Light rain (1mm)
        res_light = _compute_trek_risk({**base, "rain_1h": 1.0})
        self.assertEqual(res_light["score"], 5)
        self.assertTrue(any("Light rain" in f["label"] for f in res_light["factors"]))

        # Moderate rain (5mm)
        res_mod = _compute_trek_risk({**base, "rain_1h": 5.0})
        self.assertEqual(res_mod["score"], 12)
        self.assertTrue(any("Moderate rainfall" in f["label"] for f in res_mod["factors"]))

        # Heavy rain (12mm)
        res_heavy = _compute_trek_risk({**base, "rain_1h": 12.0})
        self.assertEqual(res_heavy["score"], 25)
        self.assertTrue(any("Heavy rainfall" in f["label"] for f in res_heavy["factors"]))

        # Normalization from raw OWM 3h rain
        raw_3h = {
            "main": {"temp": 20.0},
            "wind": {"speed": 2.0},
            "weather": [{"id": 501, "main": "Rain"}],
            "rain": {"3h": 15.0},  # 15mm in 3h -> 5mm/h -> moderate rain
        }
        norm = _normalize_owm_response(raw_3h)
        self.assertAlmostEqual(norm["rain_1h"], 5.0)
        res_norm = _compute_trek_risk(norm)
        self.assertEqual(res_norm["score"], 12)

    def test_4_snow_and_cold(self):
        """Freezing temperatures and snowfall presence."""
        # Freezing without snow
        freezing = {"temp": -2.0, "wind_speed": 2.0, "visibility": 10000, "weather_id": 800}
        res_freeze = _compute_trek_risk(freezing)
        self.assertEqual(res_freeze["score"], 20)
        self.assertTrue(any("Freezing temperatures" in f["label"] for f in res_freeze["factors"]))

        # Near freezing
        near_freeze = {"temp": 3.0, "wind_speed": 2.0, "visibility": 10000, "weather_id": 800}
        res_near = _compute_trek_risk(near_freeze)
        self.assertEqual(res_near["score"], 10)
        self.assertTrue(any("Near-freezing temperatures" in f["label"] for f in res_near["factors"]))

        # Snowfall present (2mm)
        snow_light = {"temp": 1.0, "wind_speed": 2.0, "visibility": 10000, "snow_1h": 2.0, "weather_id": 600}
        res_snow = _compute_trek_risk(snow_light)
        # Near freezing (+10) + Snowfall present (+15) = 25
        self.assertEqual(res_snow["score"], 25)
        self.assertTrue(any("Snowfall present" in f["label"] for f in res_snow["factors"]))

        # Heavy snowfall (6mm)
        snow_heavy = {"temp": -1.0, "wind_speed": 2.0, "visibility": 10000, "snow_1h": 6.0, "weather_id": 602}
        res_heavy = _compute_trek_risk(snow_heavy)
        # Freezing (+20) + Heavy snow (+30) = 50 -> Moderate Risk
        self.assertEqual(res_heavy["score"], 50)
        self.assertEqual(res_heavy["label"], "Moderate Risk")
        self.assertEqual(res_heavy["color"], "amber")

    def test_5_visibility(self):
        """Reduced, poor, and near-zero visibility."""
        base = {"temp": 20.0, "wind_speed": 2.0, "weather_id": 800}

        # Reduced (< 3000m)
        r_red = _compute_trek_risk({**base, "visibility": 2500})
        self.assertEqual(r_red["score"], 5)
        self.assertTrue(any("Reduced visibility" in f["label"] for f in r_red["factors"]))

        # Poor (< 1000m)
        r_poor = _compute_trek_risk({**base, "visibility": 800})
        self.assertEqual(r_poor["score"], 15)
        self.assertTrue(any("Poor visibility" in f["label"] for f in r_poor["factors"]))

        # Near-zero (< 500m)
        r_zero = _compute_trek_risk({**base, "visibility": 300})
        self.assertEqual(r_zero["score"], 25)
        self.assertTrue(any("Near-zero visibility" in f["label"] for f in r_zero["factors"]))

    def test_6_thunderstorm(self):
        """Thunderstorm condition code (OWM 2xx)."""
        weather = {"temp": 24.0, "wind_speed": 4.0, "visibility": 8000, "weather_id": 211}
        res = _compute_trek_risk(weather)
        self.assertEqual(res["score"], 35)
        self.assertEqual(res["label"], "Moderate Risk")
        self.assertEqual(res["color"], "amber")
        self.assertTrue(any("Thunderstorm active" in f["label"] for f in res["factors"]))

    def test_7_multi_severe(self):
        """Compound severe conditions: storm, rain, wind, near-zero visibility."""
        weather = {
            "temp": -2.0,          # Freezing (+20)
            "wind_speed": 20.0,     # Dangerous wind (+30)
            "rain_1h": 15.0,        # Heavy rain (+25)
            "visibility": 300,      # Near-zero vis (+25)
            "weather_id": 202,      # Thunderstorm (+35)
        }
        res = _compute_trek_risk(weather)
        # Sum = 20 + 30 + 25 + 25 + 35 = 135 -> capped at 100
        self.assertEqual(res["score"], 100)
        self.assertEqual(res["label"], "High Risk")
        self.assertEqual(res["color"], "red")
        self.assertGreaterEqual(len(res["factors"]), 4)

    def test_8_missing_data_not_safe(self):
        """Missing data MUST NOT be categorized as 'Low Risk' or 'green'."""
        # Completely empty dict
        res_empty = _compute_trek_risk({})
        self.assertNotEqual(res_empty["label"], "Low Risk")
        self.assertNotEqual(res_empty["color"], "green")
        self.assertEqual(res_empty["label"], "Incomplete Data")
        self.assertGreater(len(res_empty["factors"]), 0)

        # None input
        res_none = _compute_trek_risk(None)
        self.assertNotEqual(res_none["label"], "Low Risk")
        self.assertNotEqual(res_none["color"], "green")

        # Missing temperature and wind
        res_missing_core = _compute_trek_risk({"visibility": 10000, "weather_id": 800})
        self.assertNotEqual(res_missing_core["label"], "Low Risk")
        self.assertNotEqual(res_missing_core["color"], "green")

    def test_9_invalid_data(self):
        """Invalid types or malformed values should be safely caught without crashing."""
        malformed = {
            "temp": "freezing",
            "wind_speed": None,
            "visibility": "unknown",
            "weather_id": "thunder",
        }
        res = _compute_trek_risk(malformed)
        self.assertIsInstance(res, dict)
        self.assertNotEqual(res["label"], "Low Risk")
        self.assertEqual(res["label"], "Incomplete Data")

    def test_10_thresholds(self):
        """Exact threshold boundary values."""
        base = {"temp": 20.0, "wind_speed": 0.0, "visibility": 10000, "weather_id": 800}

        # Score boundaries: 34 vs 35 (Low vs Moderate)
        # Wind 18 m/s (+30) + Visibility 2500m (+5) = 35 -> Moderate
        res_35 = _compute_trek_risk({**base, "wind_speed": 18.0, "visibility": 2500})
        self.assertEqual(res_35["score"], 35)
        self.assertEqual(res_35["label"], "Moderate Risk")
        self.assertEqual(res_35["color"], "amber")

        # Wind boundaries: exactly 10.0 (+15) vs 9.9 (+0)
        self.assertEqual(_compute_trek_risk({**base, "wind_speed": 10.0})["score"], 15)
        self.assertEqual(_compute_trek_risk({**base, "wind_speed": 9.9})["score"], 0)

        # Wind boundaries: exactly 17.0 (+30) vs 16.9 (+15)
        self.assertEqual(_compute_trek_risk({**base, "wind_speed": 17.0})["score"], 30)
        self.assertEqual(_compute_trek_risk({**base, "wind_speed": 16.9})["score"], 15)

        # Rain boundaries: exactly 2.5 (+12) vs 2.4 (+5)
        self.assertEqual(_compute_trek_risk({**base, "rain_1h": 2.5})["score"], 12)
        self.assertEqual(_compute_trek_risk({**base, "rain_1h": 2.4})["score"], 5)

        # Rain boundaries: exactly 10.0 (+25) vs 9.9 (+12)
        self.assertEqual(_compute_trek_risk({**base, "rain_1h": 10.0})["score"], 25)
        self.assertEqual(_compute_trek_risk({**base, "rain_1h": 9.9})["score"], 12)

        # Temperature boundaries: 0°C (+20) vs 0.1°C (+10) vs 5.0°C (+10) vs 5.1°C (+0)
        self.assertEqual(_compute_trek_risk({**base, "temp": 0.0})["score"], 20)
        self.assertEqual(_compute_trek_risk({**base, "temp": 0.1})["score"], 10)
        self.assertEqual(_compute_trek_risk({**base, "temp": 5.0})["score"], 10)
        self.assertEqual(_compute_trek_risk({**base, "temp": 5.1})["score"], 0)

        # Heat boundaries: 35.0°C (+10) vs 34.9°C (+0) vs 40.0°C (+20) vs 39.9°C (+10)
        self.assertEqual(_compute_trek_risk({**base, "temp": 35.0})["score"], 10)
        self.assertEqual(_compute_trek_risk({**base, "temp": 34.9})["score"], 0)
        self.assertEqual(_compute_trek_risk({**base, "temp": 40.0})["score"], 20)
        self.assertEqual(_compute_trek_risk({**base, "temp": 39.9})["score"], 10)

        # High risk threshold: 64 vs 65
        # Thunderstorm (+35) + Dangerous wind (+30) = 65 -> High Risk
        res_65 = _compute_trek_risk({**base, "weather_id": 200, "wind_speed": 17.0})
        self.assertEqual(res_65["score"], 65)
        self.assertEqual(res_65["label"], "High Risk")
        self.assertEqual(res_65["color"], "red")

    def test_11_recovery(self):
        """Simulating a severe storm subsiding and recovering to safe/mild conditions."""
        severe = {
            "temp": 12.0,
            "wind_speed": 18.0,
            "rain_1h": 12.0,
            "visibility": 400,
            "weather_id": 211,
        }
        res_severe = _compute_trek_risk(severe)
        self.assertGreaterEqual(res_severe["score"], 65)
        self.assertEqual(res_severe["label"], "High Risk")

        # Weather improves: wind drops to 4 m/s, rain stops, visibility clears to 10km, clear skies
        recovered = {
            "temp": 20.0,
            "wind_speed": 4.0,
            "rain_1h": 0.0,
            "visibility": 10000,
            "weather_id": 800,
        }
        res_recovered = _compute_trek_risk(recovered)
        self.assertEqual(res_recovered["score"], 0)
        self.assertEqual(res_recovered["label"], "Low Risk")
        self.assertEqual(res_recovered["color"], "green")
        self.assertEqual(len(res_recovered["factors"]), 0)

    def test_12_score_category_explanation_consistency(self):
        """Invariants check across diverse weather combinations."""
        test_samples = [
            {"temp": 18.0, "wind_speed": 1.0, "visibility": 10000, "weather_id": 800},
            {"temp": -4.0, "wind_speed": 11.0, "visibility": 2000, "weather_id": 601},
            {"temp": 38.0, "wind_speed": 14.0, "visibility": 6000, "weather_id": 801},
            {"temp": 42.0, "wind_speed": 19.0, "visibility": 400, "weather_id": 212},
            {"temp": 15.0, "wind_speed": 0.0, "visibility": 900, "weather_id": 741},  # Fog
        ]
        for sample in test_samples:
            res = _compute_trek_risk(sample)
            score = res["score"]
            self.assertIsNotNone(score)
            self.assertTrue(0 <= score <= 100)

            # Category consistency
            if score >= 65:
                self.assertEqual(res["label"], "High Risk")
                self.assertEqual(res["color"], "red")
            elif score >= 35:
                self.assertEqual(res["label"], "Moderate Risk")
                self.assertEqual(res["color"], "amber")
            else:
                self.assertEqual(res["label"], "Low Risk")
                self.assertEqual(res["color"], "green")

            # Explanation consistency: factors must exist for non-zero scores
            if score > 0:
                self.assertGreater(len(res["factors"]), 0)
                for f in res["factors"]:
                    self.assertIn("label", f)
                    self.assertIn("severity", f)
                    self.assertIn(f["severity"], ["low", "medium", "high"])


if __name__ == "__main__":
    unittest.main()
