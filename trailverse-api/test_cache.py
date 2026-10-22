"""
Unit tests for TTLCache:
- Expiry (TTL expiration)
- Eviction (max size limit, purging expired first, then oldest)
- Not-caching-errors (refusal to cache error/failed payloads)
- Weather/risk TTL constraint (<= 600s)
"""
import unittest
import time
import os
import sys

# Ensure trailverse-api is on sys.path
sys.path.insert(0, os.path.dirname(__file__))

from main import TTLCache, DEFAULT_SEARCH_TTL, WEATHER_CACHE_TTL


class TestTTLCache(unittest.TestCase):

    def setUp(self):
        self.cache = TTLCache(max_size=3, default_ttl=3600)

    def test_basic_set_and_get(self):
        """Verify successful caching and retrieval."""
        res = self.cache.set("key1", {"results": ["trek1"]})
        self.assertTrue(res)
        self.assertEqual(self.cache.get("key1"), {"results": ["trek1"]})
        self.assertIsNone(self.cache.get("nonexistent"))

    def test_ttl_expiry(self):
        """Verify items expire after specified TTL."""
        # Set item with very short TTL of 0.05s
        self.cache.set("short_lived", {"data": 123}, ttl=0.05)
        self.assertEqual(self.cache.get("short_lived"), {"data": 123})
        
        # Sleep past expiration
        time.sleep(0.08)
        self.assertIsNone(self.cache.get("short_lived"))

    def test_weather_ttl_constraint(self):
        """Verify weather cache TTL is at most 10 minutes (600s)."""
        self.assertLessEqual(WEATHER_CACHE_TTL, 600)
        self.assertEqual(WEATHER_CACHE_TTL, 600)
        
        self.cache.set("weather:19.59:73.71", {"weather": "mild"}, ttl=WEATHER_CACHE_TTL)
        self.assertIsNotNone(self.cache.get("weather:19.59:73.71"))

    def test_max_size_eviction_expired_first(self):
        """When full, cache should purge expired entries before evicting valid ones."""
        cache = TTLCache(max_size=3, default_ttl=3600)
        
        # Insert 1 item with short TTL (0.05s) and 2 items with long TTL
        cache.set("item_exp", {"val": "expires_soon"}, ttl=0.05)
        cache.set("item_long1", {"val": "keep1"}, ttl=100)
        cache.set("item_long2", {"val": "keep2"}, ttl=100)
        self.assertEqual(len(cache), 3)

        time.sleep(0.08)  # Let item_exp expire

        # Insert 4th item -> should trigger eviction and purge item_exp
        cache.set("item_new", {"val": "fresh"}, ttl=100)
        self.assertLessEqual(len(cache), 3)
        self.assertIsNone(cache.get("item_exp"))
        self.assertEqual(cache.get("item_long1"), {"val": "keep1"})
        self.assertEqual(cache.get("item_long2"), {"val": "keep2"})
        self.assertEqual(cache.get("item_new"), {"val": "fresh"})

    def test_max_size_eviction_oldest(self):
        """When all items are unexpired, evicts the oldest entry when exceeding max_size."""
        cache = TTLCache(max_size=3, default_ttl=3600)
        
        cache.set("oldest", {"val": 1})
        time.sleep(0.02)
        cache.set("middle", {"val": 2})
        time.sleep(0.02)
        cache.set("newest", {"val": 3})
        self.assertEqual(len(cache), 3)

        # Insert 4th item -> oldest must be evicted
        cache.set("incoming", {"val": 4})
        self.assertEqual(len(cache), 3)
        self.assertIsNone(cache.get("oldest"))
        self.assertEqual(cache.get("middle"), {"val": 2})
        self.assertEqual(cache.get("newest"), {"val": 3})
        self.assertEqual(cache.get("incoming"), {"val": 4})

    def test_never_cache_errors(self):
        """Verify cache rejects error payloads, failure flags, and None."""
        cache = TTLCache(max_size=5, default_ttl=3600)
        
        # 1. Reject explicit 'error' dict
        res = cache.set("err1", {"results": [], "error": "Overpass timeout"})
        self.assertFalse(res)
        self.assertIsNone(cache.get("err1"))

        # 2. Reject explicit 'failed' flag
        res = cache.set("err2", {"failed": True, "detail": "Connection reset"})
        self.assertFalse(res)
        self.assertIsNone(cache.get("err2"))

        # 3. Reject detail with 'error'
        res = cache.set("err3", {"detail": "OpenWeatherMap API error: 401 Unauthorized"})
        self.assertFalse(res)
        self.assertIsNone(cache.get("err3"))

        # 4. Reject empty_due_to_error
        res = cache.set("err4", {"results": [], "empty_due_to_error": True})
        self.assertFalse(res)
        self.assertIsNone(cache.get("err4"))

        # 5. Reject None
        res = cache.set("err5", None)
        self.assertFalse(res)
        self.assertIsNone(cache.get("err5"))

        # Valid payload must still be cached
        res_ok = cache.set("valid", {"results": [{"name": "Kalsubai"}]})
        self.assertTrue(res_ok)
        self.assertEqual(cache.get("valid"), {"results": [{"name": "Kalsubai"}]})


if __name__ == "__main__":
    unittest.main()
