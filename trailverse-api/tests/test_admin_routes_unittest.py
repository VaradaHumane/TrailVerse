import os
import unittest
from unittest.mock import patch, MagicMock
import sys
import pathlib

# Ensure trailverse-api directory is in sys.path
api_dir = str(pathlib.Path(__file__).resolve().parents[1])
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

import main
from fastapi.testclient import TestClient

# Mock Supabase client so no test touches the live database
class MockSupabaseResult:
    def __init__(self, data=None):
        self.data = data if data is not None else [{"id": "test-id", "name": "Test Trek", "lat": 18.5, "lon": 73.8}]

class MockSupabaseQuery:
    def select(self, *args, **kwargs):
        return self
    def eq(self, *args, **kwargs):
        return self
    def ilike(self, *args, **kwargs):
        return self
    def update(self, *args, **kwargs):
        return self
    def insert(self, *args, **kwargs):
        return self
    def execute(self):
        return MockSupabaseResult()

class MockSupabaseClient:
    def table(self, *args, **kwargs):
        return MockSupabaseQuery()
    def rpc(self, *args, **kwargs):
        return MockSupabaseQuery()

# Apply mock to module-level clients
mock_db = MockSupabaseClient()
main.supabase = mock_db
main.supabase_admin = mock_db

TEST_ADMIN_KEY = "valid-secret-key-123"

class TestAdminRoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Reinforce mock so no test touches live database
        main.supabase = mock_db
        main.supabase_admin = mock_db
        cls.client = TestClient(main.app)

    def setUp(self):
        # Ensure mocks remain in place
        main.supabase = mock_db
        main.supabase_admin = mock_db

    # Test cases: (method, path, params, json_body)
    ADMIN_ROUTES = [
        ("GET", "/admin/treks/test-id/coordinates", None, None),
        ("PATCH", "/admin/treks/test-id/coordinates", {"lat": 18.5, "lon": 73.8}, None),
        ("POST", "/admin/treks/import", None, {"treks": []}),
        ("POST", "/admin/add-state-column", None, None),
    ]

    def _make_request(self, method: str, path: str, params=None, json_body=None, headers=None):
        if method == "GET":
            return self.client.get(path, params=params, headers=headers)
        elif method == "PATCH":
            return self.client.patch(path, params=params, json=json_body, headers=headers)
        elif method == "POST":
            return self.client.post(path, params=params, json=json_body, headers=headers)
        raise ValueError(f"Unsupported method: {method}")

    def test_key_unset_returns_503(self):
        """When ADMIN_API_KEY is unset in the environment, all admin routes must return 503."""
        with patch.dict(os.environ, {}, clear=True):
            for method, path, params, json_body in self.ADMIN_ROUTES:
                with self.subTest(route=f"{method} {path}"):
                    resp = self._make_request(
                        method, path, params=params, json_body=json_body,
                        headers={"X-Admin-Key": TEST_ADMIN_KEY}
                    )
                    self.assertEqual(
                        resp.status_code, 503,
                        f"Expected 503 for {method} {path} when ADMIN_API_KEY unset, got {resp.status_code}"
                    )

    def test_header_missing_returns_401(self):
        """When X-Admin-Key header is missing, all admin routes must return 401."""
        with patch.dict(os.environ, {"ADMIN_API_KEY": TEST_ADMIN_KEY}):
            for method, path, params, json_body in self.ADMIN_ROUTES:
                with self.subTest(route=f"{method} {path}"):
                    resp = self._make_request(method, path, params=params, json_body=json_body)
                    self.assertEqual(
                        resp.status_code, 401,
                        f"Expected 401 for {method} {path} with missing header, got {resp.status_code}"
                    )

    def test_wrong_key_returns_401(self):
        """When X-Admin-Key is incorrect, all admin routes must return 401."""
        with patch.dict(os.environ, {"ADMIN_API_KEY": TEST_ADMIN_KEY}):
            for method, path, params, json_body in self.ADMIN_ROUTES:
                with self.subTest(route=f"{method} {path}"):
                    resp = self._make_request(
                        method, path, params=params, json_body=json_body,
                        headers={"X-Admin-Key": "wrong-admin-key"}
                    )
                    self.assertEqual(
                        resp.status_code, 401,
                        f"Expected 401 for {method} {path} with wrong key, got {resp.status_code}"
                    )

    def test_non_ascii_wrong_key_returns_401(self):
        """When X-Admin-Key contains non-ASCII characters, it must return 401 (not 500)."""
        with patch.dict(os.environ, {"ADMIN_API_KEY": TEST_ADMIN_KEY}):
            for method, path, params, json_body in self.ADMIN_ROUTES:
                with self.subTest(route=f"{method} {path}"):
                    # Pass non-ASCII header as encoded utf-8 bytes
                    headers = [(b"x-admin-key", "wröng-key-🔑-admin".encode("utf-8"))]
                    resp = self._make_request(
                        method, path, params=params, json_body=json_body,
                        headers=headers
                    )
                    self.assertEqual(
                        resp.status_code, 401,
                        f"Expected 401 for {method} {path} with non-ASCII key, got {resp.status_code}"
                    )

    def test_correct_key_succeeds(self):
        """When X-Admin-Key matches ADMIN_API_KEY, routes must succeed (not 401 and not 503)."""
        with patch.dict(os.environ, {"ADMIN_API_KEY": TEST_ADMIN_KEY, "SUPABASE_SERVICE_ROLE_KEY": "dummy-srv-key"}):
            for method, path, params, json_body in self.ADMIN_ROUTES:
                with self.subTest(route=f"{method} {path}"):
                    resp = self._make_request(
                        method, path, params=params, json_body=json_body,
                        headers={"X-Admin-Key": TEST_ADMIN_KEY}
                    )
                    self.assertNotIn(
                        resp.status_code, (401, 503),
                        f"Expected non-auth status for {method} {path} with correct key, got {resp.status_code}: {resp.text}"
                    )
                    self.assertIn(resp.status_code, (200, 201, 204))

if __name__ == "__main__":
    unittest.main()
