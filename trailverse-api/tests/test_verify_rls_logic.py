import unittest
import sys
import pathlib

# Ensure trailverse-api directory is in sys.path
api_dir = str(pathlib.Path(__file__).resolve().parents[1])
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from verify_rls import classify_exception, classify_select_result, extract_jwt_role

class FakeAPIError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message

class TestVerifyRLSLogic(unittest.TestCase):
    def test_42501_code_classified_as_denied(self):
        """PostgreSQL 42501 APIError must be classified as DENIED (PASS)."""
        exc = FakeAPIError(code="42501", message="insufficient privileges")
        is_denied, details = classify_exception(exc)
        self.assertTrue(is_denied, "42501 error code must be classified as DENIED")
        self.assertIn("Permission denied", details)
        self.assertIn("42501", details)

    def test_permission_denied_for_in_message_classified_as_denied(self):
        """Exception with 'permission denied for relation ...' in message must be classified as DENIED."""
        exc = Exception("permission denied for table users")
        is_denied, details = classify_exception(exc)
        self.assertTrue(is_denied, "'permission denied for' message must be classified as DENIED")
        self.assertIn("Permission denied", details)

    def test_connection_error_classified_as_error(self):
        """ConnectionError must be classified as not DENIED (ERROR/INCONCLUSIVE)."""
        exc = ConnectionError("Failed to establish a connection to host:5432")
        is_denied, details = classify_exception(exc)
        self.assertFalse(is_denied, "ConnectionError must NOT be classified as DENIED")
        self.assertEqual(details, "Exception: ConnectionError")
        # Ensure message body is not leaked in details
        self.assertNotIn("Failed to establish", details)

    def test_401_or_unauthorized_not_classified_as_denied(self):
        """HTTP 401, 403, or unauthorized messages must NOT be classified as DENIED."""
        cases = [
            FakeAPIError(code="401", message="Unauthorized: invalid JWT"),
            FakeAPIError(code="403", message="Forbidden"),
            Exception("Error 401: Unauthorized access"),
            Exception("JWT expired at 1700000000"),
            Exception("Not permitted to perform this action"),
        ]
        for exc in cases:
            with self.subTest(msg=str(exc)):
                is_denied, details = classify_exception(exc)
                self.assertFalse(is_denied, f"Exception '{exc}' must NOT be classified as DENIED")
                self.assertIn("Exception:", details)

    def test_rows_returned_classified_as_fail(self):
        """Any rows returned must be classified as DATA RETURNED (FAIL)."""
        status, details = classify_select_result([{"id": "123"}], actual_count=1)
        self.assertEqual(status, "DATA RETURNED (FAIL)")
        self.assertIn("Leaked 1 row(s)", details)

    def test_zero_rows_filtered_classified_as_pass(self):
        """0 rows returned when table has rows must be classified as FILTERED (PASS)."""
        status, details = classify_select_result([], actual_count=10)
        self.assertEqual(status, "FILTERED (PASS)")
        self.assertIn("Table has 10 rows; anon sees 0", details)

    def test_zero_rows_empty_table_classified_as_inconclusive(self):
        """0 rows returned when table is empty must be classified as EMPTY (INCONCLUSIVE)."""
        status, details = classify_select_result([], actual_count=0)
        self.assertEqual(status, "EMPTY (INCONCLUSIVE)")

    def test_jwt_role_extraction(self):
        """extract_jwt_role extracts 'role' without decoding external libs."""
        # Header: {"alg":"none"}, Payload: {"role":"anon"}
        # eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYW5vbiJ9.
        anon_jwt = "eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYW5vbiJ9."
        self.assertEqual(extract_jwt_role(anon_jwt), "anon")

        # Payload: {"role":"service_role"}
        # eyJhbGciOiJub25lIn0.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.
        srv_jwt = "eyJhbGciOiJub25lIn0.eyJyb2xlIjoic2VydmljZV9yb2xlIn0."
        self.assertEqual(extract_jwt_role(srv_jwt), "service_role")

        # Invalid token
        self.assertEqual(extract_jwt_role("invalid.token"), "")

if __name__ == "__main__":
    unittest.main()

